import * as vscode from "vscode";
import * as cp from "node:child_process";
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
import { planArgs, planProblems } from "./commands";
import { debounce } from "./debounce";
import { resolvePos } from "./position";
import { findGit, parseTags } from "./releases";
import { watchedGlobs } from "./watch";
import { registerPaletteCommands } from "./paletteCommands";
import { LetsgoTaskProvider } from "./taskProvider";
import { tagNextVersion } from "./tagCommand";
import { findModules } from "./modules";
import { parsePlan, type PlanResult, type Pos } from "./plan";
import { buildModuleTree, errorNode, type TreeNode } from "./planTree";
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

function runPlanJSON(binary: string, cwd: string, analyse: boolean): Promise<PlanResult> {
  return new Promise((resolve, reject) => {
    cp.execFile(binary, planArgs(analyse), { cwd, maxBuffer: 10 * 1024 * 1024, timeout: planTimeoutMs }, (err, stdout, stderr) => {
      if (stdout) {
        try {
          resolve(parsePlan(stdout));
        } catch (parseErr) {
          reject(parseErr);
        }
        return;
      }
      reject(err ?? new Error(stderr || "letsgo plan produced no output"));
    });
  });
}

class LetsgoTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly emitter = new vscode.EventEmitter<TreeNode | undefined | void>();
  readonly onDidChangeTreeData = this.emitter.event;
  private roots: TreeNode[] = [];

  refresh(roots: TreeNode[]): void {
    this.roots = roots;
    this.emitter.fire();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    const collapsible =
      element.children && element.children.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None;
    const item = new vscode.TreeItem(element.label, collapsible);
    item.description = element.description;
    item.tooltip = element.detail ?? element.label;
    item.contextValue = element.kind;
    if (element.pos && element.dir) {
      item.command = { command: "letsgo.openPosition", title: "Open", arguments: [element.dir, element.pos] };
    }
    if (element.status === "fail") {
      item.iconPath = new vscode.ThemeIcon("error");
    } else if (element.status === "warn") {
      item.iconPath = new vscode.ThemeIcon("warning");
    }
    return item;
  }

  getChildren(element?: TreeNode): TreeNode[] {
    if (!element) {
      return this.roots;
    }
    return element.children ?? [];
  }
}

const lastPlans = new Map<string, PlanResult>();

async function refresh(
  provider: LetsgoTreeProvider,
  statusBarItem: vscode.StatusBarItem,
  outputChannel: vscode.OutputChannel,
  problems: vscode.DiagnosticCollection,
  analyse: boolean,
): Promise<void> {
  problems.clear();
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

  const version = await probeVersion(binary);
  if (version !== undefined && !isAvailable(PLAN_JSON, version)) {
    const message = outdatedMessage(version, unavailable(version));
    provider.refresh(modules.map((m) => errorNode(m.label, message)));
    statusBarItem.text = "$(warning) letsgo: outdated";
    statusBarItem.tooltip = message;
    statusBarItem.show();
    return;
  }

  const { nodes, plans, stale } = await planModules(modules, binary, analyse, problems, outputChannel);

  provider.refresh(nodes);
  const summary = stale ? markStale(summarize(plans)) : summarize(plans);
  statusBarItem.text = summary.text;
  statusBarItem.tooltip = summary.tooltip;
  statusBarItem.show();
}

// Checks that name a line of config land in Problems and as squiggles there.
function publishProblems(collection: vscode.DiagnosticCollection, plan: PlanResult, dir: string): void {
  const byFile = new Map<string, vscode.Diagnostic[]>();
  for (const p of planProblems(plan, dir)) {
    const at = new vscode.Position(p.line - 1, p.col - 1);
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(at, at.translate(0, 1)),
      p.message,
      p.severity === "error" ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning,
    );
    diagnostic.source = "letsgo plan";
    byFile.set(p.file, [...(byFile.get(p.file) ?? []), diagnostic]);
  }
  for (const [file, diagnostics] of byFile) {
    collection.set(vscode.Uri.file(file), diagnostics);
  }
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
  problems: vscode.DiagnosticCollection,
  outputChannel: vscode.OutputChannel,
): Promise<PlannedModules> {
  const settled = await Promise.all(
    modules.map(async (m) => {
      try {
        const plan = await runPlanJSON(binary, m.dir, analyse);
        lastPlans.set(m.dir, plan);
        publishProblems(problems, plan, m.dir);
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
function pickRelease(cwd: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const git = findGit(fileExists);
    if (!git) {
      void Promise.resolve(vscode.window.showInputBox({ prompt: "Tag to verify, e.g. v1.2.0" })).then(resolve);
      return;
    }
    cp.execFile(git, ["tag", "--list", "--sort=-v:refname"], { cwd, timeout: 10_000 }, (err, stdout) => {
      const tags = err ? [] : parseTags(stdout, 30);
      if (tags.length === 0) {
        void Promise.resolve(vscode.window.showInputBox({ prompt: "Tag to verify, e.g. v1.2.0" })).then(resolve);
        return;
      }
      void Promise.resolve(vscode.window.showQuickPick(tags, { placeHolder: "Release to verify" })).then(resolve);
    });
  });
}

export function activate(context: vscode.ExtensionContext): void {
  const provider = new LetsgoTreeProvider();
  context.subscriptions.push(vscode.window.createTreeView("letsgoModules", { treeDataProvider: provider }));

  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  context.subscriptions.push(statusBarItem);

  const outputChannel = vscode.window.createOutputChannel("letsgo");
  context.subscriptions.push(outputChannel);

  const problems = vscode.languages.createDiagnosticCollection("letsgo plan");
  context.subscriptions.push(problems);

  const languageClient = new LetsgoLanguageClient(configuredBinary, outputChannel);
  context.subscriptions.push(languageClient);
  const restartLanguageServer = (): void => {
    void languageClient.restart();
  };

  // Tag and Verify need a letsgo with --json on tag and verify; an unknown
  // version is assumed to have it, the same as everywhere else.
  const usable = async (feature: Feature = TAG_VERIFY): Promise<string | undefined> => {
    const binary = configuredBinary();
    if (!binary) {
      void vscode.window.showWarningMessage("letsgo was not found; install it or set letsgo.path.");
      return undefined;
    }
    const version = await probeVersion(binary);
    if (version !== undefined && !isAvailable(feature, version)) {
      void vscode.window.showWarningMessage(outdatedMessage(version, unavailable(version)));
      return undefined;
    }
    return binary;
  };

  const pickModuleDir = async (): Promise<string | undefined> => {
    const folders = vscode.workspace.workspaceFolders ?? [];
    const modules = findModules(
      folders.map((f) => ({ name: f.name, fsPath: f.uri.fsPath })),
      hasLetsgoMod,
    );
    if (modules.length <= 1) {
      return modules[0]?.dir;
    }
    return (await vscode.window.showQuickPick(modules.map((m) => ({ label: m.label, dir: m.dir }))))?.dir;
  };

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

  const doRefresh = (analyse = false): void => {
    void refresh(provider, statusBarItem, outputChannel, problems, analyse);
  };
  const scheduleRefresh = debounce(() => doRefresh(), 500);

  context.subscriptions.push(
    vscode.tasks.registerTaskProvider("letsgo", new LetsgoTaskProvider(configuredBinary)),
    ...registerPaletteCommands({ usable, pickModuleDir, refresh: doRefresh, output: outputChannel }),
    vscode.commands.registerCommand("letsgo.refresh", () => doRefresh()),
    vscode.workspace.onDidGrantWorkspaceTrust(() => {
      doRefresh();
      restartLanguageServer();
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => doRefresh()),
  );
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    for (const glob of watchedGlobs) {
      const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, glob));
      context.subscriptions.push(
        watcher,
        watcher.onDidChange(scheduleRefresh),
        watcher.onDidCreate(scheduleRefresh),
        watcher.onDidDelete(scheduleRefresh),
      );
    }
  }
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

  doRefresh();
  restartLanguageServer();
}

export function deactivate(): void {
  // Everything is disposed through context.subscriptions.
}
