# Dev0 Framework -- Design Review <!-- omit in toc -->

The consolidated output of the grilling session of 2026-09-10/11, revised by a second grilling session on 2026-09-13 (revised decisions are marked _Revised 2026-09-13_; new ones start at D59), and by a third on 2026-10-01 that began from a voice design session with Gemini on an Agile hierarchy for agent-built software (marked _Revised 2026-10-01_; new decisions D77-D87, mostly §11; D88 added 2026-10-04). This document exists so you can confirm or reject each decision in one sitting, before anything is built.

It is deliberately **ephemeral**. Once confirmed, its content disperses into durable homes (§18) and this file ages out of `docs/scratch/` under the 28-day retention rule it specifies. Do not cite it from anywhere. Where a decision before D77 says _spec_, read _blueprint_ (D80).

## Table of Contents <!-- omit in toc -->

- [1. How to use this document](#1-how-to-use-this-document)
- [2. The thesis](#2-the-thesis)
- [3. Dev0](#3-dev0)
  - [3.1. Core Tenets of Dev0](#31-core-tenets-of-dev0)
  - [3.2. The Strategic Decision Matrix: Examples in Practice](#32-the-strategic-decision-matrix-examples-in-practice)
  - [3.3. Dev0 exists in four drifting copies today](#33-dev0-exists-in-four-drifting-copies-today)
  - [3.4. Judgement gates](#34-judgement-gates)
  - [3.5. Code rules v1](#35-code-rules-v1)
- [4. Documentation architecture](#4-documentation-architecture)
  - [4.1. The diagnosis](#41-the-diagnosis)
  - [4.2. The ownership rule](#42-the-ownership-rule)
  - [4.3. The cascade](#43-the-cascade)
  - [4.4. Vocabulary](#44-vocabulary)
  - [4.5. Ephemeral area](#45-ephemeral-area)
- [5. Decision memory](#5-decision-memory)
- [6. The three tiers](#6-the-three-tiers)
- [7. The global layer](#7-the-global-layer)
- [8. The toolkit](#8-the-toolkit)
- [9. Enforcement](#9-enforcement)
- [10. Trackers](#10-trackers)
- [11. Work hierarchy and blueprints](#11-work-hierarchy-and-blueprints)
- [12. The autonomous loop](#12-the-autonomous-loop)
- [13. Agents and models](#13-agents-and-models)
- [14. Skills, plugins and context budget](#14-skills-plugins-and-context-budget)
- [15. Worktree ergonomics](#15-worktree-ergonomics)
- [16. Build order](#16-build-order)
- [17. Phase 0 -- unverified assumptions](#17-phase-0----unverified-assumptions)
- [18. Where this document goes next](#18-where-this-document-goes-next)

## 1. How to use this document

Every decision carries an ID (`D1`, `D2`, ...). Comment inline in the Markdown, or reply with `D7: no, because ...`. The file is committed, so subsequent edits are diffable against this initial version.

Each decision records what was **rejected** as well as what was chosen. The rejections are the load-bearing part: a codebase records what you built and can never record what you ruled out, so an agent with no rejection record re-proposes React, `feat/` branch prefixes and a Diátaxis `explanation/` tree forever.

## 2. The thesis

One sentence, because everything else is downstream of it:

> You currently spend your judgement **after** generation, stripping verbose code out of diffs -- repeatedly, per file. This framework moves that spend **before** generation: once, on prose, answering questions rather than authoring. A spec constrains every file the loop touches; a post-hoc edit fixes one.

**D1.** The framework's shape follows from that:

> **You own spec and architecture. Agents own construction and verification. The signed spec is the boundary.**

Everything upstream of that line is HITL and exists to sharpen your thinking (`grilling`, `to-spec`, `domain-modeling`). Everything downstream is AFK and exists to execute without interpreting (the loop, the code rules, the hooks, the verification triad). This becomes the first line of `philosophy.md`, because it tells an agent which half of the world it is in.

## 3. Dev0

Dev0 is my attempt to name the way I architect and build software based on my 40 years of experience. "Zero-Based Architecture".

Dev0 (Zero-Based Development) is an architectural and engineering philosophy that rejects default industry bloat in favour of intentionality, ruthless simplicity, and structural clarity. Rather than treating minimalism as mere "code golf" or dogmatic asceticism, Dev0 applies a zero-based mindset across the entire software lifecycle: start from an absolute baseline of zero assumptions, zero abstractions, and zero dependencies, requiring every single addition to justify its existence against the whole system.

### 3.1. Core Tenets of Dev0

- Holistic-First Systems Thinking: Architecture begins at the perimeter. Dev0 starts with a wide-angle view of the problem space to delineate bounded contexts and business domains before writing a line of code. It deliberately zooms from macro to micro while keeping the overall system topology in focus.

- C4 Model Alignment: Dev0 leverages the C4 model (Context, Containers, Components, Code) because it reflects this exact zooming mechanism. It ensures developers never lose the forest for the trees, avoiding the trap of hyper-optimising a leaf component at the expense of container-level simplicity.

- Strategic Dependency Evaluation: Dev0 does not forbid third-party dependencies; it forbids unexamined ones. When evaluating an external package, the architect must weigh its business and functional value against its total footprint.

- Full Dependency-Tree Accountability: An architect is responsible not just for the top-level package, but for the entire transitive tree. A 5 KB utility that drags in 40 indirect packages, cyclic dependencies, or heavy build tooling fails the Dev0 standard.

- Respect for the Platform: The native platform -- standardised browser APIs, the raw runtime, standard protocols, semantic HTML -- is the default framework. Dev0 relies on the platform first before layering abstractions.

### 3.2. The Strategic Decision Matrix: Examples in Practice

- The Justified Inclusion: Markdown parsing in a presentation engine like Deck0. Parsing CommonMark involves extensive specification edge cases, security sanitisation considerations, and complex tokenisation. Using a single, battle-tested, focused library like marked is a strategic Dev0 decision: the problem is solved, specialised, and avoids reinventing a massive wheel, while keeping direct and transitive overhead bounded.

- The Rejected Inclusion: Pulling in an entire UI component framework or state management library to render a clean slide or toggle a modal. The platform already provides semantic tags, CSS Grid, Scroll Snap, and native DOM APIs that accomplish the task with zero runtime weight.

- The Semantic Delimiter: Choosing native `<h1>` tags as presentation slide boundaries rather than inventing custom metadata schemas or parser syntax. The structure of the document is the interface, maintaining compatibility with standard Markdown renderers without adding parser overhead.

Dev0 shifts the default developer posture from "Why shouldn't we add this?" to "Does this component earn the right to exist in our system?" It replaces passive accretion with active, conscious architecture.

**D59 -- The tenets are for the architect, not the agents.** _Added 2026-09-13._ The introduction, the tenets and the decision matrix above move to `DEV0.md` at the root of the toolkit repo, linked from the first line of its README. Agents never load it: `philosophy.md` carries only D1, the gates and the code rules. Weighing a dependency is the architect's judgement, upstream of the D1 boundary; agents are downstream and default-deny (D3). The one exception is the Dev0 review agent (D48), whose job is judgement.

_Rejected:_ tenets in `philosophy.md` with a "weighing is the architect's job" caveat (~650 tokens in every session and subagent, and "forbids _unexamined_ ones" is exactly the sentence a model quotes to justify Zod); rewriting the tenets to be agent-safe (they are right as written, for their audience).

**D88 -- The agents' rules file is `rules/dev0.md`, not `philosophy.md`.** _Added 2026-10-04._ D59 split Dev0 by audience but left the agent file named for the other one. What agents load is **operating rules** -- D1's boundary, the gates, the code rules, Done (D84) -- derived from the tenets, not the tenets themselves. `DEV0.md` is Dev0 for the architect; `rules/dev0.md` is Dev0 for agents; the directory tells them apart. Read `rules/dev0.md` wherever an earlier decision says `philosophy.md`.

_Rejected:_ `core.md` or `ground-rules.md` (core against what -- `code-style.md` is always-on too); `tenets.md` (the human document's word); keeping `philosophy.md` (it names the other audience's file -- the confusion this decision fixes).

### 3.3. Dev0 exists in four drifting copies today

This is the single best explanation for why agent output does not look like your code.

| Location                                       | Says                                                                                                                    |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `traits/rules/philosophy.md`                   | minimalism, zero-dependency bias, native-first                                                                          |
| `traits/agents/cqrs-api-architect.md`          | _"Zero-Based Development philosophy: minimal dependencies, no bloaty frameworks"_                                       |
| `traits/agents/SeniorDev.md`                   | _"40 years of experience. You value simplicity over abstraction."_                                                      |
| `platform` `workspaces/agents/skills/harness/` | _"Low-Fat ESM JavaScript standards and surgical code changes"_ -- **inert; no frontmatter, outside any discovery path** |

Four names for one doctrine, each an incomplete subset, one unreachable. Whichever happens to be in context decides how the code comes out. **D2: `philosophy.md` becomes the single source; the other three are deleted or merged into it.** Refined by D59: the tenets go to `DEV0.md`, not `philosophy.md`.

### 3.4. Judgement gates

**D3 -- Dependencies: default-deny.** Zero new runtime dependencies without asking. No agent-side justification is accepted. The agent may hand-roll, or stop and ask. Existing dev tooling (`oxlint`, `oxfmt`, `node:test`, `tsc`) is already approved; anything new -- runtime **or** dev -- is the architect's decision. _Revised 2026-09-13:_ the dependency gate (D29) therefore blocks `-D` installs too. A bare `npm install` or `npm ci` passes, since it installs only what `package.json` already approves.

_Rejected:_ a budget (arbitrary; you would argue the number instead of the decision); a checklist of tests the dependency must pass (more prose to rationalise against); blocking runtime installs only (contradicts architect-owned tooling); different refusal messages for dev and runtime (flag parsing that changes nothing the agent does -- it stops and asks either way).

**D4 -- Abstraction: the rule of three.** Write the direct version. Abstract on the **third** repetition, not the second. Countable, so the agent can be told it is wrong.

**D5 -- Docs: a doc is written when an issue asks for it, or a public interface changed.** Never speculatively. You currently have six mechanisms describing _how_ to write docs and none describing _whether_ -- that asymmetry is why agents bury you.

**D6 -- Tests are not a Dev0 gate.** `testing.md` already settles them (moving into the `javascript` skill, D25).

The three gates share one shape, which generalises the doctrine past dependencies: **default to the direct thing; earn the indirection with a counted trigger.**

### 3.5. Code rules v1

Derived from the edits you actually make to agent output. Phrased **positively**: steering by prohibition drags the forbidden behaviour into context and makes it more available, not less.

| #   | Rule                                                                                                                                                                                             | Trigger    | Rationale                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Validate at the boundary, then trust.** Inside a module, arguments are the type the JSDoc declares.                                                                                            | --         | Bad input arrives at the edge, so one gate there is enough. Re-checking inside duplicates the JSDoc contract `tsc` already enforces and buries logic in defensive noise.                  |
| 2   | **Let errors propagate to the boundary.** Catch only to add information, convert to a `Response`, or release a resource.                                                                         | --         | Scattered catch-and-log swallows failures and strips context. One boundary handler decides status and logging consistently.                                                               |
| 3   | **A function lives in the file that calls it** until a second caller exists.                                                                                                                     | 2nd caller | Extracting early guesses at reuse and adds indirection. The second caller reveals the real shape, and moving it then is cheap.                                                            |
| 4   | **Return the expression.** `return await x()`, `return !!x`.                                                                                                                                     | --         | A temp variable or `if`/`else` adds lines and names that mean nothing. Keep the `await` -- only an awaited rejection reaches a local `catch`, and the async stack trace keeps this frame. |
| 5   | **Comments carry what the code cannot** -- why, intent, edge cases, the rejected alternative. Write them liberally.                                                                              | --         | Code already says what and how. Without the why, the next reader -- human or agent -- re-derives the decision or undoes it.                                                               |
| 6   | **Up to four parameters are positional.** Five or more take an options object.                                                                                                                   | 5th param  | Past four, call sites become order-dependent guesswork. Named properties document themselves and tolerate optional arguments.                                                             |
| 7   | **Import from the module that defines the symbol.** A barrel earns its place only at a published API boundary.                                                                                   | --         | Barrels hide where code lives, invite circular imports, and load more than needed. Direct imports keep dependencies greppable.                                                            |
| 8   | **Name a literal when the name says something the value does not**, or when it is used twice. Otherwise inline it.                                                                               | 2nd use    | A constant for a self-evident value makes the reader jump to learn nothing. A name pays when it adds meaning or keeps two uses in sync.                                                   |
| 9   | **Call the function directly** -- no forwarding wrapper.                                                                                                                                         | --         | A wrapper that only forwards adds a name, a JSDoc block, and a jump, yet no behaviour -- and it hides the real call.                                                                      |
| 10  | **Independent awaits run in parallel** -- `Promise.all` / `allSettled` / `any`.                                                                                                                  | --         | Sequential awaits of unrelated work add their latencies for nothing. The combinator also states intent: all required, failures tolerated, or first wins.                                  |
| 11  | **JSDoc is the type system, not prose.** Every parameter and return typed. `@description` only when the function needs explaining -- a short, self-evident function gets types and nothing else. | ~6 lines   | With `checkJs`, types are verified; prose restating the signature is unverified, goes stale, and is the noise you delete (D7).                                                            |
| 12  | **Braces on every `if`**, always the multi-line form.                                                                                                                                            | --         | A braceless `if` invites the added-second-line bug and noisier diffs. Mechanical, so `oxlint` enforces it (D9).                                                                           |

_Revised 2026-10-04:_ rules 1-9 are language-neutral and stay always-on in `rules/dev0.md` (D88); rules 10-12 are JavaScript's and move to the model-invoked `javascript` skill, **keeping their numbers** so D7 and D9 still resolve. Every agent no longer pays for `Promise.all` and braces while writing PHP or shell.

**D7.** Rule 11 supersedes the current `philosophy.md` §4, which mandates `@description` on _every_ function and has therefore been actively producing the JSDoc noise you then delete.

**D8.** Optional-chaining guards are **not** a strip pattern -- they stay. _(Parked: `tsc --noEmit` with `checkJs`, which you already run, is precisely the tool that proves a value cannot be null. Revisit once typecheck is clean.)_

**D9.** Rule 12 is enforced by `oxlint` (`curly: ["error", "all"]`), never by instruction. Rule 13 -- _local static serving is `npx static-server <path>`_ -- is not a rule at all but an accepted-dependency precedent, so it becomes the first entry in `install/adr/`.

**D10.** JavaScript first, on `oxlint`/`oxfmt`. `html`, `css`, `json`, `sql`, `md` are parked and surgically backfilled once the pattern is proven. `lint:content` in `platform` already covers most of them, so the backfill is wiring, not new tooling. ESLint is rejected (global ADR): its config bloats with plugins and demands constant attention as formats and interfaces change. PHP is the exception -- D60.

**D60 -- PHP is a fast-follow.** _Added 2026-09-13._ `legacy.web` (a large legacy PHP monolith) is being strangler-fig'd into `platform` over at least two years. New PHP -- interception and rerouting code, including the switch to SSO -- has to survive that long, so it is tested and held to Dev0.

- **Rules split by directory, not by language.** New strangler code (`fig/`, namespace `App\Fig`) follows the Dev0 code rules and requires tests, via its own cascade `CLAUDE.md`. The legacy tree follows the surgical-change rule: touch only what the issue needs, never refactor legacy, new logic goes in `fig/`.
- **A `php` skill** carries what both share: the production PHP syntax ceiling, PSR-12 plus the repo's `php-cs-fixer` config, and the directory split. Seeded from `SeniorDev` before D48 deletes it.
- **Testing:** the newest PHPUnit that supports production PHP inside the `legacy-web-1` container for `fig/` units; Playwright characterisation tests at the HTTP boundary for every reroute -- same request, same observable result before and after interception.
- **Hooks (Phase 4):** `php-cs-fixer` on the changed file; `php -l` inside `php:<production>-cli`, because local PHP is newer and syntax that runs locally can break production; the completion gate runs `devops/test.sh --phpunit`.

_Rejected:_ no Dev0 rules for any PHP (new interception code lives two-plus years); Dev0 rules for all PHP (rewriting legacy that is being strangled is waste and risk); the production syntax ceiling by instruction only (decays over a session; the container lint does not); PHPCompatibility via `phpcs` (a new dev tool for marginal gain).

_Parked for the `legacy.web` rollout:_ whether the existing SSO library moves into `fig/`.

## 4. Documentation architecture

### 4.1. The diagnosis

Diátaxis gives a **categorisation** rule -- which of four folders -- but no **ownership** rule. So when an agent holds a fact, Diátaxis always answers "yes, it goes somewhere" and never "no, this already lives in the code." Hence contradiction and duplication. `markdown.md` §5 states anti-duplication but nothing can enforce it.

Measured on `platform`:

|                           |                                                    |
| ------------------------- | -------------------------------------------------- |
| `docs/` total             | 165 `.md`, **4.8 MB**                              |
| `explanation/`            | **83 files, 2.3 MB -- half the doc mass**          |
| Largest singles           | 51 KB, 49 KB, 48 KB, 42 KB -- **~13k tokens each** |
| Domains in `explanation/` | 4, against **16 workspaces**                       |
| `platform/`               | ~60% of `explanation/`, and **is not a workspace** |
| `CLAUDE.md` files         | **zero**                                           |

`platform/` being both the largest bucket and the one with no code is causation, not coincidence: **docs sprawl precisely where nothing owns them.**

### 4.2. The ownership rule

**D11.** One line, and it is the rule Diátaxis never had:

> **`docs/` holds nothing an agent reads as prose.** Agent knowledge is co-located `CLAUDE.md`. `docs/reference/` holds machine-readable specs (OAS, design tokens); `docs/runbooks/` holds human procedures; `docs/adr/` holds decisions, especially rejections.

The ADR template is Pocock's, with one addition -- D62.

**D12.** `tutorials/` and `explanation/` are dropped; `how-to/` is renamed `runbooks/`. `tutorials/` onboards strangers you do not have. `explanation/` is where agent essays breed, and its legitimate content -- the _why_ -- belongs beside the code it explains.

**D13.** Dropping `explanation/` is a **harvest, not a delete**. 2.3 MB contains real value. This needs a repeatable extraction procedure and is the framework's best first real job.

**D61 -- Long-form lives in the tracker's paired wiki.** _Added 2026-09-13._ Confluence for Jira projects, Paca Docs for Paca projects, the ADO wiki for Azure DevOps projects -- declared in the root `CLAUDE.md` beside the tracker (D33). The `explanation/` harvest **extracts first**: the _why_ goes into `CLAUDE.md`, `CONTEXT.md` and ADRs, and only the residual narrative moves to the wiki. This also answers where D23's linked long-form assets live.

_Rejected:_ moving all 2.3 MB to Confluence now and extracting later (once out of the agent's reach, the extraction never happens); no long-form home for ADO projects.

**D14.** `arc42` is dropped entirely. **C4 stays** as a diagram specification invoked when a document needs a diagram -- a diagram is a far denser encoding than 30 KB of prose. C4 is one diagram type among several: use sequence, flow or state diagrams where they convey the information better. Always Mermaid, in Markdown.

### 4.3. The cascade

**D15.** The directory tree **is** the information hierarchy:

```text
CLAUDE.md                        always loaded    → @CONTEXT-MAP.md import, pointers, tracker + wiki declaration. 6 KB budget (D63).
workspaces/CLAUDE.md             any workspace    → the HLA, C4 context + container diagrams
workspaces/iam/CLAUDE.md         iam only         → that context's architectural summary
workspaces/iam/lib/CLAUDE.md     iam/lib only     → local gotchas
devops/CLAUDE.md                 devops only
```

Depth equals specificity equals laziness of loading. This beats a pointer-based scheme on every axis: there is no pointer wording to get weakly right, it cannot desync because moving the code moves the doc, it is free until relevant, and ownership is automatic -- the answer to "where does this go?" is always "beside the code it describes", and if no code claims it, that is the signal it is an ADR or it is dead.

Consequence: the framework is **Claude-dependent**. `CLAUDE.md`, the cascade and hooks are Claude Code mechanisms, and other models or harnesses will perform worse. Recorded as a global ADR (Claude-only harness accepted); the `AGENTS.md` symlink (D17) is the only hedge.

**D16.** `docs/reference/architecture.md` is **cancelled** -- the HLA lives at `workspaces/CLAUDE.md`. Splitting per-context summaries from the system-level one across two trees was an inconsistency in the first draft of this design.

**D17 -- Two files per context.** _Revised 2026-09-13; the original said there is no `CONTEXT.md`._ Pocock's skills, which are never forked (D52), treat `CONTEXT.md` as a contract: `domain-modeling` and `improve-codebase-architecture` write it eagerly, and `tdd` and `diagnosing-bugs` read it. So each context keeps **`CLAUDE.md` for mechanism** (auto-loaded by the cascade) and **`CONTEXT.md` for vocabulary** (Pocock's glossary format, loaded when a skill asks). `architectural-summary.md` collapses into the co-located `CLAUDE.md`. `AGENTS.md` becomes a symlink to `CLAUDE.md` as cheap insurance.

_Rejected:_ `CLAUDE.md` only, with an `## Agent skills` block redirecting the skills (points `domain-modeling`'s eager glossary writes at always-on files); symlinking `CONTEXT.md` to `CLAUDE.md` (the same outcome, disguised).

_Revised 2026-10-01:_ upstream renamed `CONTEXT.md` to **`GLOSSARY.md`** and `CONTEXT-MAP.md` to **`GLOSSARY-MAP.md`**; read the new names wherever this document says the old (D15, D19, D29, D61, D63). The structure is unchanged: `CLAUDE.md` for mechanism, `GLOSSARY.md` for vocabulary.

**D18.** `docs/agents/` disappears; the tracker declaration and the Pocock-compatibility notes fold into the project root `CLAUDE.md`.

_Reversed 2026-10-01:_ `docs/agents/` **stays, as upstream's configuration seam** -- `setup-matt-pocock-skills` writes it, and the skills read it through an `## Agent skills` pointer block in the root `CLAUDE.md`. `issue-tracker.md` holds the tracker and wiki declaration (D33, D61), how to publish, and the blueprint deltas (D80); `triage-labels.md` holds the label strings (D37); `domain.md` is upstream's, unchanged. Deleting it only makes upstream skills ask for setup, which recreates it.

### 4.4. Vocabulary

**D19.** Ubiquitous language is split by **reach**, which mirrors the DDD model. _Revised 2026-09-13 to follow D17._

|                                                                                       | Where                                                  | Load                                              | Promotion rule                                       |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------- | ---------------------------------------------------- |
| **Published language** -- terms crossing contexts (Customer, Order, Account, Context) | root `CONTEXT-MAP.md`, `## Published Language` section | always, via `@CONTEXT-MAP.md` in root `CLAUDE.md` | a term earns root when it appears in **≥2 contexts** |
| **Context-local language**                                                            | `workspaces/<ctx>/CONTEXT.md`                          | on demand                                         | everything else                                      |

Pocock's `CONTEXT-MAP.md` already lists the contexts (name, path, purpose) and their relationships; the published-language section is an addition his format tolerates. Importing the map routes agents to the right bounded context from the first turn, from a single source -- the root `CLAUDE.md` does not repeat the context list. Single-context repos have a root `CONTEXT.md` and no map.

Mechanism is needed when you _touch_ code; vocabulary is needed when you _talk about_ the domain -- writing a ticket, naming a variable -- which happens outside the subtree. Hence the root weighting. The promotion rule is countable, which is what holds the root file's size down.

_Rejected:_ a routing table in the root `CLAUDE.md` alongside the map (the same list maintained twice); a one-line pointer to the map instead of an import (routing then depends on the agent choosing to open it).

**D63 -- Root budget: 6 KB.** _Added 2026-09-13._ The root `CLAUDE.md` plus everything it imports stays under **6 KB** (~1.5k tokens), measured in **bytes** -- lines are gameable, tokens need a tokenizer. A global `PostToolUse` hook on writes to `CLAUDE.md`, `CONTEXT-MAP.md` or `CONTEXT.md` measures root plus imports and **warns** when over: over budget means push content down the cascade, not an emergency. A runbook in the toolkit's `docs/runbooks/` explains how to push content down -- the part a hook cannot say. The number is a guess, revisited once the client docs harvest gives `platform` a real root to measure.

_Rejected:_ a runbook alone (instruction decays, D24); a per-project lint script (missing in exactly the repos you forget); blocking.

### 4.5. Ephemeral area

**D20.** `docs/scratch/` is kept but made mechanically ephemeral: files are named `YYYY-MM-DD-<slug>.md`, and a `SessionStart` hook deletes entries older than 28 days (two sprints) **and prints what it deleted**. Silent cleanup teaches nothing; seeing "deleted 4 stale scratch files" is the feedback loop that stops the dumping. Retention keys off the filename, never `mtime` -- a `git checkout` resets `mtime`, which is why every file in `explanation/` currently reads as recently touched.

## 5. Decision memory

**D21.** There is no separate "precedent ledger" -- **ADRs already are that object.** Same schema, same purpose, same read pattern; `ADR-0022 custom design system over Bootstrap` is already a rejection record. Two locations, one format:

- `dev0/install/adr/` -- cross-project precedent. _`static-server` accepted. Conventional commits rejected. React, Zod rejected._ Binds everything. Installed like any other category.
- `<project>/docs/adr/` -- this codebase. Supersedes a global ADR when it says so explicitly. The toolkit's own decisions (two-phase install, plain symlinks) live in `dev0/docs/adr/` by the same convention.

_Revised 2026-09-13:_ the two locations stay separate because one is installed and the other is not. _Rejected:_ a single `docs/adr/` with scope front matter (the installer would filter by scope -- a per-category special case); renaming `traits/` to `src/` (`lib/` and `bin/` are the source; the folder is content -- its actual rename is D65).

**D64 -- How agents reach cross-project ADRs.** _Added 2026-09-13._ `install/adr/` symlinks to `~/.claude/adr/` like any category. A **generated** one-line-per-ADR index (`~/.claude/adr/README.md`, rebuilt from ADR titles by `dev0 install` or lint, never by hand) is named in two places: one line in `philosophy.md` -- "before a dependency or architecture choice, read the ADR index" -- and the dependency gate's refusal message. The pointer covers architecture choices no hook can see; the hook covers the moment the pointer is most likely skipped. The always-on cost is one line, regardless of ADR count.

_Rejected:_ the index inlined in `philosophy.md` (grows with every ADR); a hand-maintained index (drifts); a pointer alone or the hook alone.

**D22.** The real distinction is **decision versus rule**: _"we rejected Zod"_ is an ADR and **justifies**; _"validate at the boundary, then trust"_ is a rule and **instructs**. Some ADRs produce a rule; most do not.

**D23.** ADRs are capped at roughly 200 lines. `ADR-0011` is 42 KB -- a design document wearing an ADR's clothes, unreadable at the moment of decision, which is the only moment it exists for. Long-form material becomes a linked asset. `platform` also has two ADR homes, two naming conventions, and a gap at `ADR-0016`–`0019` to reconcile (D62).

Linked long-form assets live in the tracker's paired wiki (D61). An ADR must make complete sense without its link: the link is depth, never a dependency, so a dead wiki link -- or lost Confluence access -- never costs the decision.

**D62 -- The ADR format is Pocock's.** _Added 2026-09-13._ `domain-modeling/ADR-FORMAT.md`: `# Title`, then 1-3 sentences of context, decision and why; Status, Considered Options and Consequences are optional; files are `NNNN-slug.md`; an ADR is offered only when the decision is hard to reverse, surprising without context, and a real trade-off. One layer-above rule: ADRs in `install/adr/` **must** list what was rejected, since rejection is why a precedent exists; Status is **required** where a project ADR supersedes a global one (D21). `platform` converts to `NNNN-slug.md` during the client docs harvest.

_Rejected:_ our own Nygard-style template (conflicts with what `domain-modeling` writes); Pocock's format with no rejection rule (loses the load-bearing part, §1).

## 6. The three tiers

**D24.** Everything in the framework sits in exactly one tier, named by verb:

| Tier             | Verb     | Where                        | Load                                                    |
| ---------------- | -------- | ---------------------------- | ------------------------------------------------------- |
| **Rules**        | instruct | `philosophy.md`              | always                                                  |
| **ADRs**         | justify  | `install/adr/` + `docs/adr/` | pointer, fires on a dependency or architecture decision |
| **Hooks + lint** | enforce  | `settings.json`, `oxlint`    | on the tool call                                        |

A rule only earns tier 1 if it beats the model's default _and_ cannot be mechanised. Anything mechanisable drops to tier 3, because instruction decays over a long session and a hook does not.

Bootstrapping a new project with the standard folders and npm scripts: D68.

## 7. The global layer

Today `~/.claude/CLAUDE.md` is one line, while `~/.claude/rules/*.md` injects **4.6k tokens into every session** -- `javascript.md` (6.3 KB) while you write CloudFormation, `markdown.md` while you debug auth.

**D25.** Demote by relevance. Target: global always-on under **~1,200 tokens**.

| File            | Now    | Becomes                                                          |
| --------------- | ------ | ---------------------------------------------------------------- |
| `philosophy.md` | always | **always** -- Dev0 proper: D1, the gates, code rules v1          |
| `code-style.md` | always | **always** -- 1 KB, naming and casing, applies to every language |
| `javascript.md` | always | **skill**, model-invoked on JS work, carrying `testing.md`       |
| `testing.md`    | always | merged into the `javascript` skill -- _revised 2026-09-13_       |
| `markdown.md`   | always | folded into the `markdown` skill                                 |
| `diataxis.md`   | always | **deleted** -- superseded by D11–D14                             |

The `testing.md` row was revised because `tdd` is upstream and cannot absorb anything (D52). `node:test`, Playwright and the test layout are JavaScript rules, so they travel with the `javascript` skill and fire with it; Pocock's `tdd` supplies the red-green-refactor process. PHP testing lives in the `php` skill (D60).

**D70 -- `tests/`, plural, everywhere**, like `docs/`. _Added 2026-09-13._ It matches `platform`, `legacy.web` and the monorepo rule in `testing.md` (workspace `tests/` for unit, functional and API tests; root `tests/` for end-to-end and cross-workspace tests). The toolkit's own `test/` is renamed in Phase 1. Node's automatic discovery of any file under `test/` adds nothing once `*.test.js` naming is required.

**D26.** The risk -- a skill that does not fire means JS written without your conventions -- is mitigated by a hook, not by hope (§9).

**D26a.** Phase 0 raised this decision's value sharply: subagents inherit the full rules set (§17, A2), so the 4.6k is paid **per agent**, not per session. A loop that spawns a worker per issue pays it every time.

**D71 -- ASCII punctuation in prose:** `--`, not an em dash; `...`, not an ellipsis character. _Added 2026-09-13._ Chosen for readability, typing and grep -- the token difference is negligible. Held in memory for now and mechanised by Markdown lint/format in Phase 8, never an always-on rules line.

The three layers then answer three different questions, and nothing restates the layer above it: **global = how I think and write. Project root = what this system is called. Cascade = how this corner works.**

## 8. The toolkit

_Added 2026-09-13._ The repo that began as `~/.claude` sync becomes the toolkit Dev0 is delivered through.

**D65 -- `capabilities` becomes `dev0`, the Dev0 toolkit.** The scope test: does it exist only to serve the Dev0 workflow? **In:** the philosophy (`DEV0.md`), agentic traits (skills, agents, rules, hooks, ADRs), worktree shell functions, project templates. **Out, to the dotfiles repo:** general shell and machine setup (prompt, aliases, PATH, editor). The repo and CLI are renamed `dev0` (`dev0 install`, `dev0 sync`, `dev0 status`); `traits/` becomes `install/`, which stays true of its contents however the categories change; `test/` becomes `tests/` (D70). `CLAUDE.md` ("What this is") and `architecture.md` §2 are rewritten; the trAIt link survives as history.

_Rejected:_ keeping the repo narrow (worktree functions named after tracker issues are Dev0 workflow, not general shell); merging dotfiles in; renaming `traits/` to `toolkit/` (a part named after the whole) or to `src/`; keeping the historical names.

**D66 -- Zero runtime dependencies.** `yaml`, imported once to parse a five-line file, is dropped: `capabilities.yaml` becomes `dev0.json`, read with `JSON.parse`. The config already maps each category to its install target, so new targets (`~/.oh-my-zsh/custom/plugins/dev0`, `~/.local/bin/dev0`, `~/.claude/dev0/`) are entries, not code paths. `npm install` is needed only for dev tooling, never to use the toolkit.

_Rejected:_ keeping `yaml` as an accepted-dependency ADR (a Dev0 toolkit carrying a dependency it cannot justify is a bad first ADR); hand-rolling a YAML subset (the edge-case-heavy spec the `marked` example argues against re-implementing).

**D67 -- No `install.sh`.** Bootstrap is `git clone`, then `node bin/dev0 install`, which also links `bin/dev0` into `~/.local/bin` (already on PATH in bash and zsh; `/usr/local/bin` needs `sudo` and is machine-wide). _Revised 2026-09-27:_ was `~/bin`, which zsh never had on PATH. `bin/dev0` checks `process.versions` itself, so every command gets the Node check, not just the first install. The trigger to add a script is a need Node cannot meet, such as installing Node itself -- not before (D4).

_Rejected:_ a POSIX `install.sh` (a second entry point to keep in step); both.

**D68 -- `dev0 new <name>` copies a template.** `install/templates/js/` holds a `CLAUDE.md` with the tracker and wiki declaration block, an `AGENTS.md` symlink, `docs/{adr,runbooks,reference,scratch}/`, `tests/`, a `package.json` with `lint`, `format`, `typecheck` and `test` scripts, `.oxfmtrc.json`, `.oxlintrc.json`, `jsconfig.json`, and a tracker `.mcp.json` (D69). It is copied verbatim, with no generator: the template is the documentation of what a Dev0 project looks like. Built in **Phase 3**, because the completion gate (D29) fails in any repo without those scripts. A PHP template is added when a new PHP project appears; `legacy.web` already exists.

_Rejected:_ a generator; prompting for a language; deferring to Phase 8.

**D76 -- Harness-written content under a linked directory stays out of the repo.** _Added 2026-09-27._ Linking `~/.claude/skills` wholesale to `install/skills/` means anything Claude Code writes there lands in the repo: it syncs account-enabled Anthropic skills into `~/.claude/skills/synced/` (208 files, swept into an unpushed commit by jj's automatic snapshot before it was caught). Such paths are `.gitignore`d as they appear (`install/skills/synced/`); the files stay on disk so the harness keeps working. The repo is public, so a missed path publishes someone else's content -- check `jj st` for unexpected `install/` additions before any push.

_Rejected, for now:_ linking each skill individually instead of the directory (a per-entry code path, against the one install model, D27); revisit if a second harness-written path appears.

## 9. Enforcement

**D27.** Hooks live in a new `install/hooks/` symlink category -- same plain-symlink model as `skills`/`agents`/`rules`, no per-category code path. _Revised 2026-09-13:_ shell ergonomics (worktree functions) also live in the toolkit, as `install/shell/` (D55), not in the dotfiles repo -- see D65.

**D28.** `~/.claude/settings.json` is currently unsynced and carries machine-local content (`autoMode` environment, project permissions). `install/settings/hooks.json` becomes the synced source of truth for hook wiring, **merged** into `settings.json` by `dev0 install`. This is the one place a symlink is not enough.

**D29.** The inventory:

| Hook                                 | Event                                                                                                   | Does                                                                                      | Blocking                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **Dependency gate**                  | `PreToolUse` on `Bash(npm install\|npm i\|yarn add\|pnpm add)` with a package named, `-D` included (D3) | refuses; names the ADR index (D64) or says ask                                            | **BLOCK**                                         |
| **Git absolutes**                    | `PreToolUse` on `Bash(git push --force*\|git merge*\|git switch main\|git checkout main)`               | refuses                                                                                   | **BLOCK**                                         |
| **Format and lint on write**         | `PostToolUse` on `Edit\|Write` of `*.js`                                                                | `oxfmt` + `oxlint` on the **changed file only**                                           | feeds errors back                                 |
| **Completion gate**                  | `Stop`                                                                                                  | `npm run lint && npm run typecheck && npm test`                                           | **BLOCK**, ceiling of two retries then report red |
| **Scratch retention**                | `SessionStart`                                                                                          | delete `docs/scratch/` entries >28 days, print what went                                  | advisory                                          |
| **Micro-module check**               | `Stop` or CI                                                                                            | single export, under N lines, exactly one importer → flag for inlining                    | warn                                              |
| **Root budget**                      | `PostToolUse` on `Edit\|Write` of `CLAUDE.md`, `CONTEXT-MAP.md`, `CONTEXT.md`                           | measure root `CLAUDE.md` plus imports against 6 KB (D63)                                  | warn                                              |
| **PHP format and lint** _(Phase 4)_ | `PostToolUse` on `Edit\|Write` of `*.php`                                                               | `php-cs-fixer` and `php -l` inside `php:<production>-cli`, on the changed file only (D60) | feeds errors back                                 |
| **Account gate**                     | `UserPromptSubmit`                                                                                      | signed-in Claude account must match the `origin` owner's account (D75)                    | **BLOCK**                                         |

**D30.** The **dependency gate is the most important artefact in the design.** D3 settled on default-deny, and we both knew the prose version is something a model talks past. A `PreToolUse` hook cannot be talked past. That single hook converts Dev0 from a philosophy into a property of the machine. It is **global**, not opt-in: a Dev0 rule that is off in new repos is off exactly where dependencies get added.

**D31.** The completion gate is the `/harness` idea done correctly. `platform`'s root `AGENTS.md` has instructed self-verification for months against a skill that cannot resolve. A `Stop` hook runs whether or not the agent remembers. `verify.js` is redundant and deleted -- `npm run lint`, `typecheck` and `test` already exist and are better.

**D32.** Hooks fire on the **tool call**, so they apply regardless of which context window issued it. This is the strongest argument for putting Dev0's teeth in hooks rather than prose: hooks do not care whether a subagent inherited your rules.

**D75 -- Account gate: the Claude account must match the repo's owner.** _Added 2026-09-27._ Two subscriptions: one for personal work, one for client work. The `origin` owner decides which applies: a personal owner maps to the personal account, a client's GitHub organisation to the client account. The map lives in `dev0.json` (`accounts: { "<github owner>": "<claude email>" }`), so a new owner is a config entry. A global `UserPromptSubmit` hook reads `oauthAccount.emailAddress` from `~/.claude.json` and the owner from `git remote get-url origin`. On a mismatch it blocks and names the account to switch to (`/logout`, `/login`); a session cannot change its own account. No repo, no `origin`, or an owner not in the map: pass silently.

_Rejected:_ `SessionStart` (can only warn, and a warning scrolls past); a rule in prose (the model cannot see which account it runs under unless told, and cannot fix it anyway); inferring from the directory path (clones move, remotes do not).

## 10. Trackers

Three live backends: **Jira** (client work), **Paca** (6 personal projects), **Azure DevOps Boards** (legacy personal projects).

**D33.** Tracker is declared **per project**, no pattern by project type. The declaration lives in the project root `CLAUDE.md` -- roughly five lines, relevant every session, and exactly the payload the root file is reserved for.

_Revised 2026-10-01:_ the declaration moves to `docs/agents/issue-tracker.md` (D18); the root `CLAUDE.md` carries upstream's three-line `## Agent skills` pointer block instead, which also eases the D63 budget. The `tracker` skill and the loop read the same file.

**D34.** One `tracker` skill defines the **contract** -- _next, get, comment, transition, create_ -- and carries a recipe per backend. No adapter library, no dependency: the skill _is_ the adapter. `to-issues`/`to-tickets` already resolve the tracker through a pointer rather than naming one, so this formalises an indirection that exists.

**D35.** Branch naming stays `<key>-<slug>` (lowercase), e.g. `proj-1419-example-slug`. Worktrees take the same name; multiple worktrees for one issue suffix a lowercase sluggified task. PR title is `{Issue Title} (Re: {KEY})` with the key uppercase.

_Rejected:_ Paca's documented auto-link pattern `<type>/<PREFIX>-<number>-slug` -- because **conventional commits are deliberately rejected** (now a global ADR). Consequence: Paca's webhook auto-linker will not match, so the Paca recipe calls `github_link_pr_to_task` explicitly **and asserts the link exists afterwards** via `github_list_task_prs`. A forgotten compensating step fails silently, which is the worst failure class; an asserted one does not.

**D36 -- The 14 `paca-*` commands are deleted.** _Revised 2026-09-13; the original fixed their missing frontmatter._ They are loose, unsynced files in `~/.claude/commands/` left by Paca's setup, listed in every session including client work, and only `paca`, `paca-epic` and `paca-setup` were ever run (1-2 times each). A tracker's MCP server supplies the tools; the `tracker` skill's Paca recipe (D34) supplies the procedure. Anything worth keeping from `paca-epic` moves into the recipe first.

_Rejected:_ keeping the three used commands, synced via `install/`; per-project copies (14 files in each of 6+ repos).

**D69 -- Tracker MCP servers are configured per project.** _Added 2026-09-13._ Each project declares its tracker server in a committed `.mcp.json`, beside the tracker declaration in its root `CLAUDE.md` (D33): versioned together so they cannot drift, and a clone brings both. Credentials come from environment variables, never the file. The global `paca` entry in `~/.claude.json` is removed. MCP tool definitions are context just as skill pointers are, so this is D54 applied to MCP.

_Rejected:_ per-project entries in the local `~/.claude.json` (unsynced; set up by hand on every machine); keeping `paca` global.

## 11. Work hierarchy and blueprints

_Added 2026-10-01._ Seeded by a voice design session with Gemini ("TroyScrum": what an Agile hierarchy becomes when agents do the construction), then grilled. That session's starting problem is this document's thesis seen from the tracker: an agentic senior developer handed a loose story returns XYZ plus ABC, or XYK, because it does not hold the architecture or the business's three-year view. The answer is a constrained, implementation-rich build instruction at the level where agents work, written by the architect.

**D77 -- Epic → Story → Task, in every tracker.** C4 supplies the idea, used as **level of detail**, not structural identity: the epic is written first, at container level -- the outside of the system -- and its stories later, at component level -- the inside. Each level is written once; detail is added downward, never moved between tickets.

| Level | C4 detail | Written                           | Blueprint (D80) | Tested by               |
| ----- | --------- | --------------------------------- | --------------- | ----------------------- |
| Epic  | Container | first, by the architect           | `to-spec`       | its stories (D83)       |
| Story | Component | later, in waves, by the architect | `to-tickets`    | its acceptance criteria |
| Task  | --        | rarely (D78)                      | none            | --                      |

An epic is a unit of delivery, not of structure: it may span containers or sit inside one (DEV0-3, a repo-wide rename, is no container), so the mapping is never literal. Azure DevOps maps Story to PBI (Scrum process) or User Story (Agile process).

_Rejected:_ a Feature level between epic and story, mandatory or optional (an optional level is the "which level does this go in?" confusion; a multi-sprint epic titled by outcome already gives business stakeholders their waterfall view, and only ADO has one natively); a PBI supertype with Story and Technical Task kinds carrying different fields (one blueprint serves both, and the tracker's type field already tells them apart); moving the epic's behaviours into its stories as they are written (many writes, and the epic shrinks into illegibility for its human readers).

**D78 -- A Task is a human-only prerequisite.** Create a cloud account, buy a domain, issue a secret, obtain an outside approval. The architect creates it while writing the story; it has no blueprint, no commits and no PR; an open Task **blocks its story** (D37's "unblocked"). Anything code-shaped is part of a story or a story of its own. The tracker's traditional task -- a developer's personal plan, never meant for the ceremonies -- is now the agent's ephemeral to-do list and never reaches the board.

_Rejected:_ banning Tasks (human prerequisites would live as prose, invisible to the gate); agent-created Tasks.

**D79 -- A story is one PR you can review in one sitting.** A vertical, tracer-bullet slice (D46) of roughly 3-7 acceptance criteria; ~400 changed lines excluding tests is a smell, not a rule -- a worker over it says so in the PR rather than splitting on its own. A worker turns a story into a PR in minutes, so your review is the binding constraint, and the failure it exists to catch -- correct code for a misunderstood ticket (D44) -- is only visible in a diff you can hold in your head. Sprints stay the planning cadence for epics and priority (D41), not the unit of story size.

_Rejected:_ sprint-sized stories (a sprint of agent output is a review you will not do properly).

**D80 -- The blueprint is Pocock's output.** _Blueprint_ names the build instruction at either level -- the epic's is the floor plan, a story's the kitchen. The epic's blueprint is the issue `to-spec` publishes (Problem Statement, Solution, User Stories, Implementation Decisions, Testing Decisions, Out of Scope, Further Notes); a story's is the issue `to-tickets` publishes (Parent, What to build, Acceptance criteria, Blocked by). Both are the issue body -- one field, as D40 requires. Dev0 adds only deltas the templates tolerate, written in `docs/agents/issue-tracker.md` (D18), where the skills read their publishing rules:

- **Acceptance criteria are `Given / When / Then` lines** -- concrete, architecture-bearing, and each one a test written first, so the criteria are build instruction and oracle at once (D39). Code blocks carry signatures and formats where prose cannot.
- **Every implementation decision carries what it rejected:** `<choice> -- <why>. Rejected: <alternative> (<why not>)`.
- **Out of scope is phrased as deferral:** `Deferred: <thing> → <KEY>`, or `→ not planned` -- a decision already made, not a prohibition.
- **Standing architecture is never restated.** The cascade and ADRs carry it, as decisions with rationale ("we decided against React, because ..."), which steers an agent where "do not use React" in every ticket does not (§3.5).

_Rejected:_ the word _spec_ (collides with spec-driven development, whose spec sits a level higher and leaves the agent to interpret it); our own four-part `## Spec` template -- Outcome, Behaviour, Decisions, Boundaries (a fork in all but name, cutting off upstream iteration, D52; the skills are `disable-model-invocation`, so no wrapper skill can reshape their output); pure Gherkin (no home for rationale, ritual on structural work, and executable only through Cucumber, D3); per-kind custom fields such as Persona or Resource Bindings (D40's one-field argument); file paths in blueprints (upstream's rule: they go stale while a ticket waits -- name modules and interfaces instead); a Tech Stack or Integration Points field per ticket (the cascade already carries both).

**D81 -- Blueprint Verification.** The worker's first step, before tests or code: read the story, its epic and the cascade for the modules involved, and list the decisions still open. None: build -- no comment, no status change. Gaps: **one batched comment** in upstream `triage`'s Triage Notes form (_What we've established / What we still need from you_) with an @mention -- one question at a time suits a live grilling, not a slow asynchronous exchange -- then label `needs-info`, unassign, and move on. The answers are folded into the epic's decisions (D85), never left in the thread, so the blueprint stays the single source and the next worker sees them; the label returns to `ready-for-agent`, and reassignment is the new sign-off (D38). D43 stays as the backstop for a gap found mid-build.

A question is the system working: without it, the worker would have guessed.

_Rejected:_ a plan for the architect to approve before each build (architecture was front-loaded so that per-item review would not be needed, and every plan costs the time the blueprint saved); a "verified" comment on a clean pass (noise); waiting while assigned for an answer (holds the story and the worker).

**D82 -- Epic decisions are superseded, never deleted.** An epic spans sprints, so its decisions change mid-flight. A changed decision is marked inline -- `Superseded 2026-10-01: <new choice> -- <why>` -- so human readers keep the history. Unstarted stories pick the change up, because they reference the epic rather than copy it (D85), and Blueprint Verification (D81) flags a story that now contradicts its epic; a PR in flight under the old decision is caught at review; a merged story is never reopened -- rework is a new story. The epic's user stories keep stable wording, so stories can cite them.

_Rejected:_ freezing the epic once its first story starts (changes would need a second home -- the two-sources problem D81 avoids).

**D83 -- Acceptance tests belong to stories.** A story's acceptance criteria are its acceptance tests, automated at the seam the epic's Testing Decisions chose -- end-to-end included where that is the seam. An epic is done when its stories are; it has no tests of its own. A project's bootstrap story wires the end-to-end harness (root `tests/`, a `test:e2e` script, D70), ideally already present in the project template (D68), and stories add to it as their criteria require. This is the industry norm: XP customer tests, ATDD, Specification by Example, BDD and outside-in TDD all test at story level, and Scrum governs everything else through its Definition of Done (D84).

_Rejected:_ epic-level end-to-end tests, written up front as `todo` stubs by an epic's first story or owned scenario by scenario by a designated story (non-standard, and they conflate _acceptance_ -- what a test proves -- with _end-to-end_ -- how much stack it spans); a final story that writes them all (finds interpretation drift too late).

**D84 -- Definition of Done.** One bar for every story. **Mechanical** -- enforced by CI and hooks, and green before the worker opens a PR:

1. Every acceptance criterion has an automated test whose name cites it.
2. The full suite passes: unit, functional and end-to-end.
3. Lint, format check and typecheck are clean.
4. No unapproved dependency (D3, D29).
5. Branch and PR follow D35, and the PR-to-story link is asserted.

**Judgement** -- checked by the worker, then by you at review:

6. The diff stays within the modules the blueprint names; anything outside is explained in the PR or is a defect.
7. Docs change only where a public interface changed (D5).
8. The blueprint matches what was built: verification answers are folded in (D81).

A story is done when its PR is squash-merged (D73); an epic, when its stories are. A global baseline ships with the toolkit, and a project's root `CLAUDE.md` adds only its own items, such as the end-to-end command. It stays short, because every worker pays for it (D25); its exact home is settled when Phase 2 writes `philosophy.md`.

**D85 -- Every decision lives in the epic.** The epic's Implementation Decisions hold the cross-cutting decisions and any a single story needs, tagged with its key: `(DEV0-42) <choice> -- <why>. Rejected: ...`. The worker reads its story and the parent epic -- the `tracker` skill's `get` returns both. One list to scan, one place D82 supersedes in, one place verification answers land, and no template change to `to-tickets`.

_Rejected:_ a Decisions section on each story (a template delta outside upstream, and decisions scattered across tickets -- the many-writes problem again).

## 12. The autonomous loop

**D37 -- Eligibility gate.** All must hold: labelled **AFK**; **unblocked**; **assigned to an authorised agent**; in the active sprint or Ready status; **carries an approved spec**.

_Revised 2026-10-01:_ upstream's **`ready-for-agent`** label replaces `AFK`, and `ready-for-human` marks HITL stories, so `triage` and future upstream skills work unchanged; the strings per tracker live in `docs/agents/triage-labels.md` (D18). `to-spec` and `to-tickets` apply `ready-for-agent` on publish, so the label means _buildable_ and assignment still means _approved_ (D38): a story needs **both**. "An approved spec" is a story published by `to-tickets` from an approved epic blueprint (D80), whose Tasks are closed (D78).

**D38 -- Assignment is the sign-off.** Assigning `PROJ-1419` to `claude-dev` means "spec approved, go". One gesture, no separate approval label or status dance -- and an explicit act is a stronger gate than the absence of an assignee.

**D39 -- Spec, not acceptance criteria, drives construction.** AC is a _test oracle_; it tells you whether you are done. It is not a build instruction. Given only AC an agent must invent the spec, and its invention is not yours -- which is why the results have been abysmal. So:

| Artefact | Answers          | Drives              | Author                                   |
| -------- | ---------------- | ------------------- | ---------------------------------------- |
| **Spec** | what do I build? | construction        | `grilling` → `to-spec`, **you sign off** |
| **AC**   | is it done?      | verification, tests | you                                      |

_Revised 2026-10-01:_ at story level the two merge. Acceptance criteria written as `Given / When / Then` (D80) -- concrete, and carrying the architecture the story needs -- are build instruction and oracle at once; the objection above is to criteria too thin to build from, and those are not. The epic's blueprint keeps the role of the spec. `## Done when` is retired.

**D40.** The tracker schema gets **one markdown field, `spec`** -- not a nine-field template. A structured schema would have to be replicated across Jira, Paca and ADO; one field does not. The structure lives inside `to-spec`, where it evolves without touching three trackers.

_Revised 2026-09-13:_ in Paca the spec is a **`## Spec` section of the issue description**, not a custom field. Paca's custom field types top out at single-line `text` (no rich text or textarea, in the UI or the API), and the MCP `create_task`/`update_task` tools cannot set custom fields at all. The `tracker` skill's `get` returns the spec on its own, so a later move to a `task.detail.section` plugin changes no agent.

_Revised 2026-09-27:_ `to-spec` (DEV0-17) fixes the spec's shape at four parts -- Outcome, Behaviour, Decisions (rejected alternatives under the decision they lost to), Boundaries -- and the spec absorbs the issue's `## Scope` and `## Rejected`; `## Done when` stays as the acceptance criteria. Gaps are put to the architect one at a time; nothing is written to the tracker before the draft is approved.

_Revised 2026-10-01:_ the `## Spec` section and the four-part shape above are **superseded by the blueprint (D80)**: upstream's `to-spec` and `to-tickets` own the structure, and Dev0 adds only the deltas their templates tolerate. The home-grown `to-spec` is deleted (D87). The one-field principle stands -- the blueprint is the issue body, with no custom fields.

_Rejected:_ a Paca `text` custom field (single-line input, not agent-writable through MCP); a spec plugin now (a Go WASM backend and React frontend built before the loop exists); a Paca Doc per spec (a second place to keep in step).

**D41 -- Ordering is the tracker's, not the agent's.** Sprint order, then priority. An agent choosing _what_ to work on is making a decision you want to make; choosing _how_ to do the top item is not.

**D42 -- Failing the gate is loud.** An ineligible issue gets a comment naming the condition it failed, then the loop moves on. Not a silent skip -- the comment is what teaches you to write loopable issues.

**D43 -- The worker can refuse.** If the spec does not close a decision it needs, the Sonnet worker stops, comments which decision is missing, unassigns itself and moves on. This converts underspecification into feedback on your specs rather than into code you will strip.

_Revised 2026-10-01:_ now the backstop behind Blueprint Verification (D81), which catches most gaps before any code is written; a refusal mid-build comments, labels and unassigns exactly as D81 does.

**D44 -- Autonomy boundary: branch, push, open a PR. Never merges.** In a git worktree. Three absolutes: never `main`, never force-push, never merge.

_Rejected:_ proposal-only and commit-locally (a pile of unpushed diffs is a review queue whose context you must reconstruct -- worse than doing it yourself); merge-on-green (the failure mode is not bad code, it is **correct code for a misunderstood ticket**, and CI cannot see that; the PR is where you catch it cheaply).

**D45 -- Stop and wait for review after each PR**, with a countable graduation to full autonomy: **ten consecutive loop PRs merged with no material change by you.** Otherwise you either never flip the switch or flip it on a good day.

**D46.** The loop's real prerequisite is a well-sliced backlog, not clever automation -- reviewable PRs require tracer-bullet issue sizing, which lands back on `to-issues`.

**D86 -- The worker runs upstream `implement`.** _Added 2026-10-01._ One story per run: `tdd` at the seams the epic's Testing Decisions chose, then `code-review`, then commit. The loop supplies what `implement` leaves out: Blueprint Verification first (D81), the D35 branch and worktree, the PR and its asserted link. Upstream skills are `disable-model-invocation`, so the loop starts each worker as `claude -p "/implement <KEY>"` -- unverified (A3).

_Rejected, for now:_ upstream `implement-spec` -- a whole epic on one integration branch, merged by subagents, one PR at the end (cuts across one reviewable PR per story, D79, and stop-and-wait, D45). Revisit at D45's graduation, when its parallelism is worth having.

**D72 -- Paca-triggered agents: one per project, deferred.** _Added 2026-09-13._ The loop is our own worker driven by the `tracker` skill, so it behaves the same on Jira, Paca and ADO. Paca's ACP agents (a Paca agent served by a local `paca-acp-bridge`) start work the moment a task is assigned, bypassing the eligibility gate (D37) and the refusal (D43), and exist only for Paca. Until the loop exists, nothing is assigned to a Paca agent; tasks are driven by hand-started sessions. When Paca agents are adopted, it is **one agent per project**: a bridge serves one agent in one workspace, and only a repo-root workspace loads that project's hooks, `.mcp.json` (D69) and cascade. At that point, decide whether the agent is the loop's Paca trigger (running the gate first) or ad hoc chat only.

_Rejected:_ one shared Paca-wide agent (its workspace must be a parent directory, so project settings and MCP do not load; with permissions auto-approved, one project's task can edit every repo; one token for all projects); setting up bridges now (Paca-only machinery ahead of the tracker-agnostic loop).

**D73 -- `main` holds one commit per epic.** _Added 2026-09-27._ Task and story commits stay local (or on the PR branch) while the epic is open, and are squashed into one commit when it closes; only that commit is pushed to `main`. The tracker keeps the task-level history, so `main` stays readable as a list of delivered outcomes.

_Revised 2026-10-01:_ one commit per **story**, not per epic. An epic spans sprints, so an epic branch would live for weeks and rebase painfully; a story is one reviewable PR (D79), so one squash per story makes PR, review and commit the same unit. `main` still reads as delivered outcomes, provided stories are titled by outcome.

**D74 -- The squashed commit takes the epic's title.** _Added 2026-09-27._ Epics are titled by the outcome they deliver (e.g. `Capabilities becomes dev0`, `Create core enforcement hooks`), not by phase number, so the log on `main` says what each commit delivered. Phase order lives in the tracker.

_Revised 2026-10-01:_ the commit takes the **story's** title (D73); titling by outcome now binds stories as well as epics.

## 13. Agents and models

**D47.** An agent's only real distinction from a skill is its **own context window**:

> **An agent earns its place when you want the work done without its byproducts in your context.** Otherwise it is a skill.

Most existing agents are 890–3,800 byte "you are an expert X" personas -- largely no-ops, since the model is already an expert -- whose behaviour-changing content duplicates existing skills.

**D48 -- The cull:**

| Agent                        | Verdict                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SeniorDev`                  | delete -- `philosophy.md` wearing a persona, and the persona is _you_, deployed on the wrong side of D1. Its PHP doctrine seeds the `php` skill first (D60)                                                                                                                                                                                     |
| `cqrs-api-architect`         | delete the agent; DDD/CQRS content merges into a skill, Dev0 lines into `philosophy.md`                                                                                                                                                                                                                                                         |
| `doc-agent`                  | delete -- docs are now thin and issue-triggered                                                                                                                                                                                                                                                                                                 |
| `iac-agent`                  | delete -- duplicates the `cloudformation` skill                                                                                                                                                                                                                                                                                                 |
| `slides-agent`               | **keep** -- unique output format, and deck generation is exactly the noisy work you do not want in your window                                                                                                                                                                                                                                  |
| **loop worker** _(new)_      | one issue, own context, returns a PR                                                                                                                                                                                                                                                                                                            |
| **Dev0 review pass** _(new)_ | reads the diff, returns findings -- the edit you currently make by hand. The only agent that sees the tenets (D59): `DEV0.md` is symlinked to `~/.claude/dev0/DEV0.md` and the agent is told to read it first. When built, test whether `@` imports work in agent files (undocumented) and switch to an import if they do. _Revised 2026-09-13_ |

**D49 -- Model per agent** via `model:` frontmatter. The axis is not task complexity but **has the spec already closed the decisions?**

| Work                                               | Judgement or compliance                   | Model           |
| -------------------------------------------------- | ----------------------------------------- | --------------- |
| Spec, architecture, grilling                       | judgement; extrapolation wanted           | **you + Opus**  |
| Loop worker executing an approved spec             | compliance; **extrapolation is a defect** | **Sonnet**      |
| Dev0 review pass -- "does this look like my code?" | judgement; requires taste                 | **Opus**        |
| Bug diagnosis                                      | judgement; open-ended                     | **Opus**        |
| `slides-agent`, research, explore                  | format compliance, retrieval              | Sonnet or Haiku |

Opus reading more into the solution is the feature upstream and the defect downstream. Sonnet on the worker also makes unattended running affordable.

**D50 -- There is no Opus worker.** Work needing senior judgement routes to **you**, not to a better model improvising architecture inside the loop -- which is the failure mode that produced the abysmal results in the first place. The Opus slot is for judgement where you are _deliberately_ absent: reviewing a diff, diagnosing an opaque failure. Not building.

**D51 -- The Dev0 review pass is the highest-leverage artefact after the code rules.** You already perform it by hand. `/simplify` and Pocock's `code-review` exist but neither knows what _you_ strip. Unlike a rule, it runs after generation, when the verbosity actually exists to be seen.

## 14. Skills, plugins and context budget

The skill roster is now the **largest always-on cost** in the setup -- larger than the `rules/` problem that started the session.

|                                   |                                          |
| --------------------------------- | ---------------------------------------- |
| Your 29 skills, descriptions only | **11.9 KB ≈ 3,000 tokens** every session |
| `rules/*.md` (being cut)          | 4.6k tokens                              |
| Three enabled plugins             | roughly 50 further pointers              |

**D52 -- Never fork upstream. Customise in the layer above.** Upstream skills stay pristine so improvements flow; your preferences live in `philosophy.md` and the `CLAUDE.md` cascade. The current forks were taken from an older version of Pocock's repo and hand-edited, which silently cut off upstream improvements.

_Revised 2026-10-01:_ the layer above now has a defined seam -- upstream's own `docs/agents/*.md` (D18), which its skills read for tracker, labels and domain layout. Deltas go there, and only where upstream's templates tolerate them (D80). Upstream skills are `disable-model-invocation`, so a wrapper skill that invokes one and reshapes its output is not an option.

**D53 -- Collisions resolved in Pocock's favour:**

| Collision                                      | Action                                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| `grilling` -- yours 843 B, Pocock's 1,872 B    | delete yours (this very session ran the smaller, older fork)                           |
| `to-issues` (yours) vs `to-tickets` (Pocock)   | delete yours -- same job, different names, so nothing signalled they were alternatives |
| `tdd` -- yours 4,395 B, Pocock's 3,568 B       | lift your `node:test` additions into the `javascript` skill (D25), then adopt upstream |
| `arc42-architecture`, `diataxis-documentation` | delete -- retired by D12–D14                                                           |

Duplicate pointers to one capability are a variance bug: the model picks arbitrarily per session, so behaviour silently differs run to run.

_Revised 2026-10-01:_ never executed -- the forks were still in `install/skills/` on 2026-10-01, and a home-grown `to-spec` (DEV0-17) had repeated the collision under upstream's own name. D87 executes it.

**D54 -- Plugins are enabled per project.** `paca` is irrelevant on client work; `claude-mem` is irrelevant on one-off client repos. The cascade principle applied to plugins.

**D87 -- Pocock's skills install as his Claude Code plugin.** _Added 2026-10-01._ `mattpocock-skills` (his ADR 0002), installed from `claude-plugins-official`, which carries the same plugin, and enabled per project (D54) in the committed `.claude/settings.json`. The local forks -- `grilling`, `tdd`, `to-issues`, `to-spec` -- are deleted. Updates are **deliberate**: read upstream's `.changeset/` entries for changes to `docs/agents/`, templates, file names or labels, then update. The `CONTEXT.md` → `GLOSSARY.md` rename (D17) is the proof that an automatic update can silently break the layer above. Nearly every upstream skill is `disable-model-invocation`, which should keep its descriptions out of context -- unverified (A4).

_Rejected:_ vendoring the skill files into `install/skills/` with a sync script (rebuilds the plugin mechanism by hand, and is how the current forks went stale); automatic updates.

## 15. Worktree ergonomics

**D55.** Hard constraint that decides the shape: **a git alias cannot `cd`** -- aliases run in a subprocess, and neither can a `dev0` subcommand. It must be a **zsh function**, sourced into your shell.

_Revised 2026-09-13:_ shipped as an **oh-my-zsh plugin**. `install/shell/` holds `dev0.plugin.zsh` and `_gsw` (branch and worktree completion), linked to `~/.oh-my-zsh/custom/plugins/dev0` by `dev0 install` and enabled once by adding `dev0` to `plugins=(...)` in `.zshrc`. oh-my-zsh adds the plugin directory to `fpath` before `compinit`, so completion needs no workaround; the file is plain zsh, so a machine without oh-my-zsh can `source` it directly.

_Rejected:_ a `$ZSH_CUSTOM/*.zsh` file (auto-sourced, but after `compinit`, so completion needs a `compdef` workaround); a fixed `~/.config/dev0/dev0.zsh` sourced from `.zshrc`; bash-completion (loads on first tab, too late to define a function).

Roughly 30 lines, zero dependencies:

```zsh
gsw <branch>   # worktree exists → cd to it; otherwise git switch in place
gwt            # list worktrees by branch, not by UUID
gwtprune       # remove worktrees whose branch is merged or gone
```

**D56.** The loop names its own worktrees after the issue (D35), so directory, branch and ticket agree and most of the pain never occurs. The current pain is visible in one line: the directory is `agent-aefa27ba77fbb9efe`, the branch is `proj-1419-example-slug`. `git worktree list` already maps one to the other; only the ergonomics were missing.

## 16. Build order

**D57.** Ordered by compounding value per unit of effort.

| Phase   | What                                                                                                                                                                                                                                                                   | Why here                                                                                                                                                                                               |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **0**   | Settle the unverified assumptions (§17)                                                                                                                                                                                                                            | Blocks 2 and 7. Minutes.                                                                                                                                                                               |
| **1**   | **Restructure** -- rename to `dev0` (repo, CLI, Paca project), `traits/` to `install/`, `test/` to `tests/`; `capabilities.yaml` to `dev0.json`, dropping `yaml`; self-linking `bin` (D65-D67, D70)                                                                    | Mechanical, and covered by the existing suite, which spawns the CLI through a symlink. Cheapest now: everything after is written once, at its final paths.                                             |
| **2**   | **Dev0 core** -- rewrite `philosophy.md` as `rules/dev0.md` (D88; D1, gates, code rules v1, ADR pointer); write `DEV0.md` (D59); create `install/adr/` with the known entries and generated index (D62, D64); demote `rules/` per D25 into the `javascript` skill; write the `php` skill (D60); the Definition of Done baseline (D84) | **No code, pure content.** The only phase that compounds into its own construction: it improves every session that builds the later phases. The `php` skill rides here because SSO work is active now. |
| **3**   | **Enforcement** -- `install/hooks/` category, settings-fragment merge, the D29 hooks for `.js`, root-budget warning (D63); `install/shell/` plugin (D55); `dev0 new` with `install/templates/js/` and its end-to-end harness (D68, D83)                                                                | Dev0 stops being advice. Prerequisite for unattended running. The completion gate needs the templated scripts to exist.                                                                                |
| **4**   | **PHP enforcement** -- `php-cs-fixer`, `php:<production>-cli` lint, PHPUnit in the completion gate (D60)                                                                                                                                                               | Same pattern as Phase 3, proven on JS first.                                                                                                                                                           |
| **5**   | **Hygiene** -- skill cull, agent cull, delete `paca-*` (D36), tracker MCP per project (D69); Pocock plugin replaces the local forks (D87)                                                                                                                                                                     | Pure context-load reduction; independent, so it can slot anywhere, but earlier means cheaper sessions thereafter.                                                                                      |
| **6**   | **Tracker contract** -- `tracker` skill, `docs/agents/` with the blueprint deltas and labels (D18, D37, D80)                                                                                                                                                                                                 | Loop prerequisite.                                                                                                                                                                                     |
| **7**   | **The loop** -- Sonnet worker running `implement` (D86), Blueprint Verification (D81), named worktree, stop-and-wait                                                                                                                                                                                 | First real test.                                                                                                                                                                                       |
| **--**   | **Client docs harvest** -- 2.3 MB of `explanation/` into the cascade and ADRs                                                                                                                                                                                          | Repo-specific, tracked in the `platform` tracker. Biggest chunk, and the loop can help do it.                                                                                                                                                            |
| **8**   | Backfill remaining languages, remaining trackers, Markdown lint including ASCII punctuation (D71); graduate autonomy at ten clean PRs                                                                                                                                  | --                                                                                                                                                                                                     |

**D58 -- First loop target is `dev0` itself**, tracked in **Paca**. Small, every decision is yours, its issues are literally "build this framework", and a failure costs nothing. Paca has the best API of the three backends -- PR creation, task linking and CI status in one plugin. `issues.md` migrates into a Paca project named **`dev0`** from the start (D65).

## 17. Phase 0 -- unverified assumptions

A1 and A2 tested 2026-09-11, **both resolved in the design's favour**. A3 and A4 added 2026-10-01, untested.

**A1 -- Does the `CLAUDE.md` cascade load intermediate directories? YES.**

Method: a sentinel-tagged fixture (`CLAUDE.md` at root, `a/`, and `a/b/`, each carrying a unique marker) probed by a fresh non-interactive session that was forbidden from opening any `CLAUDE.md`.

```text
BEFORE (session start, no file read):  SENTINEL-ROOT-7Q
AFTER  (Read a/b/target.js):           SENTINEL-ROOT-7Q, SENTINEL-MID-4K, SENTINEL-DEEP-9Z
```

Two facts, both load-bearing:

- **Only the root is always loaded.** Nested files cost nothing until their subtree is touched -- the on-demand claim behind D15 holds, and root-file size discipline is the only always-on budget that matters.
- **Touching a deep file pulls every `CLAUDE.md` along the path**, intermediate directories included. So `workspaces/CLAUDE.md` loads when `workspaces/iam/lib/foo.js` is read. **D15 and D16 stand as written** -- the HLA at `workspaces/` reaches every workspace session and no other.

**A2 -- Do subagents inherit the cascade and `philosophy.md`? YES -- fully.**

A fresh `general-purpose` subagent, told to use no tools and report only what it could already see, returned the global `~/.claude/CLAUDE.md`, the project `CLAUDE.md`, **and all six `traits/rules/*.md` files**, quoting each verbatim and naming its path.

Consequences:

- The Sonnet loop worker **will** receive the Dev0 code rules. The leak D32 was hedging against does not exist, and the Q18 fallbacks -- restating rules per agent, or having agents read `philosophy.md` as a first step -- are both unnecessary. D32's argument still holds on its own merits, since hooks fire on the tool call regardless of context.
- **But the cost multiplies.** Every subagent pays the full always-on load. The probe above burned **52,624 tokens answering a single zero-tool question** -- mostly the harness baseline (system prompt, tool definitions), which no framework decision can shrink. `rules/` is **~4.6k of that**, and it is the part we control. The loop spawns one worker per issue, so that 4.6k is not a per-session cost but a per-_agent_ cost. This sharpens D25 from housekeeping into the highest-value token decision in the plan.
- `diataxis.md` is therefore currently injected into every subagent on every project -- while being the one rules file D25 deletes outright.

**A3 -- Can the loop start a worker on a user-only skill?** _Added 2026-10-01, untested._ Upstream's `implement` is `disable-model-invocation: true`, so an agent cannot call it through the Skill tool. D86 assumes `claude -p "/implement <KEY>"` counts as a user invocation, and that `implement` can then invoke `tdd` and `code-review`, which may carry the same flag. Blocks Phase 7.

**A4 -- Do `disable-model-invocation` skills stay out of context?** _Added 2026-10-01, untested._ D87 assumes their descriptions are not loaded, so the ~25-skill plugin costs little always-on. Measure as A2 was: a zero-tool probe with the plugin enabled and disabled. Blocks Phase 5's plugin step.

## 18. Where this document goes next

On confirmation, content disperses and this file is allowed to die.

| Content                                 | Home                                    | Lifetime                                     |
| --------------------------------------- | --------------------------------------- | -------------------------------------------- |
| Code rules v1, judgement gates, D1      | `install/rules/dev0.md` (D88)           | durable, always-on                           |
| Introduction, tenets, decision matrix   | `DEV0.md` at the toolkit root           | durable, human-facing (and the review agent) |
| Cross-project decisions plus rejections | `install/adr/`                          | durable, pointered                           |
| Toolkit decisions plus rejections       | `dev0/docs/adr/`                        | durable                                      |
| The ownership rule and the cascade      | `dev0/CLAUDE.md` and the rules layer    | durable                                      |
| The phases                              | **Paca issues**, `dev0` project         | until done                                   |
| Per-story implementation detail         | the blueprint, in the tracker (D80)     | throwaway                                    |

That last row means **phase 2 dogfoods the blueprint immediately** (_revised 2026-10-01_) -- the part of this design most worth testing early, since it is where agents have failed you worst.

[← Back to Documentation Home](../README.md)
