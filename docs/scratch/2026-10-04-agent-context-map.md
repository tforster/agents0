# Agent Context Map <!-- omit in toc -->

What an agent -- a session you start, a subagent, or a loop worker -- has in context, in what order it arrives, and what pulls each further file in. Each box is marked as it stands on 2026-10-18, after DEV0-67 moved Agents0 to a Claude Code plugin: **exists**, or **planned** with the story that builds it. Decision IDs refer to `2026-09-11-dev0-framework.md`.

## Table of Contents <!-- omit in toc -->

- [1. Legend](#1-legend)
- [2. Always loaded, at start](#2-always-loaded-at-start)
- [3. Loaded on demand, during work](#3-loaded-on-demand-during-work)
- [4. Enforcement, not context](#4-enforcement-not-context)
- [5. Never loaded by an agent](#5-never-loaded-by-an-agent)

## 1. Legend

```mermaid
flowchart LR
  exists["exists"]:::exists
  planned["planned, story key shown"]:::planned
  decision{"decision"}

  classDef exists fill:#dcfce7,stroke:#16a34a,color:#14532d
  classDef planned fill:#f1f5f9,stroke:#64748b,color:#334155,stroke-dasharray:5 3
```

Everything in §2 is paid by **every** agent, including each subagent and loop worker (A2) -- except the rules, which a subagent does not receive -- so it is the budget that matters: D25 targets ~1,200 tokens for the global rules, D63 caps the root `CLAUDE.md` plus imports at 6 KB.

## 2. Always loaded, at start

```mermaid
flowchart TD
  start(["Session, subagent or loop worker starts"]) --> harness["Harness baseline<br/>system prompt, tool definitions<br/>outside our control"]:::exists
  harness --> globalMd["~/.claude/CLAUDE.md<br/>one line"]:::exists
  globalMd --> memory["Auto memory MEMORY.md<br/>per project index"]:::exists
  memory --> rootMd["Project root CLAUDE.md<br/>what this system is called"]:::exists
  rootMd --> glossaryMap["GLOSSARY-MAP.md via @ import<br/>published language (D19)<br/>planned"]:::planned
  rootMd --> agentSkills["Agent skills block<br/>three pointers into docs/agents/<br/>6.2"]:::planned
  rootMd --> pointers["Skill and agent descriptions<br/>agents0: plugin, pinned third-party plugins<br/>user-only skills excluded (A4, 5.8)"]:::exists
  pointers --> mcp["MCP tool names<br/>today global; per project via .mcp.json (5.6)"]:::exists
  mcp --> subagent{"Started by<br/>the Agent tool?"}
  subagent -- no --> rules["Rules, one SessionStart hook each<br/>agents0 rules/: dev0.md, code-style.md, javascript.md,<br/>testing.md, markdown.md, diataxis.md<br/>each under 10,000 characters"]:::exists
  subagent -- yes --> ready(["Ready for the first prompt"])
  rules --> ready

  classDef exists fill:#dcfce7,stroke:#16a34a,color:#14532d
  classDef planned fill:#f1f5f9,stroke:#64748b,color:#334155,stroke-dasharray:5 3
```

Plugins cannot ship rules, so the `agents0` plugin injects each file in `rules/` through its own SessionStart hook: hook output over 10,000 characters is cut to a preview. The six rules are about 4.3k tokens in every main session and `claude -p` worker. A subagent started with the Agent tool gets no SessionStart context, so it sees none of them; native `~/.claude/rules/` used to reach it. 2.6 and 2.7 demote the language rules into skills.

## 3. Loaded on demand, during work

```mermaid
flowchart TD
  ready(["Agent at work"]) --> touchFile{"Reads or edits<br/>a file?"}
  ready --> choice{"Dependency or<br/>architecture choice?"}
  ready --> story{"Working a<br/>story?"}
  ready --> term{"Naming a<br/>domain concept?"}
  ready --> slash{"You type /to-spec,<br/>/to-tickets or /implement?"}

  touchFile -- yes --> cascade["Every CLAUDE.md on the path<br/>e.g. workspaces/ then workspaces/iam/<br/>mechanism exists (A1)"]:::exists
  cascade --> language{"Which<br/>language?"}
  language -- JavaScript --> jsSkill["agents0:javascript skill<br/>rules 10-12<br/>rules/javascript.md folded in by 2.6"]:::exists
  language -- shell --> shellSkill["agents0:shell skill"]:::exists
  language -- "HTML, CSS, Handlebars" --> webSkill["agents0:web-ui skill"]:::exists
  language -- Markdown --> mdSkill["agents0:markdown skill"]:::exists
  language -- PHP --> phpSkill["php skill<br/>2.8"]:::planned

  choice -- yes --> adrIndex["ADR file names<br/>agents0 plugin adr/, named by dev0.md"]:::exists
  adrIndex --> adr["One ADR<br/>plugin adr/, or project docs/adr/ in 2.4"]:::exists

  story -- yes --> tracker["tracker skill: get<br/>6.1"]:::planned
  tracker --> issueTracker["docs/agents/issue-tracker.md<br/>triage-labels.md<br/>6.2"]:::planned
  tracker --> blueprint["Story blueprint plus parent<br/>epic's decisions (D85)"]:::planned
  blueprint --> verify{"Blueprint Verification:<br/>open decisions? (7.3)"}
  verify -- yes --> needsInfo["Triage Notes comment, needs-info,<br/>unassign, move on"]:::planned
  verify -- no --> implement["Upstream implement<br/>then tdd, then code-review"]:::exists

  term -- yes --> glossary["GLOSSARY.md of that context<br/>planned"]:::planned

  slash -- yes --> pocock["mattpocock-skills plugin skill loads<br/>pinned in the agents0 marketplace<br/>reads docs/agents/*.md"]:::exists
  pocock --> issueTracker

  classDef exists fill:#dcfce7,stroke:#16a34a,color:#14532d
  classDef planned fill:#f1f5f9,stroke:#64748b,color:#334155,stroke-dasharray:5 3
```

The upstream skills exist but have nothing to read yet: `docs/agents/` arrives with 6.2. Whether a loop worker can start `implement` at all is A3 (7.5).

## 4. Enforcement, not context

Hooks cost no context and cannot be talked past (D30, D32). They fire on the tool call, whichever agent made it.

```mermaid
flowchart LR
  sessionStart(["SessionStart"]) --> retention["Scratch retention<br/>3.5"]:::planned
  prompt(["UserPromptSubmit"]) --> account["Account gate<br/>3.10"]:::planned
  bash(["Bash call"]) --> install{"npm install<br/>with a package?"}
  install -- yes --> depGate["Dependency gate: BLOCK<br/>3.2"]:::planned
  bash --> git{"force-push, merge,<br/>switch to main?"}
  git -- yes --> gitGate["Git absolutes: BLOCK<br/>3.1"]:::planned
  edit(["Edit or Write"]) --> fileType{"File type?"}
  fileType -- "*.js" --> jsLint["oxfmt and oxlint<br/>3.3"]:::planned
  fileType -- "*.php" --> phpLint["php-cs-fixer and php -l<br/>4.1"]:::planned
  fileType -- "root CLAUDE.md, GLOSSARY*" --> budget["Root budget warning<br/>3.6"]:::planned
  stop(["Stop"]) --> completion["Completion gate: lint,<br/>typecheck, test -- BLOCK<br/>3.4"]:::planned

  classDef planned fill:#f1f5f9,stroke:#64748b,color:#334155,stroke-dasharray:5 3
```

None of Dev0's enforcement hooks exist yet. The `agents0` plugin's only hooks inject rules at SessionStart (§2), which is context, not enforcement; other plugins run their own (`claude-mem`).

## 5. Never loaded by an agent

- `DEV0.md` (2.2): the tenets and decision matrix, written for the architect. The single exception is the Dev0 review agent (7.4), whose job is judgement (D59).
- The framework design doc and this map: `docs/scratch/`, for you.

[← Back to Documentation Home](../README.md)
