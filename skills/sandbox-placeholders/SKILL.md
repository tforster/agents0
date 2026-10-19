---
name: sandbox-placeholders
description: Sweep the empty placeholder files Claude Code's Linux sandbox leaves in a repository (.zshrc, .mcp.json, .claude/settings.json, .git/config.lock and the like). Use when the user says git reports "could not lock config file", or asks to clean up sandbox placeholders or stray empty dotfiles after an agent session.
license: MIT
metadata:
  author: tforster
  version: "1.0"
---

# Sandbox Placeholders

On Linux and WSL2 the Bash sandbox creates an empty read-only file where a protected path does not exist, to bind-mount over it, and often leaves it behind. The agents0 plugin already removes a stale `.git/config.lock` after each Bash call; this sweep clears the rest.

Run it from a normal shell, not a sandboxed agent command (inside the sandbox the placeholders are live mounts), and once no other Claude Code session is running in the repository. Preview first:

```bash
node ${CLAUDE_SKILL_DIR}/../../hooks/sweep-placeholders.js --dry-run
node ${CLAUDE_SKILL_DIR}/../../hooks/sweep-placeholders.js
```

It looks at the top level of the repository (or worktree) root and `.claude/` for empty files and character devices, and removes one only when git shows it untracked, ignored or just added (an added one also leaves the index). A tracked file is skipped, so a deliberately empty tracked file is safe. It also removes a placeholder-shaped `.git/config.lock` unless a git process is running.

Report what it removed and what it skipped. A path it skipped for an unusual git status needs a human decision; do not remove it by hand without asking.
