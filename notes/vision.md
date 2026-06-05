# Vision & Motivation

High-level purpose of the project and why event modeling is worth building a tool around. Mostly settled motivations; product specifics live elsewhere.

## What this is

A **structured whiteboard for event modeling**. The software lets people build and view an event model of a system.

## Why event modeling

> [motivation 2026-06-05]

Event modeling's core value: it **brings different roles together** around one shared artifact. Product people, customers, developers, designers, decision makers — all can look at the same model and:

- Understand what the system does and how it behaves over time.
- Speak a shared language about it.

The model is approachable enough that non-technical stakeholders follow it, while still being precise enough to drive implementation.

> [reference 2026-06-05] This value is well-documented in the source book — see `reference/benefits-vs-traditional.md` (communication over technology; "facts not prose"; defers irreversible decisions; living onboarding doc; tech-agnostic spec).

## Model as the project's source of truth (the spec)

> [decision 2026-06-05]

Beyond a discussion aid, the model is meant to be the **ultimate source of truth for the entire project** — a **complete, role-agnostic, technology-agnostic spec** of frontend, backend, and API. Enough is encoded (flows, data, business rules via GWTs/GTs + descriptions) to drive implementation later regardless of stack. Raises the bar: the tool is not a sketchpad, it's the **authoritative project definition**. **AI agents** are intended participants too — see `ai-participation.md`.

(One of several "source of truth" senses — keep distinct: this is *project/spec* level; `core-flow.md` = in-system *state* truth; `model-structure.md` = *structural* truth.)

## Primary usage mode

> [decision 2026-06-05]

Most use happens in **live, screen-shared sessions** focused on a **specific part of the domain**. One person drives the app and shares their screen; everyone looks at the **same few slices side by side** and draws/annotates around them together.

This is why scoping doesn't break the "shared picture" benefit: in a normal session the group *is* looking at one shared view (a small focused scope). The heavier navigation tools — "where is this used", larger-scope tracing, filtering — are for **specific situations**, especially **later, during development / information gathering**, not the everyday modeling session. Matches the v1 single-user / share-screen product stage.

## Relationship to event sourcing

> [motivation 2026-06-05]

The tool is **not directly tied to event sourcing**, but event models map naturally onto event-sourced systems. So it ends up being a good tool for event sourcing too. Treated as a bonus / "cherry on top", not the primary goal.

## Building blocks (as understood so far)

A model divides work into **slices**, and includes **events (business facts)**, **commands**, **read models**, **wireframes**, etc. (Terminology under active discussion — see `terminology.md`.)

## Open tensions / things to watch

- **Scale**: real systems aren't small apps — they routinely have *hundreds* of events. The tool must stay usable and comprehensible at that scale, not just for toy examples. This is a primary design constraint, not an afterthought.
