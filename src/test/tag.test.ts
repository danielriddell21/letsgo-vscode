import { test } from "node:test";
import assert from "node:assert/strict";
import { levelChoices, parseProposal, parseTaggedRef, pushCommand, tagArgs } from "../tag";

const proposal = JSON.stringify({
  schema: 1,
  previous: "v1.2.0",
  next: "v1.3.0",
  level: "minor",
  signals: [{ source: "commits", level: "minor", detail: "1 feat" }],
});

test("parseProposal reads schema 1 and rejects another", () => {
  assert.equal(parseProposal(proposal).next, "v1.3.0");
  assert.throws(() => parseProposal(JSON.stringify({ schema: 2, next: "v1" })), /schema 2/);
});

test("the proposed level comes first and carries the reason", () => {
  const choices = levelChoices(parseProposal(proposal));
  assert.deepEqual(choices.map((c) => c.level), ["minor", "major", "patch"]);
  assert.match(choices[0].description, /proposed — commits: 1 feat/);
  assert.equal(choices[1].description, "");
});

test("a proposal with no level still offers every level", () => {
  const choices = levelChoices({ schema: 1, next: "v0.0.1", level: "none" });
  assert.deepEqual(choices.map((c) => c.level), ["major", "minor", "patch"]);
  assert.ok(choices.every((c) => c.description === ""));
});

test("tag arguments force the chosen level and skip the prompt", () => {
  assert.deepEqual(tagArgs("patch"), ["tag", "--json", "--yes", "--patch"]);
});

test("the created ref is read from letsgo's JSON, prefix included", () => {
  assert.equal(parseTaggedRef('{"schema":1,"ref":"services/api/v1.3.0","tagged":true}'), "services/api/v1.3.0");
  assert.equal(parseTaggedRef('{"schema":1,"ref":"v1.3.0"}'), undefined);
  assert.equal(parseTaggedRef("nothing was tagged"), undefined);
  assert.equal(parseTaggedRef("null"), undefined);
  assert.equal(pushCommand("v1.3.0"), "git push origin v1.3.0");
});
