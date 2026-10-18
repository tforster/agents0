---
name: arc42-architecture
description: Produce an Arc42 architecture document for a software system. Use when asked to document, review, or create architecture documentation following the Arc42 template. Covers all 12 Arc42 sections including context, constraints, solution strategy, building blocks, runtime view, deployment, and architectural decisions.
license: MIT
metadata:
  author: tforster
  version: "1.0"
---

# Arc42 Architecture Skill

## When to Use This Skill

Use this skill when asked to:

- Create an architecture document for a new or existing system
- Document an architectural decision (ADR)
- Review whether existing architecture docs are complete

## Arc42 Template Structure

Arc42 organises architecture documentation into 12 sections. Produce all sections that have meaningful content; omit sections that genuinely do not apply.

### 1. Introduction and Goals

- Business requirements and key quality goals
- Stakeholders and their concerns
- Quality tree (top 3–5 quality attributes)

### 2. Constraints

- Technical constraints (technology stack, platforms)
- Organisational constraints (team, time, budget)
- Conventions (coding standards, legal)

### 3. System Scope and Context

- Business context: what systems/actors interact with this system?
- Technical context: what interfaces and protocols are used?

Include a context diagram (PlantUML preferred):

```text
[Actor] --> [System] : action
[System] --> [External] : data
```

### 4. Solution Strategy

- Fundamental technology decisions
- Decomposition strategy
- How quality goals are achieved

### 5. Building Block View

Hierarchical decomposition of the system:

- Level 1: Top-level whitebox (system → main components)
- Level 2: Blackbox descriptions of each top-level component
- Level 3 (if needed): Internal structure of complex components

### 6. Runtime View

Important runtime scenarios as sequence diagrams:

```text
Actor -> System: request
System -> DB: query
DB --> System: result
System --> Actor: response
```

Document the 3–5 most important scenarios.

### 7. Deployment View

Infrastructure and deployment topology:

- Where does the system run? (cloud, on-premises, edge)
- What are the deployment units?
- How are environments structured? (dev, stage, prod)

### 8. Cross-Cutting Concepts

Recurring patterns and principles applied throughout:

- Security approach
- Error handling strategy
- Logging and observability
- Internationalisation
- Testing approach

### 9. Architectural Decisions

Significant decisions as ADRs. Each ADR covers:

- **Title**: Short noun phrase
- **Status**: Proposed | Accepted | Deprecated | Superseded
- **Context**: What situation led to this decision?
- **Decision**: What was decided?
- **Consequences**: What are the trade-offs?

### 10. Quality Requirements

Quality scenarios mapped to quality goals from Section 1:

| Quality Goal | Scenario | Measure |
| --- | --- | --- |
| Performance | 1000 concurrent users | Response < 200ms |

### 11. Risks and Technical Debt

Known risks and areas of technical debt with mitigation strategies.

### 12. Glossary

Domain terms and technical terms that need definition.

## Output Format

Produce the document as a single markdown file in `docs/explanation/` or `docs/reference/` as appropriate. Follow the project markdown style guide. Use British/Canadian English.
