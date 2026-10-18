# Develop Agents0 <!-- omit in toc -->

How to change Agents0 and get the change into your own Claude Code: the edit loop, moving a third-party pin, and the checks to run first. [Architecture](../explanation/architecture.md) explains why it works this way.

## Table of Contents <!-- omit in toc -->

- [1. Prerequisites](#1-prerequisites)
- [2. Steps](#2-steps)
  - [2.1. Try a change in place](#21-try-a-change-in-place)
  - [2.2. Ship a change](#22-ship-a-change)
  - [2.3. Move a third-party pin](#23-move-a-third-party-pin)
- [3. Verification](#3-verification)

## 1. Prerequisites

- Agents0 installed, as in the [README](../../README.md#4-quick-start)
- A clone of this repository, with `npm install` run for the dev tooling

## 2. Steps

### 2.1. Try a change in place

`claude --plugin-dir <path-to-this-repo>` loads the working copy as the plugin for one session, with no commit.

### 2.2. Ship a change

The plugin has no `version`, so Claude Code keys its cache by commit and every pushed commit is an update:

1. Commit and push the change
2. `claude plugin marketplace update agents0 && claude plugin update agents0@agents0`
3. Restart Claude Code

### 2.3. Move a third-party pin

Pin each third-party plugin in `.claude-plugin/marketplace.json` to a release tag (`ref`) and that tag's 40-character commit (`sha`). Upstreams with no tags are pinned to a commit alone.

A third-party plugin that sets `version` is cached by that version, so moving its pin to a commit with the same version is a no-op for `claude plugin update`. Reinstall it instead with `claude plugin uninstall <plugin>@agents0` and `claude plugin install <plugin>@agents0`.

## 3. Verification

```bash
npm test                              # full test suite (node:test)
npm run lint                          # oxlint
npm run format:check                  # oxfmt --check (no write)
npm run typecheck                     # tsc --noEmit -p jsconfig.json
claude plugin validate .              # marketplace and plugin manifests
```

[← Back to How-To Guides](./README.md)
