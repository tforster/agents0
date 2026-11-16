# Harden Local Agent Sandboxing <!-- omit in toc -->

Blueprint for epic AGEN-66: make sandboxing binding for agents running locally on a Claude subscription, without giving up auto-mode throughput.

## Table of Contents <!-- omit in toc -->

- [1. Problem](#1-problem)
- [2. Constraints](#2-constraints)
- [3. Options Set Aside](#3-options-set-aside)
- [4. Option 1: Managed Settings (Now)](#4-option-1-managed-settings-now)
  - [4.1. Policy](#41-policy)
  - [4.2. Location](#42-location)
  - [4.3. Pushing Without SSH Keys](#43-pushing-without-ssh-keys)
  - [4.4. Known Gaps](#44-known-gaps)
- [5. Option 2: Isolated Environment (Near Term)](#5-option-2-isolated-environment-near-term)
  - [5.1. Shared Principles](#51-shared-principles)
  - [5.2. Option 2a: Dedicated WSL2 Distro](#52-option-2a-dedicated-wsl2-distro)
  - [5.3. Option 2b: Devcontainer](#53-option-2b-devcontainer)
- [6. Open Questions](#6-open-questions)

## 1. Problem

Claude Code's Bash sandbox (`/sandbox`) is advisory as configured today. Every Bash call can carry a `dangerouslyDisableSandbox` parameter. When a command hits a sandbox block, the agent retries with it set, and in auto mode the classifier, not the architect, decides whether that retry runs. Observed: the agent reports the block, then works around it.

Nothing else holds the line. The user settings have `defaultMode: "auto"`, no `sandbox` block and no deny rules, and there is no managed settings file. The sandbox also covers shell commands only: the Read, Edit, Write and WebFetch tools follow permission rules, of which there are none.

What is at stake on this machine: `~/.ssh` holds client production keypairs as well as the GitHub key, `~/.config/gh` holds a GitHub token, and `~/.claude/settings.json` holds the rules that govern the agent itself.

## 2. Constraints

- **Subscription only.** No Anthropic API billing. Claude Code authenticates with a Claude subscription, interactively or through `claude setup-token`
- **Throughput.** Auto mode stays. The architect does not confirm routine prompts
- **Local.** Agents run on the developer's own machine. Windows with WSL2 for the architect; macOS for at least one teammate
- **Unmodified Claude Code**, with the agents0 plugin loaded, so rules, hooks and skills still apply

## 3. Options Set Aside

- **Cloudflare Sandboxes.** The documented way to run Claude Code in one keeps the credential in the Worker by sending model traffic through AI Gateway, which is API billing. A subscription token (`CLAUDE_CODE_OAUTH_TOKEN`) would have to live inside the sandbox, and the terms on hosting Claude Code in your own sandbox are ambiguous. It also needs a Worker, an image and egress configuration built and kept up to date
- **Claude Code on the web** (`claude --cloud`). It is subscription-billed and dispatch works from the CLI, but plugins do not load in cloud sessions, so the agents0 rules, hooks and skills are lost. Status, output and "blocked" signals are visible only in the browser

Either may be revisited if the constraints change.

## 4. Option 1: Managed Settings (Now)

Lock Claude Code's own sandbox with a root-owned managed settings file. The agent cannot edit it, and user, project and local settings cannot loosen it. Story AGEN-67.

### 4.1. Policy

```json
{
  "sandbox": {
    "enabled": true,
    "failIfUnavailable": true,
    "allowUnsandboxedCommands": false,
    "autoAllowBashIfSandboxed": true,
    "filesystem": {
      "denyRead": ["~/.ssh", "~/.aws", "~/.gnupg", "~/.cloudflared"]
    },
    "network": {
      "allowedDomains": ["github.com", "*.github.com", "*.githubusercontent.com", "registry.npmjs.org"]
    }
  },
  "permissions": {
    "disableBypassPermissionsMode": "disable",
    "deny": [
      "Read(~/.ssh/**)",
      "Read(~/.aws/**)",
      "Read(~/.gnupg/**)",
      "Read(~/.cloudflared/**)",
      "Edit(~/.claude/settings.json)",
      "Edit(~/.zshrc)",
      "Edit(~/.bashrc)"
    ]
  }
}
```

| Key                               | Why                                                                                                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `allowUnsandboxedCommands: false` | Removes the `dangerouslyDisableSandbox` retry in every permission mode. Set in managed settings, it also makes Claude Code ignore loosening keys in project and local settings |
| `failIfUnavailable: true`         | No silent fall-back to running unsandboxed when bubblewrap cannot start                                                                                                        |
| `autoAllowBashIfSandboxed: true`  | Keeps throughput: a sandboxed command runs without a prompt                                                                                                                    |
| `filesystem.denyRead`             | Shell commands cannot read credentials                                                                                                                                         |
| `network.allowedDomains`          | Shell egress limited to what the Dev0 loop needs. An unlisted domain prompts; add `strictAllowlist: true` once the list is settled                                             |
| `disableBypassPermissionsMode`    | `--dangerously-skip-permissions` is refused                                                                                                                                    |
| `permissions.deny`                | Covers the tools the sandbox does not: `denyRead` does not stop the Read tool. Deny rules are checked before the auto-mode classifier, which cannot override them              |
| `Edit(~/.claude/settings.json)`   | `autoMode` and user permissions live there; without it the agent could loosen its own rules with the Edit tool                                                                 |

### 4.2. Location

| Platform       | Path                                                            |
| -------------- | --------------------------------------------------------------- |
| Linux and WSL2 | `/etc/claude-code/managed-settings.json`                        |
| macOS          | `/Library/Application Support/ClaudeCode/managed-settings.json` |

The file is machine setup, so its source lives in each developer's dotfiles repo and is installed with `sudo`. Agents0 does not install it.

### 4.3. Pushing Without SSH Keys

Remotes use SSH today (`git@github.com:...`), and `~/.ssh` is denied, so a sandboxed `git push` would fail. The agent pushes over HTTPS instead, using the `gh` token as git's credential helper (`gh auth setup-git`); `~/.config/gh` stays readable so `gh pr create` works. The SSH keys stay for the architect's own use.

### 4.4. Known Gaps

- **Not sandboxed:** hooks, MCP servers, the status line and `!` shell commands run with full access. That includes the agents0 completion gate running `npm test`. `allowManagedHooksOnly` is not set, because it would turn off the agents0 hooks
- **The `gh` token is readable.** A deliberate trade-off: the loop needs it to push and open PRs. A fine-grained token limits the damage
- **Writes outside the repo**, such as the npm cache, may need `sandbox.filesystem.allowWrite` entries; expect a few in the first week
- **`~` expansion** in `sandbox.filesystem` paths is assumed, not verified; AC3 tests it

## 5. Option 2: Isolated Environment (Near Term)

Run the agent somewhere that holds nothing worth stealing, then let it run without prompts. Isolation comes from what the environment does not contain, not from policy.

### 5.1. Shared Principles

- Only the repos being worked on are present: no SSH keys, no cloud credentials, no other client's files
- One fine-grained GitHub token per environment, scoped to the client's repos, with contents and pull-request write and no admin rights
- Egress limited to `api.anthropic.com`, GitHub and package registries
- The Claude subscription login lives inside the environment. It is readable there, which is why egress is limited
- The agents0 plugin installed at user scope, as on the host
- Option 1's managed settings still apply inside, as defence in depth

### 5.2. Option 2a: Dedicated WSL2 Distro

For the architect on Windows. A second WSL2 distro used only by agents, imported from a clean image. Story AGEN-68.

- Repos are cloned into the distro, not shared from the main distro's `/home`
- WSL2 mounts Windows drives under `/mnt/c` by default; turn this off in the distro's `/etc/wsl.conf` (`[automount] enabled = false`), or the agent can read the Windows profile
- Turn off Windows interop (`[interop] enabled = false`), or the agent can launch Windows executables
- jj, Node, `gh` and Claude Code installed per distro, from the dotfiles repo

### 5.3. Option 2b: Devcontainer

For teammates on macOS, and anyone who prefers containers. Based on Anthropic's reference devcontainer, which includes an egress firewall (`init-firewall.sh`, needing `NET_ADMIN` and `NET_RAW`). Story AGEN-69.

- Mount the repo only; `~/.claude` persists in a named volume so the subscription login survives rebuilds
- The container user is not root, which Claude Code requires for unattended runs
- Works on Docker Desktop, Colima or OrbStack on macOS, and on Docker in WSL2

## 6. Open Questions

1. **Option 1:** does the HTTPS-push switch apply to every repo through a global `url.<base>.insteadOf` rewrite, or only to repos the agent pushes from?
2. **Option 1:** should the policy file have one canonical copy that teammates take from, such as an agents0 template, or stay purely in each person's dotfiles?
3. **Option 2:** does the agent run with `--dangerously-skip-permissions` inside the environment, which means taking `disableBypassPermissionsMode` out of the managed settings there, or in auto mode as on the host?
4. **Option 2:** one environment per client, matching the one-account-per-client rule, or one shared environment that switches accounts?
5. **Option 2a:** how does the architect review agent work: VS Code Remote into the distro, or fetching the pushed branch into the main distro?

[← Back to Blueprints](./README.md)
