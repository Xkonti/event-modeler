# Event Modeling — Brainstorming Results

> Phase 1 (Brainstorming) output for the **event-modeler** app. Captures the key
> decisions and the resulting **business facts** (orange elements) with their meanings,
> ordered into a left→right story. Feeds the next phases (wireframes → commands/read
> models → automations → scenarios → structuring).
>
> Session date: 2026-06-08. Autonomous first pass, verified by the author.

## Recursion note (read first)

We are **event-modeling the event-modeler itself**. The "system" being modeled is the
app. Its **business facts** are the durable things recorded when a user builds/edits a
model; the model artifact is the system's state. The word *business fact* therefore
appears two ways: as an **element type** (the orange sticky a user defines) and as a
**domain fact of the tool** (`Business Fact Defined` = the user defined an orange
element). Names below are kept unambiguous.

## Scope — three bounded contexts

| Context | Role | Status |
|---|---|---|
| **Modeling** | the model artifact (the heart) | main story below |
| **Identity/Access** | auth — accounts, sessions | already built; listed for completeness |
| **Publishing/Sync** | GitHub PR export, JSON import/export | integration edge; listed |

Everything below is the **Modeling** context unless headed otherwise.

---

## Key decisions captured

1. **Fields live inside entity definitions.** A business fact / command / read model /
   wireframe holds its own fields/content — fields are **not** a separate entity. A
   single generic `…Fields Updated` fact per entity is enough (decision #7). Because a
   fact's fields are defined once on its identity, all producers of that fact share an
   identical schema by construction.
2. **Configurable hierarchy above the slice (#1).** The fixed `flow→feature→context→
   domain` nesting from `notes/model-structure.md` is replaced by a **user-configurable
   level scheme**: the user defines how many levels exist and what they are named, per
   model. Modeled as a generic **Group** entity + a per-model level configuration.
3. **Lane assignment is deferred and clearable (#2).** Business facts start **lane-less**;
   a separate fact assigns a fact to a context/lane, and another clears it. Matches
   `notes/swimlanes.md` ("early planning ignores lanes").
4. **Context = lane = its own entity (#4).** The swimlane/stream is a first-class entity
   with its own ID. Only **facts** carry a context assignment, and the lane is intrinsic
   to the fact's identity (travels into every slice).
5. **GWT/GT are independent entities that reference by GUID (#3).** A GWT is defined for a
   specific command, but the **command does not know about it** — the GWT holds the
   command's GUID internally (not a drawn relation). GWTs **auto-surface** wherever their
   referenced command/read-model appears. GT (no When) references a read model **or automation**
   the same way.
6. **Relations carry a stored kind + an extensible meta bag (#5).** The relation **kind**
   is **stored, not purely derived** from the endpoint type-pair — the 4th pattern
   (Translation) makes some type-pairs ambiguous, so the discriminator hook goes in **now**.
   Relations also carry an open `meta` bag so future information layers can be added
   without changing the event shape.
7. **External Business Facts + Translation are modeled now (#6).** The 4th pattern is in
   scope from the start, not deferred.

### Further decisions

- **A. Lanes and groups are user-named.** The **Context** entity (lane/swimlane) and every
  configurable **Group** level carry whatever names the user chooses — there is no fixed
  naming scheme imposed by the tool. The two remain distinct axes (a lane is a stream on
  facts; a group is a nesting level above slices), but both are freely named.
- **B. One `Scenario` entity, two kinds (GWT | GT)** — chosen for implementation ease. The
  two kinds serve different purposes (a **GWT** specifies a command's accept/reject/emit
  logic; a **GT** specifies a read model's projection) and stay conceptually distinct, but
  they share one stream/vertical discriminated by a `kind` field: a single events file,
  decider, command handler, api, and projection instead of two near-identical verticals.
  The kind-dependent parts — `when` (command ref) exists only for GWT, and the `then`
  shape differs — are field-level variations the decider handles per kind. Both reference
  their anchor (command for GWT / read model or automation for GT) by GUID and both
  auto-surface. (Reversible — split
  into two verticals later if the kinds diverge enough to warrant it.)
- **C. Element-link & backlink dropped as separate concepts** (confirmed): ID-based
  identity makes "same element" automatic (no manual link), and a backlink (later fact →
  earlier read model) is just a `feeds` relation — not needed in this automated system.
  Both are subsumed; not modeled as their own facts.

### Amendments — reconciled with Phases 3–4 (commands + automations)

Later phases changed some specifics; this file is updated to match. Canonical detail lives in
`em-commands-results.md` (F-fixes) and `em-automations-results.md` (G/O resolutions).

- **F1** — every entity belongs to a `model`; `modelId` is on every command/fact; names are
  unique **per model** (not globally). The `model` root aggregate is real (it was missing).
- **F3** — placement is `{ slotRole, slot }`, not x/y. `slotRole` is **computed from the
  entity type**; `slot` is an integer vertical index (0=top); the **lane is derived** from the
  fact's assigned Context (not stored on the placement). Command/automation/translation are single
  (no slot); wireframes/read-models/facts are multiple (slot-numbered). Reorder = **slot swap**
  between two placements (`SwapEntitySlots`), refined by the user 2026-06-08.
- **G1** — the outbound boundary is an **external business fact**, not an `externalSystem` node
  (removed). Pair table corrected below.
- **G3** — automation + translation gain an edit fact (Automation Reconfigured / Translation
  Mapping Updated); they have no generic *Fields Updated*.
- **O1** — `Model Exported` is **not** a recorded fact (Export is a state-view query); dropped
  below and replaced by the resolved Publishing/Sync facts.
- **F4/F5/F6** (read-model/event detail) — relation kind+meta stored (already reflected);
  `entity_catalog` carries each entity's definition; `scenarios` indexed by anchor GUID.
- **O4** (user, 2026-06-08) — entity field **types are free-form text**, not a fixed enum (ES simplicity).
- **O5** (user, 2026-06-08) — external business facts are assigned a lane **explicitly** (same path as
  internal facts), rendered distinctly; not auto-assigned at define.

---

## Entity taxonomy (catalog types)

Each definable entity has its own stable ID and event stream and holds its own
fields/content. Uniform lifecycle **Defined → Renamed → Fields/Content Updated →
Archived** unless noted. Deletion is always an **event** (`Archived`/`Removed`), never a
row drop.

| Entity | Color / role | Extra |
|---|---|---|
| businessFact | orange (internal) | + context assign/clear |
| externalBusinessFact | yellow (integration) | own lane — assigned explicitly (O5) |
| command | blue | |
| readModel | green | |
| wireframe | sketch | payload = content/layout |
| automation | gear | + reconfigure (G3) |
| translation | — (4th pattern) | + mapping update (G3) |
| context | lane / swimlane | own ID; only facts assign to it |
| scenario | rule (GWT \| GT) | refs command (GWT) / readModel\|automation (GT) by GUID |
| slice | container | references entities; placements = slotRole + slot# (F3) |
| group | configurable hierarchy | level scheme per model |
| relation | edge | {from, to, kind, meta} |
| model | root container | every entity carries its `modelId` (F1) |

---

## Business facts & their meanings (the glossary)

### Model lifecycle
- **Model Created** — a new, empty event model exists; the root container for everything below.
- **Model Renamed** — the model's display name changed.
- **Model Archived** — the model is retired (soft, via event).

### Grouping hierarchy (configurable, #1)
- **Grouping Hierarchy Configured** — the model's level scheme is defined: an ordered list
  of named levels above the slice and the depth (e.g. `[flow, feature, area]`).
- **Group Created** — a named grouping instance at one configured level exists.
- **Group Renamed** — a group's name changed.
- **Group Archived** — a group is retired.
- **Slice Assigned To Group** — a slice is placed into a group (the lowest grouping level).
- **Slice Unassigned From Group** — a slice is removed from a group.
- **Group Nested Under Parent** — a group is placed inside a higher-level group (builds the tree).
- **Group Un-nested** — a group is detached from its parent.

**C1 pull-forward (2026-06-10, self-model test):** a single-level **chapter band** ships ahead
of the full hierarchy (es-book ch 18) — new facts: **Chapter Defined / Renamed / Archived**,
**Slice Assigned To Chapter / Slice Chapter Cleared** (one chapter per slice, last-write-wins).
When G1 lands, chapters become level-1 groups. See em-commands Flow 6 + em-structuring C1.

### Context / lane (#4)
- **Context Defined** — a named stream/lane exists (a thing with its own story over time;
  maps to a bounded context *or* a single aggregate — the user's choice of granularity).
- **Context Renamed** — a lane's name changed.
- **Context Archived** — a lane is retired.

### Business fact (orange, internal)
- **Business Fact Defined** — an orange element exists in the catalog: a past-tense domain
  occurrence the modeled system records. Holds its own fields. Lane-less at definition (#2).
- **Business Fact Renamed** — the human-facing handle changed (references are by ID, so safe).
- **Business Fact Fields Updated** — the fact's field set/schema changed (#7). Shared by all
  producers of that fact by construction.
- **Business Fact Assigned To Context** — the fact is homed to one lane/stream; the lane
  becomes intrinsic to its identity and travels into every slice (#2).
- **Business Fact Context Cleared** — the fact's lane assignment is removed (back to lane-less).
- **Business Fact Archived** — the fact is retired.

### External business fact (yellow, #6)
- **External Business Fact Defined** — data arriving from or published to another system; a
  tech-agnostic integration record. Gets its own lane, assigned **explicitly** (same path as
  internal facts; rendered distinctly — O5).
- **External Business Fact Renamed / Fields Updated / Archived** — as for business facts.

### Command (blue)
- **Command Defined** — an instruction/input that, on acceptance, produces business fact(s).
  Holds its own fields. The same command can be issued from many sources (a wireframe, an
  automation, an AI agent).
- **Command Renamed / Fields Updated / Archived** — standard lifecycle.

### Read model (green)
- **Read Model Defined** — structured data pulled out of the system, feeding screens and
  background processes. Holds its own fields. Typically aggregates multiple sources.
- **Read Model Renamed / Fields Updated / Archived** — standard lifecycle.

### Wireframe (sketch)
- **Wireframe Defined** — a rough UI mockup, about *data* not UX polish. Holds its own
  content/layout.
- **Wireframe Renamed / Content Updated / Archived** — standard lifecycle (payload = content).

### Automation (gear)
- **Automation Defined** — a background process that reads a read model, does work, and
  issues a command; triggered by a fact, a timer, or an interaction.
- **Automation Renamed / Archived** — standard lifecycle.
- **Automation Reconfigured** — the trigger config (trigger type / monitored read model / issued
  command) changed (G3; automation has no generic *Fields Updated*).

### Translation (4th pattern, #6)
- **Translation Defined** — an anti-corruption mapping between external and internal data
  (inbound: external → internal; or outbound: internal → external).
- **Translation Renamed / Archived** — standard lifecycle.
- **Translation Mapping Updated** — the inbound/outbound field mapping changed (G3; translation
  has no generic *Fields Updated*).

### Slice (container)
- **Slice Defined** — the smallest functional unit: a bucket that references entities and
  records where they sit. Holds no entity definitions.
- **Entity Placed** — an entity reference is dropped into its **role band** (the band is fixed by
  the entity's type) at a **`slot`** number (integer vertical index, 0=top) within that band. No
  free x/y (F3). Command/automation/translation are single (no slot); wireframes/read-models/facts
  are multiple, slot-numbered.
- **Entity Slots Swapped** — two placements in the same band **exchange slot numbers** — the single
  graph-reorder primitive. You can't move across bands (band fixed by type; a fact's lane changes
  only by re-assigning its Context) (F3).
- **Entity Removed From Slice** — a placement is removed (the entity itself is untouched).
- **Slice Renamed / Archived** — standard lifecycle.

### Relation (edge, #5)
- **Relation Drawn** — a directed link between two entities, `{fromId, toId, kind, meta}`.
  Drawing the arrow *is* the relation (authored at model level, not per-slice). **Kind is
  stored**, not derived, because Translation makes some type-pairs ambiguous. `meta` is an
  open bag for future information layers.
- **Relation Info Updated** — the carried kind/meta changed without redrawing the link.
- **Relation Removed** — the link is deleted.

### Scenario — business rules (#3, one entity, two kinds: GWT | GT)
- **GWT Defined** — a Given/When/Then rule. **When** is a command, referenced by GUID held
  inside the scenario (the command is unaware). **Given** = precondition facts (existence
  and optional values); **Then** = emitted fact(s), a rejection, or an error fact. Uses
  concrete example data. Auto-surfaces wherever its command appears.
- **GT Defined** — a Given/Then rule (no When), a projection spec referencing a **read model
  or automation** by GUID (both take G/T — no command, so no When). Given ordered facts → Then
  the read model / automation shows a specific state.
- **Scenario Updated** — the rule's content changed.
- **Scenario Archived** — the rule is removed (the tool may prompt this on relation removal;
  scenarios are second-class and can be flagged out-of-sync — see `notes/gwt.md`).

### Identity/Access (separate context — already built)
- **Account Registered** · **Email Verified** · **Logged In** · **Logged Out** ·
  **Account Deleted** (crypto-shred, irreversible erasure).

### Publishing/Sync (separate context — resolved in automations phase)
- **External Model Published** *(external, yellow)* — the complete serialized model + delta
  published outward as the integration contract (the GitHub PR payload).
- **Model Published To GitHub** — internal marker that a publish happened (one-directional:
  software → GitHub, never back); rebaselines the publish diff.
- **Model Publish Failed** — a publish attempt failed → explicit failure + manual retry.
- **Model File Provided** *(external, yellow)* — a JSON model document arrived (inbound).
- **Model Imported** — an import populated the model (fans out into Define*/Draw*/… commands).
- **Model Import Failed** — an invalid/partial document → nothing imported, error surfaced.
- *(dropped)* **Model Exported** — Export is a **state-view query**, not a recorded fact (O1).

---

## Relation pair table (extended for Translation)

Keyed by `(from, to, kind)` since kind is stored. The first six are the canonical cycle;
the rest are the 4th-pattern edges (exact wiring confirmed in the automations phase).

| From | To | kind |
|---|---|---|
| readModel | wireframe | `displayedBy` |
| readModel | automation | `monitoredBy` |
| wireframe | command | `issues` |
| automation | command | `reacts` |
| command | businessFact | `produces` |
| businessFact | readModel | `feeds` |
| externalBusinessFact | translation | `inbound` |
| translation | command | `triggers` |
| externalBusinessFact | readModel | `directTranslation` *(ambiguous vs `feeds` → needs stored kind)* |
| businessFact | translation | `outbound` |
| translation | externalBusinessFact | `publishes` *(G1 — was `externalSystem`, removed)* |

---

## The left→right story (Modeling context)

Reads as *how a model gets built* — itself the Event Modeling process (recursion):

1. **Model Created**
2. *(optional)* **Grouping Hierarchy Configured**
3. **Business Facts Defined** — the brainstorm dump; fields via Fields Updated; lane-less
4. **Contexts Defined** → **Facts Assigned To Context** — later, once streams are known
5. **External Business Facts Defined**
6. **Slice Defined**
7. **Wireframe / Read Model / Command Defined** — with fields/content; backwards thinking
8. **Automation / Translation Defined**
9. **Entities Placed** → **Slots Swapped** (reorder)
10. **Relations Drawn** (kind + meta; cycle + translation edges) → **Info Updated** / **Removed**
11. **GWT / GT Defined** — referenced by GUID; auto-surface
12. **Groups Created** → **Slices Assigned** → **Groups Nested**
13. **Model Published** (external fact + marker) **/ Exported** (state-view query — no fact)

### Ordering invariants surfaced

- An entity must be **Defined before it can be Placed**.
- A relation needs **both endpoints existing** before it can be **Drawn**.
- A **Context must be Defined** before a fact can be **Assigned** to it.
- GWT/GT references may **dangle** (referenced entity removed) → the scenario is **flagged
  out-of-sync**, not blocked (`notes/gwt.md`).

---

## Carried forward to next phases

- **Wireframes** — sketch each slice's UI to reveal the data each screen needs.
- **Commands & Read Models** — backwards thinking + the information-completeness check
  (every read-model field traces to a source fact; every fact field to its command).
- **Automations & Translation** — confirm the exact Translation wiring and the new relation
  pairs (inbound/outbound/directTranslation); decide eventual-consistency + failure handling.
- **Scenarios** — author the GWT/GT rules with concrete example data.
- **Structuring** — Contexts (lanes), configurable Groups, chapters, multiple models.

### Open items to revisit

- Default resolutions **A / B / C** above (reversible).
- ~~Exact Translation relation wiring~~ — **resolved** in `em-automations-results.md` (inbound/
  outbound via external business facts; `externalSystem` removed).
- Endpoint-existence enforcement at relation-draw time is eventually-consistent (async
  catalog read), not write-path-locked — acceptable single-user; revisit for collaboration.
