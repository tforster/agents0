---
name: shell
description: House rules for shell scripts and shell configuration. Use when writing or editing a .sh file, a zsh plugin or completion, .bashrc or .zshrc, or any non-trivial shell command sequence saved to a file.
license: MIT
metadata:
  author: tforster
  version: "1.0"
---

# Shell <!-- omit in toc -->

- **Portable by default.** POSIX shell or plain Bash; avoid obscure Bash-isms. Zsh only where the file is zsh by nature: plugins, completions, `.zshrc`.
- **Check before acting.** Guard every input and precondition, e.g. `if [ -z "$TARGET" ]; then ... fi`, and fail with a message that names what was missing.
- **Functions as modules.** Break a script into named functions (`doInit`, `addAlias`) called from a short main block, not one top-to-bottom sequence.
- Names follow `rules/code-style.md`: camelCase functions and variables, PascalCase environment variables.
