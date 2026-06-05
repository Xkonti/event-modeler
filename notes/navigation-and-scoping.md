# Navigation & Scoping

How the tool stays comprehensible at scale (see `scale-problem.md`). Core idea: **choose a scope, see everything inside it; filtering and impact-tracing are exceptional tools, not the default.**

## Default: show everything within a scope

> [decision 2026-06-05]

The default is **not** a sparse/filtered view. You pick a scope and the tool shows everything in it, all layers on. Turning elements or layers **off** is reserved for specific situations (impact analysis, untangling cross-scope connections, focused deep-dives) — see `layers.md`.

## Zoom levels (the hierarchy as a dial)

> [decision 2026-06-05]

Scope = a level in the model hierarchy (`model-structure.md`). User can land at any altitude:

- **Whole model** — when you need the full picture.
- **Context** — e.g. "budgeting".
- **Flow** — e.g. "preparing the next budget year".
- **A few slices** — zoom right in on 2–3 slices to dive deep / anchor a conversation.

## On-demand expansion

> [speculation 2026-06-05]

Within or beyond the current scope, the user can **bring additional nodes in** as the conversation widens. Reframes the canvas from "draw everything up front" to "render the chosen scope, pull in more as needed". The model is structured data; the canvas is a rendered view of a chosen subgraph.

## "Show where used" — preview mechanism

> [speculation 2026-06-05]

Key feature, enabled by entity identity (`model-structure.md`). Example: focus a read model, preview everywhere it's used.

Likely mechanism (whiteboard/graph, so use it):

- Render **grayed-out, temporary, auto-laid-out** sticky notes pointing outward — "this points to that slice", "this feeds that one".
- Each such note offers actions: **pull that slice into view**, **travel to it**, or **view as a plain list**.
- Expected to be **lightweight** — may well end up as just a list of slices. Exact presentation decided later, during build.

Same pattern serves "show all events that contribute into this read model", etc. Navigation is graph-query-driven: pick an element → traverse relationships → surface the neighborhood without rendering the whole model.

> [context 2026-06-05] The model graph has **cycles** (fact → read model → automation → command → fact, see `core-flow.md`). Any traversal — "where used", "contributing events", or the completeness walk (`validation.md`) — must **guard against infinite loops**.

## Open: many-small-models (book) vs one dynamic graph (ours)

> [open question 2026-06-05]

The book organizes large systems as **many small models on a board**, with alt/error flows as separate **linked** models — likely partly a **workaround for unstructured boards** (Miro: no querying, no identity). Our structured, queryable graph may instead present those same flows **dynamically** from one model (scoped views), without manual model-splitting. Author wants to research the book's reasoning before deciding. Guiding lens: `design-principles.md` (essential practice vs medium workaround). See `reference/organizing-large-models.md`.
