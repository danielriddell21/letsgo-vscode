import * as vscode from "vscode";

// Runs a program with an argument vector, no shell in between, and shows its
// output in the terminal panel. Every argument that came from a file or from
// letsgo's own output goes through here rather than into a command line.
export async function runInPanel(name: string, program: string, args: string[], cwd: string): Promise<void> {
  const task = new vscode.Task(
    { type: "letsgo", task: name },
    vscode.TaskScope.Workspace,
    name,
    "letsgo",
    new vscode.ProcessExecution(program, args, { cwd }),
  );
  await vscode.tasks.executeTask(task);
}
