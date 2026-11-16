# Work traces to the tracker, not to conventional commits <!-- omit in toc -->

All work is tied to a tracker ticket: no ticket, no work. The branch is named after the ticket -- `<key>-<slug>`, lowercase, where the slug is the full ticket title with every run of non-alphanumerics collapsed to one hyphen and nothing truncated, e.g. `proj-1419-adopt-basecoat-as-the-component-styling-layer` -- and the PR title is `{Issue Title} (Re: {KEY})` with the key uppercase, so tracing from work planned to work executed is one lookup. Conventional commits (`feat:`, `fix:`, `feat/` branch prefixes) are rejected: the ticket already says what kind of work it is, and the key is the link that matters.

## 1. Considered Options

- **Ticket key and title in branch and PR** -- accepted. The tracker is the single record of intent; the branch and PR point at it.
- **Conventional commits** -- rejected. The type prefix restates what the ticket already records, and it adds a second taxonomy to keep consistent with the tracker's.
- **A truncated slug** (`proj-1419-adopt-basecoat`) -- rejected. Where the cut falls is a fresh judgement each time, so two agents name the same ticket's branch differently; the full title is mechanical.
- **A tracker's own auto-link convention**, e.g. Paca's `<type>/<PREFIX>-<number>-slug` -- rejected. It is conventional commits again, in branch form.

## 2. Consequences

- Worktrees take the branch name. Several worktrees for one ticket each add a lowercase, slugified task suffix.
- A tracker whose webhook auto-linker expects a type-prefixed branch will not match. The tracker integration links the PR to the ticket explicitly, then asserts the link exists. A missed compensating step fails silently, so it is asserted, not assumed.
- Tooling that needs commit-type prefixes, such as semantic-release changelogs, is not available without a separate decision.

[← Back to ADR index](./README.md)
