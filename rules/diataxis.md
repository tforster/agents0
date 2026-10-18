---
applyTo: "docs/**"
---

# Diátaxis Documentation Standards <!-- omit in toc -->

## Table of Contents <!-- omit in toc -->

- [1. Four Categories](#1-four-categories)
- [2. What Belongs Where](#2-what-belongs-where)
- [3. Document Structure](#3-document-structure)

All documentation in `docs/` follows the [Diátaxis framework](https://diataxis.fr/).

> [!NOTE]
> Markdown formatting rules (code fences, headings, callouts, British English, back navigation, anti-duplication, etc.) are defined in `rules/markdown.md`. This file covers Diátaxis categorisation and document structure only.

## 1. Four Categories

| Folder              | Type        | User intent          | Question answered            |
| ------------------- | ----------- | -------------------- | ---------------------------- |
| `docs/tutorials/`   | Tutorial    | "I want to learn..." | How do I get started?        |
| `docs/how-to/`      | How-To      | "I need to..."       | How do I accomplish X?       |
| `docs/reference/`   | Reference   | "What is...?"        | What are the specs?          |
| `docs/explanation/` | Explanation | "Why...?"            | Why does this work this way? |

A document belongs in exactly one category. If content seems to span multiple categories, it usually needs to be split or restructured.

## 2. What Belongs Where

| New content              | Category       |
| ------------------------ | -------------- |
| New build command option | `reference/`   |
| New development workflow | `how-to/`      |
| Architectural decision   | `explanation/` |
| Feature for new users    | `tutorials/`   |

## 3. Document Structure

Every document starts with a title (`#` with `<!-- omit in toc -->`), a brief introduction, a Table of Contents (`##` with `<!-- omit in toc -->`), numbered sections, and ends with a back-navigation link. How-to guide template:

```markdown
# Title <!-- omit in toc -->

Brief introduction.

## Table of Contents <!-- omit in toc -->

- [1. Prerequisites](#1-prerequisites)
- [2. Steps](#2-steps)
- [3. Verification](#3-verification)
- [4. Troubleshooting](#4-troubleshooting)

## 1. Prerequisites

## 2. Steps

### 2.1 First Step

## 3. Verification

## 4. Troubleshooting

[← Back to How-To Guides](./README.md)
```
