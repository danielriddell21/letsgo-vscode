# letsgo for VS Code

A thin editor client for [letsgo](https://github.com/danielriddell21/letsgo).
Everything it knows comes from the `letsgo` binary on your machine — this
extension carries no copy of its directive table, hook list or feature
catalogue.

> **Status: early.** The panel, status bar, language features, Update pin,
> Tag next version and the manifest viewer work.

## Requirements

`letsgo` on your `PATH`, or pointed to with `letsgo.path`:

```sh
go install github.com/danielriddell21/letsgo/cmd/letsgo@latest
```

## What it does

**Language features** for `letsgo.mod`, the global `config.mod` and
`.letsgo/*.mod`, served by `letsgo lsp` (so they need a letsgo new enough to
have it): diagnostics on every change, completion, hover documentation,
formatting and an outline. Nothing about the syntax is hard-coded here; it all
comes from the binary. In an untrusted workspace the server starts with
`--restricted` (parse, format and complete only).

A **letsgo** view in the Explorer sidebar, one entry per module (a directory
with a `letsgo.mod`), built from `letsgo plan --json`:

- resolved values (version, commit, targets)
- gates, with their pass/fail/warn/skip status
- artifacts the release would produce
- features that depart from their defaults
- plugin pins

The status bar shows the current module's version and gate-failure count.

In an untrusted workspace the extension never runs `letsgo plan` — a
repository you have only opened, not trusted, cannot execute its own pinned
plugins through it.

**Update pin**: a lightbulb on a `plugin <hook> <command> <version> sha256:…`
line installs the plugin's latest release into the plugin store and rewrites
the pin. Not offered in an untrusted workspace.

**Tag next version**: `letsgo: Tag next version` asks letsgo for a proposal
(`letsgo tag --json`), shows major/minor/patch with the proposed level first
and its reason, then tags on your pick. It then offers to push the tag, which
is what starts the release in CI. The extension never publishes a release
itself. Not run in an untrusted workspace.

**Manifests**: a `letsgo.json` gets a Verify lens (`letsgo verify <tag>`,
output in the terminal panel), and "Reopen Editor With… → letsgo manifest"
shows its artifacts, gates, features and plugins with a Verify button.
`letsgo: Verify release` asks for a tag.

**Older letsgo**: the extension checks `letsgo version`. Features a too-old
letsgo lacks are switched off and named in a warning — the panel, Tag and Verify need 0.29.0,
language features 0.30.0, Update pin 0.31.0. A dev build is assumed current.
