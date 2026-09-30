import * as vscode from "vscode";
import * as path from "node:path";
import { taskArgs } from "./commands";
import { isPlanAllowed } from "./trust";
import { letsgoTask, type LetsgoTaskDefinition } from "./run";

// Backs the `letsgo` task type in tasks.json. It resolves a task into a
// process with an argument vector, and resolves nothing in an untrusted
// workspace: a task runs letsgo, which runs what the repository chose.
export class LetsgoTaskProvider implements vscode.TaskProvider {
  constructor(private readonly binary: () => string | undefined) {}

  provideTasks(): vscode.Task[] {
    return [];
  }

  resolveTask(task: vscode.Task): vscode.Task | undefined {
    if (!isPlanAllowed(vscode.workspace.isTrusted)) {
      return undefined;
    }
    const definition = task.definition as LetsgoTaskDefinition;
    const args = taskArgs(definition.command, definition.args);
    const binary = this.binary();
    if (!args || !binary) {
      return undefined;
    }
    const folder = vscode.workspace.workspaceFolders?.[0];
    const cwd = folder ? path.resolve(folder.uri.fsPath) : process.cwd();
    return letsgoTask(binary, definition, args, cwd, task.name);
  }
}
