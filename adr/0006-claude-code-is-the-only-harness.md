# Claude Code is the only supported harness <!-- omit in toc -->

Dev0 is built on Claude Code mechanisms: the `CLAUDE.md` cascade, where the directory tree is the information hierarchy and depth decides when context loads; hooks, which enforce what instruction cannot; and skills, agents and rules installed into `~/.claude/`. Supporting other models or harnesses means giving those up or rebuilding them for each, so the framework is deliberately Claude-dependent, and other harnesses are expected to perform worse.

## 1. Considered Options

- **Claude Code only** -- accepted. One harness, used to its full depth, by one architect.
- **Harness-neutral** (`AGENTS.md` and instructions only) -- rejected. It gives up the cascade's lazy loading and hook enforcement, the two things that make rules stick.
- **Multi-harness**, with adapters per tool -- rejected. A distributed, multi-author, multi-harness model was the earlier trAIt proposal. It is more machinery than one person needs, and every harness added is one more to keep in step.

## 2. Consequences

- `AGENTS.md` is a symlink to `CLAUDE.md` in each project: cheap insurance, and the only hedge.
- Choosing another harness for a project means rebuilding its context and enforcement, and is that project's own decision.

[← Back to ADR index](./README.md)
