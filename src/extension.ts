import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveBinary } from "./binary";
import { LetsgoLanguageClient } from "./client";
import {
  MANIFEST_SELECTOR,
  MANIFEST_VIEW_TYPE,
  ManifestEditorProvider,
  ManifestLensProvider,
  verifyRelease,
} from "./manifestViewer";
import { planArgs } from "./commands";
import { debounce } from "./debounce";
import { resolvePos } from "./position";
import { LetsgoCli, execProcess } from "./cli";
import { findGit, parseTags } from "./releases";
import { watchedGlobs } from "./watch";
import { registerPaletteCommands } from "./paletteCommands";
import { LetsgoTaskProvider } from "./taskProvider";
import { tagNextVersion } from "./tagCommand";
import { findModules } from "./modules";
import { parsePlan, type PlanResult, type Pos } from "./plan";
import { buildModuleTree, errorNode, type TreeNode } from "./planTree";
import { LetsgoTreeProvider } from "./treeProvider";
import { markStale, summarize } from "./statusBar";
import { isPlanAllowed } from "./trust";
import { PLAN_JSON, TAG_VERIFY, isAvailable, outdatedMessage, probeVersion, unavailable, type Feature } from "./version";

function fileExists(candidate: string): boolean {
  try {
    fs.accessSync(candidate, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function hasLetsgoMod(dir: string): boolean {
  return fs.existsSync(path.join(dir, "letsgo.mod"));
}

const planTimeoutMs = 60_000;

async function runPlanJSON(binary: string, cwd: string, analyse: boolean): Promise<PlanResult> {
  const result = await new LetsgoCli(binary).run(planArgs(analyse), { cwd, timeout: planTimeoutMs });
  if (result.stdout) {
    return parsePlan(result.stdout);
  }
  throw new Error(result.stderr || result.message || "letsgo plan produced no output");
}

const lastPlans = new Map<string, PlanResult>();

async function refresh(
  provider: LetsgoTreeProvider,
  statusBarItem: vscode.StatusBarItem,
  outputChannel: vscode.OutputChannel,
  analyse: boolean,
): Promise<void> {
  if (!isPlanAllowed(vscode.workspace.isTrusted)) {
    provider.refresh([]);
    statusBarItem.text = "$(shield) letsgo";
    statusBarItem.tooltip = "Workspace is untrusted; letsgo is not running.";
    statusBarItem.show();
    return;
  }

  const folders = vscode.workspace.workspaceFolders ?? [];
  const modules = findModules(
    folders.map((f) => ({ name: f.name, fsPath: f.uri.fsPath })),
    hasLetsgoMod,
  );

  if (modules.length === 0) {
    provider.refresh([]);
    statusBarItem.hide();
    return;
  }

  const configured = vscode.workspace.getConfiguration("letsgo").get<string>("path") || undefined;
  const binary = resolveBinary(configured, process.env, fileExists);
  if (!binary) {
    provider.refresh(modules.map((m) => errorNode(m.label, "letsgo binary not found")));
    statusBarItem.text = "$(error) letsgo: not found";
    statusBarItem.tooltip = "letsgo binary not found on PATH or letsgo.path";
    statusBarItem.show();
    return;
  }

  const version = await probeVersion(new LetsgoCli(binary));
  if (version !== undefined && !isAvailable(PLAN_JSON, version)) {
    const message = outdatedMessage(version, unavailable(version));
    provider.refresh(modules.map((m) => errorNode(m.label, message)));
    statusBarItem.text = "$(warning) letsgo: outdated";
    statusBarItem.tooltip = message;
    statusBarItem.show();
    return;
  }

  const { nodes, plans, stale } = await planModules(modules, binary, analyse, outputChannel);

  provider.refresh(nodes);
  const summary = stale ? markStale(summarize(plans)) : summarize(plans);
  statusBarItem.text = summary.text;
  statusBarItem.tooltip = summary.tooltip;
  statusBarItem.show();
}

function configuredBinary(): string | undefined {
  const configured = vscode.workspace.getConfiguration("letsgo").get<string>("path") || undefined;
  return resolveBinary(configured, process.env, fileExists);
}

interface PlannedModules {
  nodes: TreeNode[];
  plans: PlanResult[];
  stale: boolean;
}

// planModules runs `letsgo plan --json` in every module. A module whose plan
// fails keeps its last good result, marked stale, so the panel does not go
// blank on a transient error.
async function planModules(
  modules: { label: string; dir: string }[],
  binary: string,
  analyse: boolean,
  outputChannel: vscode.OutputChannel,
): Promise<PlannedModules> {
  const settled = await Promise.all(
    modules.map(async (m) => {
      try {
        const plan = await runPlanJSON(binary, m.dir, analyse);
        lastPlans.set(m.dir, plan);
        return { plan, node: buildModuleTree(m.label, plan, { dir: m.dir }), stale: false };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`letsgo plan --json failed in ${m.dir}: ${message}`);
        const previous = lastPlans.get(m.dir);
        if (!previous) {
          return { plan: undefined, node: errorNode(m.label, message), stale: false };
        }
        return { plan: previous, node: buildModuleTree(m.label, previous, { dir: m.dir, stale: true }), stale: true };
      }
    }),
  );
  return {
    nodes: settled.map((r) => r.node),
    plans: settled.flatMap((r) => (r.plan ? [r.plan] : [])),
    stale: settled.some((r) => r.stale),
  };
}

// pickRelease offers the module's tags newest first, falling back to typing
// one when git can't list them.
async function pickRelease(cwd: string): Promise<string | undefined> {
  const git = findGit(fileExists);
  const listed = git ? await execProcess(git, ["tag", "--list", "--sort=-v:refname"], { cwd, timeout: 10_000 }) : undefined;
  const tags = listed && !listed.failed ? parseTags(listed.stdout, 30) : [];
  if (tags.length === 0) {
    return vscode.window.showInputBox({ prompt: "Tag to verify, e.g. v1.2.0" });
  }
  return vscode.window.showQuickPick(tags, { placeHolder: "Release to verify" });
}

// The editor surfaces activate wires up, handed to the helpers that register
// commands so each takes one argument rather than a list of them.
interface Surfaces {
  provider: LetsgoTreeProvider;
  statusBarItem: vscode.StatusBarItem;
  outputChannel: vscode.OutputChannel;
}

export function activate(context: vscode.ExtensionContext): void {
  const surfaces = createSurfaces(context);
  const languageClient = new LetsgoLanguageClient(configuredBinary, surfaces.outputChannel);
  context.subscriptions.push(languageClient);
  const restartLanguageServer = (): void => {
    void languageClient.restart();
  };

  const doRefresh = (analyse = false): void => {
    void refresh(surfaces.provider, surfaces.statusBarItem, surfaces.outputChannel, analyse);
  };
  registerTagAndVerify(context, surfaces.outputChannel, doRefresh);
  registerRefreshing(context, surfaces.outputChannel, doRefresh, restartLanguageServer);
  registerWatchers(context, debounce(() => doRefresh(), 500));
  registerOpenPosition(context, doRefresh, restartLanguageServer);

  doRefresh();
  restartLanguageServer();
}

// createSurfaces makes the panel, the status bar item and the output channel,
// and has the context dispose them.
function createSurfaces(context: vscode.ExtensionContext): Surfaces {
  const provider = new LetsgoTreeProvider();
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  const outputChannel = vscode.window.createOutputChannel("letsgo");
  context.subscriptions.push(
    vscode.window.createTreeView("letsgoModules", { treeDataProvider: provider }),
    statusBarItem,
    outputChannel,
  );
  return { provider, statusBarItem, outputChannel };
}

// usable returns the letsgo binary when it is there and recent enough for
// feature, warning the user when it is not. Tag and Verify need a letsgo with
// --json on tag and verify; an unknown version is assumed to have it, the same
// as everywhere else.
async function usable(feature: Feature = TAG_VERIFY): Promise<string | undefined> {
  const binary = configuredBinary();
  if (!binary) {
    void vscode.window.showWarningMessage("letsgo was not found; install it or set letsgo.path.");
    return undefined;
  }
  const version = await probeVersion(new LetsgoCli(binary));
  if (version !== undefined && !isAvailable(feature, version)) {
    void vscode.window.showWarningMessage(outdatedMessage(version, unavailable(version)));
    return undefined;
  }
  return binary;
}

// pickModuleDir is the one module in the workspace, or the one the user picks.
async function pickModuleDir(): Promise<string | undefined> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const modules = findModules(
    folders.map((f) => ({ name: f.name, fsPath: f.uri.fsPath })),
    hasLetsgoMod,
  );
  if (modules.length <= 1) {
    return modules[0]?.dir;
  }
  return (await vscode.window.showQuickPick(modules.map((m) => ({ label: m.label, dir: m.dir }))))?.dir;
}

function registerTagAndVerify(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  doRefresh: () => void,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("letsgo.tag", async () => {
      if (!isPlanAllowed(vscode.workspace.isTrusted)) {
        void vscode.window.showWarningMessage("letsgo tag runs git and go; trust this workspace first.");
        return;
      }
      const binary = await usable();
      const dir = binary ? await pickModuleDir() : undefined;
      if (binary && dir) {
        await tagNextVersion(binary, dir, outputChannel);
        doRefresh();
      }
    }),
    vscode.commands.registerCommand("letsgo.verify", async (tag?: string, dir?: string) => {
      const binary = await usable();
      const cwd = dir ?? (await pickModuleDir());
      const ref = tag ?? (cwd ? await pickRelease(cwd) : undefined);
      if (binary && cwd && ref) {
        await verifyRelease(binary, ref, cwd, vscode.workspace.isTrusted);
      }
    }),
    vscode.window.registerCustomEditorProvider(MANIFEST_VIEW_TYPE, new ManifestEditorProvider(configuredBinary)),
    vscode.languages.registerCodeLensProvider(MANIFEST_SELECTOR, new ManifestLensProvider()),
  );
}

// registerRefreshing registers what runs letsgo and shows the answer: tasks,
// the palette commands, the refresh command, and the events that call for one.
function registerRefreshing(
  context: vscode.ExtensionContext,
  output: vscode.OutputChannel,
  doRefresh: (analyse?: boolean) => void,
  restartLanguageServer: () => void,
): void {
  context.subscriptions.push(
    vscode.tasks.registerTaskProvider("letsgo", new LetsgoTaskProvider(configuredBinary)),
    ...registerPaletteCommands({ usable, pickModuleDir, refresh: doRefresh, output }),
    vscode.commands.registerCommand("letsgo.refresh", () => doRefresh()),
    vscode.workspace.onDidGrantWorkspaceTrust(() => {
      doRefresh();
      restartLanguageServer();
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => doRefresh()),
  );
}

// registerWatchers calls onChange when a file letsgo reads changes.
function registerWatchers(context: vscode.ExtensionContext, onChange: () => void): void {
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    for (const glob of watchedGlobs) {
      const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, glob));
      context.subscriptions.push(
        watcher,
        watcher.onDidChange(onChange),
        watcher.onDidCreate(onChange),
        watcher.onDidDelete(onChange),
      );
    }
  }
}

// registerOpenPosition registers the command a panel row runs to open the line
// a check names, and the reaction to letsgo.path changing.
function registerOpenPosition(
  context: vscode.ExtensionContext,
  doRefresh: () => void,
  restartLanguageServer: () => void,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("letsgo.openPosition", async (dir: string, pos: Pos) => {
      const target = resolvePos(dir, pos);
      const at = new vscode.Position(target.line, target.col);
      await vscode.window.showTextDocument(vscode.Uri.file(target.file), { selection: new vscode.Range(at, at) });
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("letsgo.path")) {
        doRefresh();
        restartLanguageServer();
      }
    }),
  );
}

export function deactivate(): void {
  // Everything is disposed through context.subscriptions.
}
