import { test } from "node:test";
import assert from "node:assert/strict";
import { diffArgs, isDiffSide, planArgs, taskArgs } from "../commands";

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
