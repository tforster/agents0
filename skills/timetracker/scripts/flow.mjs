// flow.mjs — measures how meetings and Teams chats broke up each local day's focus time
//
// Node 24+. Reads one JSON file of calendar events and chat messages, collected through the Microsoft 365 MCP tools,
// and prints JSON per local day: meeting and chat load, interruption count, and the focus time left between them.
// Local days and the workday window follow the TZ environment variable, as claude-log.mjs does.
//
// Input:
//   {
//     "workday": ["09:00", "17:00"],                                          // optional
//     "meetings": [{ "start": "<ISO>", "end": "<ISO>", "title": "…", "dev": false }],
//     "away":     [{ "start": "<ISO>", "end": "<ISO>", "title": "…" }],      // personal blocks: dentist, lunch
//     "messages": [{ "at": "<ISO>", "chat": "<chat id>", "fromMe": true }]
//   }
//
// Usage:
//   node flow.mjs events.json

// System dependencies
import { readFile } from "node:fs/promises";

/**
 * @typedef {Object} Span
 * @property {number} start - Epoch milliseconds.
 * @property {number} end - Epoch milliseconds.
 */

/**
 * @typedef {Object} Input
 * @property {[string, string]} [workday]
 * @property {{ start: string, end: string, title?: string, dev?: boolean }[]} [meetings]
 * @property {{ start: string, end: string, title?: string }[]} [away]
 * @property {{ at: string, chat: string, fromMe?: boolean }[]} [messages]
 */

const minute = 60_000;

// Messages in one chat less than this far apart are one conversation, so one interruption, not several.
const chatGap = 15 * minute;

// A one-line reply still costs a context switch; an episode occupies at least this long.
const minimumEpisode = 5 * minute;

// Time to get back into the code after an interruption ends. Commonly cited figures run 15 to 25 minutes;
// the low end keeps the metric conservative.
const recovery = 15 * minute;

// A gap shorter than this is too short for deep work, so it counts as fragmented time, not focus time.
const focusThreshold = 60 * minute;

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

/**
 * Returns the local YYYY-MM-DD date of an instant.
 *
 * @param {number} time - Epoch milliseconds.
 * @returns {string} Local date.
 */
function localDate(time) {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Returns the instant of a local wall-clock time on a local date.
 *
 * @param {string} date - Local YYYY-MM-DD.
 * @param {string} clock - Local HH:MM.
 * @returns {number} Epoch milliseconds.
 */
function at(date, clock) {
  // No zone suffix: Date parses a date-time string without one as local time.
  return new Date(`${date}T${clock}:00`).getTime();
}

/**
 * Parses an ISO timestamp, refusing one without a zone so a UTC wall-clock time is never read as local.
 *
 * @param {string} iso - ISO 8601 timestamp with Z or an offset.
 * @returns {number} Epoch milliseconds.
 */
function parse(iso) {
  if (!/(Z|[+-]\d\d:\d\d)$/.test(iso)) throw new Error(`Timestamp has no zone: ${iso}. Append Z for UTC.`);
  return Date.parse(iso);
}

/**
 * Merges overlapping spans so time is never counted twice.
 *
 * @param {Span[]} spans - Spans in any order.
 * @returns {Span[]} Disjoint spans, ordered by start.
 */
function union(spans) {
  /** @type {Span[]} */
  const merged = [];
  for (const span of [...spans].sort((a, b) => a.start - b.start)) {
    const last = merged.at(-1);
    if (last && span.start <= last.end) last.end = Math.max(last.end, span.end);
    else merged.push({ ...span });
  }
  return merged;
}

/**
 * Sums span lengths in whole minutes.
 *
 * @param {Span[]} spans - Disjoint spans.
 * @returns {number} Minutes.
 */
function minutes(spans) {
  return Math.round(spans.reduce((total, span) => total + span.end - span.start, 0) / minute);
}

// ---------------------------------------------------------------------------
// Chat episodes
// ---------------------------------------------------------------------------

/**
 * Groups messages into conversations per chat, keeping only those the user took part in: an unanswered message
 * may never have been read, so it is not evidence of an interruption.
 *
 * @param {NonNullable<Input["messages"]>} messages - Chat messages.
 * @returns {(Span & { sent: number })[]} Episodes.
 */
function episodes(messages) {
  /** @type {Map<string, (Span & { sent: number })[]>} */
  const byChat = new Map();
  for (const message of [...messages].sort((a, b) => parse(a.at) - parse(b.at))) {
    const time = parse(message.at);
    const chat = byChat.get(message.chat) ?? [];
    const last = chat.at(-1);
    if (last && time - last.end < chatGap) last.end = time;
    else chat.push({ start: time, end: time, sent: 0 });
    if (message.fromMe) chat.at(-1).sent++;
    byChat.set(message.chat, chat);
  }
  return [...byChat.values()]
    .flat()
    .filter((episode) => episode.sent > 0)
    .map((episode) => ({ ...episode, end: Math.max(episode.end, episode.start + minimumEpisode) }));
}

// ---------------------------------------------------------------------------
// Per-day measurement
// ---------------------------------------------------------------------------

/**
 * Measures one local day.
 *
 * @param {string} date - Local YYYY-MM-DD.
 * @param {{ meetings: (Span & { dev: boolean })[], away: Span[], chats: (Span & { sent: number })[] }} day - The day's spans.
 * @param {[string, string]} workday - Local HH:MM start and end.
 * @returns {Record<string, unknown>} The day's metrics.
 */
function measure(date, { meetings, away, chats }, workday) {
  const window = { start: at(date, workday[0]), end: at(date, workday[1]) };
  const interruptions = [...meetings, ...chats];

  // Busy time is each interruption plus its recovery, and any time away; whatever is left in the workday is open.
  const busy = union([...interruptions.map((span) => ({ start: span.start, end: span.end + recovery })), ...away]);
  /** @type {Span[]} */
  const open = [];
  let cursor = window.start;
  for (const span of busy) {
    if (span.start > cursor) open.push({ start: cursor, end: Math.min(span.start, window.end) });
    cursor = Math.max(cursor, span.end);
  }
  if (cursor < window.end) open.push({ start: cursor, end: window.end });
  const gaps = open.filter((span) => span.end > span.start);
  const focus = gaps.filter((span) => span.end - span.start >= focusThreshold);

  return {
    date,
    meetings: { count: meetings.length, minutes: minutes(union(meetings)) },
    chats: { episodes: chats.length, sent: chats.reduce((total, chat) => total + chat.sent, 0), minutes: minutes(union(chats)) },
    interruptions: interruptions.length,
    // Dev meetings (planning, a pairing session) break flow but are dev work, so they are left out of management time.
    managementMinutes: minutes(union([...meetings.filter((meeting) => !meeting.dev), ...chats])),
    awayMinutes: minutes(union(away)),
    focusMinutes: minutes(focus),
    focusBlocks: focus.length,
    longestFocusMinutes: Math.max(0, ...gaps.map((span) => Math.round((span.end - span.start) / minute))),
    fragmentedMinutes: minutes(gaps.filter((span) => span.end - span.start < focusThreshold)),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const [file] = process.argv.slice(2);
if (!file) throw new Error("Usage: node flow.mjs events.json");

/** @type {Input} */
const input = JSON.parse(await readFile(file, "utf8"));
const workday = input.workday ?? ["09:00", "17:00"];

/** @type {Map<string, { meetings: (Span & { dev: boolean })[], away: Span[], chats: (Span & { sent: number })[] }>} */
const days = new Map();
/**
 * Returns a day's bucket, creating it on first use.
 *
 * @param {number} time - Epoch milliseconds within the day.
 * @returns {{ meetings: (Span & { dev: boolean })[], away: Span[], chats: (Span & { sent: number })[] }} The bucket.
 */
const day = (time) => {
  const date = localDate(time);
  if (!days.has(date)) days.set(date, { meetings: [], away: [], chats: [] });
  return /** @type {NonNullable<ReturnType<typeof days.get>>} */ (days.get(date));
};

for (const meeting of input.meetings ?? []) {
  const span = { start: parse(meeting.start), end: parse(meeting.end), dev: !!meeting.dev };
  day(span.start).meetings.push(span);
}
for (const block of input.away ?? []) {
  const span = { start: parse(block.start), end: parse(block.end) };
  day(span.start).away.push(span);
}
for (const episode of episodes(input.messages ?? [])) day(episode.start).chats.push(episode);

const result = [...days.keys()].sort().map((date) => measure(date, /** @type {any} */ (days.get(date)), workday));
console.log(JSON.stringify({ workday, days: result }, null, 2));
