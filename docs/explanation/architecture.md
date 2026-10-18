# Architecture <!-- omit in toc -->

How Agents0, the toolkit that delivers [Dev0](https://github.com/tforster/dev0), is put together, and why.

## Table of Contents <!-- omit in toc -->

- [1. Background](#1-background)
- [2. Scope, and Where It Came From](#2-scope-and-where-it-came-from)
- [3. Repository Layout](#3-repository-layout)
- [4. `agents0.json`](#4-agents0json)
- [5. CLI and Modules](#5-cli-and-modules)
- [6. Install Model: Plain Symlink, Everywhere](#6-install-model-plain-symlink-everywhere)
- [7. Rules and Claude's `paths:` Scoping](#7-rules-and-claudes-paths-scoping)
- [8. Atomic Install](#8-atomic-install)
- [9. Status Model](#9-status-model)
- [10. `sync`](#10-sync)
- [11. Testing Strategy](#11-testing-strategy)
- [12. Dependencies and Version Control](#12-dependencies-and-version-control)
- [13. Further Reading](#13-further-reading)

## 1. Background

Skill, agent, and rule files for AI coding harnesses tend to scatter across `~/.claude/`, `~/.copilot/`, etc., with no single source of truth and no way to keep them consistent across machines. Agents0 is one workstation-global repository for everything the Dev0 workflow installs into a harness, synced across machines via git.

## 2. Scope, and Where It Came From

Agents0 is the toolkit the Dev0 workflow is delivered through. [Dev0](https://github.com/tforster/dev0) is the philosophy; Agents0 progressively enhances it for coding agents, and Dev0 never depends on Agents0. Someone who wants Dev0 without this toolkit uses dev0's `prompt.md` instead. The scope test for anything added here: does it exist only to serve the Dev0 workflow?

- **In:** agentic traits (skills, agents, rules, hooks, ADRs), worktree shell functions, project templates
- **Out, to the dotfiles repo:** general shell and machine setup -- prompt, aliases, PATH, editor
- **Out, to dev0:** the philosophy itself. `install/rules/dev0.md` stays here: it is the operating rules agents load, derived from the philosophy, not the philosophy

It is still a single-author, single-harness (Claude) tool, and every design choice below favours "simple and good enough for one person" over generality.

The repo began as `capabilities`, explicit scaffolding for [trAIt](https://github.com/tforster/trait) -- a separate, more ambitious proposal for a distributed-wiki model of AI agent files, multi-author and multi-harness. It was renamed `dev0` when its scope grew from syncing `~/.claude` to delivering Dev0, and renamed Agents0 when the philosophy moved out: the dev0 repo kept only the philosophy, and the CLI, skills, agents, rules, hooks, ADRs and docs came here. `install/` is the one name kept from trAIt's vocabulary.

## 3. Repository Layout

```text
agents0/
├── README.md
├── agents0.json             # harness registry — see §4
├── bin/
│   └── agents0              # CLI entry point, symlinked into ~/.local/bin
├── lib/                     # CLI implementation, one module per concern
├── install/                 # everything installed into a harness (§2)
│   ├── skills/
│   │   └── <skill-name>/SKILL.md
│   ├── agents/
│   │   └── <agent-name>.md  # Claude-native frontmatter: name, description, tools, model
│   └── rules/
│       └── <topic>.md
└── prd.md
```

`skills/`, `agents/`, `rules/` live under one `install/` parent, kept visually and structurally distinct from `docs/`, `tests/`, `lib/`, and the rest of the tooling.

## 4. `agents0.json`

The install registry: where the CLI is linked (`bin`), and a `harnesses` map of harness to category to target path. Only `claude` is populated:

```json
{
  "bin": "~/.local/bin/agents0",
  "harnesses": {
    "claude": {
      "skills": "~/.claude/skills",
      "agents": "~/.claude/agents",
      "rules": "~/.claude/rules"
    }
  }
}
```

A category missing under a harness means "not applicable," not an error. A new install target is a config entry, not a code path.

## 5. CLI and Modules

`bin/agents0` is a single Node.js ESM entry point. `agents0 install` links it to the path in `agents0.json`'s `bin` key (`~/.local/bin/agents0`), so bootstrapping a machine is `git clone`, then `node bin/agents0 install` -- there is no `install.sh`. It resolves its own real path via `import.meta.url`, so it works whether invoked directly or through that symlink, and it exits with a clear message on Node older than 24. Each subcommand is a thin wrapper over one `lib/` module:

| Command                       | Module                          |
| ----------------------------- | ------------------------------- |
| `agents0 install [harness]`   | `lib/install.js`                |
| `agents0 uninstall [harness]` | `lib/install.js`                |
| `agents0 status`              | `lib/status.js`                 |
| `agents0 sync`                | `lib/sync.js` (via `lib/jj.js`) |
| `agents0 new skill <name>`    | `lib/new-skill.js`              |

Without a harness, `install` and `uninstall` act on every harness in `agents0.json`. Uninstalling one harness keeps the CLI link; a full `uninstall` removes it.

`lib/config.js` reads `agents0.json` with `JSON.parse`, rejects a missing file, malformed JSON or a wrong shape with an error naming the file, and expands leading `~` to the home directory; every other module takes the parsed config as a plain object.

## 6. Install Model: Plain Symlink, Everywhere

`skills/`, `agents/`, and `rules/` all use the same model: `lib/install.js` symlinks each whole directory into the harness's configured path. `agents0 install claude` produces `~/.claude/skills`, `~/.claude/agents`, `~/.claude/rules` — each a directory symlink into `install/`. One rule, three categories, no exceptions, no per-category code.

Agent files are plain Claude-native frontmatter (`name`, `description`, optionally `tools`/`model`) — no per-harness variation, since Claude is the only harness Agents0 installs for (§2).

## 7. Rules and Claude's `paths:` Scoping

`install/rules/` is flat — every file in it is an independent topic file, symlinked wholesale to `~/.claude/rules/`. Claude scopes a rule file to specific paths via `paths:` frontmatter; a rule file without it loads unconditionally on every session. Agents0 doesn't manage or validate that frontmatter — it's just markdown content being symlinked, same as everything else in `install/`.

## 8. Atomic Install

`install` refuses, without making any changes, if any target path already exists as a real (non-symlink) file or directory. To guarantee "no changes on refusal" holds across every link it manages -- each applicable category of each selected harness, plus the CLI link -- `install` runs in two phases: it first validates every link (already-correct symlink, conflicting real file or directory, or fresh path to create), builds a plan, and only then applies it. A conflict on the second link can't leave the first partially installed, because nothing is written until every link has been validated.

Re-running `install` on an already-correct symlink is a no-op by the same mechanism — if the existing symlink already resolves to the expected source, that link is skipped in the plan.

## 9. Status Model

`agents0 status` reports one of four states per harness, per category:

| State            | Meaning                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| `not-applicable` | The harness doesn't configure this category at all                                             |
| `missing`        | Configured, but nothing exists at the target path yet                                          |
| `broken`         | A real directory blocks the symlink, the symlink points somewhere unexpected, or it's dangling |
| `correct`        | Installed exactly as expected                                                                  |

The same symlink-resolution check applies uniformly to `skills`, `agents`, and `rules` — no per-category special-casing.

## 10. `sync`

`agents0 sync` wraps `jj git fetch` → integrate → `jj describe` → `jj git push` into one command. `lib/sync.js` takes its `jj` runner as an injected parameter rather than shelling out directly, so the sequencing logic is testable without a real git remote. `lib/jj.js` is the one concrete implementation of that runner, and the only module that shells out via `node:child_process` for version control.

Two behaviours worth knowing:

- A conflict surfaced by `jj rebase` (detected by pattern-matching its output for "conflict") aborts the sequence **before** `describe` or `push` run.
- `describe` only runs when `jj diff --stat` reports actual working-copy changes, so a no-op `sync` doesn't clobber an existing commit description.

## 11. Testing Strategy

Filesystem-backed modules are tested against real temporary directories rather than a mocked `fs` — the behaviour under test _is_ filesystem symlink manipulation, so faking `fs` would only test a hand-written stub. `bin/agents0` is tested by spawning it as an actual child process, including through a symlink.

`sync` is the exception: its correctness is entirely about _sequencing_ jj calls and reacting to their output, and a real git remote is exactly the kind of external boundary worth mocking.

## 12. Dependencies and Version Control

There are no runtime dependencies. The registry is JSON so it can be read with `JSON.parse` rather than a parser package or a hand-rolled YAML subset (D66); new install targets are config entries, not code paths.

The repository is a normal git repository under the hood, but local development uses [Jujutsu](https://jj-vcs.github.io/jj/) (`jj`) on a colocated git backend. `agents0 sync` (§10) is written against jj's own vocabulary (`describe`, bookmarks) rather than git's.

## 13. Further Reading

- [`prd.md`](../../prd.md) — the design discussion and open items behind this architecture
- [Shaping Work for Agents](./shaping-work-for-agents.md) — how work is broken down for the agents this toolkit equips
- [Dev0](https://github.com/tforster/dev0) — the philosophy Agents0 delivers

[← Back to Explanation](./README.md)
