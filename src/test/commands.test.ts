import { test } from "node:test";
import assert from "node:assert/strict";
import { diffArgs, isDiffSide, planArgs, planProblems, taskArgs } from "../commands";
import type { PlanResult } from "../plan";

function plan(checks: PlanResult["checks"]): PlanResult {
  return { schema: 1, project: "p", commit: "c", checks, features: {} };
}

test("planArgs adds --analyse only on request", () => {
  assert.deepEqual(planArgs(false), ["plan", "--json"]);
  assert.deepEqual(planArgs(true), ["plan", "--json", "--analyse"]);
});

test("diff sides are release tags or letsgo.json paths", () => {
  assert.ok(isDiffSide("v1.2.0"));
  assert.ok(isDiffSide("services/api/v1.2.0"));
  assert.ok(isDiffSide("dist/letsgo.json"));
  assert.ok(isDiffSide("C:\\work\\letsgo.json"));
  assert.ok(!isDiffSide("--repo"));
  assert.ok(!isDiffSide("v1; rm -rf /"));
  assert.ok(!isDiffSide(""));
});

test("diffArgs defaults the second side and rejects unsafe input", () => {
  assert.deepEqual(diffArgs("v1.0.0"), ["diff", "v1.0.0"]);
  assert.deepEqual(diffArgs("v1.0.0", ""), ["diff", "v1.0.0"]);
  assert.deepEqual(diffArgs("v1.0.0", "v1.1.0"), ["diff", "v1.0.0", "v1.1.0"]);
  assert.equal(diffArgs("-x"), undefined);
  assert.equal(diffArgs("v1.0.0", "$(id)"), undefined);
});

test("a letsgo task may run known commands but never publish", () => {
  assert.deepEqual(taskArgs("plan", ["--analyse"]), ["plan", "--analyse"]);
  assert.deepEqual(taskArgs("plan"), ["plan"]);
  assert.deepEqual(taskArgs("release", ["--snapshot"]), ["release", "--snapshot"]);
  assert.equal(taskArgs("release", []), undefined);
  assert.equal(taskArgs("release", ["--draft"]), undefined);
  assert.equal(taskArgs("update", ["--yes"]), undefined);
  assert.equal(taskArgs("sh", ["-c", "id"]), undefined);
});

test("checks with a position become problems, others do not", () => {
  const problems = planProblems(
    plan([
      { name: "budgets", status: "fail", detail: "windows/arm64 is not a target", pos: { file: "letsgo.mod", line: 7, col: 3 } },
      { name: "tag", status: "warn", detail: "", pos: { file: "/abs/letsgo.mod", line: 0, col: 0 } },
      { name: "vulncheck", status: "skip", detail: "not run", pos: { file: "letsgo.mod", line: 1, col: 1 } },
      { name: "clean", status: "fail", detail: "dirty" },
      { name: "ok", status: "pass", detail: "", pos: { file: "letsgo.mod", line: 2, col: 1 } },
    ]),
    "/work/api/",
  );
  assert.deepEqual(problems, [
    { file: "/work/api/letsgo.mod", line: 7, col: 3, message: "budgets: windows/arm64 is not a target", severity: "error" },
    { file: "/abs/letsgo.mod", line: 1, col: 1, message: "tag", severity: "warning" },
  ]);
});
