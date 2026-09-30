import * as assert from "node:assert";
import * as vscode from "vscode";
import { activate, calls, fixtureUri, invocations, sleep, waitFor } from "./helpers";

// An untrusted workspace is limited mode: the language server starts with
// --restricted, and nothing the repository could influence (plan, build) runs.
// (Tasks are not exercised: VS Code itself asks for trust before it resolves one.) Only `version` and the restricted `lsp` may reach the binary.
suite("letsgo extension host (untrusted workspace)", () => {
  suiteSetup(async () => {
    await activate();
  });

  const allowed = new Set(["version", "lsp"]);

  function assertNothingRisky(): void {
    for (const call of invocations()) {
      assert.ok(allowed.has(call.args[0]), `letsgo ${call.args.join(" ")} ran in an untrusted workspace`);
    }
  }

  test("activates, and the workspace is untrusted", async () => {
    assert.strictEqual(vscode.workspace.isTrusted, false);
    const extension = await activate();
    assert.strictEqual(extension.isActive, true);
  });

  test("still registers its commands", async () => {
    const registered = new Set(await vscode.commands.getCommands(true));
    for (const command of ["letsgo.refresh", "letsgo.tag", "letsgo.verify", "letsgo.planAnalyse", "letsgo.buildSnapshot"]) {
      assert.ok(registered.has(command), `${command} is not registered`);
    }
  });

  test("starts the language server in restricted mode", async () => {
    const started = await waitFor("letsgo lsp --restricted", () => calls("lsp")[0]);
    assert.deepStrictEqual(started.args, ["lsp", "--restricted"]);
  });

  test("does not plan on activation or on refresh", async () => {
    await vscode.commands.executeCommand("letsgo.refresh");
    await sleep(1500);
    assert.strictEqual(calls("plan").length, 0);
    assertNothingRisky();
  });

  test("does not refresh when letsgo.mod changes", async () => {
    const uri = fixtureUri("letsgo.mod");
    await vscode.workspace.fs.writeFile(uri, Buffer.from("project fixture\nbad-budget 1MB\n"));
    await sleep(2000);
    assert.strictEqual(calls("plan").length, 0);
    assert.strictEqual(vscode.languages.getDiagnostics(uri).filter((d) => d.source === "letsgo plan").length, 0);
  });

  test("palette commands do not run letsgo", async () => {
    for (const command of ["letsgo.planAnalyse", "letsgo.buildSnapshot", "letsgo.rehearse", "letsgo.installPlugins", "letsgo.tag"]) {
      await vscode.commands.executeCommand(command);
    }
    await sleep(1500);
    assertNothingRisky();
  });
});
