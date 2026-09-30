import assert from "node:assert/strict";
import { test } from "node:test";
import { debounce } from "../debounce";

test("debounce collapses a burst into one call", async () => {
  let calls = 0;
  const fn = debounce(() => calls++, 20);
  fn();
  fn();
  fn();
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(calls, 1);
});
