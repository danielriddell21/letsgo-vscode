# letsgo for VS Code

A thin editor client for [letsgo](https://github.com/danielriddell21/letsgo).
Everything it knows comes from the `letsgo` binary on your machine — this
extension carries no copy of its directive table, hook list or feature
catalogue.

> **Status: early.** The panel and status bar work; language features
> (diagnostics, completion, hover, code actions) are the next phase, served
> by `letsgo lsp`.

## Requirements

`letsgo` on your `PATH`, or pointed to with `letsgo.path`:

```sh
go install github.com/danielriddell21/letsgo/cmd/letsgo@latest
```

## What it does

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
