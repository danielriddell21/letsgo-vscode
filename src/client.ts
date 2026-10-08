import * as vscode from "vscode";
import { LanguageClient, type LanguageClientOptions, type ServerOptions } from "vscode-languageclient/node";
import {
  INSTALL_COMMAND,
  LANGUAGE_ID,
  missingBinaryMessage,
  serverCommand,
  startFailureMessage,
} from "./lsp";
import { LetsgoCli } from "./cli";
import { LSP, isAvailable, outdatedMessage, probeVersion, unavailable } from "./version";

// Owns the one language client. A trust change or a letsgo.path change needs a
// different process (restricted or not, another binary), so the only
// operation is restart.
export class LetsgoLanguageClient implements vscode.Disposable {
  private client: LanguageClient | undefined;
  private notifiedMissing = false;

  constructor(
    private readonly resolve: () => string | undefined,
    private readonly output: vscode.LogOutputChannel,
  ) {}

  async restart(): Promise<void> {
    await this.stop();

    const binary = this.resolve();
    if (!binary) {
      await this.offerInstall();
      return;
    }

    const version = await probeVersion(new LetsgoCli(binary));
    if (!isAvailable(LSP, version) && version !== undefined) {
      this.output.appendLine(`letsgo ${version} predates letsgo lsp; language features are off`);
      void vscode.window.showWarningMessage(outdatedMessage(version, unavailable(version)));
      return;
    }

    const { command, args } = serverCommand(binary, vscode.workspace.isTrusted);
    const serverOptions: ServerOptions = { command, args };
    const clientOptions: LanguageClientOptions = {
      documentSelector: [{ language: LANGUAGE_ID }],
      outputChannel: this.output,
    };

    const client = new LanguageClient("letsgo", "letsgo", serverOptions, clientOptions);
    try {
      await client.start();
      this.client = client;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.output.appendLine(`letsgo lsp failed to start: ${reason}`);
      void vscode.window.showWarningMessage(startFailureMessage(reason));
    }
  }

  private async stop(): Promise<void> {
    const client = this.client;
    this.client = undefined;
    if (client) {
      await client.stop();
    }
  }

  // Once per session: a missing binary is not an error to repeat on every
  // restart, only a fact to state once.
  private async offerInstall(): Promise<void> {
    if (this.notifiedMissing) {
      return;
    }
    this.notifiedMissing = true;
    const install = "Install";
    const choice = await vscode.window.showWarningMessage(missingBinaryMessage(), install);
    if (choice === install) {
      const terminal = vscode.window.createTerminal("letsgo install");
      terminal.show();
      terminal.sendText(INSTALL_COMMAND);
    }
  }

  dispose(): void {
    void this.stop();
  }
}
