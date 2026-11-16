---
name: php
description: House rules for PHP in a legacy codebase being strangled. Use when writing, editing or reviewing .php files, their PHPUnit tests, or Playwright characterisation tests for a rerouted endpoint.
license: MIT
metadata:
  author: tforster
  version: "1.0"
---

# PHP <!-- omit in toc -->

How PHP is written where a legacy PHP application is being replaced piece by piece (the strangler fig pattern): new code intercepts and reroutes requests while the legacy code keeps running. Interception code lives for years, so it is held to Dev0; the legacy code is on its way out, so it is touched as little as possible.

Repo-specific values are not here: the production PHP version, the strangler directory and namespace, and the container that runs PHP live in the repo's own `composer.json` and `CLAUDE.md` cascade.

## Table of Contents <!-- omit in toc -->

- [1. The directory split](#1-the-directory-split)
- [2. Production syntax ceiling](#2-production-syntax-ceiling)
- [3. Style](#3-style)
- [4. Tests](#4-tests)
  - [4.1. PHPUnit for strangler code](#41-phpunit-for-strangler-code)
  - [4.2. Characterisation tests for every reroute](#42-characterisation-tests-for-every-reroute)

## 1. The directory split

The rules follow the directory, not the language.

- **New strangler code** -- the directory and namespace the repo's `CLAUDE.md` names for it (such as `fig/`, namespace `App\Fig`) -- follows the Dev0 code rules and requires tests. New logic always goes here.
- **Legacy code** -- everything else -- follows surgical change: touch only what the story needs, for interop with the new code. Never refactor it, restyle it or add features to it; it is being strangled, and rewriting it is waste and risk.

When a change seems to need new logic in the legacy tree, put the logic in the strangler directory and call it from the narrowest possible point in the legacy code.

## 2. Production syntax ceiling

Local PHP is usually newer than production, so syntax that runs locally can break production. Write no syntax or standard-library call newer than the production version.

- The production version is `composer.json` `config.platform.php`. That is the one place a repo declares it, and Composer uses it too.
- The agents0 PHP hook lints each file you write with `php -l` inside `php:<major.minor>-cli` for that version, and blocks in the same turn on a syntax error. A repo without `config.platform.php` gets no lint, so the ceiling is then on you: read the version from the repo's `CLAUDE.md` or ask.
- Typed properties, arrow functions, `match`, enums, readonly properties and named arguments each have a minimum version. Check before using one.

## 3. Style

- PSR-12, plus the repo's own `php-cs-fixer` configuration (`.php-cs-fixer.php`, else `.php-cs-fixer.dist.php`). The agents0 PHP hook applies it to each file you write; do not hand-format against it.
- In legacy files, do not let the formatter's changes spread past the lines the story needs. A formatting-only diff across a legacy file buries the real change; if the hook reformats a whole legacy file, say so in the PR.
- Canadian English in identifiers, comments and documentation, as everywhere.

## 4. Tests

### 4.1. PHPUnit for strangler code

Strangler code is unit-tested with PHPUnit: the newest PHPUnit that supports the production PHP version, run inside the repo's PHP container so the tests see the production runtime, not the host's.

```bash
docker compose exec <php-container> vendor/bin/phpunit
```

The container name comes from the repo's `CLAUDE.md` or `docker-compose.yml`.

### 4.2. Characterisation tests for every reroute

Every request the strangler code intercepts or reroutes gets a Playwright characterisation test at the HTTP boundary: the same request gives the same observable result -- status, redirects, the content and headers the user depends on -- before and after interception. Write the test against the legacy behaviour first, see it pass, then add the reroute and see it still pass.

Legacy code itself gets no new unit tests; the characterisation tests are its safety net.
