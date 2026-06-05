# The Scale Problem (core justification)

Why this tool must be more than "a whiteboard with event-modeling templates". Scale is the defining constraint that drives most other requirements.

## Not just a templated whiteboard

> [decision 2026-06-05]

The product is explicitly **not** "Miro/FigJam + event-modeling sticky-note templates". A regular freeform whiteboard does not survive real-world scale. The tool must be something more comprehensive, purpose-built for large models.

## Expected scale (order-of-magnitude)

> [context 2026-06-05]

Real systems, not toy apps. Working estimates the author uses to size the problem:

- ~**15 bounded contexts**.
- ~**50–60 events** per bounded context.
- ~**40 slices** per context, where each slice ≈ an interface + command + event + additional logic.

Plus GWTs (Given-When-Then) and other business logic attached, plus **arrows connecting elements** — including unavoidable **cross-context crosstalk**.

## Why a flat whiteboard breaks

> [context 2026-06-05]

At that scale a single flat canvas becomes:

- Endless horizontal scrolling (left/right) to navigate.
- A tangle of connecting arrows, made worse by cross-context references.
- "A very gigantic mess very, very quickly."

So: comprehension and navigation at scale is the central design problem. See `navigation-and-scoping.md` (how to tame it), `layers.md` (detail management), `model-structure.md` (structural grouping + entity identity).
