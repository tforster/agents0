---
name: diataxis-documentation
description: Write a new Diátaxis-compliant documentation file from scratch. Use when asked to create a tutorial, how-to guide, reference document, or explanation article following the Diátaxis framework.
license: MIT
metadata:
  author: tforster
  version: "1.0"
---

# Diátaxis Documentation Skill <!-- omit in toc -->

## Table of Contents <!-- omit in toc -->

- [1. Determine the Category](#1-determine-the-category)
- [2. Apply the Correct Template](#2-apply-the-correct-template)
- [3. Apply Formatting Rules](#3-apply-formatting-rules)
- [4. Update the Index](#4-update-the-index)
- [5. Verify](#5-verify)

## 1. Determine the Category

Ask: what is the user's intent when reading this document? See `rules/diataxis.md` for the full category definitions. Quick guide:

| User intent | Category | Folder |
| :--- | :--- | :--- |
| "I want to learn from scratch" | Tutorial | `docs/tutorials/` |
| "I need to accomplish a specific task" | How-To | `docs/how-to/` |
| "I need to look something up" | Reference | `docs/reference/` |
| "I want to understand why" | Explanation | `docs/explanation/` |

If the content spans multiple categories, split it into multiple documents.

## 2. Apply the Correct Template

### 2.1 Tutorial

```markdown
# Title <!-- omit in toc -->

Learning goal: what the reader will be able to do after completing this tutorial.

## Table of Contents <!-- omit in toc -->

- [1. Prerequisites](#1-prerequisites)
- [2. First Step](#2-first-step)

## 1. Prerequisites

- List prerequisite knowledge or setup

## 2. First Step

Clear, sequential instruction.

## What You've Learned

Brief summary of what was covered.

## Next Steps

- Link to related how-to guides or reference material

[← Back to Tutorials](./README.md)
```

### 2.2 How-To Guide

```markdown
# How to [Accomplish Specific Task] <!-- omit in toc -->

Brief statement of what this guide achieves.

## Table of Contents <!-- omit in toc -->

- [1. Prerequisites](#1-prerequisites)
- [2. Steps](#2-steps)
- [3. Verification](#3-verification)
- [4. Troubleshooting](#4-troubleshooting)

## 1. Prerequisites

## 2. Steps

### 2.1 First Step

### 2.2 Second Step

## 3. Verification

How to confirm the task completed successfully.

## 4. Troubleshooting

Common issues and solutions.

[← Back to How-To Guides](./README.md)
```

### 2.3 Reference

```markdown
# [Subject] Reference <!-- omit in toc -->

Brief description of what this reference covers.

## Table of Contents <!-- omit in toc -->

- [1. First Topic](#1-first-topic)

## 1. First Topic

Technical details, specifications, parameters.

[← Back to Reference](./README.md)
```

### 2.4 Explanation

```markdown
# [Concept] <!-- omit in toc -->

Brief orientation: what concept this explains and why it matters.

## Table of Contents <!-- omit in toc -->

- [1. Background](#1-background)
- [2. Core Concept](#2-core-concept)
- [3. Design Decisions](#3-design-decisions)
- [4. Further Reading](#4-further-reading)

## 1. Background

## 2. Core Concept

## 3. Design Decisions

Why things are the way they are.

## 4. Further Reading

[← Back to Explanation](./README.md)
```

## 3. Apply Formatting Rules

Follow all rules in `rules/markdown.md`, and use the `markdown` skill's scripts to generate the ToC and section numbers. Key reminders for documentation:

- British/Canadian English: organise, colour, behaviour, centre, optimise
- All code fences must specify a language (`bash`, `javascript`, `json`, `text`, etc.)
- No `---` horizontal rules — use headings instead
- Back-navigation link at the very end of the file

## 4. Update the Index

After creating the file, add a link to it in the category's `README.md`.

## 5. Verify

- [ ] Correct Diátaxis category
- [ ] British/Canadian English spelling
- [ ] All code fences have language identifiers
- [ ] Back-navigation link present
- [ ] Category `README.md` updated
- [ ] No duplicated content (links to canonical source instead)
