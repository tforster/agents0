# Architecture <!-- omit in toc -->

How Agents0, the toolkit that delivers [Dev0](https://github.com/tforster/dev0), is put together, and why.

## Table of Contents <!-- omit in toc -->

- [1. Background](#1-background)
- [2. Scope, and Where It Came From](#2-scope-and-where-it-came-from)
- [3. Repository Layout](#3-repository-layout)
- [4. Marketplace and Plugin](#4-marketplace-and-plugin)
- [5. Rules Through Hooks](#5-rules-through-hooks)
  - [5.1. Account Gate](#51-account-gate)
  - [5.2. Sandbox Placeholder Cleanup](#52-sandbox-placeholder-cleanup)
  - [5.3. PHP Format and Lint](#53-php-format-and-lint)
  - [5.4. Format and Lint](#54-format-and-lint)
  - [5.5. Completion Gate](#55-completion-gate)
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
│   ├── hooks.json           # one SessionStart and one SubagentStart entry per rule, plus enforcement hooks
│   ├── inject-rule.js
│   ├── clean-config-lock.js # PostToolUse: stale sandbox .git/config.lock -- see §5.2
│   ├── sandbox-placeholders.js
│   ├── sweep-placeholders.js
│   ├── format-lint-php.js   # PostToolUse: PHP format and lint -- see §5.3
│   ├── format-lint-oxc.js   # PostToolUse: oxfmt and oxlint -- see §5.4
│   └── completion-gate.js   # Stop: lint, typecheck and test -- see §5.5
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

### 5.1. Account Gate

Not a rule: a global `UserPromptSubmit` hook, `hooks/account-gate.js`, refuses a prompt when the signed-in Claude account is not the one mapped to the `origin` owner of the repo the prompt is submitted in (D75). It is a hook because a session cannot change its own account and a prose rule cannot see which account it runs under; blocking the prompt is the one moment that can say `/logout`, `/login`. `SessionStart` was rejected because it can only warn, and a warning scrolls past.

- **The map** is the `ClaudeAccounts` environment variable, a JSON object of owner to account email, exported from the user's shell profile. It is not in the repo because the repo is public, and not in `plugin.json` `userConfig` because object values are unverified there. Owner and email match case-insensitively
- **The owner** is the first path segment of `git remote get-url origin`, in the scp, `https://` and `ssh://` forms, with no host special cases: an Azure DevOps SSH remote yields `v3`, which is not in the map, and passes
- **The account** is `oauthAccount.emailAddress` in `$CLAUDE_CONFIG_DIR/.claude.json`, else `~/.claude.json`
- **Passes silently** when it cannot tell: variable unset, no repo or `origin`, owner not in the map, no signed-in account. A set but malformed variable (not a JSON object of strings) blocks instead, naming the variable, because failing open would hide the typo

[Set it up](../../README.md#41-account-gate).

### 5.2. Sandbox Placeholder Cleanup

On Linux and WSL2 the Bash sandbox bind-mounts over protected paths, and where a path does not exist it first creates an empty read-only placeholder on the host. [The sandboxing docs](https://code.claude.com/docs/en/sandboxing) say the sandbox removes it afterwards; on 2.1.29x it often does not: the cleanup is per process with no refcount, so concurrent sessions in one project root race ([#94008](https://github.com/anthropics/claude-code/issues/94008); also #78818, #101155, #102516). The placeholder that breaks work is `.git/config.lock`, which git reads as a held lock. Hooks run outside the sandbox, so one can delete it:

- **`hooks/clean-config-lock.js`**, a `PostToolUse` hook on `Bash`, deletes `config.lock` in the git common directory only when it is an empty, read-only regular file and no `git` process is running (`pgrep -x git`; no `pgrep` counts as none). Git's own locks are writable and hold content, so they never match. It skips `run_in_background` calls, whose sandboxed command may still be live
- The hook resolves the repository with `git rev-parse --git-common-dir` from the hook input's `cwd`, not `$CLAUDE_PROJECT_DIR`: that stays at the session's start directory, and in a linked worktree the lock lives in the main repository's `.git`. Outside a git repository it does nothing
- **`hooks/sweep-placeholders.js`**, run by the `sandbox-placeholders` skill, also clears the empty read-only files in the repository root and `.claude/`. It is manual on purpose: a `Stop` hook would race another session's live sandboxed command, and `SessionEnd` gets 1.5 seconds and does not run when a session is killed, which is what leaves strays. It removes a path only when git shows it untracked, ignored or just added, so a tracked empty file is safe

### 5.3. PHP Format and Lint

Not a rule either: a `PostToolUse` hook on `Edit|Write`, `hooks/format-lint-php.js`, for a `*.php` file outside `vendor/` (D29, D60). Local PHP is newer than production, so syntax that runs locally can break there; the hook says so in the same turn.

- **Formatter**: the host `php-cs-fixer` runs on the changed file with the repo's `.php-cs-fixer.php`, else `.php-cs-fixer.dist.php`. No config, or no binary, skips it
- **Production version**: `composer.json` `config.platform.php`, reduced to major.minor, read by `readProductionPhp`. This is the one place a repo declares it, so a PHP repo sets it for Composer's own sake too. No `composer.json`, or no value, skips the lint silently
- **Lint**: `php -l` runs in `docker run --rm php:<major.minor>-cli` with the repo mounted read-only. The first run for a version pulls the image, hence the 120-second hook timeout; nothing is pre-pulled
- **Feedback**: a formatter failure or a syntax error is a `decision: "block"` result, which returns the output to Claude in the same turn. When Docker cannot run (binary missing, daemon down, pull failed) the lint is skipped and `php -l skipped: docker unavailable` is added as context without blocking

### 5.4. Format and Lint

A `PostToolUse` hook on `Edit|Write`, `hooks/format-lint-oxc.js`, runs `oxfmt` and then `oxlint` on the changed file only (D9, D10, D29). It replaces the instruction to run lint after every edit: a rule decays over a long session and a hook does not (D24).

- **No extension list**: every file goes to both tools, and each decides what it supports. `oxfmt` answers "Expected at least one target file" and `oxlint` "No files found to lint" for a type they do not handle, or a path their config ignores; both are a silent no-op. A new `oxfmt` language arrives with an upgrade, not a hook change. As of `oxfmt` 0.73.0 that covers JS/TS, JSON, YAML, Markdown, CSS, HTML, Handlebars, Vue, TOML and GraphQL, but not SQL
- **The project's own tools**: the binaries come from the nearest `node_modules/.bin` above the file, and run from that directory so its `.oxfmtrc.json` and `.oxlintrc.json` apply. A project without them is a silent no-op. Never `npx`, which would download a tool the project has not approved (D3)
- **Feedback**: an `oxfmt` failure (usually a syntax error) or an `oxlint` error is a `decision: "block"` result, returned to Claude in the same turn. `oxlint` warnings are not. When `oxfmt` rewrites the file, Claude is told to re-read it, as in §5.3
- **Markdown**: `oxfmt` does not wrap prose and keeps a callout's empty `>` line, so its output meets `rules/markdown.md`

### 5.5. Completion Gate

A `Stop` hook, `hooks/completion-gate.js`, runs `npm run lint`, `npm run typecheck` and `npm test` in the session's directory, in that order, stopping at the first failure, and blocks the stop with its output (D29, D31). It replaces the rules that told the agent to run them: instruction decays over a long session and a hook does not (D24), so no rule, skill, agent or `CLAUDE.md` may say it any more, and a test holds that line.

- **When it runs**: only when `git status --porcelain` shows changes, so a question-only turn, or work already committed, costs no test run. Outside a git repo it always runs
- **Which repos**: one with no `package.json` is not an npm project, and passes silently. One with a `package.json` missing any of the three scripts is blocked, naming them: the JS template gives every Dev0 project all three (D68), so a missing one is the thing to fix
- **Two retries**: Claude Code sets `stop_hook_active` when a stop follows a block. The gate counts those in a per-session file in the temp directory: the first stop of a turn starts at one, the third consecutive failure lets the stop through with a `systemMessage` that the gate is red and the tail of its output. A pass, or the next user prompt, resets the count. Looping forever on a failure the agent cannot fix would burn the session instead of handing it to a human
- **Output**: the last 8,000 characters, where a test runner puts its failures and summary
- **Timeout**: 600 seconds, for slow suites. A timed-out hook fails open

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
