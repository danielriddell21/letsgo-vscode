import assert from "node:assert/strict";
import { test } from "node:test";
import { findGit, parseTags, systemGit } from "../releases";

test("parseTags drops blanks and caps the list", () => {
  assert.deepEqual(parseTags("v3\n\nv2\nv1\n", 2), ["v3", "v2"]);
});

test("findGit returns the first fixed system location that exists", () => {
  assert.equal(findGit((p) => p === "/usr/local/bin/git", "linux"), "/usr/local/bin/git");
  assert.equal(findGit((p) => p.startsWith("/usr/bin") || p.startsWith("/usr/local"), "darwin"), "/usr/bin/git");
});

test("findGit never consults PATH", () => {
  assert.equal(findGit(() => false, "linux"), undefined);
});

test("findGit uses git.exe under Program Files on windows", () => {
  assert.equal(
    findGit((p) => p.startsWith(String.raw`C:\Program Files (x86)`), "win32"),
    String.raw`C:\Program Files (x86)\Git\cmd\git.exe`,
  );
});

test("systemGit never answers from PATH", () => {
  const saved = process.env.PATH;
  process.env.PATH = "/tmp/not-a-real-dir";
  try {
    const git = systemGit();
    assert.ok(git === undefined || /^(\/|[A-Z]:\\)/.test(git), `expected an absolute path, got ${git}`);
  } finally {
    process.env.PATH = saved;
  }
});
