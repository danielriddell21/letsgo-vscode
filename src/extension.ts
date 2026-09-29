import * as vscode from "vscode";
import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveBinary } from "./binary";
import { LetsgoLanguageClient } from "./client";
import { findModules } from "./modules";
import { parsePlan, type PlanResult } from "./plan";
import { buildModuleTree, errorNode, type TreeNode } from "./planTree";
import { summarize } from "./statusBar";
import { isPlanAllowed } from "./trust";

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

function runPlanJSON(binary: string, cwd: string): Promise<PlanResult> {
  return new Promise((resolve, reject) => {
    cp.execFile(binary, ["plan", "--json"], { cwd, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
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

async function refresh(
  provider: LetsgoTreeProvider,
  statusBarItem: vscode.StatusBarItem,
  outputChannel: vscode.OutputChannel,
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

  const nodes: TreeNode[] = [];
  const plans: PlanResult[] = [];
  for (const m of modules) {
    try {
      const plan = await runPlanJSON(binary, m.dir);
      plans.push(plan);
      nodes.push(buildModuleTree(m.label, plan));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      nodes.push(errorNode(m.label, message));
      outputChannel.appendLine(`letsgo plan --json failed in ${m.dir}: ${message}`);
    }
  }

  provider.refresh(nodes);
  const summary = summarize(plans);
  statusBarItem.text = summary.text;
  statusBarItem.tooltip = summary.tooltip;
  statusBarItem.show();
}

function configuredBinary(): string | undefined {
  const configured = vscode.workspace.getConfiguration("letsgo").get<string>("path") || undefined;
  return resolveBinary(configured, process.env, fileExists);
}

export function activate(context: vscode.ExtensionContext): void {
  const provider = new LetsgoTreeProvider();
  context.subscriptions.push(vscode.window.createTreeView("letsgoModules", { treeDataProvider: provider }));

  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  context.subscriptions.push(statusBarItem);

  const outputChannel = vscode.window.createOutputChannel("letsgo");
  context.subscriptions.push(outputChannel);

  const languageClient = new LetsgoLanguageClient(configuredBinary, outputChannel);
  context.subscriptions.push(languageClient);
  const restartLanguageServer = (): void => {
    void languageClient.restart();
  };

  const doRefresh = (): void => {
    void refresh(provider, statusBarItem, outputChannel);
  };

  context.subscriptions.push(vscode.commands.registerCommand("letsgo.refresh", doRefresh));
  context.subscriptions.push(
    vscode.workspace.onDidGrantWorkspaceTrust(() => {
      doRefresh();
      restartLanguageServer();
    }),
  );
  context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(doRefresh));
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.fileName.endsWith("letsgo.mod")) {
        doRefresh();
      }
    }),
  );
  context.subscriptions.push(
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

export function deactivate(): void {}
