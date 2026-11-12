// jira-ticket.test.js — guards the jira-ticket skill (AGEN-59)
//
// The skill is prose a coordinating agent follows, so these tests pin the decisions the architect made about it: which
// skills it delegates to, which models build and review, how branches are named, and where it must stop for a human.

// System dependencies
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const skillDir = path.resolve(import.meta.dirname, "..", "skills", "jira-ticket");
const skill = readFileSync(path.join(skillDir, "SKILL.md"), "utf8");
const builderBrief = readFileSync(path.join(skillDir, "references", "builder-brief.md"), "utf8");
const reviewerBrief = readFileSync(path.join(skillDir, "references", "reviewer-brief.md"), "utf8");

/**
 * Returns the body of one numbered `##` section of the skill.
 *
 * @param {string} title - Section title without its number.
 * @returns {string} Text up to the next `##` heading.
 */
function section(title) {
  const [, body = ""] = skill.split(new RegExp(`^## \\d+\\. ${title}$`, "m"));
  return body.split(/^## /m)[0];
}

describe("jira-ticket skill", () => {
  it("AGEN-59 AC1: the skill takes a key as its argument, or asks for one", () => {
    assert.match(skill, /^argument-hint: .*KEY/m);
    const ticket = section("Ticket");
    assert.match(ticket, /key passed as the argument/);
    assert.match(ticket, /With none, ask for one/);
  });

  it("AGEN-59 AC2: the skill reads the ticket through the tracker's get and reads every blueprint it reports", () => {
    const spec = section("Read the spec");
    assert.match(spec, /`tracker` skill's `get`/);
    assert.match(spec, /every blueprint file `get` reports/);
  });

  it("AGEN-59 AC3: the skill grills, settling test seams, and gets blueprint approval before dispatching any builder", () => {
    const grill = section("Grill");
    assert.match(grill, /`mattpocock-skills:grilling`/);
    assert.match(grill, /test seams/);
    assert.match(section("Fold answers into the blueprint"), /Do not dispatch anything until it is approved/);
    // The architect owns the architecture: the skill must say gaps are theirs to fill.
    assert.match(skill, /only the architect may fill it/);
  });

  it("AGEN-59 AC4: builders are Sonnet, high effort, in worktrees, use tdd, and push suffixed branches without PRs", () => {
    const dispatch = section("Dispatch builders");
    for (const option of ['`model: "sonnet"`', '`effort: "high"`', '`isolation: "worktree"`']) {
      assert.ok(dispatch.includes(option), `dispatch does not set ${option}`);
    }
    assert.match(section("Plan the build"), /story branch name plus a unique, descriptive suffix/);
    assert.match(builderBrief, /`mattpocock-skills:tdd`/);
    assert.match(builderBrief, /git push origin <builder-branch>/);
    assert.match(builderBrief, /Do not open a PR/);
  });

  it("AGEN-59 AC5: one PR uses the pr skill, and an Opus high-effort reviewer runs code-review", () => {
    assert.match(section("Merge and open the PR"), /`mattpocock-skills:pr`/);
    const review = section("Code review");
    assert.ok(review.includes('`model: "opus"`') && review.includes('`effort: "high"`'), "reviewer is not Opus at high effort");
    assert.match(reviewerBrief, /`mattpocock-skills:code-review`/);
  });

  it("AGEN-59 AC6: the skill hands back in chat and never merges the PR or moves the ticket to Done", () => {
    const handBack = section("Hand back");
    assert.match(handBack, /one message in this chat/);
    assert.match(handBack, /Do not merge the PR or move the ticket to Done/);
  });

  it("AGEN-59 AC7: the skill leaves lint, typecheck and test to the completion gate (D24)", () => {
    // The wording ban itself is enforced for every skill by completion-gate.test.js; this pins the hand-off to the gate.
    assert.match(section("Completion gate"), /completion gate/);
    assert.match(section("Merge and open the PR"), /leave the result uncommitted/);
  });
});
