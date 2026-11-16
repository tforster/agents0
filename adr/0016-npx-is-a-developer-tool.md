# `npx` is a developer tool, never shipped <!-- omit in toc -->

`npx` runs a package without adding it to `package.json`. In development it is vital: running a tool on demand, a one-off authoring task, or a pinned tool an ADR names (such as `npx static-server`). The default-deny dependency rule governs what a project depends on, not what its developer runs. So `npx` is allowed in development workflows and ADR-named one-offs, and never appears in end-user code: anything a project ships or runs in production.

## 1. Considered Options

- **Allowed for development, banned from shipped code** -- accepted. It keeps the developer's toolbox open while nothing a user runs fetches unreviewed code at runtime.
- **Ban `npx` outright** -- rejected. It blocks one-off and ADR-named tools for no gain, since nothing they run reaches users.
- **Allow `npx` anywhere** -- rejected. In shipped code it downloads whatever version the registry serves at run time: an unpinned, unreviewed dependency the gate would refuse in `package.json`.
- **Add one-off tools as `devDependencies`** -- rejected. A package used once stays in the lockfile, and is upgraded and audited forever.

## 2. Consequences

- A pinned one-off worth repeating is recorded as an ADR, which names the version.
- Hooks that run a project's own tools resolve them from its `node_modules/.bin`, never through `npx`, so a hook never fetches a tool the project has not approved.
- A dependency gate denies new dependencies, not the developer's `npx`; a separate check keeps `npx` out of shipped code.

[← Back to ADR index](./README.md)
