# Dev0 Rules <!-- omit in toc -->

The architect owns the blueprint and the architecture. Agents own construction and verification. The signed blueprint is the boundary: decisions above it are the architect's, and below it they are carried out, not reinterpreted.

## 1. Judgement gates

Default to the direct thing; earn the indirection with a counted trigger.

- **Dependencies are default-deny.** Add no dependency, runtime or dev, without the architect's decision; no agent-side justification is accepted. Hand-roll it, or stop and ask. What `package.json` already lists is approved.
- **Abstract on the third repetition**, not the second. Write the direct version first.
- **Write docs only when the story asks for them or a public interface changed.**
- Before a dependency or architecture choice, read the ADRs in `${CLAUDE_PLUGIN_ROOT}/adr/`; their file names are the index.

## 2. Below the blueprint

The blueprint leaves small choices to you: a function body, a name, a loop or a map. Settle each with Dev0's six tests, scaled to the code in front of you. A choice passes all six; a strong pass never buys off a failure.

- **Less** -- fewer names, branches, files and lines that can go wrong.
- **Separate** -- each function does one thing, behind its signature.
- **Legibility** -- a reader predicts it without running it. Clever is not short.
- **Native** -- the language and platform before a helper you write.
- **Beneficiary** -- serve the user's behaviour, not your convenience.
- **Control** -- newest features where the project owns the runtime, conservative where it does not.

The tests choose within the blueprint, never against it. If passing them means touching another module, a public interface or a dependency, that is the architect's call: stop and ask. The code rules below are these tests applied to recurring cases; where a rule speaks, follow it.

## 3. Code rules

1. **Validate at the boundary, then trust.** Inside a module, arguments are the type their signature or JSDoc declares -- because bad input arrives at the edge, and re-checking inside buries logic in defensive noise.
2. **Let errors propagate to the boundary.** Catch only to add information, convert to a `Response`, or release a resource -- because one boundary handler decides status and logging consistently.
3. **A function lives in the file that calls it** until a second caller exists -- because the second caller reveals the real shape.
4. **Return the expression**: `return await x()`, `return !!x` -- because a temporary variable or `if`/`else` adds names that mean nothing. Keep the `await`: only an awaited rejection reaches a local `catch`.
5. **Comments carry what the code cannot** -- why, intent, edge cases, the rejected alternative -- and are written liberally, because without the why the next reader re-derives the decision or undoes it.
6. **Up to four parameters are positional**; five or more take an options object -- because past four, call sites become order-dependent guesswork.
7. **Import from the module that defines the symbol.** A barrel earns its place only at a published API boundary -- because barrels hide where code lives and invite circular imports.
8. **Name a literal when the name says something the value does not**, or when it is used twice; otherwise inline it -- because a constant for a self-evident value makes the reader jump to learn nothing.
9. **Call the function directly**, with no forwarding wrapper -- because a wrapper that only forwards adds a name and a jump, but no behaviour.

Rules 10-12 are JavaScript's, in the `javascript` skill.

## 4. Done

Beyond the checks the hooks run, a story is done when:

- every acceptance criterion has a test whose name cites it;
- the diff stays within the modules the blueprint names, or the PR says why not;
- the blueprint matches what was built, with any answers to your questions folded into it: the epic's, or the story's own when the work was too small for an epic.

Until the completion gate hook exists, run the project's `lint`, `typecheck` and `test` scripts and fix what they report before calling anything done.
