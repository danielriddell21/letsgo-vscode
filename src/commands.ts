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
