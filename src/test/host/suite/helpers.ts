import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

export const EXTENSION_ID = "letsgo.letsgo-vscode";

export interface Invocation {
  args: string[];
  cwd: string;
}

export function workspaceDir(): string {
  const dir = process.env.LETSGO_HOST_WORKSPACE;
  if (!dir) {
    throw new Error("LETSGO_HOST_WORKSPACE is not set");
  }
  return dir;
}

// Every call the fake letsgo has seen so far, oldest first.
export function invocations(): Invocation[] {
  const log = process.env.LETSGO_FAKE_LOG;
  if (!log) {
    throw new Error("LETSGO_FAKE_LOG is not set");
  }
  return fs
    .readFileSync(log, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as Invocation);
}

export function calls(first: string): Invocation[] {
  return invocations().filter((i) => i.args[0] === first);
}

export async function waitFor<T>(what: string, probe: () => T | undefined | false, timeoutMs = 20_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = probe();
    if (value) {
      return value;
    }
    if (Date.now() > deadline) {
      throw new Error(`timed out waiting for ${what}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function activate(): Promise<vscode.Extension<unknown>> {
  const extension = vscode.extensions.getExtension(EXTENSION_ID);
  if (!extension) {
    throw new Error(`${EXTENSION_ID} is not installed in the test host`);
  }
  await extension.activate();
  return extension;
}

export function fixtureUri(...parts: string[]): vscode.Uri {
  return vscode.Uri.file(path.join(workspaceDir(), ...parts));
}
