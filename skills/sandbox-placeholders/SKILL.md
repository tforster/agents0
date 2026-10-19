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

Run it outside the sandbox, because inside it the placeholders are live mounts that cannot be deleted, and once no other Claude Code session is running in the repository. As an agent, run the command with the sandbox disabled for that one Bash call (this asks the user to approve), or give the user the command to run themselves as `! node <path>`. Preview first:

```bash
node ${CLAUDE_SKILL_DIR}/../../hooks/sweep-placeholders.js --dry-run
node ${CLAUDE_SKILL_DIR}/../../hooks/sweep-placeholders.js
```

It looks at the top level of the repository (or worktree) root and `.claude/` for empty read-only files and character devices, and removes one only when git shows it untracked, ignored or just added (an added one also leaves the index). A tracked file is skipped, so a deliberately empty tracked file is safe. It also removes a placeholder-shaped `.git/config.lock` unless a git process is running.

Report what it removed and what it skipped. A path it skipped for an unusual git status needs a human decision; do not remove it by hand without asking.
