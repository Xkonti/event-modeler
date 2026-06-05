# Layout & Rendering

How elements get positioned on the canvas. Solves the auto-layout tension raised earlier (query-a-subgraph vs deliberate timeline placement).

## Slice = box (the layout primitive)

> [decision 2026-06-05]

Each **slice is a box**. Inside the box, its sticky notes (read models, wireframe, command, business fact, GWT, …) are arranged **the normal event-modeling way** and stay arranged that way. The internal layout is stable and hand-meaningful.

Showing more slices = **more boxes placed left/right** of each other. Because internal arrangement is preserved per-box, there is **no large global layout problem** — the hard layout is contained inside each box, and boxes just tile horizontally.

## Arrows between slices

> [speculation 2026-06-05]

Connections between slices (and between boxes) can be **auto-connected / auto-routed**. Not considered a hard problem — expected to stay "relatively readable". Precise routing decided during build.

## Read models & boundary arrows

> [decision 2026-06-05]

A read model is typically **placed in a slice** as the **input to that slice's wireframe** (the same read model instance can also be placed in other slices — slices reference, don't own; see `model-structure.md`). Slices stack; when a **business fact** displayed in one on-screen slice feeds a read model in another on-screen slice, draw an **arrow** between them. If the feeding slice isn't on screen, no arrow — fine.

Read models rarely draw from a single source — they usually aggregate from **multiple** business facts — so a read model rarely has just one incoming arrow. **Which arrows render depends on which slices are currently displayed.**

Where two identical read models would meet at a slice boundary, the frontend can **collapse** them into one. Presentation detail, not a hard problem.

## Why this resolves the tension

The earlier worry: on-demand subgraph rendering would force full auto-layout, fighting event modeling's deliberate left→right timeline. The box model sidesteps it — deliberate layout lives *inside* boxes (authored once), and *between* boxes the layout is simple tiling + auto arrows. Best of both.

## Open questions

> [open question 2026-06-05]

- Box ordering when tiling slices — by flow sequence? timeline? user-arranged?
- Do boxes for flows/contexts nest visually (box-in-box), or is nesting only navigational?
