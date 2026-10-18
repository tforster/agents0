# Input and output schemas are JSON Schema, not Zod <!-- omit in toc -->

A system's input and output are described with OpenAPI, whose schema language is JSON Schema, so validation at the boundary uses that same JSON Schema. Zod is rejected: its schemas are TypeScript code, not JSON Schema, so they cannot be the OpenAPI description, and keeping the two in step means maintaining every contract twice.

## 1. Considered Options

- **JSON Schema, shared with the OpenAPI description** -- accepted. One contract, readable by any language and tool, describes and validates the API.
- **Zod** -- rejected. A TypeScript-first schema DSL in a JavaScript-with-JSDoc codebase, and incompatible with OpenAPI as the source of truth.
- **Generating OpenAPI from Zod schemas** -- rejected. It makes code the source of the contract and adds a generator dependency to bridge the gap.
- **Ad hoc checks per handler** -- rejected where an OpenAPI description exists. The contract is already written; validating against something else lets the two drift.

## 2. Consequences

Validation happens once, at the boundary; inside a module, arguments are trusted to be the type their JSDoc declares. Choosing a JSON Schema validator is a dependency decision for the project.

[← Back to ADR index](./README.md)
