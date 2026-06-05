# Modeling Process & Collaboration

How teams actually build the model over time — the phased, progressive workflow and who's involved at each stage. Informs tool features (focus modes, status tracking); complements the usage mode in `vision.md`.

> [reference 2026-06-05] Strongly matches canonical event modeling — see `reference/event-modeling-process.md` (brainstorm → order → wireframe → backwards-derive → completeness check → slice → GWT → structure → implement; the large→small group-size shift; planning ≈ 60–70% of effort; park blockers with a red sticky).

## Progressive, step-by-step modeling

> [decision 2026-06-05]

Event modeling is done **iteratively**, not all-at-once. A typical order:

1. Brainstorm the **business facts** likely present in the system.
2. Refine them — dedupe, rename, settle the set.
3. Add **wireframes**, **commands**, **read models** in between → a picture of how the system works and how information transfers.
4. *Later*, a focused pass over the **data / fields layer** — the specific fields held in commands, facts, read models.
5. **Verify** completeness (backward walk, `validation.md`) — by humans/AI, once data exists.

Implication: the model is **valuable before fields are filled in**. Field/data definition is a deliberate later stage, **not a precondition**.

## Collaboration shifts by phase

> [decision 2026-06-05]

Group composition changes with the phase (extends `vision.md`'s live screen-shared sessions):

- **Structural modeling** — larger group (product, customers, designers, devs, decision-makers) building the shared picture.
- **Data/fields + verification pass** — a **smaller, focused group** (e.g. a dev or two + a product person) going over fields and walking completeness. Too detailed/technical for the whole room.

## Don't over-automate verification

> [decision 2026-06-05]

The data/field definitions are often **vague** — a human or AI reading them infers "this links to that", but a strict programmatic checker would struggle. So verification is **human/AI-assisted**, tool-**supported** (surface the chain, hold the data), **not** a fully-automated pass/fail gate. (See `validation.md`.)

## Completion / verification status tracking

> [decision 2026-06-05]

A feature to track progress over the model — **yet another data layer**, toggleable, kept off to avoid clutter (also listed in `layers.md`):

- **Lock / mark** an element's shape as *verified*, *complete*, or *implemented*.
- New elements start **unmarked** (not complete).
- Lets the team see **what's been checked**, what's locked, and **which parts still need discussion**.
- Disabled easily to keep focus on the **pure model** (no fields/flags/checkbox clutter).

## Open questions

> [open question 2026-06-05]

- Status values — fixed set (*verified* / *complete* / *implemented*) or customizable?
- Is status per-element only, or also per-slice / per-flow (roll-up of completion)?
- Does "implemented" tie back to `ai-participation.md` (AI marking what it has generated/built)?
