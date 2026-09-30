import assert from "node:assert/strict";
import { test } from "node:test";
import * as path from "node:path";
import { resolvePos } from "../position";

test("resolvePos joins a relative file and converts to 0-based", () => {
  const t = resolvePos("/w/mod", { file: "letsgo.mod", line: 3, col: 5 });
  assert.deepEqual(t, { file: path.join("/w/mod", "letsgo.mod"), line: 2, col: 4 });
});

test("resolvePos keeps an absolute file and clamps to zero", () => {
  const abs = path.resolve("/x/letsgo.mod");
  assert.deepEqual(resolvePos("/w", { file: abs, line: 0, col: 0 }), { file: abs, line: 0, col: 0 });
});
