import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePlan } from "../plan";

test("parsePlan decodes schema 1", () => {
  const json = JSON.stringify({
    schema: 1,
    project: "letsgo",
    commit: "abc123",
    checks: [{ name: "budgets", status: "pass", detail: "" }],
    features: { disabled: ["diff-notes"] },
  });
  const plan = parsePlan(json);
  assert.equal(plan.project, "letsgo");
  assert.equal(plan.checks.length, 1);
  assert.deepEqual(plan.features.disabled, ["diff-notes"]);
});

test("parsePlan rejects an unknown schema", () => {
  const json = JSON.stringify({ schema: 2, project: "x", commit: "y", checks: [], features: {} });
  assert.throws(() => parsePlan(json), /unsupported plan schema 2/);
});
