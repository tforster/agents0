---
name: web-ui
description: House rules for HTML, CSS and Handlebars templates. Use when writing or editing .html, .css or .hbs files, building page markup, styling, or moving logic out of templates.
license: MIT
metadata:
  author: tforster
  version: "1.0"
---

# Web UI <!-- omit in toc -->

- **Semantic HTML5.** Use the element that names the content (`nav`, `article`, `button`, `h1`-`h6`) rather than nested `div`s, and keep markup well formed.
- **Lean CSS.** The platform first: Grid, custom properties, Scroll Snap. When a framework is in play, use it for structure only, and put overrides in their own well-organised stylesheet.
- **Dumb templates.** Handlebars templates only place values. Formatting and logic belong in the data pipeline that feeds the template, not in block helpers.
