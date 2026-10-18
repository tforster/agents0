# Plugin Pinning Spike <!-- omit in toc -->

DEV0-67's blocking question: does moving a Claude Code plugin's pinned `sha` reinstall it when the author has not bumped `plugin.json` `version`? Run on 2026-10-18 against Claude Code 2.1.302, in a throwaway `CLAUDE_CONFIG_DIR`, with a local git repo as the plugin source (`"source": "url"`, `file://`), so no real configuration or network was involved.

## Table of Contents <!-- omit in toc -->

- [1. Answer](#1-answer)
- [2. Other findings](#2-other-findings)
- [3. Decisions for the architect](#3-decisions-for-the-architect)
- [4. Reproduce](#4-reproduce)

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

## 3. Decisions for the architect

1. **Keeping pins current.** Options:
   - **Pin to release tags** (recommended). Authors bump `version` per release, so `update` works; only a mid-release commit pin goes stale. No code.
   - **Reinstall on mismatch.** `agents0 install` compares each pin with `gitCommitSha` in `installed_plugins.json` and runs uninstall plus install when they differ. Exact, but it reads an internal file (`"version": 2` format) that `plugin list --json` does not expose.
2. **Own skills, agents and hooks.** Options:
   - **Keep symlinking them** (recommended): live edits, no `agents0:` prefix, no change from today. Only third-party skills move to plugins.
   - **Package them as a plugin**: one install mechanism, but every edit needs a version bump and an update, or a `--plugin-dir` shell alias.
3. **Installer shape.** Drive `claude plugin marketplace add` and `claude plugin install` from `agents0 install` (recommended), rather than merging `settings.json` ourselves. This replaces AC3's merge.

## 4. Reproduce

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
