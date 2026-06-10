# Event Modeling — Wireframing Results

> Phase 2 (Wireframes) output for the **event-modeler** app. Bridges the brainstorm's
> ordered business facts (`spec/em-brainstorm-results.md`) to rough screens that reveal
> **what data each screen needs** and **what actions the user takes**. Those handoff lists
> feed Phase 3 (commands + read models).
>
> Session date: 2026-06-08. Autonomous pass, then reviewed + revised by 3 independent Opus
> agents (slot-fidelity / coverage / simplicity — synthesis at the end). Rough + throwaway
> by design: about data flow, not UX polish.

## Recursion + the key UI principle

We are wireframing the **event-modeler itself**. Its screens are the tool's own UI; its
read models are the app's own read models (`entity_catalog`, `slice_placements`,
`relations_graph`); its actions are the app's own commands (`DefineBusinessFact`,
`PlaceEntity`, `DrawRelation`, …). So most handoff lists below double as the backend API.

**UI principle — SNAPPABLE SLOTS, not freeform graphs.** The slice canvas is deliberately
*less* flexible than Miro. The user never pixel-places. Each slice is a **box** with fixed
**role slots**; entities **snap** into the slot matching their role and auto-shift to stay
aligned (`notes/layout-and-rendering.md`). "Freeform" applies only to *which* entities a
slice holds, never to *where* they sit.

```
  SLICE BOX  — snap slots, staircase time-offset (trigger→command→fact flows down-right)
  ┌──────────────────────────────────────────────────────────────┐
  │ TRIGGER slot   → wireframe | automation | translation          │  top graph
  │    │ issues ▼                       ▲ displayedBy (back-edge)   │
  │  COMMAND band  → command  +  read model(s) stacked ▼            │  (cmd + RMs;
  │    │ produces ▼                     ▲ feeds (back-edge)         │   lane-agnostic)
  │  FACTS band    → business facts, divided into SWIMLANES         │
  ├──────────────────────────────────────────────────────────────┤
  │ TEXT strip     → notes + GWT/GT scenarios (as text)            │  bottom
  └──────────────────────────────────────────────────────────────┘
  Cycle: wireframe →issues→ command →produces→ fact →feeds→ readModel →displayedBy→ wireframe.
  The read model rides the COMMAND band but wires UP to the trigger (it is the screen's
  input); the command wires DOWN to facts. Command + read models are LANE-AGNOSTIC — only
  the facts band is split into swimlanes (a command's tie to a stream is the arrow to its fact).
```

---

## v1 core set vs later (simplicity pass)

The brainstorm taxonomy is deliberately complete (it includes later-stage / scale patterns).
v1 is **single-user, screen-shared, small focused scope**. So we split:

- **v1 core (6 wireframes, kept rough; W4 detailed):** W2 Dashboard · W3 Workspace shell ·
  **W4 Slice Box (snap-slot centerpiece)** · W5/6 Entity Inspector (merged) · W7 Draw
  Relation · W8 Scenario editor.
- **Later-stage (wireframed for total fact coverage, but marked not-v1):** W1 Auth (already
  built) · W9 Lane Manager (assignment itself is in the inspector for v1; the manager is
  later) · W10 Outline + configurable hierarchy (a scale feature) · W11 Publish/Sync (v1
  keeps only a single **Export JSON** button on W2).

Every business fact still has a screen below (the user's goal: *all facts complete +
reviewed*); the v1/later tag says what gets **built first**, not what's omitted.

> **Amendments — reconciled with Phases 3–4.** **F3:** placement is `{slotRole, slot}` —
> `slotRole` computed from entity type, `slot` = integer index (0=top), **lane derived** from the
> fact's Context (not stored); command/automation/translation single (no slot),
> wireframes/read-models/facts multiple; reorder = **slot swap** (`SwapEntitySlots`). **G1 resolved:** `publishes` targets an
> `externalBusinessFact` (yellow); `externalSystem` removed. **G3 resolved:** automation →
> `AutomationReconfigured`, translation → `TranslationMappingUpdated`. **O1:** `Model Exported`
> is a state-view query, not a fact. **F1:** every entity carries `modelId`; names unique
> **per model**. Canonical detail in `em-commands-results.md` + `em-automations-results.md`.

---

## Coverage matrix — every business fact → its screen

| Business fact(s) | Screen | v1? | Note |
|---|---|---|---|
| Model Created / Renamed / Archived | **W2 Dashboard** | v1 | |
| External Model Published / Model Published To GitHub / Publish Failed | **W11** | later | outbound (automations) |
| Model File Provided / Imported / Import Failed | **W11** | later | inbound (automations) |
| Model Exported *(state-view query — no fact, O1)* | **W2** (Export button) | v1 | local round-trip/save |
| Grouping Hierarchy Configured | **W10** | later | scale feature |
| Group Created / Renamed / Archived | **W10** | later | |
| Slice Assigned / Unassigned To Group | **W10** | later | |
| Group Nested Under / Un-nested | **W10** | later | |
| Context Defined | **W5/6** (inline "+ new lane") + **W9** | v1 | create inline in inspector |
| Context Renamed / Archived | **W9 Lane Manager** | later | housekeeping |
| Business Fact Defined / Renamed / Fields Updated / Archived | **W5/6 Inspector** | v1 | + **W4** snap |
| Business Fact Assigned / Context Cleared | **W5/6 Inspector** (Lane control) | v1 | |
| External Business Fact: Defined / Renamed / Fields Updated / Archived | **W5/6** | v1 | yellow; lane assigned **explicitly** (O5), distinct rendering |
| Command: Defined / Renamed / Fields Updated / Archived | **W5/6** + **W4** | v1 | command band |
| Read Model: Defined / Renamed / Fields Updated / Archived | **W5/6** + **W4** | v1 | rides command band, stacks |
| Wireframe: Defined / Renamed / **Content** Updated / Archived | **W5/6** (content editor) | v1 | trigger slot |
| Automation: Defined / Renamed / **Reconfigured** / Archived | **W5/6** + **W4** | v1 | trigger slot; Reconfigured = trigger config (G3 resolved) |
| Translation: Defined / Renamed / **Mapping Updated** / Archived | **W5/6** (mapping editor) | v1 | trigger slot; Mapping Updated (G3 resolved) |
| Slice Defined / Renamed / Archived | **W3** + **W4** | v1 | |
| Entity Placed / Slots Swapped / Removed From Slice | **W4** (snap, not drag-to-xy) | v1 | placement = slotRole + slot#; reorder = slot swap (F3) |
| Relation Drawn / Info Updated / Removed | **W7** | v1 | all kinds incl. translation |
| Scenario (GWT) Defined / Updated / Archived | **W8** | v1 | bottom strip |
| Scenario (GT) Defined / Updated / Archived | **W8** | v1 | no When |
| Account Registered | **W1 Auth** | built | |
| Email Verified | out-of-band email link | built | separate step (G-W1) |
| Logged In / Logged Out | **W1** + topbar | built | |
| Account Deleted | **W1** (settings) | later | crypto-shred |

> **Lifecycle correction:** Automation and Translation have only **Defined / Renamed /
> Archived** in the brainstorm taxonomy — **no `Fields Updated`**. The earlier blanket "all
> entities have Fields Updated" was wrong. How their internal content is *edited* is an open
> gap → **G3**, now **resolved** in the automations phase (`AutomationReconfigured` /
> `TranslationMappingUpdated`).

---

## W1 — Auth (Sign up / Sign in)  *(built; reference only)*

Already implemented (better-auth; `Signup.vue`/`Login.vue`). Separate Identity context — no
new wireframe needed. Fact wiring only:

- `Register` → *Account Registered*; the emailed verification link (out-of-band) →
  *Email Verified* (a **separate** event, not produced by `Register`).
- `LogIn` → *Logged In*; topbar `[Log out]` → *Logged Out*; settings `DeleteAccount` →
  *Account Deleted* (crypto-shred, later).

---

## W2 — Model Dashboard (model list)  *(v1, trimmed)*

```
┌─ My Models ──────────────────────────────  [ + New Model ]» ┐
│  Budgeting        14 slices   [ Open ]  [ Export ] [ ⋯ ]    │
│  Shop Checkout     7 slices   [ Open ]  [ Export ] [ ⋯ ]    │
│  Onboarding        3 slices   [ Open ]  [ Export ] [ ⋯ ]    │
└──────────────────────────────────────────────────────────────┘
   ⋯ menu (v1): Rename · Archive       ⋯ menu (later): Publish to GitHub · Import
```

- **Focus:** `[+ New Model]`.
- **Data shown** (→ read model **`models`**, NEW): name, sliceCount *(derived: count of
  `Slice Defined` − `Slice Archived`)*, archived. (Dropped relative-time chrome — polish.)
- **Actions:** `[+ New Model]` → `CreateModel` (→ *Model Created*); `Rename` → `RenameModel`;
  `Archive` → `ArchiveModel`; `[Export]` → `ExportModel` — a **state-view query** that renders
  the current-state JSON (no recorded fact; O1) — the v1 save/round-trip path; `Publish`/`Import`
  → W11 (later).
- **KEY FINDING #2:** backend has **no `model` aggregate** — needed as the root container +
  the `models` read model.

---

## W3 — Modeler Workspace (the shell)  *(v1)*

```
┌ Budgeting ▸ [slices]°          [layers ▾]  [lanes ▢]  [ Export ] ┐
├──────────┬───────────────────────────────────────┬──────────────┤
│ PALETTE  │  CANVAS  (boxes tile left→right)       │ INSPECTOR    │
│ + Fact   │  ┌── Slice: Define Year ──┐ ┌─ … ─┐    │ (selected    │
│ + Command│  │ [wireframe]            │ │      │    │  entity or   │
│ + ReadM  │  │   └▶[command] +[readM] │ │ …W4… │    │  slice —     │
│ + Wirefr │  │      └▶ lane:Year[fact]│ │      │    │  W5/6)       │
│ + Autom  │  └────────────────────────┘ └──────┘    │              │
│ + Extern │   « + add slice »                        │              │
│ + Transl │                                          │              │
│ ──────── │                                          │              │
│ Catalog° │                                          │              │
│ search🔍 │                                          │              │
└──────────┴───────────────────────────────────────┴──────────────┘
```

- **Focus:** the canvas / `[Export]`.
- **Data shown:** breadcrumb scope (→ **`models`**); palette catalog (→ **`entity_catalog`**:
  name, type, archived); tiled slices (→ **`slice_placements`** + `entity_catalog` +
  **`relations_graph`** = the existing `GET /slices/:id` join). Each box renders via **W4**.
- **Actions:** palette `+ <Type>` → opens **W5/6** on a fresh entity; `+ add slice` →
  `DefineSlice` (→ *Slice Defined*); `[layers ▾]`/`[lanes ▢]` → presentation toggles (no
  fact); breadcrumb → scope/zoom (W10, later — v1 = flat tiled slices).
- Reuse: the same entity reused across boxes is the same identity (ID-based) — no
  element-link concept needed. The mini-box hints the read model in the command band (`+[readM]`).

---

## W4 — Slice Box: the SNAP-SLOT anatomy  *(v1 centerpiece — detailed)*

**Empty** slice shows the slots so snapping is obvious (read models stack ▼ in the command band):

```
┌── Slice: (unnamed) ─────────────────────── [rename][⋯] ──┐
│  TRIGGER   « + wireframe / automation / translation »     │
│     │ issues ▼                                            │
│  COMMAND   « + command »    « + read model » (stack ▼,    │
│     │ produces ▼              feed trigger ▲)             │
│  FACTS                                                    │
│     ┌ lane: (none) ─ « + business fact » ────────────────┐│
│     └─────────────────────────────────────────────────── ┘│
├──────────────────────────────────────────────────────────┤
│  notes / scenarios:  « + GWT »  « + GT »                  │
└──────────────────────────────────────────────────────────┘
```

**Filled** — full cycle, read model feeds trigger UP, command produces fact DOWN:

```
┌── Slice: Record Budget Line ─────────────── [rename][⋯] ──┐
│  »[ Budget Entry Form ]«  (wireframe — TRIGGER)            │
│      │ issues               ▲ displayedBy                  │
│   [ Record Budget Line ]   [ Budget Summary ]°   ← COMMAND band (cmd + read model; lane-agnostic)
│      │ produces              ▲ feeds                       │
│   ── lane: Budget ── [ Budget Line Recorded ]° ───────────  ← FACTS band (swimlanes)
│   ── lane: Audit ──────────────── [ Entry Logged ]°        
├──────────────────────────────────────────────────────────┤
│ GWT (Record Budget Line):                                 │
│   GIVEN  Budget Year Defined {year: 2026}                 │
│   WHEN   Record Budget Line  {amount: €5}                 │
│   THEN   Budget Line Recorded {amount: €5}                │
└──────────────────────────────────────────────────────────┘
legend: »…« focus · °data-from-system · staircase = time L→R
slots: TRIGGER(wireframe|automation|translation) → COMMAND band(command + read models stacked ▼)
       → FACTS band(swimlanes — facts only). Command + read models are LANE-AGNOSTIC.
```

**Variant A — multiple read models stack** (`layout-and-rendering.md`: table + summary):

```
│   [ Record Budget Line ]   [ Budget Lines Table ]°   ← read model 1
│                            [ Budget Summary ]°       ← read model 2 (stacked ▼; both feed trigger ▲)
```

**Variant B — automation trigger** (the slot is role-bound, not wireframe-only; no UI):

```
│  »⚙ Nightly Roll-Forward«  (automation — TRIGGER)         │
│      │ reacts        ▲ monitoredBy                        │
│   [ Prepare Next Year ]   [ Open Years ]°  ← command + read model the automation monitors
│      │ produces                                           │
│   ── lane: Budget ── [ Budget Year Defined ]°             │
```

**Variant C — lanes toggled OFF** (default in early planning; facts in one flat band):

```
│   FACTS (lanes off):  [ Budget Line Recorded ]°  [ Entry Logged ]°
```

- **Focus:** the slot the slice is "about" (here, the command).
- **Data shown** (→ **`slice_placements`** ⋈ **`entity_catalog`**): per placement
  `{ entityId, name, entityType, slotRole, lane, slot }`; relations among visible entities
  (→ **`relations_graph`**, kind stored); read-model fields (W5/6); auto-surfaced scenarios
  (→ **`scenarios`**, queried by the slice's entity GUIDs).
- **Actions:** `+ <role>` → pick existing or create (W5/6) then **`PlaceEntity`** with a **`slot`**
  number (band computed from type; not x/y; omitted for single-cardinality command/automation/
  translation) (→ *Entity Placed*); to **reorder**, **`SwapEntitySlots`** between two placements in
  the same band (→ *Entity Slots Swapped*) — you can't move across bands (band fixed by type; a
  fact's lane changes only by re-assigning its Context); remove →
  **`RemoveEntityFromSlice`**; `[rename]` → `RenameSlice`; `[⋯]` → `ArchiveSlice`; draw arrow → **W7**.
- **KEY FINDING #1 — placement shape must change.** Backend `EntityPlaced {x, y}` is freeform.
  Snap slots mean placement = **`{ slotRole, slot }`** — `slotRole` (trigger|command|readModel|
  fact) is **computed from the entity's type**, `slot` is an **integer vertical index** (0=top), and
  the **lane is derived** from the fact's assigned Context (not stored on the placement → no drift).
  Command/automation/translation are single (no slot); wireframes/read-models/facts are multiple
  (slot-numbered). x/y becomes a derived layout-solver output, never user-authored. (Resolved as
  **F3** in `em-commands-results.md`.)
- **Within-lane arrangement** of multiple facts = a **vertical stack ordered by slot number**
  (resolved 2026-06-08, `layout-and-rendering.md`); reorder via slot swap. The one-fact-per-lane
  example below is illustrative, not a limit.

---

## W5/6 — Entity Inspector  *(v1; merged create + edit; type-parameterized)*

Creation **is** the inspector on a fresh entity (single-user → no separate create form).
Fields live *inside* the definition (brainstorm #1/#7). Business-fact example:

```
┌─ Inspector: <name | new>   ( business fact ▾ ) ──┐
│ Name°    [ Budget Line Recorded____ ]»            │
│ Fields°  ┌──────────────────────────────┐        │
│          │ amount    : money           ✎ │        │
│          │ lineId    : id              ✎ │        │
│          └──────────────────────────────┘        │
│          [ + Add field ]                          │
│ Lane°    [ Budget ▾ ]  [ + new lane ] [ Clear ]   │  ← facts only
│          [ Archive ]                              │
└────────────────────────────────────────────────────┘
```

- **Focus:** Name (on create) / `[+ Add field]` (on edit).
- **Data shown** (→ **`entity_catalog`** entry + its definition): name, fields[], lane;
  duplicate-name check reads **`entity_catalog`** (names unique **per model** — F1b; the write-path 409
  comes from the `entity_names` *constraint*, not a read model). *(Removed: completion-status
  flags and "used in / show where used" — deferred, see cuts.)*
- **Actions:** first save → `Define<Type>` (→ *<Type> Defined*); name edit → `Rename<Type>`;
  fields → `Update<Type>Fields` (→ *<Type> Fields Updated*); lane `▾` →
  `AssignBusinessFactToContext`; `+ new lane` (inline) → `DefineContext` (→ *Context Defined*)
  then assign; `Clear` → `ClearBusinessFactContext`; `Archive` → `Archive<Type>`.
- **Type variants:**
  - **Wireframe** → Fields replaced by a **content/layout editor** (→ *Wireframe Content Updated*).
  - **External fact** → yellow; **explicit Lane control** (same assign/clear path as internal facts,
    O5), rendered distinctly (yellow / "external"). **Not** auto-assigned at define.
  - **Command / Read Model** → fields editor; **no** Lane control (lane-agnostic).
    **Read Model additionally (F7, 2026-06-10):** a `mode` toggle (projected | live) and a
    per-field **derived** checkbox in the fields editor (rendered distinctly, e.g. ƒ-prefix) —
    derived fields / live read models are skipped by A3 validation (es-book ch 31/33).
    The derived checkbox is available on every fields editor (facts use it for
    decider-computed attributes like `slotRole`).
  - **Automation** → trigger-type (fact | timer | interaction) + monitored read-model ref +
    issued-command ref; edited via **`ReconfigureAutomation`** → *Automation Reconfigured*
    (G3 resolved — no generic *Fields Updated*).
  - **Translation** → a **mapping editor** (external field ↔ internal field columns + inbound/
    outbound direction); edited via **`UpdateTranslationMapping`** → *Translation Mapping
    Updated* (G3 resolved).

---

## W7 — Draw Relation + Relation Inspector  *(v1)*

```
   [ Budget Entry Form ] ───▶ [ Record Budget Line ]     (drag to draw; invalid pair rejected)

┌─ Relation ─────────────────────────────────┐
│ From°  Budget Entry Form (wireframe)        │
│ To°    Record Budget Line (command)         │
│ Kind°  [ issues ▾ ]   (stored, not derived) │  ← dropdown offers every valid kind for the pair
│ Info°  [ + note / field-mapping … ] (meta)  │
│        » [ Save ] «      [ Remove ]          │
└─────────────────────────────────────────────┘
```

Translation edge example (the reason kind is **stored**, not derived):

```
   [ Bank Statement Received ] (external) ───▶ [ FX Translation ]
   Kind [ inbound ▾ ]   →  DrawRelation {from, to, kind:'inbound', meta}
```

- **Focus:** the drawn arrow / `[Save]`.
- **Data shown** (→ **`relations_graph`** + `entity_catalog`): from/to names+types; the
  `Kind ▾` lists **all** valid kinds for the selected pair (the 11 from the Phase-1 table,
  incl. `inbound / triggers / directTranslation / outbound / publishes`); meta.
- **Actions:** valid release → `DrawRelation {fromId,toId,kind,meta}` (→ *Relation Drawn*);
  edit → `UpdateRelationInfo` (→ *Relation Info Updated*); `Remove` → `RemoveRelation`
  (prompts about dependent scenarios — gwt.md sync; handled server-side, not drawn here).
- **G1 — resolved.** The `publishes` kind now targets an **`externalBusinessFact`** (yellow), a
  real catalog type — not a phantom `externalSystem` (removed). Outbound boundary =
  `businessFact → translation → externalBusinessFact`. Invalid-pair check is a backend rule
  (422), noted here not drawn. (See `em-automations-results.md`.)

---

## W8 — Scenario editor (GWT / GT)  *(v1; bottom text strip)*

```
┌─ Scenario  [ GWT ▾ ]   anchor command: Record Budget Line° ─┐
│ GIVEN°  + Budget Year Defined   { year: 2026 }              │
│ WHEN°   Record Budget Line      { amount: €5 }              │
│ THEN°   emit Budget Line Recorded { amount: €5 }            │
│         » [ Save scenario ] «                               │
└──────────────────────────────────────────────────────────────┘
   GT variant: kind=GT, anchor = a read model or automation, NO When:
   GIVEN ordered facts → THEN read model shows {state}.
```

- **Focus:** `[Save scenario]`.
- **Data shown** (→ **`scenarios`** read model, NEW; + `entity_catalog` for pickers): kind,
  anchor entity (command for GWT / read model or automation for GT, **by GUID**), given facts[], when, then,
  out-of-sync flag.
- **Actions:** `[Save]` → `DefineScenario {kind, anchorId, given, when?, then}` (→ *Scenario
  Defined*); edit → `UpdateScenario`; delete → `ArchiveScenario`.
- Notes: GWT auto-surfaces in every slice containing its command; GT in every slice with its
  read model. The command is **unaware** of its GWTs (GUID-in-scenario, one-way). The
  **emit / reject / error-fact** outcome choice is the **scenarios phase's** job — kept as a
  data note here, not drawn as UI.

---

## W9 — Lane (Context) Manager  *(later; v1 assigns via W5/6 only)*

v1 creates + assigns lanes inline in the inspector (W5/6). The standalone manager
(rename/archive/fact-counts) is later housekeeping for a grown model.

```
┌─ Lanes (Contexts) ─────────────┐
│ ▤ Budget   [rename][archive]    │   → RenameContext / ArchiveContext
│ ▤ Audit    [rename][archive]    │
│ ▤ External (yellow)             │
│ [ + New lane ]                  │   → DefineContext
└─────────────────────────────────┘
```

- **Data shown** (→ **`contexts`** read model, NEW): lane name, archived, fact count
  *(derived)*. **Actions:** as labelled. Lanes are user-named; only facts assign to one.

---

## W10 — Outline + configurable hierarchy  *(later; scale feature)*

A zoom/scope navigator + level-scheme configurator. Not v1 (v1 = a few slices tiled flat).
Wireframed for fact coverage; built later.

> **C1 pull-forward (2026-06-10):** a SINGLE-LEVEL **chapter band** ships before full W10 —
> a labeled band above the W3/W4 canvas (es-book ch 18), chapters created/assigned inline
> (`DefineChapter`, `AssignSliceToChapter`; em-commands Flow 6). W10's configured hierarchy
> later absorbs chapters as level-1.

```
┌─ Outline ─────────────────────────┐   Levels (configurable, user-named):
│ ▾ Budgeting                        │   slice ← fixed
│   ▾ Prepare Year                   │   flow°    [rename][✕]
│     • Define Year                  │   feature° [rename][✕]
│     • Record Budget Line           │   [ + Add level ]
│ [ + New group ]                    │   (drag slices/groups to nest)
└────────────────────────────────────┘
```

- **Data shown** (→ **`groups`** read model + level config on **`models`**): level scheme,
  group tree, slice membership.
- **Actions:** add/rename/remove level → `ConfigureGroupingHierarchy` (→ *Grouping Hierarchy
  Configured*); `+ New group` → `CreateGroup`; rename/archive → `RenameGroup`/`ArchiveGroup`;
  drag slice → `AssignSliceToGroup`/`UnassignSliceFromGroup`; drag group →
  `NestGroupUnderParent`/`UnnestGroup`; click node = set scope (W3). Membership is a **graph**.

---

## W11 — Publish / Sync  *(later; v1 keeps only Export on W2)*

```
┌─ Publish "Budgeting" ──────────────────────┐
│ Target°   github.com/acme/specs (subtree)   │
│ Summary°  12 changes since last publish     │
│           » [ Open Pull Request ] «          │
│ [ Import JSON … ]                            │
└──────────────────────────────────────────────┘
```

- **Data shown** (→ **`models`** + a **`publish_diff`** read model, NEW): target repo,
  change-count *(derived: events since the last `Model Published To GitHub` marker)*,
  last-published marker *(derived from that event)*.
- **Actions:** `[Open Pull Request]` → `PublishModel` (→ *Model Published To GitHub*, one-way
  software→GitHub); `[Import JSON]` → `ImportModel` (→ *Model Imported*, automation path).
  (`Export` lives on W2 in v1.) Sync is one-directional; a GitHub hand-edit conflict is a
  *signal* surfaced at next publish, not modeled as inbound.

---

## Handoff to Phase 3 (commands + read models)

**Read models the app needs** (its own State Views):

| Read model | Feeds | Status |
|---|---|---|
| `entity_catalog` | W3, W4, W5/6, W7, pickers; dup-name check | exists |
| `slice_placements` | W3, W4 | exists — **change to slotRole + slot#; lane derived, not x/y** (F3) |
| `relations_graph` | W4, W7 | exists |
| `models` | W2, W3 scope, W11 | **NEW** (needs `model` aggregate) |
| `contexts` | W9, W5/6 lane pickers | **NEW** |
| `groups` | W10 | **NEW** (later) |
| `scenarios` | W8; auto-surface in W4 | **NEW** — must be **queryable by anchor GUID** (command/read-model), not only by scenario id |
| `publish_diff` | W11 | **NEW** (later; derived from publish marker + event positions) |

**Derived fields (no dedicated fact — tag so the completeness check doesn't chase phantoms):**
`models.sliceCount`, `models.lastEditedAt`, `contexts.factCount`, `publish_diff.changeCount` /
`lastPublished`. (W6's "used in N slices" was **cut** from v1.)

**Commands** (its own State Changes): existing — `DefineBusinessFact/Command`, `Rename*`,
`Archive*`, `DefineSlice`, `PlaceEntity`, `SwapEntitySlots`, `RemoveEntityFromSlice`, `RenameSlice`,
`ArchiveSlice`, `DrawRelation`, `RemoveRelation`. **New** — `CreateModel`/`RenameModel`/
`ArchiveModel`/`ExportModel` (+ later `PublishModel`/`ImportModel`); `DefineReadModel`/
`DefineWireframe`/`DefineAutomation`/`DefineTranslation`/`DefineExternalBusinessFact`;
`Update…Fields` for fact/command/readModel and `UpdateWireframeContent` (automation/translation
instead use `ReconfigureAutomation`/`UpdateTranslationMapping` — G3 resolved); `DefineContext`/
`RenameContext`/`ArchiveContext`, `AssignBusinessFactToContext`/`ClearBusinessFactContext`;
`ConfigureGroupingHierarchy`, `CreateGroup`/`RenameGroup`/`ArchiveGroup`/`AssignSliceToGroup`/
`UnassignSliceFromGroup`/`NestGroupUnderParent`/`UnnestGroup` (later); `UpdateRelationInfo`;
`DefineScenario`/`UpdateScenario`/`ArchiveScenario`. (Per-type `Rename*`/`Archive*` expand to
one command per entity stream.)

## Flagged decisions / gaps (carry to Phase 3 / verify)

1. **KEY FINDING #1 — placement = `{slotRole, slot#}`, not x/y** (slotRole computed from type;
   `slot` integer 0=top; lane derived from Context). Reshapes `EntityPlaced`; reorder = `SwapEntitySlots`.
   **Resolved (F3, refined by user 2026-06-08).**
2. **KEY FINDING #2 — `model` aggregate missing.** Root container + `models` read model.
   **Resolved (F1/F2 in commands).**
3. **G1 — resolved.** `publishes` targets an `externalBusinessFact` (yellow); `externalSystem`
   removed. (automations phase.)
4. **G3 — resolved.** Automation → `AutomationReconfigured`; Translation →
   `TranslationMappingUpdated`. (automations phase.)
5. **D1 — read-model orientation on canvas.** Confirmed model: read model rides the command
   band but wires **up** to the trigger (`displayedBy`), fed from below by facts (`feeds`);
   the command wires **down** to facts (`produces`). Drives vue-flow arrow routing (a back-edge).
6. **D2 — trigger slot: single or stackable? RESOLVED** (user 2026-06-08): **wireframes are
   stackable** (multiple, slot-numbered); **automation / translation are single**. Command is single
   too; read models + facts stack.
7. **D3 — within-lane fact arrangement. RESOLVED** (user 2026-06-08): **vertical stack ordered by
   slot number** (0=top); reorder via `SwapEntitySlots`. (`layout-and-rendering.md`)
8. **Completion layer not fact-stormed.** W6's verified/implemented flags were **cut** from v1
   — the completion layer (`notes/layers.md`) has no business facts. If wanted later, model
   `Element Marked Verified/Implemented` + commands first.
9. **Lane toggle + multiple read models** must be first-class in W4 rendering (Variants A & C).

---

## Review synthesis (3 independent Opus agents)

- **WF-Slots (slot-fidelity):** caught that the draft drew the read model on the
  command→fact downward spine; corrected to feed the trigger upward. Added the role-named
  legend, the lane-agnostic note, and Variants A (stacked read models), B (automation
  trigger), C (lanes off). Surfaced D1/D2/D3.
- **WF-Coverage (fact coverage + handoff):** caught the Automation/Translation `Fields
  Updated` over-claim (taxonomy gives them none → gap G3), the missing Translation mapping
  editor, W7's inability to author 4th-pattern relations + the `externalSystem` phantom (G1),
  the `entity_names`-as-read-model slip, the Register→Email-Verified mis-attribution, and the
  derived-vs-fact tagging. Required `scenarios` be queryable by anchor GUID; added
  `publish_diff`.
- **WF-Simplicity (v1 scope):** merged W5+W6 into one type-parameterized inspector; cut the
  completion flags and "show where used"; marked W9/W10/W11 as later-stage (v1 keeps only an
  Export button on W2); trimmed UX polish (relative-time chrome, color-validation theatrics,
  reject/error radios) to keep the sketches rough — all while preserving the snap-slot core.
