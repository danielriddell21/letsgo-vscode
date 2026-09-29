import { test } from "node:test";
import assert from "node:assert/strict";
import { isSafeTag, manifestTag, parseManifest, renderManifest, verifyCommand } from "../manifest";

const base = { schema: 1, project: "foo", version: "1.2.0", commit: "abc" };

test("the tag is the manifest's own, else prefix and version", () => {
  assert.equal(manifestTag(parseManifest(JSON.stringify({ ...base, tag: "foo/v1.2.0" }))), "foo/v1.2.0");
  assert.equal(manifestTag(parseManifest(JSON.stringify({ ...base, tag_prefix: "svc/" }))), "svc/v1.2.0");
  assert.equal(manifestTag(parseManifest(JSON.stringify(base))), "v1.2.0");
  assert.equal(verifyCommand(base), "letsgo verify v1.2.0");
});

test("something that is not a manifest is rejected", () => {
  assert.throws(() => parseManifest("{}"), /not a letsgo manifest/);
  assert.throws(() => parseManifest("nope"));
});

test("the summary lists artifacts, gates, features and plugins", () => {
  const html = renderManifest({
    ...base,
    gates: { vulncheck: "pass" },
    features: { disabled: ["sbom"], required: ["apidiff"] },
    artifacts: [{ name: "foo_linux_amd64.tar.gz", os: "linux", arch: "amd64", size: 10, sha256: "deadbeef" }],
    builder: { tool: "letsgo", go: "1.24", plugins: [{ hook: "ldflags", command: "letsgo-env", digest: "sha256:aa" }] },
  });
  for (const want of ["foo_linux_amd64.tar.gz", "linux/amd64", "vulncheck", "sbom", "required", "letsgo-env", "letsgo verify v1.2.0"]) {
    assert.ok(html.includes(want), `missing ${want}`);
  }
});

test("manifest values cannot inject markup", () => {
  const html = renderManifest({ ...base, project: "<script>alert(1)</script>" });
  assert.ok(!html.includes("<script>"));
});

test("only plain tag names are passed on as arguments", () => {
  for (const ok of ["v1.2.0", "services/api/v1.2.0", "v1.2.0-rc.1", "v1.2.0+meta"]) {
    assert.ok(isSafeTag(ok), ok);
  }
  for (const bad of ["", "--upload-pack=x", "-v1", "v1 2", "v1;rm", "$(x)"]) {
    assert.ok(!isSafeTag(bad), bad);
  }
});
