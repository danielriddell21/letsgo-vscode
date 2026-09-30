import assert from "node:assert/strict";
import { test } from "node:test";
import { parseTags } from "../releases";

test("parseTags drops blanks and caps the list", () => {
  assert.deepEqual(parseTags("v3\n\nv2\nv1\n", 2), ["v3", "v2"]);
});
