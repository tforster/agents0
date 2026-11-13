# One orchestration folder per client <!-- omit in toc -->

A Claude Code session sees the repo it starts in, but client work often spans several: a platform, an API, infrastructure, a marketing site. Started in one, a session does not know the others exist, so the architect re-explains them every time. So each client with more than one repo gets an orchestration folder, `~/dev/<Client>/base`: the place a cross-repo session starts. It holds a map of the client's repos and a setting that lets a session started there reach them. Day to day nothing in it changes; the work lands in the sibling repos. The architect counts as a client, so their own repos get one too.

## 1. Considered Options

- **One orchestration folder per client, `~/dev/<Client>/base`** -- accepted. Each holds only a `CLAUDE.md` that says who the client is and lists the client's repos, one line each: `<name> (<what it is>): ../<repo>. Clone from <remote> if missing.` Past about 20 repos the list moves into `repos/<area>.md` files, and `CLAUDE.md` lists the areas. A committed `.claude/settings.json` holds `{ "permissions": { "additionalDirectories": [".."] } }`, so a session reaches every repo in the client folder and stops at its boundary.
- **One folder for every client** -- rejected. Clients sit under different Claude accounts and GitHub owners; one folder would mix them and show one client's repo list to another.
- **Agents0 as the orchestration folder** -- rejected. Agents0 is public and serves every client; a client's repo list does not belong in it. The plugin, installed at user scope, already gives every folder its rules, hooks and skills, so an orchestration folder copies or symlinks nothing from Agents0.
- **A folder outside git** -- rejected. The account gate reads the `origin` owner to know which Claude account a folder expects; a folder without a remote passes it silently, and a client session could run on the wrong account. A fresh machine also needs to clone it. Git is how it persists, not what it is for.
- **Naming it a home repo, workspace or working directory** -- rejected. "Home repo", the name of the pattern this came from, puts git first. `workspace` clashes with npm workspaces and a monorepo's `workspaces/` folder. "Working directory" already means a session's `cwd`. The concept is the orchestration folder; the directory is `base`, short to type.

## 2. Consequences

- Single-repo work still starts in that repo, governed by its own `CLAUDE.md`. Start in the orchestration folder when work crosses repos or the right repo is not yet known. A client with one repo gets no orchestration folder.
- The folder's remote lives with the client, in the client's own GitHub account or team account, named after the client, such as `acme.base`. Its `origin` owner is the client's, so the existing owner-to-account map covers it and every sibling with no new code: one entry per client owner.
- Paths in the map are relative, so the folder works wherever the client folder is cloned, and the clone line lets Claude fetch a repo a fresh machine does not have yet.
- Today it orchestrates by being where a session starts. Running the agentic loop or story coordination from it, for stories that span repos, is the expected next use.
- Folders are created by hand at first. A scaffolding skill that lists the sibling repos and drafts the map waits for the third folder.

A client folder, with made-up names:

```text
~/dev/Acme/
├── base/                  # the orchestration folder; remote acme.base
│   ├── .claude/settings.json
│   ├── CLAUDE.md
│   └── repos/<area>.md    # only past about 20 repos
├── acme.platform/
├── billing-api/
└── marketing-site/
```

[← Back to ADR index](./README.md)
