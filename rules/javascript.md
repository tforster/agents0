---
applyTo: "**/*.js"
---

# JavaScript Standards <!-- omit in toc -->

> [!NOTE]
> **Naming, casing and where formatting comes from** are in `rules/code-style.md`. Do not duplicate them here.

## Table of Contents <!-- omit in toc -->

- [1. Runtime Targets](#1-runtime-targets)
- [2. Type Safety Without TypeScript](#2-type-safety-without-typescript)
- [3. JSDoc Requirements](#3-jsdoc-requirements)
- [4. Variable Declarations](#4-variable-declarations)
- [5. Import Organisation](#5-import-organisation)
- [6. File Headers](#6-file-headers)
- [7. Async and Error Handling](#7-async-and-error-handling)
- [8. Code Organisation](#8-code-organisation)
- [9. Inline Comments](#9-inline-comments)
- [10. Miscellaneous](#10-miscellaneous)

## 1. Runtime Targets

This codebase runs across three distinct environments. Write code appropriate to its target:

| Target              | Location                            | Available APIs                                 |
| ------------------- | ----------------------------------- | ---------------------------------------------- |
| Node 24+            | `devops/`, build scripts, CLI tools | Full Node.js APIs (`fs`, `path`, `http`, etc.) |
| WinterCG (portable) | Workers, handlers, shared libraries | Web platform APIs only — see below             |
| Evergreen browsers  | `workspaces/*/scripts/`             | DOM + Web platform APIs                        |

**WinterCG portability rules** — when writing portable or worker code:

- Use only Web platform APIs: `fetch`, `crypto.subtle`, `TextEncoder`/`TextDecoder`, `URL`,
  `Headers`, `Request`, `Response`, `structuredClone`
- Never import Node modules (`fs`, `path`, `http`) directly in portable code
- Inject runtime-specific concerns (file I/O, environment variables) via function arguments,
  following the Cloudflare Workers `(request, env)` convention

## 2. Type Safety Without TypeScript

We use JavaScript with `checkJs: true` in `jsconfig.json`. This gives TypeScript-level type
checking at edit time and in CI without requiring `.ts` files.

- All type information is expressed through JSDoc — see [Section 3](#3-jsdoc-requirements)
- Code must pass type checking as configured in `jsconfig.json` with zero errors
- Use `// @ts-expect-error` (not `// @ts-ignore`) when suppression is genuinely unavoidable;
  always include a comment explaining why

## 3. JSDoc Requirements

Every exported function, class, method, and non-trivial variable must have a JSDoc block.

**Required tags:**

```js
/**
 * Brief description of what the function does.
 *
 * @param {string} userId - The unique identifier of the user.
 * @param {{ role: string, active: boolean }} options - Configuration options.
 * @returns {Promise<User>} The resolved user record.
 */
async function getUser(userId, options) {}
```

**Classes:**

```js
/**
 * Manages session tokens for a single authenticated user.
 */
class TokenManager {
  /** @type {string} */
  #secret;

  /**
   * @param {string} secret - Signing secret from environment.
   */
  constructor(secret) {
    this.#secret = secret;
  }

  /**
   * Issues a signed JWT for the given claims.
   *
   * @param {Record<string, unknown>} claims - JWT payload.
   * @returns {string} Signed token.
   * @memberof TokenManager
   */
  issue(claims) {}
}
```

**Reusable object shapes** — declare with `@typedef` at the top of the file or in a `types.js`
module, then reference with `@param` or `@type`:

```js
/**
 * @typedef {Object} UserRecord
 * @property {string} id
 * @property {string} email
 * @property {"admin"|"viewer"} role
 */

/** @type {UserRecord} */
const user = await getUser(id);
```

## 4. Variable Declarations

- `const` by default
- `let` only when the variable is explicitly reassigned later in scope
- Never `var`
- Use numeric separators for large literals: `3_600_000` not `3600000`
- Prefer template literals over string concatenation
- Use destructuring where it improves clarity without obscuring intent

## 5. Import Organisation

Group imports in this order, each group separated by a blank line, with a short comment label:

```js
// System dependencies
import { resolve } from "path";
import { readFile } from "fs/promises";

// Third party dependencies
import yaml from "js-yaml";

// Local dependencies
import { parseConfig } from "./config.js";
```

- Always use explicit file extensions in local imports (`.js`) — required for Node ESM and WinterCG
- No barrel re-exports unless the module genuinely needs a public API surface

## 6. File Headers

Every file opens with a comment block containing at minimum the filename and a one-line description.
Complex files should also document runtime compatibility, usage, and key behaviours:

```js
// handler.js — Cognito Auth Gateway
//
// WinterCG-compliant. Portable across Lambda, Cloudflare Workers, Deno, Bun.
// Runtime-specific concerns are injected via router.fetch(request, env).
//
// Usage:
//   import { router } from "./handler.js";
```

## 7. Async and Error Handling

- Prefer `async`/`await` over `.then()`/`.catch()` chains
- Use `try`/`catch` for error handling in `async` functions
- Always handle Promise rejections — never leave a floating `Promise`
- Throw `Error` instances, not strings: `throw new Error("message")` not `throw "message"`
- In WinterCG contexts, return `new Response(body, { status: 4xx })` rather than throwing for
  expected client errors

## 8. Code Organisation

Long files should use section divider comments to group related logic:

```js
// ---------------------------------------------------------------------------
// JWT Verification
// ---------------------------------------------------------------------------
```

Keep each section focused and named for what it does, not how it does it.

## 9. Inline Comments

- Use inline comments liberally to explain _why_ code does something, not _what_ it does
- Avoid obvious comments that restate the code; instead, clarify intent, assumptions, or edge cases

## 10. Miscellaneous

- Run `npm run lint` after every edit
- Do not mix CommonJS (`require`) and ESM (`import`) in the same file or package
