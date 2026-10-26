# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Agents0 is the toolkit that delivers the [Dev0](https://github.com/tforster/dev0) philosophy through Claude Code: a personal, single-harness (Claude-only) repo whose root is both the `agents0` Claude Code marketplace and the `agents0` plugin. Agents0 progressively enhances Dev0; Dev0 never depends on Agents0, so nothing in the dev0 repo may assume this toolkit is installed. Scope test for any addition: does it exist only to serve the Dev0 workflow? **In:** agentic traits (skills, agents, rules, hooks, ADRs), worktree shell functions, project templates. **Out, to the dotfiles repo:** general shell and machine setup (prompt, aliases, PATH, editor). **Out, to dev0:** the philosophy itself. Favour "simple and good enough for one person" over generality in any change here.

Read `docs/explanation/architecture.md` first for any non-trivial change; `docs/scratch/2026-10-18-plugin-pinning-spike.md` has the evidence behind the plugin design.

## Commands

```bash
npm test                              # full suite (node:test)
node --test tests/plugin.test.js      # single file
npm run lint                          # oxlint
npm run format                        # oxfmt --write
npm run format:check                  # oxfmt --check (no write)
npm run typecheck                     # tsc --noEmit -p jsconfig.json — JSDoc types, no .ts files
claude plugin validate .              # marketplace and plugin manifests
claude --plugin-dir .                 # load this working copy as the plugin for one session
```

The completion gate (`hooks/completion-gate.js`) runs `lint`, `typecheck` and `test` when a session stops with uncommitted changes. Type checking is JSDoc-based (`checkJs: true`, no `.ts` files). Plugin content -- `skills/`, `agents/`, `rules/`, `adr/` -- is excluded from lint, format and typecheck; `hooks/` and `tests/` are not.

## Architecture

- **Plugin layout**: `.claude-plugin/marketplace.json` lists `agents0` (`"source": "./"`) plus pinned third-party plugins; `.claude-plugin/plugin.json` has **no `version`**, so the cache is keyed by commit and every commit is an update. Do not add one.
- **Rules**: plugins cannot ship rules, so each `rules/*.md` has its own SessionStart and SubagentStart entry in `hooks/hooks.json`, both running `hooks/inject-rule.js`. A new rule needs both entries, and must stay under 10,000 characters (hook output cap); `tests/plugin.test.js` enforces both.
- **Paths**: never write `~/.claude/` into plugin content. Skills use `${CLAUDE_SKILL_DIR}`; rules use `${CLAUDE_PLUGIN_ROOT}`, which `inject-rule.js` substitutes.
- **Third-party skills are not vendored**: add the upstream plugin to `marketplace.json`, pinned to a release tag (`ref`) and its 40-character `sha`.
- **Testing convention**: tests read the repo's own files and run `hooks/inject-rule.js` as a real child process. Any `claude` CLI call in a test uses a throwaway `CLAUDE_CONFIG_DIR`.

## Code style

- ESM only (`"type": "module"`), explicit `.js` extensions on local imports
- JSDoc on all functions
- 2-space indent, double quotes, 132 char line width — enforced by `oxfmt` (`.oxfmtrc.json`), not manual
