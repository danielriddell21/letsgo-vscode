import assert from "node:assert/strict";
import { test } from "node:test";
import * as path from "node:path";
import { candidatePaths, resolveBinary } from "../binary";

test("candidatePaths orders GOBIN, GOPATH/bin, ~/go/bin, then PATH", () => {
  const env = {
    GOBIN: "/gobin",
    GOPATH: "/gopath",
    HOME: "/home/me",
    PATH: ["/usr/bin", "/usr/local/bin"].join(path.delimiter),
  };
  assert.deepEqual(candidatePaths(env, "linux"), [
    path.join("/gobin", "letsgo"),
    path.join("/gopath", "bin", "letsgo"),
    path.join("/home/me", "go", "bin", "letsgo"),
    path.join("/usr/bin", "letsgo"),
    path.join("/usr/local/bin", "letsgo"),
  ]);
});

test("candidatePaths uses letsgo.exe on windows", () => {
  const candidates = candidatePaths({ PATH: "C:\\bin" }, "win32");
  assert.ok(candidates[0].endsWith("letsgo.exe"));
});

test("candidatePaths falls back to USERPROFILE when HOME is unset", () => {
  const candidates = candidatePaths({ USERPROFILE: "/users/me" }, "linux");
  assert.deepEqual(candidates, [path.join("/users/me", "go", "bin", "letsgo")]);
});

test("resolveBinary prefers the configured path when it exists", () => {
  const exists = (p: string) => p === "/custom/letsgo";
  assert.equal(resolveBinary("/custom/letsgo", {}, exists), "/custom/letsgo");
});

test("resolveBinary returns undefined when the configured path does not exist", () => {
  assert.equal(resolveBinary("/custom/letsgo", {}, () => false), undefined);
});

test("resolveBinary falls back through the search order", () => {
  const env = { GOPATH: "/gopath", PATH: "/usr/bin" };
  const target = path.join("/gopath", "bin", "letsgo");
  assert.equal(
    resolveBinary(undefined, env, (p) => p === target, "linux"),
    target,
  );
});

test("resolveBinary returns undefined when nothing matches", () => {
  assert.equal(resolveBinary(undefined, {}, () => false), undefined);
});
