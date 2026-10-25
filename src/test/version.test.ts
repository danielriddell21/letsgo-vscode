import { test } from "node:test";
import assert from "node:assert/strict";
import { DID_YOU_MEAN, FEATURES, INSTALL_PLUGINS, LSP, PLAN_DIAGNOSTICS, PLAN_JSON, TAG_VERIFY, UPDATE_PIN, atLeast, isAvailable, outdatedMessage, parseVersion, unavailable, type VersionInfo } from "../version";

const all = FEATURES.map((f) => f.capability);
const info = (...capabilities: string[]): VersionInfo => ({ version: "0.41.0", capabilities });

test("parseVersion reads the version and capabilities", () => {
  const out = JSON.stringify({ schema: 1, version: "v0.41.0", capabilities: ["lsp", "plan-json"] });
  assert.deepEqual(parseVersion(out), { version: "v0.41.0", capabilities: ["lsp", "plan-json"] });
});

test("parseVersion treats anything but the JSON form as unknown", () => {
  assert.equal(parseVersion("letsgo v0.30.1\n"), undefined);
  assert.equal(parseVersion(""), undefined);
  assert.equal(parseVersion("null"), undefined);
  assert.equal(parseVersion('{"version":"dev"}'), undefined);
  assert.equal(parseVersion('{"capabilities":[]}'), undefined);
});

test("parseVersion drops capabilities that are not strings", () => {
  assert.deepEqual(parseVersion('{"version":"dev","capabilities":["lsp",3]}')?.capabilities, ["lsp"]);
});

test("a feature is unavailable when letsgo does not advertise it", () => {
  assert.deepEqual(unavailable(info()), [...FEATURES]);
  assert.deepEqual(unavailable(info("plan-json", "tag-json", "plugin-install")), [LSP, UPDATE_PIN, DID_YOU_MEAN, PLAN_DIAGNOSTICS]);
  assert.deepEqual(unavailable(info(...all, "something-newer")), []);
});

test("an unknown letsgo lacks nothing", () => {
  assert.deepEqual(unavailable(undefined), []);
  assert.ok(isAvailable(LSP, undefined));
});

test("isAvailable follows the advertised capabilities", () => {
  assert.ok(isAvailable(INSTALL_PLUGINS, info("plugin-install")));
  assert.ok(!isAvailable(INSTALL_PLUGINS, info("lsp")));
  assert.ok(!isAvailable(DID_YOU_MEAN, info("lsp")));
  assert.ok(isAvailable(TAG_VERIFY, info("tag-json")));
});

// v0.42.0 to v1.0.x publish plan problems without advertising it, so their
// version stands in for the capability; nothing older does.
test("plan diagnostics are available by capability or from v0.42.0", () => {
  const at = (version: string, ...capabilities: string[]): VersionInfo => ({ version, capabilities });
  assert.ok(isAvailable(PLAN_DIAGNOSTICS, at("dev", "plan-diagnostics")));
  assert.ok(isAvailable(PLAN_DIAGNOSTICS, at("1.0.0", "lsp")));
  assert.ok(isAvailable(PLAN_DIAGNOSTICS, at("v0.42.0", "lsp")));
  assert.ok(isAvailable(PLAN_DIAGNOSTICS, at("0.42.0-rc.1", "lsp")));
  assert.ok(!isAvailable(PLAN_DIAGNOSTICS, at("0.41.1", "lsp")));
  assert.ok(!isAvailable(PLAN_DIAGNOSTICS, at("dev", "lsp")));
});

test("a since version leaves every other feature to its capability", () => {
  assert.deepEqual(unavailable({ version: "1.0.0", capabilities: [] }), FEATURES.filter((f) => f !== PLAN_DIAGNOSTICS));
});

test("atLeast compares the release, not its candidate", () => {
  assert.ok(atLeast("0.42.0", "0.42.0"));
  assert.ok(atLeast("v0.43.0", "0.42.0"));
  assert.ok(atLeast("1.0.0", "0.42.0"));
  assert.ok(atLeast("0.42.10", "0.42.9"));
  assert.ok(atLeast("0.42.0-rc.3", "0.42.0"));
  assert.ok(!atLeast("0.41.9", "0.42.0"));
  assert.ok(!atLeast("0.9.0", "0.42.0"));
  assert.ok(!atLeast("dev", "0.42.0"));
  assert.ok(!atLeast("1.0", "0.42.0"));
});

test("the message names the version and each missing feature", () => {
  const i = info("update-pin");
  const message = outdatedMessage(i, unavailable(i));
  assert.match(message, /0\.41\.0/);
  assert.match(message, /letsgo lsp/);
  assert.match(message, new RegExp(PLAN_JSON.name.slice(0, 20)));
});
