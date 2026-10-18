# Agents0 <!-- omit in toc -->

_The skills, agents, rules and tooling that deliver the [Dev0](https://github.com/tforster/dev0) workflow through Claude Code, kept in sync across machines._

## Table of Contents <!-- omit in toc -->

- [1. About](#1-about)
- [2. Quick Start](#2-quick-start)
- [3. Documentation](#3-documentation)
- [4. Known Issues](#4-known-issues)
- [5. Change Log](#5-change-log)
- [6. Contributing](#6-contributing)
- [7. License](#7-license)

## 1. About

Agents0 is the toolkit the Dev0 workflow is delivered through: a personal, single-harness (Claude-only) repo that keeps `install/{skills,agents,rules}` in sync across machines and symlinks them into `~/.claude/`.

[Dev0](https://github.com/tforster/dev0) is the philosophy -- what simplicity means and how work is divided between architects and doers. Agents0 progressively enhances it for coding agents; Dev0 never depends on Agents0. If you want Dev0 without this toolkit, dev0's [`prompt.md`](https://github.com/tforster/dev0/blob/main/prompt.md) is the standalone alternative: one prompt, no install.

The scope test for anything added here: does it exist only to serve the Dev0 workflow? **In:** agentic traits (skills, agents, rules, hooks, ADRs), worktree shell functions, project templates. **Out, to the dotfiles repo:** general shell and machine setup. **Out, to [dev0](https://github.com/tforster/dev0):** the philosophy itself.

**Key points:**

- One canonical copy of skills, agents, and rules, git-synced across machines
- Symlinked wholesale into a harness's config directory -- no per-category special-casing
- Zero runtime dependencies; `npm install` is only for dev tooling
- Deliberately minimal: "simple and good enough for one person" over generality

It began as `capabilities`, scaffolding for [trAIt](https://github.com/tforster/trait), and was then `dev0` until the philosophy and the toolkit split. See [`docs/explanation/architecture.md`](./docs/explanation/architecture.md) for the full design rationale and [`docs/reference/prd.md`](./docs/reference/prd.md) for the original design discussion.

## 2. Quick Start

**Prerequisites:** Node.js 24+ (npm only for development)

```bash
# Clone, then link install/{skills,agents,rules} into ~/.claude/ and bin/agents0 into ~/.local/bin
git clone https://github.com/tforster/agents0.git
cd agents0
node bin/agents0 install

# Check what's currently linked
agents0 status

# Pull/push changes across machines
agents0 sync

# Scaffold a new skill under install/skills/
agents0 new skill <name>
```

For development:

```bash
npm install                           # dev tooling only
npm test                              # full test suite (node:test)
npm run lint                          # oxlint
npm run format                        # oxfmt --write
npm run format:check                  # oxfmt --check (no write)
npm run typecheck                     # tsc --noEmit -p jsconfig.json
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

Work is tracked in the Dev0 project in Paca, one epic per phase of the Dev0 framework (`docs/scratch/2026-09-11-dev0-framework.md` §15). The original issue-by-issue build log lives in git history.

## 5. Change Log

No `CHANGELOG.md` yet. For now, `git log` is the change history.

## 6. Contributing

This is a personal, single-user tool and isn't set up to take outside contributions. If you're working in this codebase, `CLAUDE.md` and `docs/explanation/architecture.md` are the places to start.

## 7. License

MIT License — see [LICENSE](./LICENSE) for details.

**Author:** Troy Forster ([@tforster](https://github.com/tforster)) — <troy.forster@gmail.com>
