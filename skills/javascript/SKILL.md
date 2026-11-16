---
name: javascript
description: House rules for JavaScript and its tests. Use when writing, editing or reviewing .js or .mjs files or their JSDoc types, and when writing or changing tests with node:test or Playwright.
license: MIT
metadata:
  author: tforster
  version: "0.2"
---

# JavaScript <!-- omit in toc -->

How JavaScript and its tests are written. Naming, casing and where formatting comes from are in the `code-style` rule; Dev0's code rules 1-9 are in the `dev0` rule. Neither is repeated here.

## Table of Contents <!-- omit in toc -->

- [1. Code rules 10-12](#1-code-rules-10-12)
- [2. Structure](#2-structure)
- [3. Runtime targets](#3-runtime-targets)
- [4. Types and JSDoc](#4-types-and-jsdoc)
- [5. Declarations and expressions](#5-declarations-and-expressions)
- [6. Imports and file headers](#6-imports-and-file-headers)
- [7. Tests](#7-tests)
  - [7.1. Runners and files](#71-runners-and-files)
  - [7.2. Shape](#72-shape)
  - [7.3. Rules](#73-rules)

## 1. Code rules 10-12

Dev0's code rules 1-9 are in `rules/dev0.md`; these three are JavaScript's and keep their numbers.

10. **Run independent awaits in parallel** with `Promise.all`, `allSettled` or `any` -- because sequential awaits of unrelated work add their latencies for nothing.
11. **JSDoc is the type system, not prose.** Type every parameter and return; add `@description` only when the function needs explaining -- because prose restating the signature is unverified and goes stale.
12. **Braces on every `if`**, in the multi-line form -- because a braceless `if` invites the added-second-line bug. `oxlint` enforces it.

## 2. Structure

- **Classes** encapsulate with native private members (`#field`, `#method()`). A method that does not use `this` is `static`.
- **Data flows through pipelines.** Break large processing into small, isolated `TransformStream`s over Web Streams rather than loading everything into memory.
- **Long files** group related logic under section divider comments, each named for what it does, not how:

```js
// ---------------------------------------------------------------------------
// JWT Verification
// ---------------------------------------------------------------------------
```

## 3. Runtime targets

Write code for the environment it runs in:

| Target              | Typical location                    | Available APIs                                 |
| ------------------- | ----------------------------------- | ---------------------------------------------- |
| Node 24+            | `devops/`, build scripts, CLI tools | Full Node.js APIs (`fs`, `path`, `http`, etc.) |
| WinterCG (portable) | Workers, handlers, shared libraries | Web platform APIs only                         |
| Evergreen browsers  | `workspaces/*/scripts/`             | DOM and Web platform APIs                      |

Portable (WinterCG) code:

- uses only Web platform APIs: `fetch`, `crypto.subtle`, `TextEncoder`/`TextDecoder`, `URL`, `Headers`, `Request`, `Response`, `structuredClone`;
- never imports Node modules (`fs`, `path`, `http`);
- takes runtime-specific concerns (file I/O, environment variables) as function arguments, following the Cloudflare Workers `(request, env)` convention;
- returns `new Response(body, { status: 4xx })` for expected client errors rather than throwing.

ESM only: never mix `require` and `import` in one file or package.

## 4. Types and JSDoc

Types come from JSDoc under `checkJs: true` in `jsconfig.json`; there are no `.ts` files, and type checking passes with zero errors.

- Every exported function, class, method and non-trivial variable has a JSDoc block, with `@param` and `@returns` typed.
- Reusable object shapes are a `@typedef` at the top of the file, or in a `types.js` module, referenced by `@param` or `@type`.
- Suppress with `// @ts-expect-error`, never `// @ts-ignore`, and only when unavoidable, with a comment saying why.

```js
/**
 * @typedef {Object} UserRecord
 * @property {string} id
 * @property {"admin"|"viewer"} role
 */

/**
 * Manages session tokens for a single authenticated user.
 */
class TokenManager {
  /** @type {string} */
  #secret;

  /**
   * @param {string} secret - Signing secret from the environment.
   */
  constructor(secret) {
    this.#secret = secret;
  }

  /**
   * Issues a signed JWT for the given claims.
   *
   * @param {Record<string, unknown>} claims - JWT payload.
   * @returns {string} Signed token.
   */
  issue(claims) {}
}
```

## 5. Declarations and expressions

- `const` by default; `let` only when the variable is reassigned later; never `var`.
- Numeric separators in large literals: `3_600_000`, not `3600000`.
- Template literals over string concatenation.
- Destructure where it makes the code clearer without hiding intent.
- `async`/`await` over `.then()`/`.catch()` chains, and never a floating `Promise`.
- Throw `Error` instances, never strings.

## 6. Imports and file headers

Imports are grouped, each group labelled and separated by a blank line, and local imports carry their `.js` extension:

```js
// System dependencies
import { readFile } from "node:fs/promises";

// Third party dependencies
import yaml from "js-yaml";

// Local dependencies
import { parseConfig } from "./config.js";
```

Every file opens with a comment naming the file and what it is. A complex file adds its runtime compatibility, usage and key behaviours:

```js
// handler.js — Cognito Auth Gateway
//
// WinterCG-compliant. Portable across Lambda, Cloudflare Workers, Deno, Bun.
// Runtime-specific concerns are injected via router.fetch(request, env).
```

## 7. Tests

### 7.1. Runners and files

- **Server-side, API and libraries**: the Node.js built-in runner, `node:test`, with `node:assert`. No Jest, Mocha or other frameworks.
- **Browser and DOM**: Playwright with the latest Chromium, installed once at the project root and shared across workspaces.
- Test files are named `*.test.js`, so the runner finds them.
- In an npm workspace monorepo, each workspace keeps its own `tests/` folder for unit, functional and API tests; the root `tests/` holds end-to-end tests and tests that cross workspaces.

```bash
node --test                               # all tests
node --test path/to/file.test.js          # one file
node --test --watch                       # watch mode
node --test --experimental-test-coverage  # with coverage
```

### 7.2. Shape

```js
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

describe("TokenManager", () => {
  it("ABC-12 AC1: issues a token that carries the given claims", async () => {
    // Arrange
    const manager = new TokenManager("secret");

    // Act
    const token = manager.issue({ sub: "user-1" });

    // Assert
    assert.strictEqual(decode(token).sub, "user-1");
  });
});
```

- Name each test for the behaviour it expects, citing the acceptance criterion it covers.
- Assert with `assert.strictEqual`, `assert.ok(value, message)`, `assert.rejects` and `assert.throws`.

### 7.3. Rules

- Test error conditions, not only the happy path.
- Mock external dependencies, such as APIs and the file system, where possible.
- Keep test data minimal but realistic.
- Never delete or skip an existing test unless asked.
