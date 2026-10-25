import type { LetsgoCli } from "./cli";

// A letsgo feature this extension leans on, and the capability letsgo
// advertises for it in `letsgo version --json`.
export interface Feature {
  name: string;
  capability: string;
  // since is the letsgo release that shipped the feature before it was
  // advertised. A letsgo at or past it has the feature without the capability.
  since?: string;
}

// What `letsgo version --json` reports about the binary.
export interface VersionInfo {
  version: string;
  capabilities: readonly string[];
}

export const PLAN_JSON: Feature = { name: "the module panel and status bar (letsgo plan --json)", capability: "plan-json" };
export const TAG_VERIFY: Feature = { name: "the Tag and Verify commands (--json)", capability: "tag-json" };
export const LSP: Feature = { name: "letsgo.mod language features (letsgo lsp)", capability: "lsp" };
export const INSTALL_PLUGINS: Feature = { name: "the Install pinned plugins command (letsgo plugin install)", capability: "plugin-install" };
export const UPDATE_PIN: Feature = { name: "the Update pin quick fix", capability: "update-pin" };
export const DID_YOU_MEAN: Feature = { name: "the Did you mean quick fix", capability: "did-you-mean" };
// The language server has published plan problems since v0.42.0; this
// extension no longer computes them itself, so an older letsgo shows none.
export const PLAN_DIAGNOSTICS: Feature = {
  name: "plan problems in the editor (letsgo lsp diagnostics)",
  capability: "plan-diagnostics",
  since: "0.42.0",
};

export const FEATURES: readonly Feature[] = [PLAN_JSON, TAG_VERIFY, INSTALL_PLUGINS, LSP, UPDATE_PIN, DID_YOU_MEAN, PLAN_DIAGNOSTICS];

// The features a letsgo lacks, by what it says it can do rather than by a
// version number this extension would have to keep in step. The one exception
// is a feature's since, for the releases that had it before saying so. An
// unknown letsgo (one that predates `version --json`, or failed to answer)
// lacks none: guessing that a working binary is too old would only take
// features away.
export function unavailable(info: VersionInfo | undefined): Feature[] {
  if (info === undefined) {
    return [];
  }
  return FEATURES.filter(
    (f) => !info.capabilities.includes(f.capability) && !(f.since !== undefined && atLeast(info.version, f.since)),
  );
}

// atLeast compares major.minor.patch only, so a release candidate counts as
// its release: v0.42.0's candidates already published plan problems. A version
// that is not a release ("dev") is never at least anything; such a build is
// judged by its capabilities alone.
export function atLeast(version: string, floor: string): boolean {
  const have = release(version);
  const want = release(floor);
  if (have === undefined || want === undefined) {
    return false;
  }
  for (let i = 0; i < 3; i++) {
    if (have[i] !== want[i]) {
      return have[i] > want[i];
    }
  }
  return true;
}

function release(version: string): [number, number, number] | undefined {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/.exec(version);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : undefined;
}

export function isAvailable(feature: Feature, info: VersionInfo | undefined): boolean {
  return !unavailable(info).includes(feature);
}

export function outdatedMessage(info: VersionInfo, missing: readonly Feature[]): string {
  const list = missing.map((f) => f.name).join("; ");
  return `letsgo ${info.version} is older than this extension expects, so these are unavailable: ${list}. Update letsgo, or set letsgo.path.`;
}

export function parseVersion(output: string): VersionInfo | undefined {
  try {
    const raw: unknown = JSON.parse(output);
    if (typeof raw !== "object" || raw === null) {
      return undefined;
    }
    const { version, capabilities } = raw as { version?: unknown; capabilities?: unknown };
    if (typeof version !== "string" || !Array.isArray(capabilities)) {
      return undefined;
    }
    return { version, capabilities: capabilities.filter((c): c is string => typeof c === "string") };
  } catch {
    return undefined;
  }
}

export async function probeVersion(cli: LetsgoCli): Promise<VersionInfo | undefined> {
  const result = await cli.run(["version", "--json"], { timeout: 10_000 });
  return result.failed ? undefined : parseVersion(result.stdout);
}
