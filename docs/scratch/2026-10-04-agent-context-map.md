# Agent Context Map <!-- omit in toc -->

The context map diagrams live in the root README, [How Agents0 Reaches an Agent](../../README.md#3-how-agents0-reaches-an-agent), since DEV0-68; edit them there. The README is written for a visitor with none of our context, so it leaves out the story keys and decision IDs. This note keeps them. Decision and assumption IDs refer to `2026-09-11-dev0-framework.md`.

## Table of Contents <!-- omit in toc -->

- [1. Planned boxes and their stories](#1-planned-boxes-and-their-stories)
- [2. Notes behind the diagrams](#2-notes-behind-the-diagrams)

## 1. Planned boxes and their stories

| Diagram | Box | Story or decision |
| --- | --- | --- |
| Always loaded | `GLOSSARY-MAP.md` | D19, published language |
| Always loaded | Pointers into `docs/agents/` | 6.2 |
| Always loaded | MCP tool names, per project via `.mcp.json` | 5.6 |
| Loaded on demand | `php` skill | 2.8 |
| Loaded on demand | `rules/javascript.md` folded into the `javascript` skill | 2.6 |
| Loaded on demand | Project ADRs in `docs/adr/` | 2.4 |
| Loaded on demand | `tracker` skill | 6.1 |
| Loaded on demand | `docs/agents/` | 6.2 |
| Loaded on demand | Story blueprint plus epic decisions | D85 |
| Loaded on demand | Blueprint Verification, needs-info | 7.3 |
| Enforcement | Scratch retention | 3.5 |
| Enforcement | Account gate | 3.10, D75 |
| Enforcement | Dependency gate | 3.2 |
| Enforcement | Git gate | 3.1 |
| Enforcement | oxfmt and oxlint | 3.3 |
| Enforcement | php-cs-fixer and `php -l` | 4.1 |
| Enforcement | Root budget warning | 3.6 |
| Enforcement | Completion gate | 3.4 |

## 2. Notes behind the diagrams

- Everything always loaded is paid by every agent, each subagent and loop worker included (A2). D25 targets ~1,200 tokens for the global rules; D63 caps the root `CLAUDE.md` plus imports at 6 KB. The six rules are about 4.3k tokens today; 2.6 and 2.7 demote the language rules into skills.
- The README's skill descriptions box drops "user-only skills excluded": it rests on A4, untested (5.8).
- The CLAUDE.md cascade on a file's path is A1, tested.
- The upstream skills exist but have nothing to read until `docs/agents/` arrives with 6.2. Whether a loop worker can start `implement` at all is A3 (7.5).
- Hooks cost no context and cannot be talked past (D30, D32). Other plugins run their own hooks (`claude-mem`).
- Never loaded by an agent: `DEV0.md` (2.2), written for the architect, except by the Dev0 review agent (7.4, D59); the framework design doc and this note.

[← Back to Documentation Home](../README.md)
