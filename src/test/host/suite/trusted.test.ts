import * as assert from "node:assert";
import * as fs from "node:fs";
import * as vscode from "vscode";
import { activate, calls, fixtureUri, waitFor, workspaceDir } from "./helpers";

interface Contributed {
  contributes: { commands: { command: string }[] };
}

suite("letsgo extension host (trusted workspace)", () => {
  suiteSetup(async () => {
    await activate();
  });

  test("activates in a trusted workspace", async () => {
    assert.strictEqual(vscode.workspace.isTrusted, true);
    const extension = await activate();
    assert.strictEqual(extension.isActive, true);
  });

  test("registers every contributed command", async () => {
    const extension = await activate();
    const contributed = (extension.packageJSON as Contributed).contributes.commands.map((c) => c.command);
    assert.ok(contributed.length > 0);
    const registered = new Set(await vscode.commands.getCommands(true));
    for (const command of contributed) {
      assert.ok(registered.has(command), `${command} is contributed but not registered`);
    }
  });

  test("starts the language server with the full (not restricted) mode", async () => {
    const started = await waitFor("letsgo lsp", () => calls("lsp")[0]);
    assert.deepStrictEqual(started.args, ["lsp"]);
  });

  test("serves letsgo.mod diagnostics from the language server", async () => {
    const uri = fixtureUri(".letsgo", "extra.mod");
    const doc = await vscode.workspace.openTextDocument(uri);
    assert.strictEqual(doc.languageId, "letsgo-mod");
    await vscode.window.showTextDocument(doc);
    const edit = new vscode.WorkspaceEdit();
    edit.insert(uri, new vscode.Position(1, 0), "bogus thing\n");
    await vscode.workspace.applyEdit(edit);
    const found = await waitFor("a diagnostic from letsgo lsp", () =>
      vscode.languages.getDiagnostics(uri).find((d) => d.source === "letsgo lsp"),
    );
    assert.strictEqual(found.message, "unknown directive bogus");
    assert.strictEqual(found.range.start.line, 1);
  });

  test("plans the module on activation", async () => {
    const first = await waitFor("letsgo plan --json", () => calls("plan")[0]);
    assert.deepStrictEqual(first.args, ["plan", "--json"]);
    assert.strictEqual(fs.realpathSync(first.cwd), fs.realpathSync(workspaceDir()));
  });

  test("refreshes when letsgo.mod changes, without publishing the plan's problems itself", async () => {
    const uri = fixtureUri("letsgo.mod");
    const before = calls("plan").length;

    // A failing check with a position. The language server is where a plan's
    // problems become diagnostics, so the extension must not publish the same
    // one again from `letsgo plan --json`: each problem is reported once.
    fs.writeFileSync(uri.fsPath, "project fixture\nbad-budget 1MB\n");

    await waitFor("another letsgo plan after the change", () => calls("plan").length > before);
    assert.strictEqual(vscode.languages.getDiagnostics(uri).filter((d) => d.source === "letsgo plan").length, 0);

    fs.writeFileSync(uri.fsPath, "project fixture\n");
    await waitFor("a plan after the fix", () => calls("plan").length > before + 1);
  });

  test("Plan with analysis passes --analyse to letsgo", async () => {
    await vscode.commands.executeCommand("letsgo.planAnalyse");
    await waitFor("letsgo plan --json --analyse", () => calls("plan").find((i) => i.args.includes("--analyse")));
  });

  test("Build snapshot runs letsgo build --snapshot in the module", async () => {
    await vscode.commands.executeCommand("letsgo.buildSnapshot");
    const call = await waitFor("letsgo build --snapshot", () => calls("build")[0]);
    assert.deepStrictEqual(call.args, ["build", "--snapshot"]);
    assert.strictEqual(fs.realpathSync(call.cwd), fs.realpathSync(workspaceDir()));
  });

  test("the letsgo task type runs a task from tasks.json", async () => {
    const tasks = await vscode.tasks.fetchTasks({ type: "letsgo" });
    const task = tasks.find((t) => t.name === "letsgo: features");
    assert.ok(task, `no letsgo: features task among ${tasks.map((t) => t.name).join(", ")}`);
    assert.ok(task.execution instanceof vscode.ProcessExecution, "task resolved to a process");

    const ended = new Promise<number | undefined>((resolve) => {
      const listener = vscode.tasks.onDidEndTaskProcess((e) => {
        if (e.execution.task.name === task.name) {
          listener.dispose();
          resolve(e.exitCode);
        }
      });
    });
    await vscode.tasks.executeTask(task);
    assert.strictEqual(await ended, 0);
    assert.deepStrictEqual(calls("features")[0]?.args, ["features"]);
  });
});
