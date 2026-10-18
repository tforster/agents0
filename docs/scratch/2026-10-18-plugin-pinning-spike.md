# Plugin Pinning Spike <!-- omit in toc -->

DEV0-67's blocking question: does moving a Claude Code plugin's pinned `sha` reinstall it when the author has not bumped `plugin.json` `version`? Run on 2026-10-18 against Claude Code 2.1.302, in a throwaway `CLAUDE_CONFIG_DIR`, with a local git repo as the plugin source (`"source": "url"`, `file://`), so no real configuration or network was involved.

## Table of Contents <!-- omit in toc -->

- [1. Answer](#1-answer)
- [2. Other findings](#2-other-findings)
- [3. Agents0 as a plugin: follow-up checks](#3-agents0-as-a-plugin-follow-up-checks)
- [4. Decisions for the architect](#4-decisions-for-the-architect)
- [5. Reproduce](#5-reproduce)

## 1. Answer

**No.** With `version` unchanged, `claude plugin update` reports "already at the latest version" and keeps the old commit. `plugins/installed_plugins.json` does record the installed commit as `gitCommitSha`, but nothing compares it with the pin. The cache is keyed by version (`cache/<marketplace>/<plugin>/<version>/`), so a new commit at the same version has nowhere new to go.

| Attempt                                                            | Result                                                         |
| :----------------------------------------------------------------- | :------------------------------------------------------------- |
| Move `sha`, `marketplace update`, `plugin update`                  | No-op: "already at the latest version (1.0.0)"; old content    |
| Same, with `version: "1.0.0+<sha>"` on the marketplace entry       | No-op: `plugin.json` `version` wins                            |
| Same, with `strict: false` and an entry `version`                  | No-op                                                          |
| `plugin uninstall` then `plugin install`                           | Works: new commit installed, `gitCommitSha` updated            |
| Plugin whose `plugin.json` has **no** `version`                    | Works: cache keyed by 12-character SHA; `update` moves A to B  |

Third-party sources today: `mattpocock/skills` sets `version` 1.3.1 and `cloudflare/skills` sets 1.0.2, so the no-op applies to both. `anthropics/skills` has no root `plugin.json`, so a single-skill `git-subdir` pin is keyed by SHA and updates normally.

## 2. Other findings

- **`marketplace add` writes the settings itself.** `claude plugin marketplace add <dir>` wrote `extraKnownMarketplaces`, and `plugin install` wrote `enabledPlugins`, into the user `settings.json`. The installer can drive the official CLI instead of merging JSON.
- **The inline `"source": "settings"` marketplace is not seen by the CLI.** Declared in `settings.json`, `marketplace update` and `plugin install` both answered "not found". Whether a session start materialises it was not tested: the sandbox has no credentials. A `directory` marketplace needs no such feature.
- **A `directory` marketplace copies, it does not link.** A local plugin (`"source": "./own"`) was installed into `cache/<marketplace>/own/0.1.0/`; editing the source did not change the installed copy. The existing `skillopt-sleep` install shows the same. So DEV0-67 AC2 ("edits live, no reinstall") fails as written. `--plugin-dir <path>` loads a plugin in place, but for one session only.

## 3. Agents0 as a plugin: follow-up checks

Asked after the first round: what if Agents0 itself installs with `claude plugin install`? Plugins cannot carry rules, and the docs list no install, update or enable hook (https://code.claude.com/docs/en/plugins/manifest-reference). So three checks, the first using `claude -p --plugin-dir`, which loads a plugin for one session and installs nothing.

| Check                                                                     | Result                                                                                                                                                       |
| :------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SessionStart hook injecting all six rules in one output (16.9 KB)         | Fails. Output over 10,000 characters is saved to a file; the session sees the path and the first 2 KB                                                        |
| One SessionStart hook per rule (largest 6.1 KB)                           | Works. All six rules arrive intact, each in its own context block                                                                                           |
| SessionStart hook that writes a rule file if missing                      | Works one session late. The file is written in session 1 but not loaded until session 2, because rules are read at launch                                     |
| Version-less local plugin (`"source": "./"` in a git repo)                | Works. Cache keyed by commit; `plugin update` picks up each commit, not uncommitted edits                                                                   |
| GitHub marketplace declared in `settings.json`, fresh config              | Not tested. The CLI ignores it, and a session start needs a login the throwaway config does not have                                                        |

No rule uses `paths:` today, so every rule already loads at launch: about 17,300 characters, roughly 4,300 tokens. Injecting them by hook costs nothing extra over today.

## 4. Decisions for the architect

1. **Keeping pins current.** Options:
   - **Pin to release tags** (recommended). Authors bump `version` per release, so `update` works; only a mid-release commit pin goes stale. No code.
   - **Reinstall on mismatch.** `agents0 install` compares each pin with `gitCommitSha` in `installed_plugins.json` and runs uninstall plus install when they differ. Exact, but it reads an internal file (`"version": 2` format) that `plugin list --json` does not expose.
2. **Own skills, agents and hooks.** Options:
   - **Keep symlinking them** (recommended): live edits, no `agents0:` prefix, no change from today. Only third-party skills move to plugins.
   - **Package them as a plugin**: one install mechanism, but every edit needs a version bump and an update, or a `--plugin-dir` shell alias.
3. **Installer shape.** Drive `claude plugin marketplace add` and `claude plugin install` from `agents0 install` (recommended), rather than merging `settings.json` ourselves. This replaces AC3's merge.

## 5. Reproduce

```bash
export CLAUDE_CONFIG_DIR=$(mktemp -d)
# repo: .claude-plugin/plugin.json {"name":"probe","version":"1.0.0"}, skills/probe/SKILL.md; commits A and B differ only in SKILL.md
# market/.claude-plugin/marketplace.json: plugins[0].source = {"source":"url","url":"file://<repo>","sha":"<A>"}
claude plugin marketplace add ./market
claude plugin install probe@spikemkt          # installs A
# change sha to <B> in marketplace.json
claude plugin marketplace update spikemkt
claude plugin update probe@spikemkt           # "already at the latest version"; still A
claude plugin uninstall probe@spikemkt && claude plugin install probe@spikemkt   # B
```

[← Back to Documentation Home](../README.md)
