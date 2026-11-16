# Agents0 installs as a Claude Code plugin from its own marketplace <!-- omit in toc -->

Agents0's skills, agents, rules, hooks and ADRs reach Claude Code as one plugin. The repo root is both the `agents0` marketplace (`.claude-plugin/marketplace.json`) and the `agents0` plugin (`"source": "./"`), so install is `claude plugin marketplace add tforster/agents0`, then `claude plugin install agents0@agents0`. Claude Code owns fetching, caching, enabling and updating; Agents0 ships no installer of its own.

## 1. Considered Options

- **Claude Code plugin and marketplace** -- accepted. One install mechanism for Agents0 and the third-party plugins it lists, maintained by Claude Code rather than by us, and the same on every machine.
- **A home-grown CLI installer** -- rejected. It was built and run until the plugin system could replace it: code to write, test and keep in step with Claude Code's own layout, for a job Claude Code now does.
- **Symlinking skills, agents and rules into `~/.claude/`** -- rejected. Live edits were its one advantage, and `claude --plugin-dir .` gives them back for a development session. Symlinks also need a per-machine setup step and break silently when the repo moves.

## 2. Consequences

- Plugin skills and agents are namespaced: `markdown` is invoked as `agents0:markdown`.
- Plugins cannot carry rules and have no install hook, so rules are injected by hooks instead.
- No plugin file may name `~/.claude/`: the plugin lives in Claude Code's cache. Skills use `${CLAUDE_SKILL_DIR}` and rules `${CLAUDE_PLUGIN_ROOT}`.
- `docs/`, `tests/` and the dev tooling travel with the plugin; Claude Code ignores them.

[← Back to ADR index](./README.md)
