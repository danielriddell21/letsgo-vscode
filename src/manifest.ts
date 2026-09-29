export interface Manifest {
  schema: number;
  project: string;
  version: string;
  tag?: string;
  tag_prefix?: string;
  commit: string;
  gates?: Record<string, string>;
  artifacts?: { name: string; os: string; arch: string; size: number; sha256: string }[];
  features?: { disabled?: string[]; required?: string[] };
  builder?: { tool: string; go: string; plugins?: { hook: string; command: string; version?: string; digest: string }[] };
}

export function parseManifest(text: string): Manifest {
  const data = JSON.parse(text) as Manifest;
  if (typeof data.project !== "string" || typeof data.version !== "string") {
    throw new Error("not a letsgo manifest");
  }
  return data;
}

// The tag `letsgo verify` needs: the manifest's own when it records one, else
// the prefix and version it was built from.
export function manifestTag(m: Manifest): string {
  return m.tag ?? `${m.tag_prefix ?? ""}v${m.version}`;
}

// A tag reaches a process as an argument, and a manifest can be downloaded
// from anywhere: one that begins with "-" would be read as a flag.
export function isSafeTag(tag: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._/+-]*$/.test(tag);
}

export function verifyCommand(m: Manifest): string {
  return `letsgo verify ${manifestTag(m)}`;
}

function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function table(head: string[], rows: string[][]): string {
  if (rows.length === 0) {
    return "<p><em>none</em></p>";
  }
  const th = head.map((h) => `<th>${esc(h)}</th>`).join("");
  const body = rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("");
  return `<table><tr>${th}</tr>${body}</table>`;
}

// A read-only summary of a manifest. Every value is escaped: a manifest is
// downloaded content, and this page runs inside the editor.
export function renderManifest(m: Manifest): string {
  const artifacts = (m.artifacts ?? []).map((a) => [a.name, `${a.os}/${a.arch}`, String(a.size), a.sha256]);
  const gates = Object.entries(m.gates ?? {}).map(([name, status]) => [name, status]);
  const plugins = (m.builder?.plugins ?? []).map((p) => [p.hook, p.command, p.version ?? "", p.digest]);
  const features = [
    ...(m.features?.disabled ?? []).map((f) => [f, "disabled"]),
    ...(m.features?.required ?? []).map((f) => [f, "required"]),
  ];
  return [
    `<h1>${esc(m.project)} ${esc(manifestTag(m))}</h1>`,
    `<p>commit ${esc(m.commit)} · built with ${esc(m.builder?.tool ?? "letsgo")} on go ${esc(m.builder?.go ?? "?")}</p>`,
    `<p><button id="verify">Verify</button> <code>${esc(verifyCommand(m))}</code></p>`,
    "<h2>Artifacts</h2>",
    table(["name", "platform", "size", "sha256"], artifacts),
    "<h2>Gates</h2>",
    table(["gate", "result"], gates),
    "<h2>Features</h2>",
    table(["feature", "state"], features),
    "<h2>Plugins</h2>",
    table(["hook", "command", "version", "digest"], plugins),
  ].join("\n");
}
