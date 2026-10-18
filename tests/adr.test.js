// adr.test.js — guards the shape of the cross-project ADRs in adr/
//
// These ADRs are installed into every project and read at the moment of a decision, by agents
// that have none of the design discussion behind them. So each must stand alone (D23), and each
// must record what it rejected, since the rejection is why a precedent exists (D62).

// System dependencies
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const adrDir = path.resolve(import.meta.dirname, "..", "adr");

/**
 * Reads every ADR in adr/, skipping the generated index.
 *
 * @returns {Promise<{ name: string, content: string }[]>} ADRs in filename order.
 */
async function readAdrs() {
  const names = (await readdir(adrDir)).filter((name) => name !== "README.md").sort();
  return Promise.all(names.map(async (name) => ({ name, content: await readFile(path.join(adrDir, name), "utf8") })));
}

describe("cross-project ADRs", () => {
  it("DEV0-20: files are NNNN-slug.md, numbered from 0001 without gaps", async () => {
    const adrs = await readAdrs();
    assert.ok(adrs.length > 0, "adr/ has no ADRs");
    adrs.forEach(({ name }, index) => {
      assert.match(name, /^\d{4}-[a-z0-9]+(-[a-z0-9]+)*\.md$/, `${name} is not NNNN-slug.md`);
      assert.strictEqual(name.slice(0, 4), String(index + 1).padStart(4, "0"), `${name} breaks the numbering`);
    });
  });

  it("DEV0-20: every ADR has one title and lists what was rejected", async () => {
    for (const { name, content } of await readAdrs()) {
      assert.strictEqual(content.match(/^# /gm)?.length, 1, `${name} needs exactly one # title`);
      assert.match(content, /-- rejected\b/, `${name} lists nothing as rejected`);
    }
  });

  it("DEV0-20: every ADR stands alone and stays under ~200 lines", async () => {
    for (const { name, content } of await readAdrs()) {
      assert.ok(content.replace(/\n$/, "").split("\n").length <= 200, `${name} is over 200 lines`);
      // A framework decision number (D21) or a link to a sibling ADR means the reader needs
      // another document to follow the argument. Only the back-link to the index is allowed.
      assert.doesNotMatch(content, /\bD\d+\b/, `${name} cites a framework decision number`);
      const links = [
        ...content.matchAll(/\]\(([^)]+)\)/g),
        ...content.matchAll(/^\[[^\]]+\]:\s*(?:<([^>]+)>|(\S+))/gm),
        ...content.matchAll(/<([a-z][a-z0-9+.-]*:[^>]+)>/gi),
      ].map((match) => match[1] ?? match[2]);
      assert.deepStrictEqual(
        links.filter((link) => link !== "./README.md"),
        [],
        `${name} depends on another document`
      );
    }
  });
});
