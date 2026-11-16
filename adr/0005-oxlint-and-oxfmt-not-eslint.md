# Lint and format with oxlint and oxfmt, not ESLint <!-- omit in toc -->

JavaScript is linted with `oxlint` and formatted with `oxfmt`. ESLint is rejected: its configuration grows with plugins and needs constant attention as formats and interfaces change, which is maintenance with nothing to show for it. Rules that matter mechanically -- such as `curly: ["error", "all"]` -- are enforced by `oxlint`, never by instruction.

## 1. Considered Options

- **`oxlint` and `oxfmt`** -- accepted. Fast, little configuration, and one toolchain for linting and formatting.
- **ESLint** -- rejected. Plugin-driven configuration bloats and keeps breaking as the ecosystem moves.
- **Enforcing style by instruction** in rules or prompts -- rejected. An instruction decays; a linter runs every time.

## 2. Consequences

- `oxfmt` also formats JSON, YAML, Markdown, CSS, HTML and Handlebars, so those need no separate formatter. SQL is not covered.
- PHP is the exception, with its own tooling, decided where PHP is in scope.

[← Back to ADR index](./README.md)
