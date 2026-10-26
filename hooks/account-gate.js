// account-gate.js -- UserPromptSubmit hook that refuses a prompt when the signed-in Claude account is
// not the one mapped to the repo's `origin` owner (AGEN-22, D75)
//
// A session cannot change its own account, so the only fix is /logout and /login; blocking the prompt
// is the one moment that can say so. The owner-to-account map is the ClaudeAccounts environment
// variable, a JSON object of remote owner to account email, exported from the user's shell profile.
// It stays out of this public repo on purpose.
//
// Passes silently (no output, exit 0) when it cannot tell: variable unset, no repo, no origin, an
// owner not in the map, or no signed-in account. A malformed variable blocks instead, because a
// typo in a shell profile would otherwise switch the gate off unnoticed.

// System dependencies
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

await main();

/**
 * Reads the hook input and blocks the prompt on an account mismatch.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const rawMap = process.env.ClaudeAccounts;
  if (!rawMap) return;

  let parsed;
  try {
    parsed = JSON.parse(rawMap);
  } catch (error) {
    return block(
      `ClaudeAccounts is not valid JSON (${error instanceof Error ? error.message : error}). Fix the export in your shell profile, then restart Claude.`
    );
  }
  // Validate at the boundary, then trust: a wrong shape would otherwise pass silently or crash below.
  if (!isAccountMap(parsed)) {
    return block(
      "ClaudeAccounts must be a JSON object of owner to account email. Fix the export in your shell profile, then restart Claude."
    );
  }
  const accounts = lowerCaseKeys(parsed);

  const { cwd } = JSON.parse(await readStdin());
  const owner = await originOwner(cwd);
  const expected = owner && accounts[owner.toLowerCase()];
  const signedIn = await signedInEmail();
  if (!expected || !signedIn || expected.toLowerCase() === signedIn.toLowerCase()) return;

  block(`The owner "${owner}" uses ${expected}, but Claude is signed in as ${signedIn}. Run /logout, then /login as ${expected}.`);
}

/**
 * Refuses the prompt. Claude Code shows the reason to the user and erases the prompt.
 *
 * @param {string} reason - What to tell the user.
 * @returns {void}
 */
function block(reason) {
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
}

/**
 * Reports whether a parsed value is a plain object whose values are all strings.
 *
 * @param {unknown} value - The parsed ClaudeAccounts.
 * @returns {value is Record<string, string>} Whether it has the account-map shape.
 */
function isAccountMap(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((email) => typeof email === "string")
  );
}

/**
 * Lower-cases an object's keys, because remote owners are case-insensitive.
 *
 * @param {Record<string, string>} object - The parsed account map.
 * @returns {Record<string, string>} The same entries, keys lower-cased.
 */
function lowerCaseKeys(object) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key.toLowerCase(), value]));
}

/**
 * Reads all of stdin as text.
 *
 * @returns {Promise<string>} The hook input.
 */
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Finds the owner, the first path segment, of the `origin` remote in `directory`.
 *
 * @param {string} directory - Where the prompt was submitted.
 * @returns {Promise<string | undefined>} The owner, or undefined without a repo, an origin or an owner segment.
 */
async function originOwner(directory) {
  const url = await run("git", ["-C", directory, "remote", "get-url", "origin"]).then(
    ({ stdout }) => stdout.trim(),
    () => undefined
  );
  if (!url) return undefined;

  // The scp form (git@github.com:owner/repo.git) is not a URL; the others are, whatever the scheme.
  const scpPath = url.match(/^[^/:]+:(?!\/\/)(.+)$/)?.[1];
  const remotePath = scpPath ?? URL.parse(url)?.pathname ?? "";
  const [owner, repository] = remotePath.split("/").filter(Boolean);
  return repository ? owner : undefined;
}

/**
 * Reads the signed-in account's email from Claude Code's config file.
 *
 * @returns {Promise<string | undefined>} The email, or undefined when no account is signed in.
 */
async function signedInEmail() {
  const configDir = process.env.CLAUDE_CONFIG_DIR ?? homedir();
  const config = await readFile(path.join(configDir, ".claude.json"), "utf8").then(JSON.parse, (error) => {
    if (error.code === "ENOENT") return {};
    throw error;
  });
  return config.oauthAccount?.emailAddress;
}
