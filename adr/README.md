# Architecture Decision Records <!-- omit in toc -->

Decisions that set precedent, one per file, named `NNNN-slug.md`. The cross-project ones ship in the plugin and apply in every project Agents0 reaches; the rest record how Agents0 itself is built. Each stands alone and states what it rejected, because the rejection is why the precedent exists.

## Table of Contents <!-- omit in toc -->

- [1. Records](#1-records)

## 1. Records

- [Local static serving uses `npx static-server`](./0001-static-server-for-local-static-serving.md)
- [Work traces to the tracker, not to conventional commits](./0002-work-traces-to-the-tracker-not-conventional-commits.md)
- [No front-end framework: React rejected](./0003-no-front-end-framework.md)
- [Input and output schemas are JSON Schema, not Zod](./0004-json-schema-not-zod.md)
- [Lint and format with oxlint and oxfmt, not ESLint](./0005-oxlint-and-oxfmt-not-eslint.md)
- [Claude Code is the only supported harness](./0006-claude-code-is-the-only-harness.md)
- [One orchestration folder per client](./0007-one-orchestration-folder-per-client.md)
- [Agents0 installs as a Claude Code plugin from its own marketplace](./0008-claude-code-plugin-is-the-installer.md)
- [Each rule is injected by its own hook](./0009-one-hook-per-rule.md)
- [Third-party plugins are pinned by release tag and sha](./0010-third-party-plugins-pinned-by-tag-and-sha.md)
- [The Agents0 plugin has no version](./0011-plugin-json-has-no-version.md)
- [Blueprints live in docs/blueprints/](./0012-blueprints-live-in-docs-blueprints.md)
- [The account gate warns, it does not block](./0013-account-gate-warns-not-blocks.md)
- [A supervised coordinator builds each story](./0014-supervised-coordinator-builds-stories.md)
- [The completion gate fits the project it finds](./0015-completion-gate-fits-the-project.md)
- [`npx` is a developer tool, never shipped](./0016-npx-is-a-developer-tool.md)

[← Back to the Agents0 README](../README.md)
