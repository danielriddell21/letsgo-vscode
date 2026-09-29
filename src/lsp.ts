export const LANGUAGE_ID = "letsgo-mod";

export interface ServerCommand {
  command: string;
  args: string[];
}

// An untrusted workspace gets `letsgo lsp --restricted`: parse, decode,
// format and complete only, with no plan and no plugin lookup, so opening a
// repository never runs code it chose.
export function serverCommand(binary: string, workspaceTrusted: boolean): ServerCommand {
  return { command: binary, args: workspaceTrusted ? ["lsp"] : ["lsp", "--restricted"] };
}

export const INSTALL_COMMAND = "go install github.com/danielriddell21/letsgo/cmd/letsgo@latest";

export function missingBinaryMessage(): string {
  return "letsgo was not found, so letsgo.mod language features are off. Install it, or set letsgo.path.";
}

export function startFailureMessage(reason: string): string {
  return `The letsgo language server failed to start (${reason}). Your letsgo may predate \`letsgo lsp\`; update it.`;
}
