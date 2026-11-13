# Develop Agents0 <!-- omit in toc -->

How to change Agents0 and get the change into your own Claude Code: why your edits do not reach the installed plugin, the edit loop, running a single hook outside a session, moving a third-party pin, and the checks to run first. [Architecture](../explanation/architecture.md) explains why it works this way.

## Table of Contents <!-- omit in toc -->

- [1. Prerequisites](#1-prerequisites)
- [2. Why edits do not reach the installed plugin](#2-why-edits-do-not-reach-the-installed-plugin)
- [3. Steps](#3-steps)
  - [3.1. Try a change in place](#31-try-a-change-in-place)
  - [3.2. Run a hook outside a session](#32-run-a-hook-outside-a-session)
  - [3.3. Add a hook test](#33-add-a-hook-test)
  - [3.4. Ship a change](#34-ship-a-change)
  - [3.5. Move a third-party pin](#35-move-a-third-party-pin)
- [4. Verification](#4-verification)
- [5. Troubleshooting](#5-troubleshooting)
  - [5.1. One hook keeps blocking you](#51-one-hook-keeps-blocking-you)
  - [5.2. Every hook needs to stop](#52-every-hook-needs-to-stop)
  - [5.3. Edits have no effect](#53-edits-have-no-effect)

## 1. Prerequisites

- Agents0 installed, as in the [README](../../README.md#4-quick-start)
- A clone of this repository, with `npm install` run for the dev tooling
- Node on your `PATH`, which every hook already needs

## 2. Why edits do not reach the installed plugin

The installed plugin does not run from this repository. It runs from `~/.claude/plugins/cache/agents0/agents0/<commit>/`, a snapshot taken at the commit you last installed or updated. The plugin has no `version`, so the cache is keyed by commit. An edit here changes nothing in a normal session until you commit, push and update.

Claude Code also enables or disables a plugin as a whole. Every hook in `hooks/hooks.json` comes and goes with it, and no setting turns off one plugin hook while keeping the rest.

So while you develop:

- the installed plugin runs the **old** code, including any hook that may be in your way;
- the working copy, loaded with `--plugin-dir`, runs the **new** code;
- a hook script can be run by hand, with no session at all.

## 3. Steps

### 3.1. Try a change in place

Run `/plugin`, choose `agents0`, and disable it. Leave it disabled until the change is shipped: re-enabling it brings back the cached, unedited copy. Both copies have the same plugin name, and loading both at once is untested here.

Then load the working copy as the plugin for one session, with no commit:

```bash
claude --plugin-dir .
```

This session loads every skill, rule and hook from your working tree. Claude Code reads `hooks.json` when the session starts, so:

- an edit to a hook **script** (`hooks/*.js`) applies to the hook's next run, because each run starts a new `node` process;
- an edit to **`hooks/hooks.json`** (a new entry, a matcher or a timeout) applies only after `/reload-plugins` or a restart.

### 3.2. Run a hook outside a session

`devops/run-hook.sh` runs one hook from the working copy exactly as Claude Code would: it builds the JSON payload, pipes it to the script on stdin with `CLAUDE_PLUGIN_ROOT` set to this repository, and reports what came back.

```bash
devops/run-hook.sh account-gate                                   # payload with cwd = current directory
devops/run-hook.sh account-gate -d ~/dev/SomeOwner/some-repo      # as if prompting from another repo
devops/run-hook.sh account-gate -p "fix the bug"                  # a specific prompt
devops/run-hook.sh inject-rule -e SessionStart -- SessionStart rules/dev0.md
echo '{"cwd":"/tmp"}' | devops/run-hook.sh account-gate           # hand-written payload on stdin
```

| Option       | Meaning                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------- |
| `<hook>`     | File name in `hooks/`, with or without `.js`                                                 |
| `-e event`   | Hook event; defaults to the event the hook is registered under in `hooks.json`               |
| `-d dir`     | The payload's `cwd`; defaults to the current directory                                       |
| `-p prompt`  | The `prompt` field, for `UserPromptSubmit`                                                   |
| `-t tool`    | The `tool_name` field, for `PreToolUse` and `PostToolUse`; defaults to `Bash`                |
| `-- args...` | Arguments passed to the hook script; paths relative to the repository root are made absolute |

The script ends with a verdict that reads the result the way Claude Code does:

| Result                               | Verdict            | What Claude Code does                           |
| ------------------------------------ | ------------------ | ----------------------------------------------- |
| Exit 0, no `"decision": "block"`     | passed             | Carries on; stdout may be added as context      |
| Exit 0, `{"systemMessage": ...}`     | passed             | Carries on and shows the message as a warning   |
| Exit 0, `{"decision": "block", ...}` | BLOCKED            | Refuses the prompt or action and shows `reason` |
| Exit 2                               | BLOCKED            | Refuses, and shows stderr as the reason         |
| Any other non-zero exit              | non-blocking error | Carries on and reports the error                |

The environment you run it from is the environment the hook sees. For the account gate that means `ClaudeAccounts` from your shell profile and the signed-in account in `~/.claude.json` (or `$CLAUDE_CONFIG_DIR/.claude.json`). Override either for one run:

```bash
ClaudeAccounts='{"SomeOwner":"someone@example.com"}' devops/run-hook.sh account-gate
CLAUDE_CONFIG_DIR=/tmp/fake-config devops/run-hook.sh account-gate
```

### 3.3. Add a hook test

The tests in `tests/` run hooks as real child processes, the same way the script does. Add a case for the behaviour you changed, using a throwaway `CLAUDE_CONFIG_DIR` for anything that reads Claude's config, then run it alone:

```bash
node --test tests/account-gate.test.js
```

### 3.4. Ship a change

The plugin has no `version`, so Claude Code keys its cache by commit and every pushed commit is an update:

1. Commit and push the change
2. `claude plugin marketplace update agents0 && claude plugin update agents0@agents0`
3. Re-enable `agents0` in `/plugin` if you disabled it, then restart Claude Code

### 3.5. Move a third-party pin

Pin each third-party plugin in `.claude-plugin/marketplace.json` to a release tag (`ref`) and that tag's 40-character commit (`sha`). Upstreams with no tags are pinned to a commit alone.

A third-party plugin that sets `version` is cached by that version, so moving its pin to a commit with the same version is a no-op for `claude plugin update`. Reinstall it instead with `claude plugin uninstall <plugin>@agents0` and `claude plugin install <plugin>@agents0`.

## 4. Verification

```bash
npm test                              # full test suite (node:test)
npm run lint                          # oxlint
npm run format:check                  # oxfmt --check (no write)
npm run typecheck                     # tsc --noEmit -p jsconfig.json
claude plugin validate .              # marketplace and plugin manifests
```

For a hook change, also check that `devops/run-hook.sh <hook>` gives the verdict you expect for each case you care about. After shipping, `ls ~/.claude/plugins/cache/agents0/agents0/` lists a directory named for your new commit.

## 5. Troubleshooting

### 5.1. One hook keeps blocking you

Short term, stay on `claude --plugin-dir .` with the installed plugin disabled, and fix the hook in the working copy. Do not commit a temporary early `return` in a hook.

If a hook keeps getting in the way of real work, give it a kill switch: an environment variable, named in PascalCase to match the project's conventions (for example `DisableAccountGate`), checked at the top of the hook and exiting 0 when set. That changes the plugin's behaviour, so record it in the hook's header comment and add a test for it.

### 5.2. Every hook needs to stop

Set `"disableAllHooks": true` in `.claude/settings.local.json`. It turns off every hook from every source, plugin and settings alike, including the completion gate and the rule injectors. Remove it as soon as you are done.

### 5.3. Edits have no effect

- In a normal session you are running the cached copy, not this repository. Use `claude --plugin-dir .`
- You edited `hooks.json`: run `/reload-plugins` or restart
- The hook ran from a different `cwd` than you assumed. Run it with `devops/run-hook.sh -d <dir>` to reproduce

[← Back to How-To Guides](./README.md)
