# A supervised coordinator builds each story <!-- omit in toc -->

A story is built by a coordinator session that writes no code itself. It reads the story, its epic and their blueprints, grills the architect until no gap remains, and folds the answers into the blueprint. It then dispatches Sonnet builder subagents, each working test-first on its own pushed branch, reviews each branch, merges them into one story branch and opens one pull request. An Opus reviewer subagent code-reviews that pull request; fixes go back to builders. The architect answers every question, does the final review, and merges.

## 1. Considered Options

- **Coordinator, Sonnet builders, Opus reviewer, architect merges** -- accepted. The expensive model judges and the cheaper model types; every decision above the blueprint still reaches a human.
- **One session builds and reviews its own work** -- rejected. An agent reviewing its own diff shares the blind spots that produced it.
- **Fully autonomous, agent merges** -- rejected. The merge is where the architect accepts the work, and builders cannot ask questions mid-task, so a wrong reading would ship unseen.
- **Unbounded review rounds** -- rejected. Review stops after two rounds; what remains goes to the architect as open questions rather than burning a session on disagreement.

## 2. Consequences

- Builders split work only when slices share no files; otherwise one builder does it all in order.
- A reviewer finding that questions the blueprint is not acted on; it goes to the architect.
- The coordinator never moves a story to Done; that, like the merge, is the architect's.

[← Back to ADR index](./README.md)
