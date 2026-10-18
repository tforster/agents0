---
name: software-erasure
description: >
  Apply the erasure operation to software artifacts: architecture documents,
  ADRs, interface contracts, API specs, PR descriptions, system designs, code
  comments, and technical communications. Use whenever a software artifact is
  being reviewed and the question is not "is this correct?" but "does the noise
  in this design carry a gap forward rather than dissolve it?" Triggers on:
  architecture review, design critique, ADR drafting, interface contract
  evaluation, refactor planning, PR description review, or any moment a
  proposed solution adds a layer rather than removes what required a layer.
---

# Erasure — Software

One operation: the noise is restated so that it was never introduced.

In a software artifact, noise is the appearance of a gap in the design — a
seam, an adapter, a workaround, a comment explaining the inexplicable — where
a prior coherent structure was interrupted and the interruption was managed
rather than resolved. The signal is prior and complete: the territory the
artifact is serving, the invariant every component in that artifact is an
expression of. Erasure is the withdrawal of investment in the gap — the gap
closes, and the simpler design that was always available returns.

The five noise forms (NOISE_IDENTIFICATION_REFERENCE) apply to software
artifacts directly:

- **Redundancy** — the same concept represented in two components, models, or
  services with no structural justification; a DTO that mirrors a domain object
  with superficial differences; two services doing the same transformation for
  the same reason
- **Ambiguity** — an interface whose contract cannot be resolved in context; a
  boundary whose ownership isn't determinable from the design; a service name
  that could mean two different things depending on which team is reading it
- **Contradiction** — a dependency incompatible with what the system has
  established elsewhere; a constraint in one layer violated by an assumption
  in another; a domain model that uses the same term with different meanings
  in different modules
- **Out-of-context content** — a dependency, abstraction, or service that is
  real in some other part of the system but not serving this circuit; it
  occupies space a relevant design element would have used; an inherited
  framework concern injected into a domain that doesn't share its territory
- **Negation** — a constraint or boundary defined by what it excludes; access
  control specified entirely by prohibition; negative tests as primary
  specification; an anti-corruption layer defined by what it blocks rather
  than what invariant it preserves

---

## The distinction this skill exists to hold

There are two responses to a gap in a software design, and they look similar
from inside the moment of fixing. Only one is erasure.

**Compensation** adds an inverse layer upstream. It meets a noisy design by
wrapping it, adapting it, documenting it, or adding a translation mechanism —
and in doing so carries the gap forward as the justification for the layer.
The defect remains; a countermeasure is installed beside it. The circuit is
longer: the original gap, then the layer managing it. The layer only functions
while the gap is there to justify it. The design is now harder to reason about
because the gap is still present and must be tracked alongside its manager.

**Erasure** restates the design from the invariant so the gap was never
introduced. The component, interface, or boundary that required the managing
layer is gone. The layer has no gap to manage and therefore is not needed. The
circuit is shorter. Nothing remains pointing at what was wrong.

**The test for compensation** is one question: does this component, layer, or
comment carry an earlier design decision forward in order to display its
management? An adapter that exists because two services disagree about a
concept is compensation until the disagreement is resolved at the invariant
level. An ACL that translates between two bounded contexts is erasure if the
two contexts are genuinely distinct; it is compensation if they are two
coordinate expressions of the same territory and the ACL is working around the
fact that the invariant was never found.

---

## The diagnostic signatures

Compensation, in a software artifact, takes recognizable forms:

- A comment block explaining why this implementation exists ("this works
  around X," "this is here because of Y's behavior") — the comment preserves
  a design mistake in order to justify the code managing it
- A retry/fallback structure added because an operation is unreliable — the
  circuit now includes the unreliable operation as a permanent resident; the
  fallback only functions while the unreliability persists
- An adapter or translator between two representations of the same concept —
  both representations are now load-bearing; removing either breaks the
  adapter; the adapter is the gap's evidence, not its resolution
- Feature flags as permanent infrastructure — the unresolved design decision
  now lives in the configuration surface; the flag is the indecision made
  operational
- A DTO as a near-copy of a domain object with minor differences, no
  structural boundary between the two coordinate systems having been declared
- Defensive null checks accumulating at a boundary because the contract was
  never enforced — the checks are the failure made permanent rather than the
  contract made clear
- "Not X but Y" in a PR description where X is carried forward from the
  previous implementation to show its replacement — the clean form names Y
  directly, without X as the coordinate origin

Conway's Law surfaces a specific diagnostic: a boundary in the architecture
that doesn't match a domain boundary in the territory usually reflects a team
boundary. An ACL, adapter, or translation layer at that boundary is
compensation for the communication structure, not erasure of the domain gap.
The question is always: is this layer here because the domain has two distinct
territories? Or because the team is organized in a way that prevented a
conversation?

---

## The operation

**1. Locate the signal.** Name what the component, interface, or service is
actually serving — the prior recognition it points at, the territory it is an
expression of. The signal is prior to any of the layers and wrappers over it.
Ask: if this component did only what the territory requires, and the noise had
never entered, what would it be?

**2. Name the noise as a thought.** Identify the specific form (one of the
five) and name the compensation structure if one is present: what gap is being
carried forward, and what layer is managing it? This step is complete when the
gap can be stated plainly without referencing the managing layer.

**3. Restate from the signal.** Design the component, interface, or boundary
as it would have existed if the noise had never entered. Do not reference the
gap. Do not explain the change. The corrected error is not carried; the design
that required no correction is what remains.

**4. Confirm the circuit shortened.** The clean design is simpler or equal,
never more complex. If the restatement added a layer — a new service, a new
abstraction, a new translation concern — return to step 3. Complexity added is
compensation wearing erasure's costume.

---

## Where this interacts with the coordinate-system frame

A software gap is often a coordinate gap: two components expressing the same
territory in different coordinate systems, without a connection operator
defined at the invariant level. The symptom is two internally coherent systems
whose interfaces don't translate cleanly, and where more documentation makes
it worse.

The compensation response is to install a permanent translator (an ACL, an
adapter, a mapper). This is not erasure. The translator works around the
coordinate gap without closing it; the gap is now inside the system's
permanent infrastructure.

The erasure response is to find the invariant — what both components are
expressions of — and let the design happen at that level. When the invariant
is found and named, one of three things follows: the two components merge
because they were always one; the boundary is redrawn so each component serves
one territory cleanly; or the interface is restated in invariant terms so
neither component's coordinate system is forced onto the other. In all three
cases, the permanent translator is no longer required.

The test: does the proposed interface make sense stated in the territory's
terms, without reference to either component's internal model? If it requires
both models to be explained before the interface makes sense, the invariant
has not been found.

---

## Timing

Erasure runs on the circuit's timing. The recognition that the gap was never
structural arrives when it arrives. Where the signal has not clarified,
the move is to name the noise and wait — not to force a restatement. A
restatement forced before the invariant is seen is itself compensation: the
designer managing the correction before the territory has been understood.

An erasure pass on a software artifact produces two things: (a) the components
or interfaces restated now, from the invariant that has clarified; and (b) a
list of noise named but not yet erased — held, not forced. The second list is
not a backlog. It is what is waiting for the conversation that will surface the
invariant.

---

## Worked example

**Compensation** (a service boundary that carries the gap forward):

> The `OrderEnrichmentService` exists because the `OrderService` doesn't have
> access to the pricing data that lives in `PricingService`. It fetches the
> order, calls `PricingService`, and assembles the enriched view that the API
> layer needs. It was added when the API team found that clients were making
> two calls to assemble the same data.

Every sentence in that description preserves a design mistake in order to
justify the enrichment service. The enrichment service is the gap's manager.
Remove it and the gap is exposed: `OrderService` and `PricingService` each
have part of a concept the API needs whole, with no clear invariant between
them.

**Erasure** (the same territory, restated from the invariant):

> An `Order` in the context of a customer-facing API includes its applicable
> price. `OrderService` is the bounded context for that concept. `Pricing` is
> a sub-domain — its rules are applied when an `Order` is created or modified,
> not assembled on read. The API returns `Order` directly.

The enrichment service has no gap to fill. Its load-bearing precondition —
that pricing and order are concepts the system holds separately and assembles
on demand — is no longer the design. Nothing points at what the enrichment
service was managing.

---

## Relationship to other diagnostics in this context

The erasure operation is what the noise identification diagnostic leads to.
Naming the noise form (NOISE_IDENTIFICATION_REFERENCE) is step 2. The
coordinate-system frame supplies step 1: the territory that is the signal.
Conway's Law is the diagnostic for step 2 when the gap is organizational
rather than conceptual: the boundary in the artifact is a copy of the
communication structure that produced it.

DDD's bounded context declaration is erasure at the system level: it finds
the invariant, names the scope within which one ubiquitous language is
coherent, and restates the boundary from that ground. An anti-corruption layer
that translates at the invariant level is erasure. An ACL installed to manage
a coordinate gap that was never resolved is compensation with a DDD nameplate.