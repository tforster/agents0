---
applyTo: "tests/**,**/*.test.js"
---

# Testing Standards <!-- omit in toc -->

## 1. Test Runners

- **Backend / API / server-side**: Node.js built-in test runner (`node:test`) — no Jest, Mocha, or other frameworks
- **Browser / DOM**: Playwright with latest Chromium — installed at project root, shared across workspaces

## 2. File Naming

`*.test.js` — auto-discovered by the Node.js test runner.

## 3. Running Tests

```bash
node --test                                    # All tests
node --test path/to/file.test.js               # Single file
node --test --watch                            # Watch mode
node --test --experimental-test-coverage       # With coverage (Node 20+)
npm run test                                   # Project-defined test script
```

## 4. Test Structure

```javascript
import { strict as assert } from "assert";
import { describe, it } from "node:test";

describe("ComponentName", () => {
  it("should describe expected behaviour", async () => {
    // Arrange
    const input = createTestInput();

    // Act
    const result = await component.method(input);

    // Assert
    assert.strictEqual(result.property, expectedValue);
    assert.ok(result.isValid, "Should be valid");
  });
});
```

When using npm workspaces for a mono repo each workspace will typically have its own tests folder for functional, unit and API tests. The project root will have a tests folder for end-to-end tests and tests that deliberately exercise the intersection of multiple workspaces.

## 5. Assertions

- `assert.strictEqual(actual, expected)` — exact equality
- `assert.ok(value, message)` — truthiness
- `assert.rejects(async () => {...})` — expected rejections
- `assert.throws(() => {...})` — expected throws

## 6. Rules

- Always test error conditions — not just happy paths
- Mock external dependencies (APIs, file system) where possible
- Keep test data minimal but realistic
- Use descriptive test names that explain the expected behaviour
- Tests must pass before a task is considered complete
- Do not delete or skip existing tests unless explicitly asked
