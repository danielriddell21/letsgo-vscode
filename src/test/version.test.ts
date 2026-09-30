import { test } from "node:test";
import assert from "node:assert/strict";
import { DID_YOU_MEAN, INSTALL_PLUGINS, LSP, PLAN_JSON, TAG_VERIFY, UPDATE_PIN, isAvailable, outdatedMessage, parseVersion, unavailable } from "../version";

test("parseVersion reads a release and ignores a dev build", () => {
  assert.equal(parseVersion("letsgo v0.30.1\n"), "0.30.1");
  assert.equal(parseVersion("letsgo 0.30.0-rc.2\n"), "0.30.0");
  assert.equal(parseVersion("letsgo dev\n"), undefined);
  assert.equal(parseVersion(""), undefined);
});

test("an old letsgo lacks the features added after it", () => {
  assert.deepEqual(unavailable("0.28.0"), [PLAN_JSON, TAG_VERIFY, INSTALL_PLUGINS, LSP, UPDATE_PIN, DID_YOU_MEAN]);
  assert.deepEqual(unavailable("0.29.0"), [LSP, UPDATE_PIN, DID_YOU_MEAN]);
  assert.deepEqual(unavailable("0.30.1"), [UPDATE_PIN, DID_YOU_MEAN]);
  assert.deepEqual(unavailable("0.31.0"), [DID_YOU_MEAN]);
  assert.deepEqual(unavailable("0.33.0"), []);
  assert.deepEqual(unavailable("1.0.0"), []);
});

test("an unknown version is assumed to have everything", () => {
  assert.deepEqual(unavailable(undefined), []);
  assert.ok(isAvailable(LSP, undefined));
});

test("versions compare numerically, not as text", () => {
  assert.ok(isAvailable(LSP, "0.100.0"));
  assert.ok(!isAvailable(LSP, "0.9.0"));
});

test("the message names the version and each missing feature", () => {
  const message = outdatedMessage("0.28.0", unavailable("0.28.0"));
  assert.match(message, /0\.28\.0/);
  assert.match(message, /letsgo lsp/);
  assert.match(message, /plan --json/);
});

test("Install pinned plugins needs 0.29.0", () => {
  assert.ok(!isAvailable(INSTALL_PLUGINS, "0.28.0"));
  assert.ok(isAvailable(INSTALL_PLUGINS, "0.29.0"));
  assert.ok(isAvailable(INSTALL_PLUGINS, undefined));
});

test("Did you mean needs 0.33.0", () => {
  assert.ok(!isAvailable(DID_YOU_MEAN, "0.32.0"));
  assert.ok(isAvailable(DID_YOU_MEAN, "0.33.0"));
  assert.ok(isAvailable(DID_YOU_MEAN, undefined));
});
