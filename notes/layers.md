# Layers (toggleable detail planes)

A way to manage detail density: information lives in **layers** that can be toggled on/off, so the user sees only the altitude of detail relevant to the current conversation. Distinct from *scoping* (which elements) — layers control *how much detail* about those elements.

> [speculation 2026-06-05]

## Layer examples raised so far

- **Base modeling layer**: the core flow — business facts, commands, read models, wireframes. The default "what happens" view.
- **Field/schema layer**: the actual **fields** for events and commands. Toggle on when you need structural detail, off when you don't. (Filled in a later, focused modeling pass — see `process-and-collaboration.md` — not required up front.)
- **Design layer** (for UI designers): their own plane collecting design details, links, etc. Toggleable independently.
- **GWT layer**: Given-When-Then and other business logic. Captured **below the main element** (think a strip of sticky notes underneath a slice), possibly as **text content** rather than purely visual notes, to keep it simpler. Full structure + behavior in `gwt.md` (GWTs auto-surface by reference, not manual placement).
- **Completion / verification layer**: per-element status flags — *verified*, *complete*, *implemented*. New elements start **unmarked**. Lets a team track what's been reviewed, what's locked, and which parts still need discussion. Pure clutter for modeling → easily toggled off. See `process-and-collaboration.md`.

## Default: all relevant layers on

> [decision 2026-06-05]

Within a chosen scope the default is to **show everything** — all layers on. Toggling layers **off** is the exception, used only in specific situations (e.g. impact analysis, reducing noise during a focused deep-dive). Layers are a noise-reduction tool, not the normal viewing mode.

## Intent

Different roles care about different layers (designer vs developer vs product). Layering lets one model serve all of them without overwhelming any single view — supports the "brings roles together" vision (`vision.md`) at scale.

## Open questions

> [open question 2026-06-05]

- Are layers global toggles, or per-element / per-scope?
- Fixed set of layers vs user-definable layers?
- How do GWTs-as-text relate to a future need to make them executable/checkable? (Just flagging; not discussed yet.)
