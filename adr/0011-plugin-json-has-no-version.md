# The Agents0 plugin has no version <!-- omit in toc -->

`.claude-plugin/plugin.json` deliberately sets no `version`. Claude Code caches a plugin by its version when it has one, and `claude plugin update` ignores every commit until that version changes. Without one, the cache is keyed by commit, so each pushed commit is an update and nothing needs bumping.

## 1. Considered Options

- **No `version`** -- accepted. One person ships small changes often; the commit already identifies the release.
- **A `version` bumped on every change** -- rejected. A forgotten bump means machines silently keep old content, and the bump is ceremony on every pull request.
- **A version on the marketplace entry only** (such as `1.0.0+<sha>`) -- rejected. Tested: `plugin.json`'s own version wins, so it changes nothing.

## 2. Consequences

- `claude plugin validate` warns that the version is missing. The warning is expected.
- Only committed, pushed work reaches an installed plugin; uncommitted edits are tried with `claude --plugin-dir .`.
- Do not add a `version`; doing so freezes every installed copy at that version.

[← Back to ADR index](./README.md)
