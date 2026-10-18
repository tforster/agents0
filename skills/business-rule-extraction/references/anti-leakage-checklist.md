# Anti-Leakage Checklist <!-- omit in toc -->

Pre-delivery pass for the business-language-only discipline every rule's wording must meet. Run this over every `Given/When/Then` scenario before a use case's status moves from `draft` to `reviewed`.

## Table of Contents <!-- omit in toc -->

- [1. The golden rule](#1-the-golden-rule)
- [2. Checklist](#2-checklist)
- [3. Allowed exceptions](#3-allowed-exceptions)
- [4. Worked corrections](#4-worked-corrections)

## 1. The golden rule

For every `Given`, `When`, and `Then` line: if this system were rewritten from scratch on a completely different stack, would this sentence still be true? If not, rewrite it in business terms.

## 2. Checklist

Walk each scenario and confirm none of the following appear in the `Given/When/Then` wording itself (citations are exempt — this checklist applies to prose only):

- [ ] No class, method, or function names (`Order::validate()`, `actionCreate()`)
- [ ] No framework or library names (Yii2, Laravel, jQuery, React, Eloquent)
- [ ] No table or column names used as identifiers (`ORDERS.CREDIT_LIMIT`, `orders_tbl`) — unless the exact name is required to disambiguate a genuine business concept, per [Section 3](#3-allowed-exceptions)
- [ ] No file paths or line numbers in the prose — those belong only in `sources[]`
- [ ] No HTTP verbs, status codes, exception/error class names, or other protocol-level detail, unless the protocol behaviour *is* the business rule being described (e.g., a webhook contract with an external partner)
- [ ] No architecture-pattern vocabulary (MVC, microservice, controller, repository, DTO)
- [ ] No variable or config-key names (`USE_NEW_ORDER_SERVICE`, `credit_limit_flag`)

## 3. Allowed exceptions

Two, and only two, categories of technical-looking terms are permitted in rule wording:

- **Entity/attribute names carrying real business meaning** — "credit limit," "order status," "shipping address." These stay because they're how the business actually talks about the concept, even though they also happen to be field names. The test: would a domain expert with no code access recognize and use this term unprompted?
- **Named external integrations** — "Stripe," "the ERP," "the fulfillment partner's API." These are business facts (which vendor is involved), not implementation detail.

Everything else fails the golden rule test and moves to the rule's `sources[]` citations instead.

## 4. Worked corrections

| Leaky (reject) | Corrected (business language only) |
| --- | --- |
| `Given Order::validate() is called with credit_limit=0` | `Given a customer with a credit limit of $0` |
| `When OrderController::actionCreate() runs` | `When an order is submitted` |
| `Then a CDbException is thrown` | `Then the order is rejected with "insufficient credit"` |
| `Given the USE_NEW_ORDER_SERVICE flag is true` | `Given the new order processing path is active` (or, if the flag itself has no business meaning, remove the condition — it's an implementation detail, not a rule) |
| `Then a row is inserted into orders_tbl with status='PENDING'` | `Then the order is created in a pending state` |

[← Back to SKILL.md](../SKILL.md)
