import assert from "node:assert/strict";
import { test } from "node:test";
import { isPlanAllowed } from "../trust";

test("isPlanAllowed mirrors workspace trust", () => {
  assert.equal(isPlanAllowed(true), true);
  assert.equal(isPlanAllowed(false), false);
});
