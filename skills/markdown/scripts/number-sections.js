#!/usr/bin/env node
// number-sections.js — renumber the section headings of a Markdown document in place
//
// Node 24+. Zero dependencies.
//
// Applies the house convention: level-2 headings are numbered "1.", "2.", …; deeper headings
// are numbered "1.1.", "1.1.1.", …. Every number carries a trailing dot. The H1 title is never
// numbered, and neither is any heading carrying `<!-- omit in toc -->` (the title and the Table
// of Contents).
//
// Idempotent — existing numbers are stripped before renumbering, so it is safe to re-run after
// every edit. Run this BEFORE update-toc.js, because anchor slugs include the section number.
//
// Usage:
//   node number-sections.js <file.md> [...more.md]

// System dependencies
import { readFile, realpath, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Local dependencies
import { formatHeadingLine, parseHeadings, splitLines } from "./parse-headings.js";

const TOP_LEVEL = 2;

/**
 * Builds the section number for a heading from the running counters.
 *
 * @param {number[]} counters - One counter per depth, index 0 being level-2 headings.
 * @param {number} depth - Zero-based depth of the heading being numbered.
 * @returns {string} The formatted section number, e.g. "2." or "2.3.1.".
 */
function formatSectionNumber(counters, depth) {
  // Every section number carries a trailing dot, at every depth: "1.", "1.1.", "1.1.1.".
  // The dot separates the number from the heading text rather than marking the top level.
  return `${counters.slice(0, depth + 1).join(".")}.`;
}

/**
 * Renumbers every structural heading in a document.
 *
 * @param {string} content - The document's current content.
 * @returns {string} The document with section numbers applied.
 */
export function numberSections(content) {
  const lines = splitLines(content);
  const headings = parseHeadings(lines);

  /** @type {number[]} Running counter per depth; truncated whenever we step back out a level. */
  const counters = [];

  for (const heading of headings) {
    if (heading.level < TOP_LEVEL || heading.isOmitted) {
      continue;
    }

    const depth = heading.level - TOP_LEVEL;

    // Pad for documents that skip a level (## straight to ####) rather than throwing.
    while (counters.length <= depth) {
      counters.push(0);
    }

    counters.length = depth + 1;
    counters[depth] += 1;

    const numberedText = `${formatSectionNumber(counters, depth)} ${heading.text}`;
    lines[heading.lineIndex] = formatHeadingLine(heading.level, numberedText, heading.isOmitted);
  }

  return lines.join("\n");
}

/**
 * Rewrites each file given on the command line, reporting whether it changed.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const filePaths = process.argv.slice(2);

  if (filePaths.length === 0) {
    console.error("Usage: node number-sections.js <file.md> [...more.md]");
    process.exitCode = 1;
    return;
  }

  for (const filePath of filePaths) {
    const original = await readFile(filePath, "utf8");
    const updated = numberSections(original);

    if (updated === original) {
      console.log(`unchanged  ${filePath}`);
      continue;
    }

    await writeFile(filePath, updated, "utf8");
    console.log(`numbered   ${filePath}`);
  }
}

/**
 * Resolves the process entry point to a real path.
 *
 * The skill can be reached through a symlinked path, such as a skills directory linked into a
 * repo, and then `process.argv[1]` is the symlink path while `import.meta.url` is already the real path. Comparing the two without
 * resolving both means the direct-invocation check never matches, `main()` silently never runs,
 * and the script exits 0 looking exactly like a clean no-op.
 *
 * @returns {Promise<string>} The resolved entry point path, or an empty string when unavailable.
 */
async function resolveEntryPoint() {
  if (!process.argv[1]) {
    return "";
  }

  try {
    return await realpath(process.argv[1]);
  } catch {
    return "";
  }
}

// Only run the CLI when invoked directly, so the module stays importable for tests.
if ((await resolveEntryPoint()) === fileURLToPath(import.meta.url)) {
  await main();
}
