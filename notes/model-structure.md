# Model Structure (building blocks & grouping)

The structural concepts the tool represents, and how they nest/group. This is the data backbone that makes scoping (`navigation-and-scoping.md`) and layers (`layers.md`) possible.

## Hierarchy of grouping

> [decision 2026-06-05]

A clear nesting, smallest → largest. This hierarchy is the axis the user zooms along (see `navigation-and-scoping.md`).

- **Sticky note** — smallest unit. Several types (read model, wireframe, automation, command, business fact, GWT, …).
- **Slice** — a set of sticky notes forming one step of behavior (anatomy below). Main unit of work (~40 per context).
- **Flow** — a set of slices telling a story / user flow with business meaning. Named (e.g. "preparing the next budget year").
- **Feature** — a set of flows.
- **Context** — larger grouping within the domain, named (e.g. "budgeting"). ~15 at top level.
- **Whole model / domain** — everything.

Nesting: sticky note → slice → flow → feature → context → domain.

> [open question 2026-06-05] **Book divergence (hierarchy).** Canonical EM groups as Slice → (Sub-)Chapter → Model → Board, **plus an orthogonal `swimlane` axis** (event-stream / business-capability / aggregate) we don't have, plus bounded-context overlays. Our flow/feature ≈ chapter/sub-chapter; our context ≈ model. See `reference/organizing-large-models.md`.
>
> [decision 2026-06-05] **Leaning: adopt swimlanes** as a concept (likely tied to context / capability), **toggleable on/off to varying extent**. Author needs to research swimlanes more before pinning how they integrate with our box/graph layout and the existing hierarchy. Terminology alignment TBD.

**Re: "aggregate"** — earlier loose use of "aggregate" refers to *implementation* concerns (DDD / event-sourcing aggregates), **not** the modeling hierarchy. For modeling we use the named hierarchy above. _[decision 2026-06-05]_

## Slice: a bucket of placed entities

> [decision 2026-06-05]

A slice has **no fixed shape**. It's a **bucket / container** in which the user arranges entities meaningfully — it does **not** contain the *definitions* of those entities. Entities (read models, wireframes, automations, commands, business facts) are **separate concepts with their own identity**; a slice merely **references** them and records **where they sit** within it.

**What a slice holds (data model):**

- a **list of entity references** placed in it,
- each with a **position** within the slice,
- arrows are generally **not stored** — drawn **automatically** from the entities' defined relations (see below).

The same entity instance can appear in **many slices** (see "Identity & reuse"). A read model / command / fact is **not "owned" by one slice**; it's placed wherever relevant.

**Usual contents (a pattern, not a rule):** a slice is usually driven by either a **wireframe** (UI) *or* an **automation** (no UI — processor / AI / agent trigger), usually has **at least one command**, and usually **at least one business fact**. The **user decides** what actually goes in. This is why automation slices don't "break" anything — there was never a *required* wireframe.

Common left→right arrangement when UI-driven: `read model → wireframe → (action) → command → business fact`. Automation-driven swaps the wireframe for an automation trigger.

> [decision 2026-06-05] **Slice typing — freeform creation, optional pattern-typing later.** Slices are created **organically**: a slice often starts as a loose pile of facts, then gets **split into smaller slices as boundaries are discovered** (mostly humans, piece by piece, especially early). The tool must **support gradual boundary discovery** and never force a pattern up front. Agreed each *finished* slice will usually settle into one of the 4 patterns. **Optional, future** functionality may recognize a slice's pattern → offer suggestions / enforce rules — additive, **never blocking**. See `design-principles.md` ("don't block organic work"), `reference/element-types.md`.

## Relations are model-level, not slice-level

> [decision 2026-06-05]

Relationships between entities (command **produces** fact, fact **feeds** read model, …) are defined on the **entities / model**, independent of any slice and of layout. Canvas arrows are **auto-rendered projections** of these relations — which is why slices don't store arrows, and why "where used" / "contributing events" queries work (`navigation-and-scoping.md`).

**How relations are authored.** _[decision 2026-06-05]_ The user **draws an arrow** between two elements on the slice — that drawing **is** the relation (it creates the relation at model level). If the relation already exists in the catalog, the arrow **draws itself** automatically whenever both elements are shown. Arrows are only valid between **sensible type pairs** (e.g. command → business fact ✓; command → read model ✗). **No smart suggestions / inference for now** — it's a plain tiny whiteboard; smarts may come later once the product is usable. Note: drawing an arrow authors a *relation*; element **position** within a slice stays purely visual.

**Relations are the structural source of truth (vs GWTs).** _[decision 2026-06-05]_ Explicit relations — not GWTs — are authoritative for the model's structure. The full relation set + behavioral cycle live in `core-flow.md`. Valid type-pairs:

- read model → wireframe (read by / displayed by)
- read model → automation (monitored by)
- wireframe → command (action issues) — **confirmed**
- automation → command (reaction issues)
- command → business fact (produces, on acceptance)
- business fact → read model (feeds)

**GWTs/GTs are second-class** — a commentary layer that *references* relations but never defines them, and can drift out of sync and get flagged. See `gwt.md`.

> Two different "source of truth" layers — don't conflate: **relations** = truth of the model graph (here); **business facts** = truth of the modeled system's *state* (`core-flow.md`).

## Identity & reuse

> [decision 2026-06-05]

An element is a **stable identity** that can appear in many slices/contexts. Two sticky notes representing the same entity are the same thing no matter which slice they sit in — elements are identities, not drawings.

**Name vs identity.** The **name is a human-facing handle**, not the identity key itself. The user uses the name to express intent ("this is the same `BudgetYearDefined`"), but internally the link is via a **stable ID (likely a GUID)**, not string matching. So:

- Sameness is an **explicit link to one underlying entity**, not an automatic merge of matching strings.
- **Renames are safe** — references point at the ID, so renaming the entity updates everywhere without breaking links.

**Names are globally unique across the whole model.** _[decision 2026-06-05]_ No per-context scoping — a name resolves to exactly one entity model-wide. Because identity is ID-based, a unique name then maps 1:1 to one ID, so the handle is always unambiguous. (This is why scoping/namespacing isn't needed: uniqueness is enforced, and good naming makes it natural — see below.)

> [speculation 2026-06-05] GUID-as-internal-id is the leaning, not locked ("we'll see"). The principle (name = handle, identity = stable ref) is the decision; the exact mechanism is open.

This applies to **all** element types, not just read models:

- **Commands** — the same command can be issued from multiple sources. A wireframe is only one UI; the system may also be driven by **automations or AI agents**. A UI button, an automation, and an AI agent can all submit the *same* command. Multiple views in the app can also map to one command. Two command notes with the same name = one command, living across many slices.
- **Business facts** — different commands can produce the *same* business fact. Example: `Budget Year Defined` is produced both by a manual "create new budget year" command **and** by the automated "prepare next budget year" process (a multi-step automation that, among other things, creates the next budget year and links it to the previous one). Same fact, multiple, loosely-related producers.
- **Read models** — shared; typically aggregate from **multiple** sources (see `layout-and-rendering.md`).
- **Wireframes** — *can* be shared too, but it's a **choice** (see below).

> Earlier guess that wireframes/commands are slice-local while only facts/read-models are shared was **wrong**. Any type can be reused by name.

Because any element can appear in many slices/contexts, the model is a **graph**, with the hierarchy (`model-structure` levels) as a navigational overlay — **not a strict tree**.

Identity is what powers "show where used" / "show contributing events" (`navigation-and-scoping.md`) and safe impact reasoning. It's the payoff of event modeling / sourcing: small, well-surfaced concepts that compose and reuse cleanly.

## Naming convention

> [decision 2026-06-05]

Names must be **specific and domain-meaningful**, qualified by their context — not generic. Global uniqueness (above) falls out naturally from good naming.

- **Generic / CRUD-like names are discouraged** — never just `Created`, `Updated`, `Deleted`. Too generic, too CRUD, carries no business meaning. (`Created` especially called out as bad.)
- Business facts read as **past-tense domain truths**. Examples: `BudgetLineRecorded`, `BudgetLineAmended`, `UserRegistered`, `UserSuspended`, `UserPermissionGranted`, `StaffHiringProcessInitialized`.

The discipline is part of the value: forcing meaningful names is what makes the model speak the shared business language (`vision.md`).

> [decision 2026-06-05] **Naming — reconciled via context prefixing** (leaning; pending implementation research). Names are **prefixed per bounded context** → `Payments_OrderCreated` vs `Orders_OrderCreated`. This keeps names **globally unique** (our decision survives) *and* honors per-context meaning (the book's point). Prefix likely **auto-prepended** from the element's context, and **configurable** (toggle / format). Open: author wants to see how this plays out across real implementations of different bounded contexts before locking it. See `reference/organizing-large-models.md`.

## Wireframe reuse (a choice)

> [open question 2026-06-05]

Common case: one wireframe with different buttons across parts of the system. Two options, settable **per case** by the user (or the app):

- **Reuse** one wireframe, shared and updated in place, or
- **Unique** wireframe per part of the system.

Not fixed — must be a deliberate, settable choice. (Open: what's the default, and who decides — user vs app heuristic?)

## Data-model spine

> [decision 2026-06-05] Author confirmed the entity catalog as the spine.

The decisions above form a three-part data model:

1. **Entity catalog** — the authoritative set of entities (read models, wireframes, automations, commands, business facts), each with stable ID, unique name, and its **own definition** (e.g. a fact's fields live here).
2. **Relations** — model-level links between entities (command *produces* fact, fact *feeds* read model). Independent of slices/layout.
3. **Slice placements** — slices reference entities and store **per-slice positions** (and grouping into flows/features/contexts).

The canvas is a **projection** of (1)+(2) filtered/arranged by (3). Consequence: a fact's fields are defined once on the entity, so all producers share an identical schema (answers the "same fact name → same fields?" question: **yes, by construction**).

## Cross-context crosstalk

> [context 2026-06-05]

References **between** bounded contexts are expected and unavoidable. The tool must represent cross-context relationships as a normal case — not an exception — without turning the view into a mess (ties back to `scale-problem.md`).

## Open questions

> [open question 2026-06-05]

- Do flows nest (sub-flows), or is it strictly slice → flow → feature → context?
- **Linking UX**: how does the user mark "this note is the same entity as that one" — pick from existing / autocomplete by name / drag-link? (Now that identity is ID-based + names are unique, sameness must be an explicit gesture, likely "reference existing by name".)
- (Same display name on two *different* identities — **resolved: not allowed**, names are globally unique.)
- Enforcement on rename/create: block duplicate names outright, or warn + offer to link to the existing entity?
- (Multi-parent membership — slice in two flows, entity in two contexts — is **resolved: yes**, the model is a graph. See "Identity & reuse".)
