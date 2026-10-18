---
name: javascript
description: House rules for JavaScript. Use when writing, editing or reviewing .js or .mjs files, their JSDoc types, or their tests.
license: MIT
metadata:
  author: tforster
  version: "0.1"
---

# JavaScript <!-- omit in toc -->

Stub: story 2.6 folds `rules/javascript.md` and `rules/testing.md` in here. Until then those rules files still load in every session.

## 1. Code rules 10-12

Dev0's code rules 1-9 are in `rules/dev0.md`; these three are JavaScript's and keep their numbers.

10. **Run independent awaits in parallel** with `Promise.all`, `allSettled` or `any` -- because sequential awaits of unrelated work add their latencies for nothing.
11. **JSDoc is the type system, not prose.** Type every parameter and return; add `@description` only when the function needs explaining -- because prose restating the signature is unverified and goes stale.
12. **Braces on every `if`**, in the multi-line form -- because a braceless `if` invites the added-second-line bug. `oxlint` enforces it.

## 2. Structure

- **Classes** encapsulate with native private members (`#field`, `#method()`). A method that does not use `this` is `static`.
- **Data flows through pipelines.** Break large processing into small, isolated `TransformStream`s over Web Streams rather than loading everything into memory.
