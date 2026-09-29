import * as vscode from "vscode";
import * as path from "node:path";
import { isSafeTag, manifestTag, parseManifest, renderManifest, type Manifest } from "./manifest";
import { runInPanel } from "./run";

export const MANIFEST_VIEW_TYPE = "letsgo.manifest";
const MANIFEST_GLOB = "**/letsgo.json";

function tryParse(text: string): Manifest | undefined {
  try {
    return parseManifest(text);
  } catch {
    return undefined;
  }
}

export async function verifyRelease(
  binary: string | undefined,
  tag: string,
  dir: string,
  trusted: boolean,
): Promise<void> {
  if (!trusted) {
    void vscode.window.showWarningMessage("letsgo verify runs a build; trust this workspace first.");
    return;
  }
  if (!binary) {
    void vscode.window.showWarningMessage("letsgo was not found; install it or set letsgo.path.");
    return;
  }
  if (!isSafeTag(tag)) {
    void vscode.window.showWarningMessage(`"${tag}" is not a tag letsgo can verify.`);
    return;
  }
  await runInPanel(`verify ${tag}`, binary, ["verify", tag], dir);
}

// The manifest viewer: a read-only summary of a letsgo.json with a Verify
// button. It is offered as an alternative to the text editor, not in place of
// it, so opening a manifest never changes what a person sees by default.
export class ManifestEditorProvider implements vscode.CustomTextEditorProvider {
  constructor(private readonly binary: () => string | undefined) {}

  resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): void {
    panel.webview.options = { enableScripts: true };
    const dir = path.dirname(document.uri.fsPath);

    const render = (): void => {
      const manifest = tryParse(document.getText());
      const nonce = Math.random().toString(36).slice(2);
      const body = manifest ? renderManifest(manifest) : "<p>This file is not a letsgo manifest.</p>";
      panel.webview.html = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'">
<style>table{border-collapse:collapse}td,th{padding:2px 10px;text-align:left;font-family:var(--vscode-editor-font-family)}</style>
</head><body>${body}
<script nonce="${nonce}">const api = acquireVsCodeApi(); const b = document.getElementById("verify"); if (b) b.onclick = () => api.postMessage("verify");</script>
</body></html>`;
    };

    const changes = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document === document) {
        render();
      }
    });
    panel.onDidDispose(() => changes.dispose());
    panel.webview.onDidReceiveMessage((message: unknown) => {
      const manifest = tryParse(document.getText());
      if (message === "verify" && manifest) {
        void verifyRelease(this.binary(), manifestTag(manifest), dir, vscode.workspace.isTrusted);
      }
    });
    render();
  }
}

// A Verify lens at the top of a letsgo.json opened as text.
export class ManifestLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const manifest = tryParse(document.getText());
    if (!manifest) {
      return [];
    }
    const tag = manifestTag(manifest);
    return [
      new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
        title: `Verify ${tag}`,
        command: "letsgo.verify",
        arguments: [tag, path.dirname(document.uri.fsPath)],
      }),
    ];
  }
}

export const MANIFEST_SELECTOR: vscode.DocumentSelector = { pattern: MANIFEST_GLOB };
