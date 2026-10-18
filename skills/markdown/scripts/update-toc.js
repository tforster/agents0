#!/usr/bin/env node
// update-toc.js — regenerate a Markdown document's Table of Contents in place
//
// Node 24+. Zero dependencies.
//
// Replaces the list under the `## Table of Contents <!-- omit in toc -->` heading with one entry
// per structural heading, nested two spaces per level. Headings carrying `<!-- omit in toc -->`
// are excluded, which is what keeps the title and the Table of Contents itself out of the list.
//
// Idempotent. Run AFTER number-sections.js — anchor slugs are derived from the rendered heading
// text, so the section number has to be in place first or every link will be stale.
//
// Usage:
//   node update-toc.js <file.md> [...more.md]

// System dependencies
import { readFile, realpath, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Local dependencies
import { parseHeadings, slugify, splitLines } from "./parse-headings.js";

const TOP_LEVEL = 2;
const TOC_HEADING_TEXT = "table of contents";
const INDENT = "  ";
const LIST_ITEM_PATTERN = /^\s*[-*+]\s/;

/**
 * Builds the Table of Contents bullet list.
 *
 * GitHub disambiguates repeated headings by appending "-1", "-2" and so on to the slug; we mirror
 * that so documents with two identically named subsections still link correctly.
 *
 * @param {import("./parse-headings.js").Heading[]} headings - All headings in the document.
 * @returns {string[]} The list's lines, empty when the document has no structural headings.
 */
function buildEntries(headings) {
  const listed = headings.filter((heading) => heading.level >= TOP_LEVEL && !heading.isOmitted);

  if (listed.length === 0) {
    return [];
  }

  const shallowestLevel = Math.min(...listed.map((heading) => heading.level));

  /** @type {Map<string, number>} How many times each base slug has been emitted so far. */
  const slugCounts = new Map();

  return listed.map((heading) => {
    const baseSlug = slugify(heading.displayText);
    const seenCount = slugCounts.get(baseSlug) ?? 0;
    slugCounts.set(baseSlug, seenCount + 1);

    const slug = seenCount === 0 ? baseSlug : `${baseSlug}-${seenCount}`;
    const indent = INDENT.repeat(heading.level - shallowestLevel);

    return `${indent}- [${heading.displayText}](#${slug})`;
  });
}

/**
 * Locates the existing Table of Contents list so it can be replaced without disturbing anything
 * else in the section. Some documents carry an intro paragraph or a callout between the list and
 * the first real heading, and those must survive regeneration.
 *
 * @param {string[]} lines - Document lines.
 * @param {number} searchFrom - First line index after the Table of Contents heading.
 * @param {number} searchTo - Line index of the next heading, or the document length.
 * @returns {number} The line index just past the existing list. When no list is present this is
 *   the first non-blank line, so freshly generated entries get inserted ahead of it.
 */
function findListEnd(lines, searchFrom, searchTo) {
  let start = searchFrom;

  while (start < searchTo && lines[start].trim() === "") {
    start += 1;
  }

  if (start >= searchTo || !LIST_ITEM_PATTERN.test(lines[start])) {
    return start;
  }

  let end = start;
  let cursor = start;

  // Walk past blank lines inside the list (loose lists), but only commit the end position when a
  // further list item actually follows — trailing prose must not be swallowed.
  while (cursor < searchTo) {
    const line = lines[cursor];

    if (LIST_ITEM_PATTERN.test(line)) {
      end = cursor + 1;
    } else if (line.trim() !== "") {
      break;
    }

    cursor += 1;
  }

  // Absorb the blank lines trailing the list; the caller re-emits exactly one separator, and
  // leaving these in place would compound an extra blank line on every run.
  while (end < searchTo && lines[end].trim() === "") {
    end += 1;
  }

  return end;
}

/**
 * Regenerates the Table of Contents of a document.
 *
 * @param {string} content - The document's current content.
 * @returns {string} The document with a rebuilt Table of Contents.
 * @throws {Error} When the document has no `## Table of Contents <!-- omit in toc -->` heading.
 */
export function updateToc(content) {
  const lines = splitLines(content);
  const headings = parseHeadings(lines);

  const tocPosition = headings.findIndex(
    (heading) => heading.isOmitted && heading.text.toLowerCase() === TOC_HEADING_TEXT
  );

  if (tocPosition === -1) {
    throw new Error(`No "## ${TOC_HEADING_TEXT}" heading marked with <!-- omit in toc --> was found`);
  }

  const tocHeading = headings[tocPosition];
  const nextHeading = headings[tocPosition + 1];

  const sectionEnd = nextHeading ? nextHeading.lineIndex : lines.length;
  const listEnd = findListEnd(lines, tocHeading.lineIndex + 1, sectionEnd);

  const entries = buildEntries(headings);

  // The blank lines either side satisfy MD032 (lists must be surrounded by blank lines).
  const rebuilt = [...lines.slice(0, tocHeading.lineIndex + 1), "", ...entries, "", ...lines.slice(listEnd)];

  return rebuilt.join("\n");
}

/**
 * Rewrites each file given on the command line, reporting whether it changed.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const filePaths = process.argv.slice(2);

  if (filePaths.length === 0) {
    console.error("Usage: node update-toc.js <file.md> [...more.md]");
    process.exitCode = 1;
    return;
  }

  for (const filePath of filePaths) {
    const original = await readFile(filePath, "utf8");

    let updated;

    try {
      updated = updateToc(original);
    } catch (error) {
      console.error(`skipped    ${filePath} — ${error.message}`);
      process.exitCode = 1;
      continue;
    }

    if (updated === original) {
      console.log(`unchanged  ${filePath}`);
      continue;
    }

    await writeFile(filePath, updated, "utf8");
    console.log(`updated    ${filePath}`);
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
