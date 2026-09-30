import assert from "node:assert/strict";
import { test } from "node:test";
import { watchedGlobs } from "../watch";

test("watchedGlobs covers config, go.mod and git state", () => {
  for (const want of ["letsgo.mod", "go.mod", ".letsgo/*.mod", ".git/HEAD", ".git/refs/tags/**"]) {
    assert.ok(watchedGlobs.includes(want), want);
  }
});
