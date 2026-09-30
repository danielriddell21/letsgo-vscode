# letsgo for VS Code

A thin editor client for [letsgo](https://github.com/danielriddell21/letsgo).
Everything it knows comes from the `letsgo` binary on your machine — this
extension carries no copy of its directive table, hook list or feature
catalogue.

> **Status: v1.** The panel, status bar, language features, Update pin, Tag
> next version, the manifest viewer, the palette commands and the `letsgo` task
> type work.

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

**Commands** (Command Palette, all from the binary on your machine; each runs
in the terminal panel unless noted, and none runs in an untrusted workspace):

| command | runs |
| --- | --- |
| Plan with analysis | `letsgo plan --json --analyse`, refreshing the panel |
| Build snapshot | `letsgo build --snapshot` |
| Rehearse release | `letsgo release --snapshot` (publishes nothing) |
| Diff releases | `letsgo diff <from> [to]`, shown in a read-only document |
| Install pinned plugins | `letsgo plugin install` |
| Update letsgo | `letsgo update`, after showing what is available and asking |

Checks that point at a line of `letsgo.mod` (a budget naming a target that
isn't built, say) also show as squiggles there and in Problems.

**Tasks**: a `letsgo` task type for `tasks.json`, with a `$letsgo` problem
matcher for `letsgo.mod:L:C: message` lines. It runs `plan`, `build`, `verify`,
`diff`, `doctor`, `features`, `audit` and `plugin`, plus `release` only with
`--snapshot`: the extension never publishes a release.

```json
{ "type": "letsgo", "command": "plan", "args": ["--analyse"], "problemMatcher": "$letsgo" }
```

**Older letsgo**: the extension checks `letsgo version` and switches off
features a too-old binary lacks, named once in a warning rather than failing
repeatedly. See [Editor support][docs] for the version each feature needs.

## Documentation

Full docs — the LSP methods, every command, the task type, and how this fits
into the rest of letsgo — live on the [Editor support][docs] page of the
[letsgo wiki][wiki].

[docs]: https://github.com/danielriddell21/letsgo/wiki/Editor-Support
[wiki]: https://github.com/danielriddell21/letsgo/wiki

## Development

```sh
npm ci --ignore-scripts
npm test            # compile, lint, unit tests (no VS Code needed)
npm run test:host   # extension-host tests in a real VS Code
```

`npm run test:host` downloads VS Code into `.vscode-test/` on first run and
runs two suites in its extension host, one in a trusted workspace and one in an
untrusted one, against a fixture workspace (`src/test/host/fixtures`). A fake
`letsgo` script first on `PATH` stands in for the binary, so no letsgo install
is needed; it logs every call, which is how the tests see what the extension
ran. On a headless Linux box wrap it in `xvfb-run -a`; CI does. The host tests
need Linux or macOS. Set `VSCODE_TEST_VERSION` to test another VS Code version.
