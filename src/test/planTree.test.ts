import assert from "node:assert/strict";
import { test } from "node:test";
import { buildModuleTree, errorNode } from "../planTree";
import type { PlanResult } from "../plan";

function basePlan(overrides: Partial<PlanResult> = {}): PlanResult {
  return {
    schema: 1,
    project: "letsgo",
    commit: "abc123",
    checks: [],
    features: {},
    ...overrides,
  };
}

test("buildModuleTree groups checks, artifacts, features and plugins", () => {
  const plan = basePlan({
    version: "v1.2.3",
    checks: [{ name: "budgets", status: "fail", detail: "over budget" }],
    artifacts: ["letsgo_linux_amd64.tar.gz"],
    features: { disabled: ["diff-notes"], required: ["vulncheck"] },
    plugins: { cask: { command: "letsgo-cask", version: "v0.3.0" } },
  });
  const tree = buildModuleTree("root", plan);
  assert.equal(tree.label, "root");
  assert.equal(tree.description, "v1.2.3");
  assert.equal(tree.status, "fail");
  assert.deepEqual(
    tree.children?.map((c) => c.label),
    ["Checks", "Artifacts", "Features", "Plugins"],
  );
});

test("buildModuleTree omits empty groups and a passing status", () => {
  const tree = buildModuleTree("root", basePlan());
  assert.deepEqual(tree.children, []);
  assert.equal(tree.status, undefined);
});

test("errorNode carries the failure message as detail", () => {
  const node = errorNode("root", "binary not found");
  assert.equal(node.kind, "error");
  assert.equal(node.detail, "binary not found");
});
