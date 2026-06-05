# Open Questions — Backlog

Consolidated, reviewable list of everything still undecided across the notes. Each item links to its **home note**, which holds the full context — the home note is the source of truth if this list drifts. Grouped by theme. ⭐ = author-flagged "needs research" item.

_Last reconciled: 2026-06-05._

## Identity & naming

- **Linking UX** — how does a user mark "this note is the same entity as that one"? Pick-existing / autocomplete / drag-link. (`model-structure.md`)
- **Duplicate-name enforcement** — block duplicates outright, or warn + offer to link to the existing entity? (`model-structure.md`)
- ⭐ **Context-prefix naming** — confirm the `Context_FactName` prefixing scheme (auto-prepend, configurable) against how real bounded-context implementations work. (`model-structure.md`)
- **Business fact vs canonical "event"** — keep our dialect, or canonical terms with "business fact" as framing? Open tension. (`terminology.md`)
- **Translation / External Event** — do these adopt our naming dialect too? (`terminology.md`)

## Hierarchy & structure

- **Flow nesting** — do flows nest (sub-flows), or strictly slice → flow → feature → context? (`model-structure.md`)
- ⭐ **Swimlanes** — adopt the canonical swimlane (stream/capability) axis; how does it integrate with our box/graph layout + hierarchy? Toggleable to what extent? (`model-structure.md`, `reference/organizing-large-models.md`)
- **Wireframe reuse** — default behavior + who decides reuse-vs-unique (user vs app heuristic)? (`model-structure.md`)

## Layout & navigation

- **Box ordering** when tiling slices — flow sequence / timeline / user-arranged? (`layout-and-rendering.md`)
- **Visual nesting** — do flow/context boxes nest visually (box-in-box), or is nesting only navigational? (`layout-and-rendering.md`)
- ⭐ **Many-small-models vs one dynamic graph** — research the book's reasoning; can our queryable graph render flows dynamically instead of manual model-splitting? (`navigation-and-scoping.md`)

## Business rules (GWT/GT)

- **GWT editing home** — purely catalog-level (slices are views), or a canonical home? (`gwt.md`)
- **Condition/value expression** — GIVEN value-conditions + WHEN command-values as free text vs structured predicates? Determines later checkability/executability. (`gwt.md`, `layers.md`)
- **Orphan GWTs** — if a GWT's referenced entities are never co-present in one slice, where does it surface so it's not invisible? (`gwt.md`)

## Layers, status & validation

- **Layer scope** — global toggles vs per-element / per-scope? Fixed set vs user-definable layers? (`layers.md`)
- **Completion status** — fixed values (verified/complete/implemented) vs customizable? Per-element only or per-slice/flow roll-up? Does "implemented" tie to AI builds? (`process-and-collaboration.md`)
- **Completeness check** — on-demand vs continuous/live? Granularity (field-level/type-aware vs presence)? Surfacing (canvas markers / report / punch-list)? (`validation.md`)
- **Cycle guard** — traversals + completeness walk must not infinite-loop on graph cycles. (`validation.md`, `navigation-and-scoping.md`)

## Deferred capabilities (whole topics, design later)

- **Translation + External Events** — confirmed in-scope; full design TBD (4th pattern, anti-corruption, versioned public-API boundary). (`core-flow.md`, `reference/element-types.md`)
- **AI access** — model export (JSON/YAML) + eventual MCP server; explicitly deferred, needs its own deep session. (`ai-participation.md`)

## Research TODOs (good agent fodder for next session)

1. ⭐ Swimlanes — deep dive into the concept + how it maps to our structure.
2. ⭐ Why "many small models" — the book's reasoning, vs our one-graph dynamic approach.
3. ⭐ Context-prefix naming across real bounded-context implementations.
