import { test } from "node:test";
import assert from "node:assert/strict";
import { INSTALL_COMMAND, LANGUAGE_ID, missingBinaryMessage, serverCommand, startFailureMessage } from "../lsp";

test("a trusted workspace runs the full server", () => {
  assert.deepEqual(serverCommand("/bin/letsgo", true), { command: "/bin/letsgo", args: ["lsp"] });
});

test("an untrusted workspace runs the restricted server", () => {
  assert.deepEqual(serverCommand("/bin/letsgo", false), { command: "/bin/letsgo", args: ["lsp", "--restricted"] });
});

test("the language id matches the one package.json contributes", async () => {
  const { readFileSync } = await import("node:fs");
  const pkg = JSON.parse(readFileSync(require.resolve("../../package.json"), "utf8"));
  assert.equal(pkg.contributes.languages[0].id, LANGUAGE_ID);
  assert.equal(pkg.contributes.grammars[0].language, LANGUAGE_ID);
});

test("messages name the remedy", () => {
  assert.match(missingBinaryMessage(), /letsgo\.path/);
  assert.match(startFailureMessage("boom"), /boom/);
  assert.match(INSTALL_COMMAND, /cmd\/letsgo@latest$/);
});
