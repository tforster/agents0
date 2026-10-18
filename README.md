# Agents0 <!-- omit in toc -->

_The skills, agents, rules and hooks that deliver the [Dev0](https://github.com/tforster/dev0) workflow, as a Claude Code plugin marketplace._

## Table of Contents <!-- omit in toc -->

- [1. About](#1-about)
- [2. Quick Start](#2-quick-start)
  - [2.1. Install](#21-install)
  - [2.2. Edit loop](#22-edit-loop)
  - [2.3. Pin policy](#23-pin-policy)
  - [2.4. Development](#24-development)
- [3. Documentation](#3-documentation)
- [4. Known Issues](#4-known-issues)
- [5. Change Log](#5-change-log)
- [6. Contributing](#6-contributing)
- [7. License](#7-license)

## 1. About

Agents0 is the toolkit the Dev0 workflow is delivered through: a personal, Claude-only Claude Code marketplace whose `agents0` plugin carries the skills, agents, rules, hooks and ADRs, and which pins the third-party plugins the workflow uses.

[Dev0](https://github.com/tforster/dev0) is the philosophy -- what simplicity means and how work is divided between architects and doers. Agents0 progressively enhances it for coding agents; Dev0 never depends on Agents0.

The scope test for anything added here: does it exist only to serve the Dev0 workflow? **In:** agentic traits (skills, agents, rules, hooks, ADRs), worktree shell functions, project templates. **Out, to the dotfiles repo:** general shell and machine setup. **Out, to [dev0](https://github.com/tforster/dev0):** the philosophy itself.

**Key points:**

- The repo root is both the `agents0` marketplace (`.claude-plugin/marketplace.json`) and the `agents0` plugin (`.claude-plugin/plugin.json`)
- Installed and updated with `claude plugin`; no installer of its own
- Plugins cannot ship rules, so each file in `rules/` is injected by its own SessionStart hook
- Third-party skills come from their authors' plugins, pinned in the marketplace, not vendored copies
- Deliberately minimal: "simple and good enough for one person" over generality

It began as `capabilities`, scaffolding for [trAIt](https://github.com/tforster/trait), and was then `dev0` until the philosophy and the toolkit split. See [`docs/explanation/architecture.md`](./docs/explanation/architecture.md) for the design rationale.

## 2. Quick Start

### 2.1. Install

```bash
claude plugin marketplace add tforster/agents0
claude plugin install agents0@agents0
# the pinned third-party plugins, as needed
for plugin in mattpocock-skills cloudflare tare c4-architecture; do claude plugin install "$plugin@agents0"; done
```

Or declare both in `~/.claude/settings.json`. The `extraKnownMarketplaces` key must equal the marketplace's own name, `agents0`, or the marketplace is cloned but nothing installs:

```json
{
  "extraKnownMarketplaces": {
    "agents0": { "source": { "source": "github", "repo": "tforster/agents0" } }
  },
  "enabledPlugins": {
    "agents0@agents0": true
  }
}
```

Either way, skills are available from the next session. Plugin skills and agents carry the plugin prefix, such as `agents0:markdown`.

### 2.2. Edit loop

The plugin has no `version`, so Claude Code keys its cache by commit and every pushed commit is an update:

1. Commit and push the change
2. `claude plugin marketplace update agents0 && claude plugin update agents0@agents0`
3. Restart Claude Code

While developing, `claude --plugin-dir <path-to-this-repo>` loads the working copy in place for one session, with no commit.

### 2.3. Pin policy

Pin each third-party plugin to a release tag (`ref`) and that tag's 40-character commit (`sha`). Upstreams with no tags are pinned to a commit alone. A third-party plugin that sets `version` is cached by that version, so moving its pin to a commit with the same version is a no-op for `claude plugin update`; reinstall it instead with `claude plugin uninstall <plugin>@agents0` and `claude plugin install <plugin>@agents0`.

### 2.4. Development

```bash
npm install                           # dev tooling only
npm test                              # full test suite (node:test)
npm run lint                          # oxlint
npm run format                        # oxfmt --write
npm run format:check                  # oxfmt --check (no write)
npm run typecheck                     # tsc --noEmit -p jsconfig.json
claude plugin validate .              # marketplace and plugin manifests
```

## 3. Documentation

Documentation follows the [Diátaxis framework](https://diataxis.fr):

- **[Tutorials](./docs/tutorials/README.md)** — step-by-step guides for getting started
- **[How-To Guides](./docs/how-to/README.md)** — practical guides for specific tasks
- **[Reference](./docs/reference/README.md)** — specs and the PRD
- **[Explanation](./docs/explanation/README.md)** — architecture, design rationale, and how work is shaped for agents

📚 **Start here:** [Documentation Index](./docs/README.md)

> [!NOTE]
>
> Tutorials and how-to guides are still stubs — this is a young, single-user tool. Reference (`prd.md`) and Explanation are the most complete sections today.

## 4. Known Issues

Subagents started with the Agent tool do not receive the rules: SessionStart hook context reaches only the main session and `claude -p` workers.

Work is tracked in the Dev0 project in Paca, one epic per phase of the Dev0 framework (`docs/scratch/2026-09-11-dev0-framework.md` §15). The original issue-by-issue build log lives in git history.

## 5. Change Log

No `CHANGELOG.md` yet. For now, `git log` is the change history.

## 6. Contributing

This is a personal, single-user tool and isn't set up to take outside contributions. If you're working in this codebase, `CLAUDE.md` and `docs/explanation/architecture.md` are the places to start.

## 7. License

MIT License — see [LICENSE](./LICENSE) for details.

**Author:** Troy Forster ([@tforster](https://github.com/tforster)) — <troy.forster@gmail.com>
