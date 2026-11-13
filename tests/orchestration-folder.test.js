// orchestration-folder.test.js -- guards the orchestration folder ADR (AGEN-61)
//
// Seam: adr/0007, read as a file. adr.test.js already holds every ADR's shape; this holds the decisions a later
// scaffolding skill will build on, and keeps the public example free of real client names.

// System dependencies
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const adrPath = path.resolve(import.meta.dirname, "..", "adr", "0007-one-orchestration-folder-per-client.md");
const placeholderClients = new Set(["Acme"]);

describe("orchestration folder ADR", () => {
  it("AGEN-61 AC2: an orchestration folder copies or symlinks nothing from agents0, which reaches it at user scope", async () => {
    const adr = await readFile(adrPath, "utf8");
    assert.match(adr, /installed at user scope, already gives every folder its rules, hooks and skills/);
    assert.match(adr, /copies or symlinks nothing from Agents0/);
  });

  it("AGEN-61 AC3: the folder's place, when a client gets one, and the repo map format are decided", async () => {
    const adr = await readFile(adrPath, "utf8");
    assert.ok(adr.includes("`~/dev/<Client>/base`"));
    assert.match(adr, /each client with more than one repo gets an orchestration folder/);
    assert.ok(adr.includes("`<name> (<what it is>): ../<repo>. Clone from <remote> if missing.`"));
    assert.ok(adr.includes("`repos/<area>.md`"));
  });

  it("AGEN-61 AC4: the folder reaches the client folder, and the account gate maps it through its origin owner", async () => {
    const adr = await readFile(adrPath, "utf8");
    assert.ok(adr.includes('{ "permissions": { "additionalDirectories": [".."] } }'));
    assert.match(adr, /A folder outside git\*\* -- rejected/);
    assert.match(adr, /one entry per client owner/);
  });

  it("AGEN-61 AC5: the sample tree names only a placeholder client", async () => {
    const adr = await readFile(adrPath, "utf8");
    const clients = [...adr.matchAll(/^~\/dev\/([^/\s]+)\//gm)].map(([, client]) => client);
    assert.ok(clients.length > 0, "the ADR has no sample client folder");
    for (const client of clients) {
      assert.ok(placeholderClients.has(client), `the sample tree names client "${client}", which is not a placeholder`);
    }
  });
});
