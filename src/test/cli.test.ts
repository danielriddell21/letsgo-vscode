import { test } from "node:test";
import assert from "node:assert/strict";
import { LetsgoCli, execProcess, type RunResult, type Runner } from "../cli";
import { probeVersion } from "../version";

function fake(result: Partial<RunResult>): { runner: Runner; calls: { file: string; args: readonly string[]; cwd?: string }[] } {
  const calls: { file: string; args: readonly string[]; cwd?: string }[] = [];
  const runner: Runner = async (file, args, options) => {
    calls.push({ file, args, cwd: options.cwd });
    return { stdout: "", stderr: "", failed: false, message: "", ...result };
  };
  return { runner, calls };
}

test("run passes the binary, arguments and directory to the runner", async () => {
  const { runner, calls } = fake({ stdout: "ok" });
  const result = await new LetsgoCli("/bin/letsgo", runner).run(["plan", "--json"], { cwd: "/repo" });
  assert.equal(result.stdout, "ok");
  assert.deepEqual(calls, [{ file: "/bin/letsgo", args: ["plan", "--json"], cwd: "/repo" }]);
});

test("run hands back a failed result instead of throwing", async () => {
  const { runner } = fake({ failed: true, stdout: "{}", stderr: "drift" });
  const result = await new LetsgoCli("letsgo", runner).run(["plan"]);
  assert.equal(result.failed, true);
  assert.equal(result.stdout, "{}");
});

test("output returns stdout on success", async () => {
  const { runner } = fake({ stdout: "hello" });
  assert.equal(await new LetsgoCli("letsgo", runner).output(["version"]), "hello");
});

test("output rejects with stderr, then the process message", async () => {
  await assert.rejects(new LetsgoCli("letsgo", fake({ failed: true, stderr: " bad tag \n", message: "exit 1" }).runner).output(["tag"]), {
    message: "bad tag",
  });
  await assert.rejects(new LetsgoCli("letsgo", fake({ failed: true, message: "spawn ENOENT" }).runner).output(["tag"]), {
    message: "spawn ENOENT",
  });
});

test("execProcess runs a real process and reports a missing one as failed", async () => {
  const ok = await execProcess(process.execPath, ["-e", "process.stdout.write('hi')"], {});
  assert.equal(ok.failed, false);
  assert.equal(ok.stdout, "hi");

  const missing = await execProcess("/no/such/letsgo", [], {});
  assert.equal(missing.failed, true);
  assert.notEqual(missing.message, "");
});

test("probeVersion reads the JSON form and treats a failure as unknown", async () => {
  const json = JSON.stringify({ schema: 1, version: "v0.41.0", capabilities: ["lsp"] });
  const ok = fake({ stdout: json });
  assert.deepEqual(await probeVersion(new LetsgoCli("letsgo", ok.runner)), { version: "v0.41.0", capabilities: ["lsp"] });
  assert.equal(await probeVersion(new LetsgoCli("letsgo", fake({ failed: true, stdout: json }).runner)), undefined);
  assert.equal(await probeVersion(new LetsgoCli("letsgo", fake({ stdout: "letsgo v0.35.1\n" }).runner)), undefined);
});
