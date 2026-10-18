# Code Style <!-- omit in toc -->

Naming and casing for every language. Formatting follows the project's formatter configuration, else its `.editorconfig`, else the surrounding file.

## 1. Spelling

Canadian English in identifiers, comments and documentation: `colour`, `behaviour`, `initialise`, `catalogue`. US spelling only where a language, standard API or reserved word dictates it: CSS `color`, `Intl.DateTimeFormat`.

## 2. Names

- **camelCase** for variables, functions and object properties; **PascalCase** for classes. Never `snake_case`, unless the language enforces it.
- **Environment variables** are PascalCase (`DatabaseUrl`), not `UPPER_SNAKE_CASE`.
- **Unabbreviated and descriptive**: `extensionToMime`, `outputContent` -- never `extMap`, `outCont`.
- **Booleans read as conditions**: `isEndOfArchive`, `atSegmentStart`, `hasChildren`.

## 3. Files

- **kebab-case** for files that do not export a class: `parse-headings.js`, `how-to-deploy.md`.
- **PascalCase** for a file exporting a class, matching the class name: `TokenManager.js` exports `TokenManager`.
