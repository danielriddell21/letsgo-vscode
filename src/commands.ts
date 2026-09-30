import type { Check, PlanResult } from "./plan";
import { isSafeTag } from "./manifest";

// The arguments each palette command hands to letsgo. Every one is a fixed
// vector: nothing from a file or from letsgo's own output is ever joined into a
// command line.
export const BUILD_SNAPSHOT_ARGS: readonly string[] = ["build", "--snapshot"];
// A rehearsal never publishes: --snapshot is what keeps `release` from writing
// to the forge, so it is part of the vector rather than an option.
export const REHEARSE_ARGS: readonly string[] = ["release", "--snapshot"];
export const INSTALL_PLUGINS_ARGS: readonly string[] = ["plugin", "install"];
export const UPDATE_CHECK_ARGS: readonly string[] = ["update", "--check"];
export const UPDATE_ARGS: readonly string[] = ["update", "--yes"];

export function planArgs(analyse: boolean): string[] {
  return analyse ? ["plan", "--json", "--analyse"] : ["plan", "--json"];
}

// A side of `letsgo diff` is a release tag or the path to a letsgo.json.
export function isDiffSide(side: string): boolean {
  return isSafeTag(side) || /^[A-Za-z0-9._/\\:~-]+\.json$/.test(side);
}

export function diffArgs(from: string, to?: string): string[] | undefined {
  if (!isDiffSide(from) || (to !== undefined && to !== "" && !isDiffSide(to))) {
    return undefined;
  }
  return to ? ["diff", from, to] : ["diff", from];
}

// What a `letsgo` task in tasks.json may run. The task type is a convenience
// for CI-like runs, not a way to publish: a real `release` is refused, so the
// extension keeps its promise never to publish from the editor.
const TASK_COMMANDS: ReadonlySet<string> = new Set([
  "plan",
  "build",
  "release",
  "verify",
  "diff",
  "doctor",
  "features",
  "audit",
  "plugin",
]);

export function taskArgs(command: string, args: readonly string[] = []): string[] | undefined {
  if (!TASK_COMMANDS.has(command)) {
    return undefined;
  }
  if (command === "release" && !args.includes("--snapshot")) {
    return undefined;
  }
  return [command, ...args];
}

export interface Problem {
  file: string;
  line: number;
  col: number;
  message: string;
  severity: "error" | "warning";
}

function isAbsolute(file: string): boolean {
  return file.startsWith("/") || /^[A-Za-z]:[\\/]/.test(file);
}

// Checks that point at a line of config become diagnostics there, so "the
// budget is wrong" is a squiggle under the budget. A file letsgo reports
// relative to the module is resolved against the module's directory.
export function planProblems(plan: PlanResult, moduleDir: string): Problem[] {
  const out: Problem[] = [];
  for (const check of plan.checks) {
    const problem = problemFor(check, moduleDir);
    if (problem) {
      out.push(problem);
    }
  }
  return out;
}

function problemFor(check: Check, moduleDir: string): Problem | undefined {
  if (!check.pos || (check.status !== "fail" && check.status !== "warn")) {
    return undefined;
  }
  const file = isAbsolute(check.pos.file) ? check.pos.file : `${moduleDir.replace(/[\\/]$/, "")}/${check.pos.file}`;
  return {
    file,
    line: Math.max(check.pos.line, 1),
    col: Math.max(check.pos.col, 1),
    message: check.detail ? `${check.name}: ${check.detail}` : check.name,
    severity: check.status === "fail" ? "error" : "warning",
  };
}
