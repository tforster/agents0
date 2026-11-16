# Blueprints live in docs/blueprints/ <!-- omit in toc -->

A blueprint is the technical design for a piece of work: the decisions the architect has made, which builders carry out and do not reinterpret. It lives in the repository, beside the code it governs, at `docs/blueprints/<key>-<slug>.md`, named after the tracker issue it serves. The epic owns the blueprint; a story small enough to have no epic carries its own. The tracker issue links to the file, and the file holds the decisions.

## 1. Considered Options

- **A Markdown file in `docs/blueprints/`, per epic or per small story** -- accepted. It is versioned with the code, reviewed in the same pull request as the change it shapes, and readable by any agent without tracker access.
- **The blueprint in the tracker issue body** -- rejected. It cannot be reviewed as a diff, drifts from the code it describes, and ties the design to one tracker's formatting.
- **A tracker custom field or a fixed spec schema** -- rejected. A schema replicated across trackers is machinery to maintain, and a text field is the issue body again.
- **One blueprint per story, always** -- rejected. Stories under one epic share most of their decisions; per-story files would repeat them and let them disagree.

## 2. Consequences

- `docs/blueprints/` sits outside the four documentation categories, and its `README.md` indexes every blueprint.
- Answers given while a story is grilled are folded into the blueprint before any building starts, so the file matches what was built.
- A tracker skill reports the blueprint paths an issue links, so a builder reads the file rather than the issue for design.

[← Back to ADR index](./README.md)
