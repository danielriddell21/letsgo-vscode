import * as vscode from "vscode";

// Task definition shared with package.json's `letsgo` task type: a letsgo
// subcommand and its arguments, run without a shell.
export interface LetsgoTaskDefinition extends vscode.TaskDefinition {
  command: string;
  args?: string[];
}

export const PROBLEM_MATCHER = "$letsgo";

export function letsgoTask(
  binary: string,
  definition: LetsgoTaskDefinition,
  args: readonly string[],
  cwd: string,
  name: string,
): vscode.Task {
  const task = new vscode.Task(
    definition,
    vscode.TaskScope.Workspace,
    name,
    "letsgo",
    new vscode.ProcessExecution(binary, [...args], { cwd }),
    [PROBLEM_MATCHER],
  );
  return task;
}

// Runs a program with an argument vector, no shell in between, and shows its
// output in the terminal panel. Every argument that came from a file or from
// letsgo's own output goes through here rather than into a command line.
export async function runInPanel(name: string, program: string, args: string[], cwd: string): Promise<void> {
  const task = new vscode.Task(
    { type: "letsgo", command: args[0] ?? "", args: args.slice(1) } satisfies LetsgoTaskDefinition,
    vscode.TaskScope.Workspace,
    name,
    "letsgo",
    new vscode.ProcessExecution(program, args, { cwd }),
    [PROBLEM_MATCHER],
  );
  await vscode.tasks.executeTask(task);
}
