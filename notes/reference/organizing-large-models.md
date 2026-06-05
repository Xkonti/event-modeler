# Reference: Organizing Large Event Models (canonical)

> [reference 2026-06-05] Source: `source.md` (ch 18 core; ch 5, 7, 8, 10, 43, 44). **Most important for aligning our hierarchy** (`../model-structure.md`) — and where we diverge most.

## Two orthogonal axes (do not conflate)

- **Timeline (horizontal)** — process steps left-to-right; one model = one readable story.
- **Swimlanes (vertical bands)** — each swimlane ≈ one **event stream** ≈ one **business capability** ≈ (often) one **aggregate's** stream (ch 7). Canonical + first-class. External events get their **own** swimlane (ch 15).

## The book's grouping vocabulary (finest → coarsest)

| Level | Book term | Notes |
|---|---|---|
| atomic | Event / Command / Read Model / Screen / External Event / Automation / GWT | sticky notes (ch 3) |
| functional unit | **Slice** | one of the 4 patterns; ~1 day; 1:1 with code package + ticket (ch 10) |
| stream band | **Swimlane** | = stream / capability / aggregate; **orthogonal** to chapters (ch 7) |
| flow group | **Chapter** + **Sub-Chapter** | blue-arrow spans above timeline; *optional extension*; ≈ Epic (ch 18, 43) |
| context | **Model** | one business context; named with pink sticky; "prefer many small models" (ch 18) |
| board | **Board** | holds many models (ch 18) |
| overlay | **Bounded Context** (DDD) | event clusters → areas of interest; language boundary, NOT deployment (ch 8) |

> The book never gives one rigorous tree; ch 18 calls the above-slice apparatus **optional**. "Flow", "use case", "model", "sub-chapter" are used loosely/interchangeably.

## Slice (precise)

One of: **State Change / State View / Automation / Translation**. Tiny (~1 day). Cuts vertically through all layers for one feature. "Minimize coupling between slices, maximize within a slice" (Bogard). Black-box tested by GWTs at its edges. The one allowed inter-slice dependency: an automation reading **another slice's exposed read model** (ch 10).

## Cross-context + consistency

- **Bounded context** = ubiquitous-language boundary; the same word ("Order") legitimately means **different things** in different contexts. Don't auto-map context → microservice; default: keep one system until you know more (ch 8).
- Crossing a context boundary = **Translation + External (integration) Events** — a published, **versioned** contract (`CustomerRegistered` → `…V2`); never read another context's internal events (ch 5).
- **Internal events** = living, frequently-changing, NOT public API. **External events** = the stable, versioned, schema'd API.
- **Aggregate** = consistency + transaction boundary; one stream; optimistic-lock on version (ch 8).
- **Dynamic Consistency Boundary (DCB)** (ch 44) — for multi-stream invariants: one global stream + **tagging** + conditional append; per-operation, cross-lane boundary. Complements (not replaces) aggregates. Described as **immature/evolving**.

## Keeping big models comprehensible (book's actual advice)

1. **Many small models > one big** — split by business context (ch 18).
2. One readable story per model; name each (pink).
3. **Chapters/sub-chapters** = scannable context strip above the timeline.
4. **Alternative-flow links** — a marker under a slice **jumps to another model**; error/alt cases are **separate linked flows, never inline branches** (ch 18).
5. **Swimlane isolation** — hide all lanes but one, read it alone (ch 7).
6. **GWT vertical drill-down** — skim horizontally, descend per slice (ch 3).
7. **Level-of-detail / progressive disclosure (ch 43)** — hide attributes/events for a "TL;DR / 5-slide" exec view vs full detail for devs/QA. The book's main answer to scale.
8. **No quantitative thresholds** given (no "at N events do X"); scaling answer is qualitative: split + chapter + LOD.

## Naming at scale

Events past tense; commands imperative; business language. **Names valid only within their bounded context** (ubiquitous language) — explicitly **not global**. Only **external** events are versioned. No formal casing/namespacing spec (ch 5, 8, 11).

## DIVERGENCE flags (our tool vs book) — IMPORTANT

> [open question 2026-06-05]

- **Hierarchy mismatch.** Ours: sticky → slice → flow → feature → context → domain. Book: Slice → (Sub-)Chapter → Model → Board, **plus orthogonal Swimlanes**, plus bounded-context overlays. Our "flow/feature" ≈ book "chapter/sub-chapter"; our "context" ≈ book "model". **We have no swimlane (stream/capability) axis** — a canonical, first-class concept we're missing.
- **Naming conflict (sharp).** We decided names are **globally unique** (`../model-structure.md`). The book says names are **per-context** (same word means different things in different bounded contexts). Direct conflict — needs a decision.
- **One-big-graph vs many-small-models.** Our design = one structured graph, scoped/queried subviews (`../navigation-and-scoping.md`). Book = many small models on a board, linked. Different organizing philosophy.
- **Typed slices vs freeform buckets.** Book slice = exactly one of 4 patterns. Our slice = freeform bucket of placed entities (`../model-structure.md`). We chose flexibility; book chose constraint (and constraint is the book's stated value).
- **Inline branching.** Book forbids it (alt flows = separate linked models). Our scoping/graph model could allow richer connection — decide whether to follow the book's "good case first, errors elsewhere" discipline.
