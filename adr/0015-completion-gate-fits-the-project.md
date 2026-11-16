# The completion gate fits the project it finds <!-- omit in toc -->

A `Stop` hook runs the project's `lint`, `typecheck` and `test` scripts, in that order, whenever a session stops with uncommitted changes, and blocks the stop with the first failure's output. It runs in every repo the plugin reaches, including ones that are not npm projects or that predate the Dev0 template.

## 1. Considered Options

- **Pass silently on a repo with no `package.json`; skip a missing script with a one-line warning** -- accepted. The gate enforces what the project declares, and says what it could not check.
- **Block when a script is missing** -- rejected. Older projects lack one or more of the three scripts; a gate that blocks every stop there gets switched off, and then guards nothing.
- **Require every repo to be an npm project** -- rejected. PHP, infrastructure and documentation repos have nothing for the gate to run.
- **Telling the agent to run the checks** -- rejected. Instruction decays over a long session; a hook runs every time.

## 2. Consequences

- A `package.json` that does not parse blocks, naming the file, because that is a real fault rather than a missing convention.
- In a monorepo the gate runs from the git root's `package.json`, where an npm workspace defines its scripts once.
- No rule, skill or `CLAUDE.md` tells the agent to run lint, typecheck or test; the gate owns that.

[← Back to ADR index](./README.md)
