---
applyTo: "**/*.md"
---

# Markdown Style Guide <!-- omit in toc -->

Constraints that hold for every Markdown file, always. The authoring procedure — document templates, the code-fence language table, and the scripts that regenerate a Table of Contents and section numbers — lives in the `markdown` skill. Invoke it when creating or restructuring a document.

## Table of Contents <!-- omit in toc -->

- [1. Language](#1-language)
- [2. File Naming](#2-file-naming)
- [3. Structure](#3-structure)
- [4. Formatting](#4-formatting)
- [5. Anti-Duplication](#5-anti-duplication)

## 1. Language

Always use British/Canadian English spelling: organise, colour, behaviour, centre, optimise, analyse.

## 2. File Naming

Use kebab-case for all Markdown file names: `database-setup.md`, `how-to-deploy.md`.

## 3. Structure

- One `#` title per document, carrying `<!-- omit in toc -->`
- `##` for sections, `###` for subsections
- Sections are numbered — `## 1. Section`, `### 1.1. Subsection`, `#### 1.1.1. Sub-subsection`. Every number carries a trailing dot, matching the Markdown All in One extension's **Add/Update section numbers** command. The title and the `## Table of Contents` heading are not numbered
- Every document ends with a back-navigation link, e.g. `[← Back to Documentation Home](../README.md)`
- Each `docs/` category folder has a `README.md` indexing its documents; update it whenever a document is added or removed

> [!IMPORTANT]
>
> Never hand-calculate section numbers or Table of Contents anchors. Run the `markdown` skill's scripts — `number-sections.js` first, then `update-toc.js`.

## 4. Formatting

- Every fenced code block specifies a language identifier — never a bare ` ``` `. Use `text` when nothing else fits
- Blank lines around headings, fenced code blocks, and lists
- Do not use `---` as a section divider; use headings
- Do not hard-wrap prose. Wrapping is the renderer's job, not the file's
- A callout has an empty `>` line between its marker and its text (`> [!NOTE]`, `>`, `> Text`). Without it, a formatter that unwraps prose folds the marker onto the text and GitHub stops rendering the callout
- Diagrams are Mermaid, in the Markdown. C4 for architecture; sequence, flow or state diagrams where they convey the information better

These correspond to markdownlint MD022 (headings surrounded by blank lines), MD025 (one top-level heading), MD031 (fences surrounded by blank lines), MD032 (lists surrounded by blank lines), and MD040 (fences have a language).

## 5. Anti-Duplication

Never duplicate content across documents. Identify the canonical source and link to it from all other locations; duplicated content creates maintenance burden and conflicting information.
