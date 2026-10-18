---
name: markdown
description: Author or restructure a Markdown document to the house standard, and regenerate its Table of Contents and section numbers with the bundled scripts. Use when creating a new .md file, adding or reordering sections in an existing one, or when a document's ToC or section numbers have gone stale. Do not hand-calculate section numbers or anchor slugs — run the scripts.
license: MIT
metadata:
  author: tforster
  version: "1.0"
---

# Markdown Authoring Skill <!-- omit in toc -->

The standing constraints live in `rules/markdown.md` and always apply. This skill covers the mechanics: document structure, the regeneration scripts, and the reference tables.

## Table of Contents <!-- omit in toc -->

- [1. Regenerating the ToC and Section Numbers](#1-regenerating-the-toc-and-section-numbers)
- [2. Document Skeleton](#2-document-skeleton)
- [3. Code Fence Languages](#3-code-fence-languages)
- [4. Callouts and Tables](#4-callouts-and-tables)
- [5. Anti-Duplication](#5-anti-duplication)
- [6. Verify](#6-verify)

## 1. Regenerating the ToC and Section Numbers

**Never work these out by hand.** Renumbering sections and recomputing anchor slugs is deterministic, and doing it in your head is slow and error-prone. Two scripts do it:

```bash
node ~/.claude/skills/markdown/scripts/number-sections.js docs/how-to/deploy.md
node ~/.claude/skills/markdown/scripts/update-toc.js docs/how-to/deploy.md
```

> [!IMPORTANT]
>
> Order matters. `number-sections.js` runs first, because anchor slugs include the section number — `## 2. Code Blocks` anchors to `#2-code-blocks`. Running the ToC update first produces links that break the moment sections are renumbered.

> [!WARNING]
>
> Each script prints exactly one line per file — `numbered`/`updated`, `unchanged`, or `skipped`. **Silence means the script did not run.** Never report a document as clean on the basis of no output; check that you got a line per file first.

Both accept multiple files, are idempotent, and print `unchanged` when there is nothing to do, so re-running after every edit is free:

```bash
S=~/.claude/skills/markdown/scripts
node $S/number-sections.js docs/**/*.md && node $S/update-toc.js docs/**/*.md
```

What they do:

| Script | Behaviour |
| :--- | :--- |
| `number-sections.js` | Numbers `##` as `1.`, `2.`, … and `###`+ as `1.1.`, `1.1.1.` — a trailing dot at every depth, matching the Markdown All in One extension. Strips existing numbers first, so it never double-prefixes. |
| `update-toc.js` | Rebuilds the bullet list under the `## Table of Contents` heading, indented two spaces per level, with GitHub-compatible anchors. |

Both skip headings inside fenced code blocks, and both skip any heading carrying `<!-- omit in toc -->` — which is how the title and the ToC heading stay unnumbered and unlisted. `update-toc.js` replaces only the list itself, so an intro paragraph or callout sitting between the ToC and the first section survives.

`update-toc.js` exits non-zero and reports `skipped` if the document has no `## Table of Contents <!-- omit in toc -->` heading. Add the heading, then re-run — short documents without a ToC simply do not need this script.

## 2. Document Skeleton

Start every document from this shape:

```markdown
# Document Title <!-- omit in toc -->

One or two sentences on what this document is for.

## Table of Contents <!-- omit in toc -->

- [1. First Section](#1-first-section)

## 1. First Section

Content.

### 1.1. A Subsection

More content.

[← Back to Documentation Home](../README.md)
```

Write the headings and content first, leave the ToC list empty, then run the two scripts to fill it in.

Both the title and the `## Table of Contents` heading carry `<!-- omit in toc -->`: the title because it is the document, not a section of it; the ToC because it is navigation, not content.

For documents under `docs/`, the Diátaxis category also determines the template and folder — see the `diataxis-documentation` skill.

## 3. Code Fence Languages

Every fence takes a language identifier. When in doubt use `text` rather than leaving it bare.

| Content | Identifier |
| :--- | :--- |
| JavaScript | `javascript` or `js` |
| TypeScript | `typescript` or `ts` |
| PHP | `php` |
| SQL | `sql` |
| Shell/Bash | `bash` or `shell` |
| YAML | `yaml` or `yml` |
| JSON | `json` |
| HTML | `html` |
| CSS | `css` |
| Markdown content | `markdown` or `md` |
| Plain text, prompts, pseudo-code | `text` |

## 4. Callouts and Tables

Use GitHub Flavoured callouts for anything that interrupts the reader. Put an empty `>` line between the marker and the text:

```markdown
> [!NOTE]
>
> Useful information.

> [!TIP]
>
> Helpful suggestion.

> [!WARNING]
>
> Something that could go wrong.

> [!IMPORTANT]
>
> Critical information.
```

The empty line makes the marker and the text separate paragraphs. Without it they are one paragraph joined by a soft line break, and a formatter set to unwrap prose (oxfmt or Prettier with `proseWrap: "never"`) folds them into `> [!NOTE] Useful information.`, which GitHub no longer renders as a callout. GitHub renders both forms the same.

Tables declare column alignment in the delimiter row — `:---` left, `:---:` centre, `---:` right.

## 5. Anti-Duplication

Never repeat a fact across documents. Pick the canonical location and link to it from everywhere else; duplicated content drifts and then contradicts itself.

Bad — the same fact maintained in two places:

```markdown
<!-- reference/oracle-guide.md -->
The Oracle connection string format is: user/password@//host:port/service

<!-- how-to/developer-guide.md -->
The Oracle connection string format is: user/password@//host:port/service
```

Good — one source, one link:

```markdown
<!-- reference/oracle-guide.md (canonical) -->
## 3. Connection String Format

The Oracle connection string format is: user/password@//host:port/service

<!-- how-to/developer-guide.md -->
See [Connection String Format](../reference/oracle-guide.md#3-connection-string-format).
```

> [!WARNING]
>
> Cross-document anchor links embed the section number. Renumbering a document invalidates inbound links to it, and the scripts cannot detect that. After renumbering, grep for links to the file you changed.

## 6. Verify

- [ ] `number-sections.js` then `update-toc.js` both run, both report `unchanged` on a second pass
- [ ] Title and ToC heading both carry `<!-- omit in toc -->`
- [ ] Every code fence has a language identifier
- [ ] Canadian/British English throughout — organise, colour, behaviour, centre, analyse
- [ ] No `---` horizontal rules
- [ ] No hard-wrapped prose lines
- [ ] Every callout has an empty `>` line between its marker and its text
- [ ] Back-navigation link at the end
- [ ] Category `README.md` updated if a document was added or removed
- [ ] No content duplicated from another document
