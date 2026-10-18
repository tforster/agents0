# Local static serving uses `npx static-server` <!-- omit in toc -->

Every project that needs to serve static files locally -- a site, a prototype, built output, a test fixture -- does it with `npx static-server <path>`. The architect has used it for years, so it is familiar, and `npx` runs it on demand with no install, no config and no entry in `package.json`. This is an accepted-dependency precedent, not a rule: it is the one answer to "how do I serve this folder?", so agents stop choosing a different server per project.

## 1. Considered Options

- **`npx static-server`** -- accepted. Familiar, zero-config, and nothing to add to `package.json`, so the default-deny dependency gate is never in play.
- **Another static server package** (`http-server`, `serve` and the like) -- rejected. Not because they are worse: they do the same job, and switching buys nothing. Letting each project pick its own is exactly the drift this ADR exists to stop.
- **A framework dev server** (Vite, webpack-dev-server) -- rejected. It brings build tooling and a dependency tree to a job that needs neither.
- **A hand-rolled `node:http` server per project** -- rejected. The same code, rewritten in every repo, for a solved problem.
- **`python -m http.server`** -- rejected. A second runtime for a JavaScript toolchain.

## 2. Consequences

A project whose framework already ships its own dev server is not a static-serving case and is out of scope; that choice belongs to the project's own ADR.

[← Back to ADR index](./README.md)
