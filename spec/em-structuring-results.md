# Event Modeling — Structuring Results

> Phase 6 (Structuring) for the **event-modeler** app — the final modeling phase. It adds no
> new facts/commands/rules; it **organizes** what Phases 1–5 produced into a readable story and,
> per the user's directive, **divides the model into focusable implementation chunks** so the
> build can proceed one small piece at a time.
>
> Session date: 2026-06-08. Autonomous. Inputs: `spec/em-brainstorm`, `em-wireframes`,
> `em-commands`, `em-automations`, `em-scenarios`. The structuring **conventions** (swimlanes,
> chapters, links, legend) are flexible practitioner extensions — the **fixed** core is the four
> patterns + GWT. Decision this phase: **catalog = one ES vertical per type** (user, 2026-06-08).

## Recursion note

We are structuring the **event-modeler itself**. A happy coincidence falls out of the recursion:
the **capability swimlanes = the aggregate streams = the implementation verticals**. Grouping the
model for readability and grouping it for the build are, here, the **same partition**. So this
phase doubles as the build plan.

---

## The three bounded contexts → three models

The brainstorm's three contexts each become their own **model** (pink context sticky on the left
edge). One business context per model — the rule, not the exception.

| Model (context) | Holds | Status |
|---|---|---|
| **Modeling** | the model artifact + every entity (catalog, context, slice, relation, scenario, group) | the heart — built across many chunks below |
| **Identity / Access** | accounts, sessions, crypto-shred | **already built** (better-auth + ES adapter) |
| **Publishing / Sync** | Import, Export, Publish-to-GitHub (the integration edge) | **later-stage** |

**Modeling** is too wide to read as one timeline, so it is sub-divided into **aggregate
verticals** (below) — each an *area of interest* (DDD) with a real business name, i.e. a clean
aggregate boundary.

---

# Implementation chunking — the overall groups + build order  ★ the deliverable

Each chunk = **one event-sourced vertical** (events → decider → command handlers → api →
projection) — the es-book "Vertical Slicing" unit, ~a focusable work-package. **Its Phase-5 GWT/GT
scenarios become its tests.** Chunks are ordered so each only depends on already-built chunks.

## Dependency graph (build top-to-bottom)

```
                    ┌─────────────────────────────────────────┐
   FOUNDATION       │ F0  ES core + model root                 │  modelId(F1), event log,
                    │     (model aggregate, models RM,          │  projection substrate,
                    │      inline-constraint pattern)           │  entity_names(F1b)
                    └─────────────────────────────────────────┘
                                     │ everything depends on F0
       ┌──────────────┬─────────────┼─────────────┬──────────────┐
   CATALOG        │              │             │              │
   (7 verticals,  ▼              ▼             ▼              ▼
   one per type;  E1 businessFact   E2 command   E3 readModel   E4 wireframe   ← same shape
   all project →  E5 externalBusinessFact (yellow)                            ← same shape, +lane
   shared          │   (E6 automation · E7 translation built later — they REFERENCE E2/E3/E5)
   entity_catalog) │
                   ▼
   STREAMS      X1 context + lane assignment  (needs facts: E1, E5)
                   │
   GRAPH        R1 relations  (needs catalog endpoints)  ──┐
                   │                                        │
   COMPOSE      S1 slice + placement (needs entity types) │
                   │                                        │
                   ▼                                        ▼
   RULES        V1 scenarios (GWT/GT; soft refs)     S2 slice_canvas RM (joins S1⋈catalog⋈R1⋈V1)
                   │
   DIVERGENT    E6 automation · E7 translation  (catalog verticals, built once E2/E3/E5 exist)
                   │
   REACT        A1 archive-cascade automation (needs S1 placements + R1 relations)   [E4 decision]
                   │
   ANALYZE      A2 validation + where-used (read-only, cycle-guarded; needs read models)
                   │
   LATER        G1 grouping/hierarchy        P1 publishing/sync (Import/Export/Publish — whole model)
```

## Chunk catalog

| # | Chunk | Owns (commands → facts) | Read model(s) | Depends on | v1? |
|---|---|---|---|---|---|
| **F0** | ES core + model root | `CreateModel/RenameModel/ArchiveModel` | `models` | — | ✅ core |
| **E1** | businessFact vertical *(template type)* | `DefineBusinessFact/Rename/UpdateFields/Archive` | → `entity_catalog` | F0 | ✅ core |
| **E2** | command vertical | `DefineCommand/Rename/UpdateFields/Archive` | → `entity_catalog` | F0 | ✅ core |
| **E3** | readModel vertical | `DefineReadModel/Rename/UpdateFields/Archive` | → `entity_catalog` | F0 | ✅ core |
| **E4** | wireframe vertical | `DefineWireframe/Rename/UpdateContent/Archive` | → `entity_catalog` | F0 | ✅ core |
| **E5** | externalBusinessFact vertical *(yellow)* | `DefineExternalBusinessFact/Rename/UpdateFields/Archive` | → `entity_catalog` | F0 | ✅ core |
| **E6** | automation vertical *(divergent)* | `DefineAutomation/Rename/Reconfigure/Archive` | → `entity_catalog` | F0, E3, E2 | ✅ core |
| **E7** | translation vertical *(divergent)* | `DefineTranslation/Rename/UpdateMapping/Archive` | → `entity_catalog` | F0, E5, E2 | ✅ core |
| **X1** | context + lane assignment | `DefineContext/Rename/Archive`, `AssignBusinessFactToContext/Clear` | `contexts` (+ `entity_catalog.contextId`) | F0, E1, E5 | ✅ core |
| **R1** | relations | `DrawRelation/UpdateRelationInfo/RemoveRelation` | `relations_graph` | F0, catalog | ✅ core |
| **S1** | slice + placement | `DefineSlice/Rename/Archive`, `PlaceEntity/SwapEntitySlots/RemoveEntityFromSlice` | (feeds S2) | F0, catalog | ✅ core |
| **S2** | slice_canvas (the money RM) | — (read model only) | `slice_canvas` | S1, entity_catalog, R1, V1 | ✅ core |
| **V1** | scenarios (GWT/GT) | `DefineScenario/UpdateScenario/ArchiveScenario` | `scenarios` (F6 indexed) | F0, E1/E2/E3/E6 (soft) | ✅ core |
| **A1** | entity archive cascade *(automation)* | issues `RemoveEntityFromSlice`/`RemoveRelation` (fan-out) | — | E1–E7, S1, R1 | ✅ core (E4) |
| **A2** | validation + where-used *(analysis)* | — | `model_validation` (+ neighborhood) | read models | ◑ v1 on-demand |
| **G1** | grouping / hierarchy | `ConfigureGroupingHierarchy`, `CreateGroup/…`, `AssignSliceToGroup/…`, `NestGroupUnderParent/…` | `groups` | F0, S1 | ⏳ later |
| **P1** | publishing / sync | `ImportModel`, `ExportModel`(query), `PublishModel` | `model_export`, `publish_diff` | whole model | ⏳ later |
| **AUTH** | identity / access | `Register/VerifyEmail/LogIn/LogOut/DeleteAccount` | `session`/`user` | — (own context) | 🔒 built |
| **AI** | MCP participation | *(reuses every command above)* | reads AI-semantic export | P1 (export), all commands | ⏳ later |

**Shared cross-type components** (not a vertical — infrastructure the 7 catalog chunks share):
- `entity_catalog` **projection** — fed by all 7 type streams (F5: carries `definition` + `contextId`).
  Each vertical contributes its projector slice; the read-model shape is shared.
- `entity_names` **inline constraint** (F1b) — the `(modelId, normalized_name)` uniqueness index,
  written in every catalog vertical's append tx. One mechanism, used by all 7.

## Recommended build order (each step only needs earlier ones)

1. **F0** — foundation (model root, event log, projection substrate, inline-constraint pattern).
   *(AUTH is already built and runs in parallel.)*
2. **E1 businessFact** — the **template** vertical; nail the generic Define/Rename/UpdateFields/
   Archive shape + the `entity_catalog` projector + `entity_names` constraint here, once.
3. **E2 command · E3 readModel · E4 wireframe · E5 externalBusinessFact** — replicate E1's shape
   (E4 swaps UpdateFields→UpdateContent; E5 adds the yellow rendering). Parallelizable.
4. **X1 context + lanes** — needs facts (E1/E5) to assign; owns the *only-facts-laned* rule.
5. **R1 relations** — needs catalog endpoints; owns the 11-pair table + stored kind (F4) + dup-reject (E3).
6. **S1 slice + placement** — needs entity types to place; owns the slot model (F3).
7. **V1 scenarios** — soft GUID refs; owns auto-surface (F6) + `outOfSync` derivation.
8. **S2 slice_canvas** — the integration read model; assemble once S1+catalog+R1 exist, fold in
   `scenarios` when V1 lands. (Build incrementally as its inputs arrive.)
9. **E6 automation · E7 translation** — the divergent catalog types; built once their referenced
   entities (E3/E2/E5) exist so the trigger/mapping refs resolve.
10. **A1 archive cascade** — needs placements (S1) + relations (R1) to clean.
11. **A2 validation / where-used** — read-only analyses over the now-complete read models.
12. **G1 grouping** *(later)* · **P1 publishing/sync** *(later — serializes the whole model)* ·
    **AI** *(later — MCP transport over the existing command surface)*.

> **Each chunk's Phase-5 scenarios are its acceptance tests.** E.g. E1 is "done" when the
> `DefineBusinessFact` GWTs (happy, dup-name reject, blank reject, archived-name-freed, …) pass.

---

## Swimlanes (Modeling model) — capability = stream = chunk

Facts grouped by capability; **internal (orange) separated from external (yellow)**. In this
self-referential model the lanes coincide with the catalog/aggregate chunks above:

```
── Model        (internal) ─ ModelCreated/Renamed/Archived
── BusinessFact (internal) ─ BusinessFactDefined/Renamed/FieldsUpdated/Archived/AssignedToContext/ContextCleared
── Command      (internal) ─ CommandDefined/…
── ReadModel    (internal) ─ ReadModelDefined/…
── Wireframe    (internal) ─ WireframeDefined/…/ContentUpdated
── Automation   (internal) ─ AutomationDefined/…/Reconfigured
── Translation  (internal) ─ TranslationDefined/…/MappingUpdated
── Context      (internal) ─ ContextDefined/Renamed/Archived
── Slice        (internal) ─ SliceDefined/Renamed/Archived · EntityPlaced/SlotsSwapped/Removed
── Relation     (internal) ─ RelationDrawn/InfoUpdated/Removed
── Scenario     (internal) ─ ScenarioDefined/Updated/Archived
── Group        (internal) ─ Group*/Hierarchy/SliceAssigned/Nested
══ External     (YELLOW)   ═ Model File Provided · External Model Published   ← integration contracts (P1)
```

*Read-one-lane-aloud* check: each lane reads L→R as a coherent sub-story (e.g. BusinessFact:
defined → renamed → fields updated → assigned to a lane → archived). Boundaries hold.

---

## Chapters — the "build a model" story (slices by phase)

The model's own timeline IS the Event Modeling process (recursion). Chapter bands above the
slices, L→R:

```
Modeling › [ Setup | Catalog | Streams | Assembly | Rules | Organize* | Share* ]
            *later-stage
```

| Chapter | Slices | Chunk(s) |
|---|---|---|
| **Setup** | Create Model · (Configure Hierarchy) | F0 (·G1) |
| **Catalog** | Define <type> ×7 · Update fields/content · Rename · Archive | E1–E7 |
| **Streams** | Define Context · Assign / Clear lane | X1 |
| **Assembly** | Create Slice · Place Entity · Swap Slots · Draw Relation | S1, R1, S2 |
| **Rules** | Define GWT / GT · Update / Archive scenario | V1 |
| **Organize** *(later)* | Create/Nest Group · Assign Slice | G1 |
| **Share** *(later)* | Export · Publish · Import | P1 |

---

## Alternative / error flows (lifted off the main timeline)

One flow per timeline — the good case stays linear; failures branch to their own linked models
(marker sticky below the branching slice). The exception/failure-fact choice was made in
em-scenarios; structuring decides only **where the flow lives**:

| Branches from | → Lifted to | Why a model (not a GWT) |
|---|---|---|
| `ImportModel` | **model "Model Import Error"** (`ModelImportFailed` + recovery screen) | a real recovery process (failure fact, em-scenarios) |
| `PublishModel` | **model "Model Publish Error"** (`ModelPublishFailed` + manual retry; todo stays open) | a real recovery process (failure fact) |
| `ArchiveBusinessFact`/`Archive<T>` | **automation "Entity Archive Cascade"** (A1) | a fan-out background flow, not a branch |
| every structural reject (E2) | **stays a GWT** on its slice | too small for its own model (dup name, bad pair, cross-band, …) |

---

## Element links + backlinks

- **Element links — subsumed by ID identity** (brainstorm decision C). "Same element" is automatic
  (entities are referenced by GUID), so there is **no manual element-link concept** to add. The
  shared read models (`entity_catalog`, `slice_canvas`) reused across screens W3/W4/W5/W7 are the
  same identity by construction. *Do not reintroduce a link convention.*
- **Backlinks (dotted, data-only)** — kept where a later fact affects an earlier read model:
  - `ModelPublishedToGitHub` ⇢ `publish_diff` — the publish back-channel (rebaseline the diff).
  - cascade `RelationRemoved`/`<T>Archived` ⇢ `slice_canvas` / `scenarios.outOfSync` — derived
    recompute, doesn't reorder the timeline.

---

## De-collided legend (→ tool feature candidates)

Disambiguate by **shape + position**, not color alone — and in the product, **type the
connectors** (removes every color collision):

- **Element kinds:** orange = business fact · yellow = external/integration fact · blue = command ·
  green = read model · gear = automation · sketch = wireframe · (translation = 4th-pattern node).
- **Annotation stickies:** pink (left of model) = model context name · white (in a scenario) =
  note · red = parked/unresolved.
- **Connectors (typed in the tool):** chapter band *above* · `produces/feeds/issues/…` relations
  (stored kind, F4) · **dotted** = backlink/back-channel · red = missing-data gap (A2 validation) ·
  marker below a slice = alternative-flow link.

These structuring affordances (multi-model navigation, typed links, jump-to-model, same-element-by-
id, de-collided kinds) are exactly the **board features** the product formalizes — feature
candidates, not whiteboard hand-drawing.

---

## Structure log (boundary decisions → status)

| Decision | Disposition |
|---|---|
| 3 bounded contexts → 3 models | **decided** (Modeling / Identity / Publishing-Sync) |
| Catalog granularity | **decided: one vertical per type** (E1–E7) — user 2026-06-08; max isolation, smallest chunks |
| `entity_catalog` projection + `entity_names` constraint | **shared** across the 7 verticals (not a chunk) |
| Modeling sub-division | aggregate verticals = swimlanes = chunks (the recursion alignment) |
| Grouping (G1) + Publishing (P1) + AI | **later-stage** (em-wireframes W9/W10/W11 confirm) |
| A2 validation | **v1 on-demand**, advisory, never gates (em-automations D-validate) |
| Import/Publish failures | **own linked error models** (failure facts) |
| Structural rejections | **GWTs**, not models |
| Element links | **dropped** — subsumed by ID identity (brainstorm C) |
| Backlinks | **kept** for publish back-channel + derived recompute (dotted) |

---

## Open questions (carried — mostly the same as em-scenarios)

These don't block the chunking; resolve as the relevant chunk is built:
1. **S2 `slice_canvas`** is the highest-fan-in chunk (joins 4 sources) — build it **incrementally**
   as S1/R1/V1 land, not in one shot. (build-sequencing note)
2. **E6/E7 vs the generic template** — automation/translation diverge enough that their verticals
   share *shape* but not *payload* with E1; expect ~30% custom (trigger/mapping editors + cross-
   entity ref validation).
3. The **9 em-scenarios open leans** (model-name uniqueness, clear-lane-when-none, context archived
   with facts, publish-zero-changes, group nesting cycle, dup fieldName, GIVEN/WHEN value
   expression, orphan GWT surfacing, A6 claims) — each lands in its owning chunk (F0/X1/V1/G1/P1).
4. **A6 collaboration substrate** (future) — must not be designed out: the inline `entity_claims`
   constraint slots beside `entity_names` in F0; the session attribution bag + collision-merge are
   a post-v1 model. **Keep F0's constraint pattern extensible.**

---

## Status — modeling cycle complete

- **All six phases done.** Brainstorm → Wireframes → Commands → Automations → Scenarios →
  **Structuring**. The model is a readable, navigable set of **three context-scoped models**
  (Modeling / Identity / Publishing-Sync), grouped on the three axes (facts→swimlanes,
  slices→chapters, contexts→models), with error flows isolated and a de-collided legend.
- **The model is now divided into ~18 focusable implementation chunks** with an explicit
  dependency order; each maps to one ES vertical and is tested by its Phase-5 scenarios.
- **v1-core build path:** F0 → E1…E7 → X1 → R1 → S1 → V1 → S2 → A1 (→ A2). **Later:** G1, P1, AI.
  **Built:** AUTH.
- The model is the **living spec** feeding implementation. Re-run structuring as an organize pass
  whenever it grows.
- **Pending (unchanged from em-commands/scenarios):** reflect **F1–F6 + G1/G3 + E1–E4 + new facts**
  into `notes/` and the **backend** (event shapes change) before/at implementation start.
