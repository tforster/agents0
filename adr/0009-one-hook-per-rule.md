# Each rule is injected by its own hook <!-- omit in toc -->

Plugins cannot carry rule files, so every file in `rules/` reaches the agent through `hooks/hooks.json`: one `SessionStart` entry (matched on `startup|clear|compact`) for the main session and `claude -p` workers, and one `SubagentStart` entry (matched on `*`) for subagents, which never see `SessionStart` context. Each entry runs `hooks/inject-rule.js` on one rule and returns it as `additionalContext`.

## 1. Considered Options

- **One hook entry per rule, per event** -- accepted. Each rule arrives intact in its own context block.
- **One hook injecting every rule** -- rejected. Claude Code caps each hook's output at 10,000 characters and replaces anything longer with a file path and a 2,000-character preview, so the rules past the cap would silently never load.
- **Native rule files** -- rejected. A plugin cannot ship them, and a hook that writes them into the user's configuration takes effect one session late, because rules are read at launch.

## 2. Consequences

- A new rule needs both entries, and must stay under 10,000 characters. A test fails when a rule lacks either entry or reaches the cap.
- `resume` is not matched: a resumed session already carries the rules in its transcript.
- Every injected rule is paid for in every session and every subagent, which is the pressure to keep rules few and short and to move the rest into skills that load on demand.

[← Back to ADR index](./README.md)
