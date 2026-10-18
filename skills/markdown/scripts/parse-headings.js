// parse-headings.js — shared Markdown heading parser
//
// Node 24+. Zero dependencies. Used by both number-sections.js and update-toc.js,
// which need an identical view of a document: the ATX headings that represent real
// structure, ignoring anything inside fenced code blocks and anything opted out
// with an `<!-- omit in toc -->` marker.
//
// Usage:
//   import { parseHeadings, stripSectionNumber, slugify } from "./parse-headings.js";

/**
 * @typedef {Object} Heading
 * @property {number} lineIndex - Zero-based index of the heading's line within the source lines array.
 * @property {number} level - ATX heading level: 1 for `#` through 6 for `######`.
 * @property {string} text - Heading text with the omit marker AND any existing section number removed.
 * @property {string} displayText - Heading text as it renders, omit marker removed but section number kept.
 * @property {boolean} isOmitted - True when the heading carries the `<!-- omit in toc -->` marker.
 */

const OMIT_MARKER = "<!-- omit in toc -->";

// A leading section number is either dotted ("1.1", "2.3.1.") or a single number with a trailing
// dot ("1."). Requiring the dot is what stops a heading like "## 2026 Roadmap" from being eaten.
const SECTION_NUMBER_PATTERN = /^(?:\d+(?:\.\d+)+\.?|\d+\.)\s+/;

const ATX_HEADING_PATTERN = /^(#{1,6})\s+(.*)$/;
const FENCE_PATTERN = /^\s{0,3}(`{3,}|~{3,})/;

/**
 * Splits file content into lines, normalising CRLF to LF.
 *
 * @param {string} content - Raw file content.
 * @returns {string[]} The content's lines, without line terminators.
 */
export function splitLines(content) {
  return content.split(/\r?\n/);
}

/**
 * Removes an existing section number prefix from heading text, so headings can be renumbered
 * idempotently rather than accumulating prefixes on every run.
 *
 * @param {string} text - Heading text, possibly already numbered.
 * @returns {string} The heading text with any leading section number removed.
 */
export function stripSectionNumber(text) {
  return text.replace(SECTION_NUMBER_PATTERN, "");
}

/**
 * Converts heading text into a GitHub-compatible anchor slug: lowercased, punctuation dropped,
 * spaces turned into hyphens. Unicode letters are preserved, so "Diátaxis" slugs to "diátaxis"
 * exactly as GitHub renders it.
 *
 * Each whitespace character becomes its own hyphen — runs must NOT collapse. Dropping punctuation
 * leaves the spaces that surrounded it behind, so "Known Gaps & Tech Debt" becomes
 * "known-gaps--tech-debt" with a double hyphen, and "buckets (a / b)" becomes "buckets-a--b".
 * Collapsing with `\s+` produces a single hyphen and every such link 404s — headings containing
 * `&` or `/` are common enough that this silently breaks real Tables of Contents.
 *
 * @param {string} text - Heading text, already stripped of the omit marker.
 * @returns {string} The anchor slug, without a leading `#`.
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .trim()
    .replace(/\s/g, "-");
}

/**
 * Parses the structural headings out of a Markdown document.
 *
 * Lines inside fenced code blocks are skipped entirely — the style guide's own examples embed
 * `## 1. First Section` inside a ```markdown fence, and renumbering those would corrupt the docs.
 *
 * @param {string[]} lines - Document lines as produced by splitLines.
 * @returns {Heading[]} Every ATX heading found outside fenced code blocks, in document order.
 */
export function parseHeadings(lines) {
  /** @type {Heading[]} */
  const headings = [];

  /** @type {string|null} The delimiter that opened the current fence, or null when outside one. */
  let openFence = null;

  lines.forEach((line, lineIndex) => {
    const fenceMatch = FENCE_PATTERN.exec(line);

    if (fenceMatch) {
      const delimiter = fenceMatch[1];

      if (openFence === null) {
        openFence = delimiter;
        return;
      }

      // A fence only closes on the same character, repeated at least as many times as it opened.
      if (delimiter[0] === openFence[0] && delimiter.length >= openFence.length) {
        openFence = null;
      }

      return;
    }

    if (openFence !== null) {
      return;
    }

    const headingMatch = ATX_HEADING_PATTERN.exec(line);

    if (!headingMatch) {
      return;
    }

    const rawText = headingMatch[2].trim();
    const isOmitted = rawText.includes(OMIT_MARKER);
    const withoutMarker = rawText.replace(OMIT_MARKER, "").trim();

    headings.push({
      lineIndex,
      level: headingMatch[1].length,
      text: stripSectionNumber(withoutMarker),
      displayText: withoutMarker,
      isOmitted,
    });
  });

  return headings;
}

/**
 * Rebuilds a heading line from its parts, restoring the omit marker when present.
 *
 * @param {number} level - ATX heading level.
 * @param {string} text - Heading text, already numbered if numbering applies.
 * @param {boolean} isOmitted - Whether to re-append the `<!-- omit in toc -->` marker.
 * @returns {string} The complete heading line.
 */
export function formatHeadingLine(level, text, isOmitted) {
  const marker = isOmitted ? ` ${OMIT_MARKER}` : "";
  return `${"#".repeat(level)} ${text}${marker}`;
}

export { OMIT_MARKER };
