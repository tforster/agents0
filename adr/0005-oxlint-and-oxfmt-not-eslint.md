# Lint and format with oxlint and oxfmt, not ESLint <!-- omit in toc -->

JavaScript is linted with `oxlint` and formatted with `oxfmt`. ESLint is rejected: its configuration grows with plugins and needs constant attention as formats and interfaces change, which is maintenance with nothing to show for it. Rules that matter mechanically -- such as `curly: ["error", "all"]` -- are enforced by `oxlint`, never by instruction.

## 1. Considered Options

- **`oxlint` and `oxfmt`** -- accepted. Fast, little configuration, and one toolchain for linting and formatting.
- **ESLint** -- rejected. Plugin-driven configuration bloats and keeps breaking as the ecosystem moves.
- **Enforcing style by instruction** in rules or prompts -- rejected. An instruction decays; a linter runs every time.

## 2. Consequences

- `html`, `css`, `json`, `sql` and `md` will be linted separately once the JavaScript pattern is proven.
- PHP is the exception, with its own tooling, decided where PHP is in scope.

[← Back to ADR index](./README.md)
