#!/usr/bin/env node
/**
 * Discover custom field IDs in your Jira Cloud instance.
 *
 * Run this once to find the correct customfield_XXXXX values for
 * JIRA_FIELD_STORY and JIRA_FIELD_AC, then export them in your shell profile.
 *
 * Usage:
 *   node discover-fields.mjs                  list all custom fields
 *   node discover-fields.mjs story            filter by name (case-insensitive)
 *   node discover-fields.mjs acceptance
 */

const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN } = process.env;

if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
  console.error("Missing required env vars: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN");
  process.exit(1);
}

const AUTH = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
const filter = process.argv[2]?.toLowerCase();

const res = await fetch(`${JIRA_BASE_URL.replace(/\/$/, "")}/rest/api/3/field`, {
  headers: {
    "Authorization": `Basic ${AUTH}`,
    "Accept": "application/json",
  },
});

if (!res.ok) {
  console.error(`HTTP ${res.status}: ${await res.text()}`);
  process.exit(1);
}

/** @type {Array<{id: string, name: string, custom: boolean, schema?: object}>} */
const fields = await res.json();

const custom = fields
  .filter((f) => f.custom && (!filter || f.name.toLowerCase().includes(filter)))
  .sort((a, b) => a.name.localeCompare(b.name));

const heading = filter ? `Custom fields matching "${filter}" (${custom.length})` : `All custom fields (${custom.length})`;
console.log(`\n${heading}:\n`);
console.log("  ID                    Name");
console.log("  ─────────────────────────────────────────────────────");

for (const f of custom) {
  const type = f.schema?.type ?? "";
  console.log(`  ${f.id.padEnd(22)} ${f.name}  ${type ? `[${type}]` : ""}`);
}

console.log("\nOnce you have the correct IDs, export them:");
console.log("  export JIRA_FIELD_STORY=customfield_XXXXX");
console.log("  export JIRA_FIELD_AC=customfield_XXXXX");
