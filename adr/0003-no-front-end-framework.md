# No front-end framework: React rejected <!-- omit in toc -->

Front ends are semantic HTML, CSS and vanilla ESM JavaScript, servable as static assets with no build step, using the web platform's own features (Grid, custom properties, Scroll Snap, `fetch`). React, and runtime-heavy frameworks like it, are rejected: they bring build tooling, bundle size and a dependency tree out of proportion to the work, and they replace platform knowledge with framework knowledge that dates.

## 1. Considered Options

- **The web platform, no framework** -- accepted. Nothing to upgrade, nothing to audit, and the browser renders HTML and CSS directly.
- **React** -- rejected. JSX and CSS-in-JS break the separation of HTML, CSS and JavaScript; the build step and dependency churn are permanent costs for every project.
- **Vue, Svelte and similar** -- rejected for the same reasons. The objection is to a runtime framework and build pipeline, not to React in particular.
- **Meta-frameworks** (Next.js, Nuxt) -- rejected. They add a server runtime and deployment model on top of the framework.

## 2. Consequences

- DOM updates and state are written by hand. That is more verbose than a declarative UI library, and acceptable at the scale these projects run.
- A small, unopinionated component or CSS library is not a framework, and is decided per project through the dependency gate.

[← Back to ADR index](./README.md)
