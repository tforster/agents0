# Architecture <!-- omit in toc -->

How Agents0, the toolkit that delivers [Dev0](https://github.com/tforster/dev0), is put together, and why.

## Table of Contents <!-- omit in toc -->

- [1. Background](#1-background)
- [2. Scope, and Where It Came From](#2-scope-and-where-it-came-from)
- [3. Repository Layout](#3-repository-layout)
- [4. Marketplace and Plugin](#4-marketplace-and-plugin)
- [5. Rules Through Hooks](#5-rules-through-hooks)
  - [5.2. PHP Format and Lint](#52-php-format-and-lint)
- [6. Paths Inside the Plugin](#6-paths-inside-the-plugin)
- [7. Third-Party Plugins and Pins](#7-third-party-plugins-and-pins)
- [8. Testing Strategy](#8-testing-strategy)
- [9. Dependencies and Version Control](#9-dependencies-and-version-control)
- [10. Further Reading](#10-further-reading)

## 1. Background

Skill, agent, and rule files for AI coding harnesses tend to scatter across `~/.claude/`, `~/.copilot/`, etc., with no single source of truth and no way to keep them consistent across machines. Agents0 is one repository for everything the Dev0 workflow installs into Claude Code, delivered as a Claude Code plugin marketplace.

## 2. Scope, and Where It Came From

Agents0 is the toolkit the Dev0 workflow is delivered through. [Dev0](https://github.com/tforster/dev0) is the philosophy; Agents0 progressively enhances it for coding agents, and Dev0 never depends on Agents0. The scope test for anything added here: does it exist only to serve the Dev0 workflow?

- **In:** agentic traits (skills, agents, rules, hooks, ADRs), worktree shell functions, project templates
- **Out, to the dotfiles repo:** general shell and machine setup -- prompt, aliases, PATH, editor
- **Out, to dev0:** the philosophy itself. `rules/dev0.md` stays here: it is the operating rules agents load, derived from the philosophy, not the philosophy

It is still a single-author, single-harness (Claude) tool, and every design choice below favours "simple and good enough for one person" over generality.

The repo began as `capabilities`, explicit scaffolding for [trAIt](https://github.com/tforster/trait) -- a separate, more ambitious proposal for a distributed-wiki model of AI agent files, multi-author and multi-harness. It was renamed `dev0` when its scope grew from syncing `~/.claude` to delivering Dev0, and renamed Agents0 when the philosophy moved out. Until DEV0-67 it shipped its own CLI, which symlinked `install/{skills,agents,rules}` into `~/.claude/`; Claude Code plugins replaced it (`docs/scratch/2026-10-18-plugin-pinning-spike.md`).

## 3. Repository Layout

```text
agents0/
├── .claude-plugin/
│   ├── marketplace.json     # the agents0 marketplace -- see §4 and §7
│   └── plugin.json          # the agents0 plugin; no version
├── skills/<name>/SKILL.md   # Agents0's own skills
├── agents/<name>.md         # Agents0's own agents
├── rules/<topic>.md         # injected by hooks -- see §5
├── hooks/
│   ├── hooks.json           # one SessionStart and one SubagentStart entry per rule, plus the other hooks
│   ├── inject-rule.js
│   └── php-format-lint.js
├── adr/                     # cross-project ADRs
├── docs/
└── tests/
```

The repo root is the plugin root, so the plugin directories sit at the top level. `docs/`, `tests/` and the dev tooling travel with the plugin, and Claude Code ignores them.

## 4. Marketplace and Plugin

`.claude-plugin/marketplace.json` names the marketplace `agents0` and lists the `agents0` plugin with `"source": "./"`. Install is `claude plugin marketplace add tforster/agents0`, then `claude plugin install agents0@agents0`; the README has the settings form, and [Develop Agents0](../how-to/develop-agents0.md) the edit loop.

`plugin.json` sets no `version` on purpose. With a version, Claude Code caches by it and `claude plugin update` ignores every commit until the version changes. Without one, the cache is keyed by commit, so each pushed commit is an update and nothing needs bumping. `claude plugin validate` warns about the missing version; the warning is expected.

Plugin skills and agents are namespaced: `markdown` becomes `agents0:markdown`.

## 5. Rules Through Hooks

Plugins cannot carry rules and have no install hook. So `hooks/hooks.json` gives each file in `rules/` two entries, each running `hooks/inject-rule.js` on that file, which returns it as `additionalContext`:

- **SessionStart**, matched on `startup|clear|compact`, for the main session and `claude -p` workers. `resume` is left out: a resumed session is expected to carry the rules in its transcript already
- **SubagentStart**, matched on `*`, for subagents started with the Agent tool, which never see SessionStart context

One hook per rule, not one for all, because Claude Code caps each hook's output at 10,000 characters and replaces anything longer with a file path and a 2,000-character preview. All six rules together are about 17,000 characters. A test fails when any rule reaches the cap or lacks an entry under either event.

### 5.2. PHP Format and Lint

Not a rule either: a `PostToolUse` hook on `Edit|Write`, `hooks/php-format-lint.js`, for a `*.php` file outside `vendor/` (D29, D60). Local PHP is newer than production, so syntax that runs locally can break there; the hook says so in the same turn.

- **Formatter**: the host `php-cs-fixer` runs on the changed file with the repo's `.php-cs-fixer.php`, else `.php-cs-fixer.dist.php`. No config, or no binary, skips it
- **Production version**: `composer.json` `config.platform.php`, reduced to major.minor, read by `readProductionPhp`. This is the one place a repo declares it, so a PHP repo sets it for Composer's own sake too. No `composer.json`, or no value, skips the lint silently
- **Lint**: `php -l` runs in `docker run --rm php:<major.minor>-cli` with the repo mounted read-only. The first run for a version pulls the image, hence the 120-second hook timeout; nothing is pre-pulled
- **Feedback**: a formatter failure or a syntax error is a `decision: "block"` result, which returns the output to Claude in the same turn. When Docker cannot run (binary missing, daemon down, pull failed) the lint is skipped and `php -l skipped: docker unavailable` is added as context without blocking

## 6. Paths Inside the Plugin

The installed plugin lives in Claude Code's plugin cache, so no file may assume `~/.claude/`:

- **Skills** name bundled files with `${CLAUDE_SKILL_DIR}`, which Claude Code substitutes in skill content
- **Rules** name plugin files with `${CLAUDE_PLUGIN_ROOT}`. Claude Code does not substitute hook output, so `inject-rule.js` replaces it with the real plugin root

## 7. Third-Party Plugins and Pins

Third-party skills are not vendored. Each upstream plugin has an entry in `marketplace.json`, pinned to a release tag (`ref`) and that tag's 40-character `sha`, or to a `sha` alone when upstream has no tags. A plugin that sets `version` is cached by it, so a new pin at the same version needs uninstall and install rather than `update`.

## 8. Testing Strategy

The tests read the repo's own files: manifest shape, one hook per rule under the cap, `inject-rule.js` run as a real child process, plugin paths that resolve, ADR shape and docs. `claude plugin validate` runs as a test when `claude` is on `PATH`, with a throwaway `CLAUDE_CONFIG_DIR` so it never touches real configuration.

## 9. Dependencies and Version Control

There are no runtime dependencies; npm is only for lint, format, typecheck and test. The repository is a normal git repository, used locally with [Jujutsu](https://jj-vcs.github.io/jj/) (`jj`) on a colocated git backend.

## 10. Further Reading

- [`prd.md`](../../prd.md) -- the original design discussion; its CLI and symlink model are superseded by this document
- [Shaping Work for Agents](./shaping-work-for-agents.md) -- how work is broken down for the agents this toolkit equips
- [Dev0](https://github.com/tforster/dev0) -- the philosophy Agents0 delivers

[← Back to Explanation](./README.md)
