import * as cp from "node:child_process";

export interface RunOptions {
  cwd?: string;
  timeout?: number;
}

// What a finished process left behind. A non-zero exit is not thrown: letsgo
// plan exits 2 for drift and still prints its JSON, so a caller decides whether
// the output is usable.
export interface RunResult {
  stdout: string;
  stderr: string;
  failed: boolean;
  message: string;
}

// The one place a process is spawned. Production uses execProcess; tests pass a
// fake, so nothing that talks to letsgo or git needs VS Code or a binary.
export type Runner = (file: string, args: readonly string[], options: RunOptions) => Promise<RunResult>;

const maxBuffer = 10 * 1024 * 1024;

export const execProcess: Runner = (file, args, options) =>
  new Promise((resolve) => {
    cp.execFile(file, [...args], { ...options, maxBuffer }, (err, stdout, stderr) => {
      resolve({ stdout, stderr, failed: err !== null, message: err?.message ?? "" });
    });
  });

// letsgo, as the extension calls it. Every spawn goes through run or output, so
// there is one error policy: output rejects with letsgo's own stderr, run hands
// back everything for the caller to judge.
export class LetsgoCli {
  constructor(
    readonly binary: string,
    private readonly runner: Runner = execProcess,
  ) {}

  run(args: readonly string[], options: RunOptions = {}): Promise<RunResult> {
    return this.runner(this.binary, args, options);
  }

  async output(args: readonly string[], options: RunOptions = {}): Promise<string> {
    const result = await this.run(args, options);
    if (result.failed) {
      throw new Error((result.stderr || result.message).trim());
    }
    return result.stdout;
  }
}
