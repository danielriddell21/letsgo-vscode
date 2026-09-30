import * as cp from "node:child_process";

// A letsgo feature this extension leans on, and the first release that has it.
export interface Feature {
  name: string;
  minVersion: string;
}

export const PLAN_JSON: Feature = { name: "the module panel and status bar (letsgo plan --json)", minVersion: "0.29.0" };
export const TAG_VERIFY: Feature = { name: "the Tag and Verify commands (--json)", minVersion: "0.29.0" };
export const LSP: Feature = { name: "letsgo.mod language features (letsgo lsp)", minVersion: "0.30.0" };
export const INSTALL_PLUGINS: Feature = { name: "the Install pinned plugins command (letsgo plugin install)", minVersion: "0.29.0" };
export const UPDATE_PIN: Feature = { name: "the Update pin quick fix", minVersion: "0.31.0" };

export const FEATURES: readonly Feature[] = [PLAN_JSON, TAG_VERIFY, INSTALL_PLUGINS, LSP, UPDATE_PIN];

// `letsgo version` prints "letsgo <version>": a release like v0.30.1, or "dev"
// for a build with no version stamped in. Only a release gives a number to
// compare, so anything else reads as unknown.
export function parseVersion(output: string): string | undefined {
  const match = /^letsgo v?(\d+\.\d+\.\d+)(?:-[0-9A-Za-z.-]+)?(?:\+\S*)?\s*$/m.exec(output);
  return match?.[1];
}

function compare(a: string, b: string): number {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) {
      return x[i] < y[i] ? -1 : 1;
    }
  }
  return 0;
}

// The features a letsgo of this version lacks. An unknown version (a dev build)
// lacks none: guessing that a working checkout is too old would only take
// features away from someone building letsgo themselves.
export function unavailable(version: string | undefined): Feature[] {
  if (version === undefined) {
    return [];
  }
  return FEATURES.filter((f) => compare(version, f.minVersion) < 0);
}

export function isAvailable(feature: Feature, version: string | undefined): boolean {
  return !unavailable(version).includes(feature);
}

export function outdatedMessage(version: string, missing: readonly Feature[]): string {
  const list = missing.map((f) => `${f.name} (needs ${f.minVersion})`).join("; ");
  return `letsgo ${version} is older than this extension expects, so these are unavailable: ${list}. Update letsgo, or set letsgo.path.`;
}

export function probeVersion(binary: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    cp.execFile(binary, ["version"], { timeout: 10_000 }, (err, stdout) => {
      resolve(err ? undefined : parseVersion(stdout));
    });
  });
}
