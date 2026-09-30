import * as vscode from "vscode";
import * as cp from "node:child_process";
import {
  BUILD_SNAPSHOT_ARGS,
  INSTALL_PLUGINS_ARGS,
  REHEARSE_ARGS,
  UPDATE_ARGS,
  UPDATE_CHECK_ARGS,
  diffArgs,
} from "./commands";
import { runInPanel } from "./run";
import { isPlanAllowed } from "./trust";
import { INSTALL_PLUGINS, type Feature } from "./version";

export interface PaletteDeps {
  // A usable letsgo for the feature, or undefined once the person has been told why not.
  usable: (feature?: Feature) => Promise<string | undefined>;
  pickModuleDir: () => Promise<string | undefined>;
  refresh: (analyse: boolean) => void;
  output: vscode.OutputChannel;
}

function capture(binary: string, args: readonly string[], cwd: string): Promise<{ text: string; failed: boolean }> {
  return new Promise((resolve) => {
    cp.execFile(binary, [...args], { cwd, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ text: (stdout || stderr || err?.message || "").trim(), failed: err !== null });
    });
  });
}

// Everything but Update runs letsgo in a module, and letsgo runs what the
// repository chose (plugins, git, go), so an untrusted workspace gets none of it.
function trusted(what: string): boolean {
  if (isPlanAllowed(vscode.workspace.isTrusted)) {
    return true;
  }
  void vscode.window.showWarningMessage(`${what} runs code the repository chooses; trust this workspace first.`);
  return false;
}

async function inModule(deps: PaletteDeps, what: string, feature?: Feature): Promise<{ binary: string; dir: string } | undefined> {
  if (!trusted(what)) {
    return undefined;
  }
  const binary = await deps.usable(feature);
  const dir = binary ? await deps.pickModuleDir() : undefined;
  return binary && dir ? { binary, dir } : undefined;
}

function runner(deps: PaletteDeps, name: string, args: readonly string[], feature?: Feature) {
  return async (): Promise<void> => {
    const target = await inModule(deps, name, feature);
    if (target) {
      await runInPanel(name, target.binary, [...args], target.dir);
    }
  };
}

// Diff releases: two sides, each a tag or a letsgo.json path, shown in a
// read-only document rather than a terminal so it can be read and searched.
async function diffReleases(deps: PaletteDeps): Promise<void> {
  const target = await inModule(deps, "letsgo diff");
  if (!target) {
    return;
  }
  const from = await vscode.window.showInputBox({ prompt: "Compare from: a tag or a letsgo.json path", placeHolder: "v1.1.0" });
  if (!from) {
    return;
  }
  const to = await vscode.window.showInputBox({ prompt: "Compare to (empty: the latest release)", placeHolder: "v1.2.0" });
  if (to === undefined) {
    return;
  }
  const args = diffArgs(from, to);
  if (!args) {
    void vscode.window.showWarningMessage("letsgo can only diff release tags and letsgo.json paths.");
    return;
  }
  const result = await capture(target.binary, args, target.dir);
  deps.output.appendLine(`${target.binary} ${args.join(" ")}${result.failed ? " failed" : ""}`);
  const doc = await vscode.workspace.openTextDocument({ content: result.text, language: "plaintext" });
  await vscode.window.showTextDocument(doc, { preview: true });
}

// Update letsgo: ask what is available first, install only on a yes. It is the
// one command that changes the binary itself, so it never runs unprompted.
async function updateLetsgo(deps: PaletteDeps): Promise<void> {
  const binary = await deps.usable();
  if (!binary) {
    return;
  }
  const check = await capture(binary, UPDATE_CHECK_ARGS, process.cwd());
  if (check.failed) {
    void vscode.window.showWarningMessage(`letsgo update --check failed: ${check.text}`);
    return;
  }
  const install = "Update";
  const answer = await vscode.window.showInformationMessage(check.text || "letsgo is up to date.", install);
  if (answer === install) {
    await runInPanel("update letsgo", binary, [...UPDATE_ARGS], process.cwd());
  }
}

export function registerPaletteCommands(deps: PaletteDeps): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand("letsgo.planAnalyse", () => {
      if (trusted("letsgo plan --analyse")) {
        deps.refresh(true);
      }
    }),
    vscode.commands.registerCommand("letsgo.buildSnapshot", runner(deps, "letsgo build snapshot", BUILD_SNAPSHOT_ARGS)),
    vscode.commands.registerCommand("letsgo.rehearse", runner(deps, "letsgo release rehearsal", REHEARSE_ARGS)),
    vscode.commands.registerCommand("letsgo.installPlugins", runner(deps, "letsgo plugin install", INSTALL_PLUGINS_ARGS, INSTALL_PLUGINS)),
    vscode.commands.registerCommand("letsgo.diff", () => diffReleases(deps)),
    vscode.commands.registerCommand("letsgo.update", () => updateLetsgo(deps)),
  ];
}
