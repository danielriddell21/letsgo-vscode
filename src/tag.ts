export type Level = "major" | "minor" | "patch" | "none";

export interface Signal {
  source: string;
  level: Level;
  detail: string;
}

export interface Proposal {
  schema: number;
  previous?: string;
  next: string;
  level: Level;
  signals?: Signal[];
  notes?: string[];
  disagree?: boolean;
}

const supportedSchema = 1;

export function parseProposal(text: string): Proposal {
  const data = JSON.parse(text) as Proposal;
  if (data.schema !== supportedSchema) {
    throw new Error(`unsupported tag schema ${data.schema}`);
  }
  return data;
}

export const LEVELS: readonly Exclude<Level, "none">[] = ["major", "minor", "patch"];

export interface LevelChoice {
  label: string;
  description: string;
  level: Exclude<Level, "none">;
}

// The quick pick: every level a person could choose, the proposed one first and
// carrying the reason for it. The reason is whatever letsgo's own signals said —
// this only lays them out, it does not weigh them.
export function levelChoices(proposal: Proposal): LevelChoice[] {
  const reason = (proposal.signals ?? []).map((s) => `${s.source}: ${s.detail}`).join("; ");
  const proposedNote = reason ? "proposed — " + reason : "proposed";
  const proposed = LEVELS.includes(proposal.level as never) ? proposal.level : undefined;
  return [...LEVELS]
    .sort((a, b) => Number(b === proposed) - Number(a === proposed))
    .map((level) => ({
      label: level,
      description: level === proposed ? proposedNote : "",
      level,
    }));
}

export function tagArgs(level: LevelChoice["level"]): string[] {
  return ["tag", "--yes", `--${level}`];
}

// `letsgo tag --yes` reports "  tagged <ref>"; the ref carries the module's tag
// prefix, which `tag --json` leaves out, so this is where the real name is.
export function parseTaggedRef(stdout: string): string | undefined {
  return /^[ \t]*tagged (\S+)/m.exec(stdout)?.[1];
}

export function pushCommand(tag: string): string {
  return `git push origin ${tag}`;
}
