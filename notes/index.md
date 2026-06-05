# Notes Index

AI-managed knowledge base for this project (a structured whiteboard for **event modeling**). Describes the current organization of `notes/`. Read this first; it mirrors the real files.

Status legend used inline in notes: `[decision]`, `[motivation]`, `[context]`, `[speculation]`, `[open question]`, `[reference]`.

## Vision & rationale

- `vision.md` — purpose: structured whiteboard for event modeling; why (brings roles together); primary usage mode (live screen-shared focused sessions); model as the **project's source of truth / spec**; relationship to event sourcing; scale constraint.
- `scale-problem.md` — the core justification: why a flat templated whiteboard fails at scale (≈15 contexts × 50–60 events × ~40 slices; crosstalk; the "gigantic mess").
- `terminology.md` — domain language: the **"business fact" vs "event"** decision + rationale; open tension on diverging from canonical vocab; canonical vocabulary + the Translation/External-Event gaps.
- `design-principles.md` — cross-cutting guides: **essential EM practice vs whiteboard-medium (Miro) workarounds**; **don't block organic work** (gradual structure discovery, never gate the user).
- `ai-participation.md` — model as complete role/tech-agnostic spec; **AI as first-class participant** (cares about structure, not layout); deferred access (JSON/YAML export, MCP).

## Model backbone (the data model)

- `model-structure.md` — building blocks & grouping: **hierarchy** (sticky → slice → flow → feature → context → domain); **slice = bucket of placed entity references** (freeform; pattern-typing optional/later); **identity** (stable ID; globally-unique names via context prefixing); **naming convention**; **relations as structural source of truth**; the confirmed **data-model spine** (catalog + relations + placements); cross-context crosstalk.
- `core-flow.md` — behavioral spine: element roles, the **canonical cycle** (wireframe/automation → command → business fact → read model → …), principles (**command is the only way to change state**; **facts = state source of truth**), automation triggering; decision to **model Translation + External Events**.
- `gwt.md` — **business rules**: GWT (anchored on a command; GIVEN/WHEN/THEN → emit/reject/error-fact); **GT** = read-model projection spec (no When); auto-surface by reference; second-class vs explicit relations (out-of-sync flagging).
- `validation.md` — **model integrity**: the backward **completeness walk** (= the book's Information Completeness Check), human/AI-assisted not auto-gated; GWT-sync check; cycle-guard.

## Viewing at scale (UX & rendering)

- `navigation-and-scoping.md` — default show-all-in-scope; zoom levels; on-demand expansion; **"show where used"** preview; the many-small-models vs one-graph open question.
- `layout-and-rendering.md` — layout primitive: **slice = box**, internal arrangement preserved, boxes tile left/right, auto arrows, conditional boundary arrows.
- `layers.md` — toggleable detail planes (base flow / fields / design / GWT / completion-status); default all-on; toggling off is exceptional.

## Process

- `process-and-collaboration.md` — how teams build the model: progressive order (facts → refine → wireframes/commands/read-models → fields → verify), phase-dependent group size, don't-over-automate, completion/verification status tracking.

## Backlog

- `open-questions.md` — consolidated, reviewable list of all undecided items, grouped by theme, linking to home notes. Includes the author's **research TODOs**.

## Reference (`reference/`) — canonical event modeling from the source book

Distilled from *Event Modeling and Event Sourcing* (Dilger / Dymitruk) via 5 research agents. Describes the method **as the book defines it** (what our tool supports); divergences from our design flagged inline + in the design notes.

- `reference/source.md` — the book, local path, how these were produced, caveats.
- `reference/element-types.md` — the **4 patterns** + element defs (event, command, wireframe, read model, automation, translation) + colors; our missing Translation/External-Events.
- `reference/gwt-and-gt.md` — GWT vs GT precise structure + decision rule; example data → tests. (Source of our GT resolution.)
- `reference/event-modeling-process.md` — end-to-end process, participation by phase, Information Completeness Check, notation.
- `reference/benefits-vs-traditional.md` — benefits + contrast with prose/UML/layered approaches.
- `reference/organizing-large-models.md` — swimlanes, chapters/models/boards, bounded contexts, DCB, LOD views. Biggest divergences + the naming reconciliation.

## Conventions

- Capture author thoughts, speculations, open questions as they surface; mark status inline.
- `open-questions.md` aggregates open items; home notes remain the source of truth.
- Refactor structure freely (split/combine/move) and keep this index in sync.
