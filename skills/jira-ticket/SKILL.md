---
name: jira-ticket
description: Take one Jira ticket from story to review-ready PR. Reads the ticket, its epic and their blueprints, grills the architect until no gap remains, then coordinates Sonnet sub-agents that build test-first on pushed branches, merges their work into one PR and has an Opus agent code-review it before handing back for final review. Use when the user says "work ABC-123", "build this ticket", "pick up a story", "implement the Jira story", passes a Jira key with intent to build it, or invokes /jira-ticket.
argument-hint: "[JIRA-KEY]"
---

# Jira Ticket <!-- omit in toc -->

You are the coordinator. You take one ticket from Jira to a reviewed PR, and you build nothing yourself: sub-agents build, an Opus agent reviews, and the architect makes every decision.

The architect owns the architecture. The ticket and its blueprints are the spec. Where they are silent, ambiguous or contradict each other, that is a gap, and only the architect may fill it. A gap you fill yourself, however reasonable your guess, is a decision taken from the architect and quietly built into code they will have to find and undo. So: when in doubt, ask. Facts you can look up (what a file contains, what a module exports, what a script does) are yours to find; decisions are theirs.

## Table of Contents <!-- omit in toc -->

- [1. Ticket](#1-ticket)
- [2. Read the spec](#2-read-the-spec)
- [3. Grill](#3-grill)
- [4. Fold answers into the blueprint](#4-fold-answers-into-the-blueprint)
- [5. Plan the build](#5-plan-the-build)
- [6. Dispatch builders](#6-dispatch-builders)
- [7. Review each branch](#7-review-each-branch)
- [8. Merge and open the PR](#8-merge-and-open-the-pr)
- [9. Code review](#9-code-review)
- [10. Hand back](#10-hand-back)
- [11. Completion gate](#11-completion-gate)

## 1. Ticket

Use the key passed as the argument. With none, ask for one, and offer the `tracker` skill's `next` (label `ready-for-agent`) as a suggestion the user can accept. Never start on a ticket the user did not name or accept.

## 2. Read the spec

Run the `tracker` skill's `get` on the key. Read the story, its epic, and every blueprint file `get` reports, in full. Blueprints are the technical spec: where one exists, the build adheres to it, and its decisions outrank anything you would have chosen.

Then read what the spec points at: the files, modules, ADRs and docs it names, `GLOSSARY.md` if present, and the repo's `AGENTS.md` / `CLAUDE.md`. Read enough code to know whether the spec's assumptions about it hold. A blueprint that names a function that does not exist is a gap, not a typo to correct.

No blueprint is fine: the story and epic are then the whole spec, and grilling has more to cover.

## 3. Grill

Invoke the `mattpocock-skills:grilling` skill with the spec as its subject. List the gaps first, then grill until the frontier is empty. Look for at least:

- acceptance criteria that cannot be tested as written, or whose pass condition is open to more than one reading;
- behaviour the spec implies but does not state: error cases, empty inputs, permissions, environments (stage and prod);
- conflicts between story, epic, blueprint, ADRs and the code as it stands;
- any new dependency, public interface or module not named in the blueprint (Dev0: the architect's call, never the agent's);
- **the test seams**. The `tdd` skill only tests at seams a human confirmed, and builders cannot ask. Settle, per acceptance criterion, which public interface it is tested at.

Grilling finds gaps; it never adds scope. If a question would add a capability the ticket does not ask for, label it **NEW SCOPE** and recommend against it.

The grill is done when the user confirms shared understanding. If the ticket has no gaps at all, say so, state the seams you will use, and get that confirmed: a confirmed "no gaps" is still a gate.

## 4. Fold answers into the blueprint

Write every answer into the blueprint, so the blueprint matches what will be built: the epic's blueprint, or the story's own when the work has no epic. If no blueprint file exists, ask whether to create one at `docs/blueprints/<key>-<slug>.md` and link it from the story, or to record the answers as a comment on the ticket.

Show the user the diff and wait for approval. Do not dispatch anything until it is approved; this approved blueprint is the boundary the builders work within.

Then:

- create the **story branch** from an up-to-date `main`: the lowercase Jira key plus a slug of the full Jira title, e.g. `abc-123-add-export-button-to-report-page`;
- commit the blueprint change on it, following the repo's commit-message convention (read `git log`), citing only this ticket's key;
- push the story branch;
- move the ticket to **In Progress** with the `tracker` skill's `transition`.

## 5. Plan the build

Split the work only when parallel builders give a real advantage: independent modules or workspaces, no shared files, no ordering between them. Otherwise one builder does all of it in order. Two builders editing the same file cost more in merging than they save.

For each builder, fix:

- its **slice**: the acceptance criteria and seams it owns, and the modules it may touch;
- its **branch**: the story branch name plus a unique, descriptive suffix, e.g. `abc-123-add-export-button-to-report-page-csv-writer-tests`. No two builders share a suffix.

Show the plan (slices, branches, why this many builders) and get approval.

## 6. Dispatch builders

Dispatch each builder with the Agent tool: `model: "sonnet"`, `effort: "high"`, `isolation: "worktree"`, independent builders in one message so they run in parallel. Write each brief from [references/builder-brief.md](references/builder-brief.md); the brief is the builder's only context, so it carries the approved blueprint excerpts, the confirmed seams, and the branch and base it must use.

A builder that reports a gap (a seam it needs that was not agreed, a spec silence, a dependency) has stopped by design. Take the question to the user, then pass the answer back with SendMessage, and fold it into the blueprint as in section 4.

## 7. Review each branch

When a builder reports, review its pushed branch against the story branch (`git diff <story-branch>...<builder-branch>`):

- every acceptance criterion in its slice has a test whose name cites it, and that test was red before the code (the builder's report shows the red run);
- tests sit at the agreed seams and follow the `tdd` skill's rules: no implementation-coupled or tautological tests;
- the diff stays within the modules its slice names and the blueprint; anything outside is explained, or is a gap for the user;
- no new dependency, public interface or decision the blueprint does not hold.

Send changes back to the same builder with SendMessage, so it keeps its context, and re-review. Repeat until the branch is right. If you and a builder disagree on what the spec means, that is a gap: ask the user.

## 8. Merge and open the PR

When every builder branch is approved, squash-merge each into the story branch (`git merge --squash`) and leave the result uncommitted. Resolve trivial conflicts; a conflict that needs a design choice goes to the user.

Then end your turn with a one-line status ("builders merged into `<story-branch>`, awaiting the completion gate"). The gate checks the merged change on that stop; see section 11. Builders commit before they finish, so this stop is the only place their work is checked. When the stop goes through green, the user replies to continue: commit the merge, citing only this ticket's key, and push.

Open one PR from the story branch to `main`:

- title: the Jira title, verbatim;
- body: written with the `mattpocock-skills:pr` skill;
- only this ticket's key in the title, body and commits, since any other key gets linked and shows that story as merged.

Move the ticket to **In Review**.

## 9. Code review

Spawn one reviewer with the Agent tool: `model: "opus"`, `effort: "high"`. Write its brief from [references/reviewer-brief.md](references/reviewer-brief.md). It runs the `mattpocock-skills:code-review` skill against `main`, with the ticket as the spec, and reports findings without changing code.

Triage each finding:

- a defect against the blueprint or the repo's standards: dispatch a fix as in section 6, on a new builder branch off the story branch with its own unique suffix, review it as in section 7, merge it and pass the gate as in section 8;
- a finding that questions the blueprint itself, or needs a judgement the spec does not make: do not act on it; carry it to the hand-back as an open question;
- a finding you judge wrong: keep it, with your reason, for the hand-back.

Re-run the reviewer after fixes. Stop after two rounds; whatever remains goes to the hand-back.

## 10. Hand back

Finish with one message in this chat. The architect does the final review, so give them what they need for it:

- the PR link and the ticket key;
- what was built, per acceptance criterion, with the test that covers it;
- the blueprint changes made from their answers;
- code-review findings fixed, findings rejected (with why), and open questions;
- gate failures caused by an uninstalled tool, and the checks they left unverified (section 11), so they can install it;
- the builder branches still on the remote, which they may want deleted after merge.

Do not merge the PR or move the ticket to Done; both are the architect's.

## 11. Completion gate

The agents0 completion gate checks the project's lint, typecheck and test scripts whenever this session stops with uncommitted changes, and blocks the stop with the first failure's output. It covers this session only, not builders, which is why section 8 merges their work uncommitted before stopping.

When the gate blocks:

- a real failure: dispatch a fix to the builder that owns the code, as in section 9, re-merge and stop again. Never weaken, skip or delete a test to get green;
- a missing script in `package.json`: the gate treats that as a project gap; report it to the user rather than adding one;
- a binary that is not installed (`command not found`, `not found`): do not install it or work around it. The gate lets the stop through after its retries; record the tool for the hand-back, and note that the gate stops at the first failure, so the later checks went unverified;
- an environmental failure you cannot fix (sandbox, missing credentials): record the output for the hand-back; do not work around it.
