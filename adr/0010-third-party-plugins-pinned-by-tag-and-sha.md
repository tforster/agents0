# Third-party plugins are pinned by release tag and sha <!-- omit in toc -->

Third-party skills are not copied into Agents0. Each upstream plugin gets an entry in `.claude-plugin/marketplace.json`, pinned to a release tag (`ref`) and that tag's 40-character commit `sha`, or to a `sha` alone when upstream publishes no tags. Moving to a new upstream release is a deliberate edit to both values.

## 1. Considered Options

- **Release tag plus sha** -- accepted. The tag says which release was chosen; the sha makes the pin immutable even if the tag is moved. Upstream authors bump `version` per release, so `claude plugin update` picks a new pin up.
- **Floating refs** (a branch, or no ref) -- rejected. Every upstream push would reach every session unreviewed, and two machines could run different code under the same configuration.
- **Vendoring the skills into this repo** -- rejected. Copies drift from upstream, hide where the content came from, and make every upstream fix a manual merge.
- **A mid-release commit pin** -- rejected as a default. A plugin that sets `version` is cached by it, so a new commit at the same version is ignored by `update` and needs an uninstall and install.

## 2. Consequences

- Reviewing an upstream upgrade means reading the diff between two shas, in one place.
- A pin whose upstream sets `version` but did not bump it needs `claude plugin uninstall` then `install` on each machine.

[← Back to ADR index](./README.md)
