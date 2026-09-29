import assert from "node:assert/strict";
import { test } from "node:test";
import { summarize } from "../statusBar";
import type { PlanResult } from "../plan";

function plan(checks: PlanResult["checks"]): PlanResult {
  return { schema: 1, project: "x", commit: "y", checks, features: {} };
}

test("summarize reports no modules", () => {
  const s = summarize([]);
  assert.match(s.text, /letsgo/);
  assert.equal(s.isError, false);
});

test("summarize counts failing checks across modules as an error", () => {
  const s = summarize([
    plan([{ name: "a", status: "fail", detail: "" }]),
    plan([{ name: "b", status: "pass", detail: "" }]),
  ]);
  assert.equal(s.isError, true);
  assert.match(s.text, /1 failing/);
});

test("summarize reports warnings when nothing is failing", () => {
  const s = summarize([plan([{ name: "a", status: "warn", detail: "" }])]);
  assert.equal(s.isError, false);
  assert.match(s.text, /1 warning/);
});

test("summarize reports all clear", () => {
  const s = summarize([plan([{ name: "a", status: "pass", detail: "" }])]);
  assert.doesNotMatch(s.text, /warning|failing/);
});
