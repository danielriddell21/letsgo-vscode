import * as vscode from "vscode";
import type { TreeNode } from "./planTree";

// The panel's tree, fed by whatever the last refresh produced. Kept apart from
// planTree.ts, which builds the nodes without touching the editor API and so
// runs under plain node in the unit tests.
export class LetsgoTreeProvider implements vscode.TreeDataProvider<TreeNode> {
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
