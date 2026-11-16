# The account gate warns, it does not block <!-- omit in toc -->

Different clients sit under different Claude accounts. A `UserPromptSubmit` hook compares the signed-in account with the one mapped to the `origin` owner of the repo the prompt is submitted in, and on a mismatch prints one line telling the user to `/logout` and `/login`. It lets the prompt through.

## 1. Considered Options

- **Warn on every prompt** -- accepted. A session cannot change its own account and a prose rule cannot see which account it runs under; each prompt is the moment that can say so, and a per-prompt line does not scroll away.
- **Block the prompt** -- rejected. It stops deliberate cross-account work, such as editing Agents0 while signed in to a client account, and a gate that blocks legitimate work gets switched off.
- **Warn once at `SessionStart`** -- rejected. A single warning scrolls past and is forgotten.

## 2. Consequences

- The gate passes silently when it cannot tell: no map, no repo or `origin`, an owner not in the map, or no signed-in account. A map that is set but malformed warns, so a typo is not hidden.
- The owner-to-account map lives in the user's shell environment, not the repo, because the repo is public.
- Working on the wrong account is possible, but never unannounced.

[← Back to ADR index](./README.md)
