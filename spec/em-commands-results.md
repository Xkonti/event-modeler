# Event Modeling — Commands & Read Models Results

> Phase 3 (Commands + Read Models) for the **event-modeler** app. Takes the wireframe
> handoff (`spec/em-wireframes-results.md`) + the brainstorm fact timeline
> (`spec/em-brainstorm-results.md`) and, **flow by flow**, defines the state-change slices
> (command → fact[s]) and state-view slices (fact[s] → read model), then walks each flow
> **backwards** to prove every attribute has a source (the information-completeness check).
>
> Session date: 2026-06-08. Autonomous. Built incrementally; **fixes to earlier phases are
> recorded inline and consolidated in the Gap/Fix log** at the end (this is where the
> backwards walk earns its keep).
>
> **Update:** the deferred items **G1 / G3 / O1 / O2 are now resolved** in
> `em-automations-results.md`; the Gap/Fix log + Flow 7 below reflect that.

## Recursion + grounding

We model the event-modeler itself, so its commands/facts/read models are the app's own — and
several already exist in the backend (`backend/src/domain/*`, `backend/src/read/*`). That lets
the completeness trace ground in real event shapes; where the design now diverges from the
existing code, it's tagged **FIX (amends backend)**.

Notation (per em-commands): `command { attrs }` → `fact { attrs }`; `sources` trace each
attribute to UI input / a read model / generated id / computed; `gaps` = unresolved sources
(red arrows). `[state change]` = data in; `[state view]` = data out.

**One identifier threads through everything: `modelId`.** Every entity, slice, relation,
context, group, and scenario belongs to exactly one model. This is discovered as **F1** below
and assumed present on every command/fact/read model from here on.

---

# Flow 0 — Model lifecycle (the root)

```
SLICE  Create Model                         [state change]
  command  CreateModel { modelId, name }
  fact     ModelCreated { modelId, name }
  sources  modelId ← generated (root id; everything else references it)
           name    ← UI input
  gaps     —

SLICE  Rename Model                         [state change]
  command  RenameModel { modelId, name }
  fact     ModelRenamed { modelId, name }
  sources  name ← UI;  modelId ← current model
  gaps     —

SLICE  Archive Model                        [state change]
  command  ArchiveModel { modelId }
  fact     ModelArchived { modelId }
  sources  modelId ← current model
  gaps     —

SLICE  Models List                          [state view]
  read model  models { modelId, name, archived, sliceCount, lastEditedAt }
  fed by      ModelCreated, ModelRenamed, ModelArchived
              sliceCount   ← SliceDefined − SliceArchived (scoped by modelId)
              lastEditedAt ← max event timestamp across this model's streams
  sources     name ← ModelCreated/Renamed;  archived ← ModelArchived
  derived     sliceCount, lastEditedAt  (no dedicated fact — see D-derived)
  gaps        —
```

**Discovered — F1 (identifier threading).** `sliceCount` can only be computed if slices know
their `modelId`; the same is true for every catalog query ("entities in THIS model"). So
`modelId` must be an attribute of **every** command + fact in every flow below, and read
models are all scoped by it. Backend events currently carry no `modelId` → **FIX**. It also
relocates name-uniqueness: names are unique **per model**, not globally (the brainstorm's
"globally unique across the whole model" = within one model). → entity-name constraint key
becomes `(modelId, normalized_name)` (**F1b**, amends `backend/src/constraints/entityNames.ts`).

**Discovered — O1 (Export).** Is `Model Exported` a recorded fact (audit) or just a query
(read the current state out)? Export reads the whole model — that's a **state view**
(`model_export` read model, Flow 7), not inherently a state change. Recording an audit fact is
optional. **Decision deferred** → treat Export as a state view; audit fact optional.

---

# Flow 1 — Entity definition (the catalog)

Generic across the **named** entity types: businessFact, command, readModel, wireframe,
automation, translation, externalBusinessFact. Uniform shape; per-type payload differs.

```
SLICE  Define Entity  (e.g. Business Fact)   [state change]
  command  DefineBusinessFact { modelId, entityId, name, fields }
  fact     BusinessFactDefined { modelId, entityId, name, fields }
  sources  entityId ← generated
           name     ← UI input  (unique per model — F1b)
           fields   ← UI (the field editor): list of { fieldName, fieldType }
  gaps     —   (a definition IS the source of its own data — authored content)

SLICE  Update Entity Fields                  [state change]
  command  UpdateBusinessFactFields { modelId, entityId, fields }
  fact     BusinessFactFieldsUpdated { modelId, entityId, fields }
  sources  fields ← UI
  gaps     —

SLICE  Rename / Archive Entity               [state change]
  command  RenameBusinessFact { modelId, entityId, name } → BusinessFactRenamed
  command  ArchiveBusinessFact { modelId, entityId }       → BusinessFactArchived
  sources  name ← UI
  gaps     —

SLICE  Entity Catalog                        [state view]
  read model  entity_catalog { entityId, modelId, entityType, name, archived,
                               definition, contextId? }
  fed by      <T>Defined, <T>Renamed, <T>FieldsUpdated / WireframeContentUpdated,
              <T>Archived  (every named type);  contextId ← Assigned/Cleared (Flow 2)
  sources     name ← *Defined/Renamed;  definition ← *Defined/FieldsUpdated;
              archived ← *Archived;  contextId ← assignment (facts only)
  gaps        —
```

**Per-type `definition` payload:**
- businessFact / command / readModel / externalBusinessFact → `fields: [{fieldName, fieldType}]`.
- wireframe → `content` (layout/text); edited via `UpdateWireframeContent` → *WireframeContentUpdated*.
- automation → `triggerConfig { triggerType ∈ fact|timer|interaction, monitoredReadModelId?, issuedCommandId? }`.
- translation → `mapping { direction ∈ inbound|outbound, pairs: [{externalField, internalField}] }`.

**Discovered — F2 (drop the `context` string from definitions).** Backend
`BusinessFactDefined { entityId, name, context }` carries a free `context` string. But the
brainstorm made **Context its own entity** (a lane) assigned to a fact *later* via a separate
fact (Flow 2), and lane assignment is **deferred + clearable**. A string baked in at define
time contradicts that. **FIX:** `*Defined` carries **no `context`**; the lane lives in
`entity_catalog.contextId`, set by the assignment fact. Name uniqueness is on the raw `name`
(F1b). The earlier "auto-prefix the name from its context" idea (`Payments_OrderCreated`)
can't fire at define time (no context yet) → demote to a **display convention** computed from
the assigned Context, never stored in the name. (Amends `businessFact/events.ts`,
`command/events.ts`, and the catalog.)

**Discovered — F5 (catalog must carry the definition).** Today `entity_catalog` stores only
`{name, context, archived}`. The inspector (W5/6) and canvas (W4) need each entity's **fields/
content** too. **FIX:** fold the `definition` payload into the catalog document (one doc per
entity already), so a single read serves name + type + fields + lane. (Amends
`backend/src/read/entityCatalog.ts`.)

**Discovered — G3 (automation/translation have no edit fact).** Taxonomy gives them only
Defined/Renamed/Archived — but `triggerConfig` and `mapping` are editable. **Add**
`ReconfigureAutomation` → *AutomationReconfigured* and `UpdateTranslationMapping` →
*TranslationMappingUpdated* (the analog of FieldsUpdated). **Resolved** in the **em-automations**
phase (G3); recorded here so the catalog has an edit path.

**Open — O4 (field type).** `fieldType` = a fixed enum (id/string/money/number/bool/ref/…) vs
freeform text? Either is UI-sourced; affects later checkability. Flag; lean fixed-enum + "other".

---

# Flow 2 — Context (lane) + assignment

```
SLICE  Define Context                        [state change]
  command  DefineContext { modelId, contextId, name }
  fact     ContextDefined { modelId, contextId, name }
  sources  contextId ← generated;  name ← UI (user-named lane)
  gaps     —

SLICE  Rename / Archive Context              [state change]
  command  RenameContext {modelId, contextId, name} → ContextRenamed
  command  ArchiveContext {modelId, contextId}      → ContextArchived
  gaps     —

SLICE  Assign Fact To Context                [state change]
  command  AssignBusinessFactToContext { modelId, factId, contextId }
  fact     BusinessFactAssignedToContext { modelId, factId, contextId }
  sources  factId    ← the fact being edited (exists in catalog)
           contextId ← UI selection from `contexts` read model (must exist)
  gaps     —

SLICE  Clear Fact Context                    [state change]
  command  ClearBusinessFactContext { modelId, factId }
  fact     BusinessFactContextCleared { modelId, factId }
  gaps     —

SLICE  Contexts List                         [state view]
  read model  contexts { contextId, modelId, name, archived, factCount }
  fed by      ContextDefined/Renamed/Archived;  factCount ← Assigned − Cleared
  derived     factCount
  gaps        —
```

Notes: the lane is **intrinsic to the fact's identity** (`notes/swimlanes.md`) → stored as
`entity_catalog.contextId`, so it **travels into every placement** automatically (no per-slice
lane). Only `businessFact` / `externalBusinessFact` may be assigned (commands/read models are
lane-agnostic) — the command is rejected for other types.

**Open — O5 (external fact lane).** External facts "get their own lane." Auto-assign a lane at
define, or assign explicitly like internal facts? Lean: explicit, same path, but allow a
distinct "external" rendering. Flag.

---

# Flow 3 — Slice + placement (the snap-slot core)

```
SLICE  Define Slice                          [state change]
  command  DefineSlice { modelId, sliceId, name? }
  fact     SliceDefined { modelId, sliceId, name? }
  sources  sliceId ← generated;  name ← UI (optional)
  gaps     —

SLICE  Place Entity                          [state change]
  command  PlaceEntity { modelId, sliceId, placedEntityId, order }
  fact     EntityPlaced { modelId, sliceId, placedEntityId, slotRole, order }
  sources  placedEntityId ← catalog selection (must exist)
           slotRole       ← COMPUTED from the entity's type (see F3)
           order          ← UI (position within its slot/lane)
  gaps     —

SLICE  Move (reorder) / Remove Placement     [state change]
  command  MoveEntity { modelId, sliceId, placedEntityId, order } → EntityMoved
  command  RemoveEntityFromSlice { modelId, sliceId, placedEntityId } → EntityRemovedFromSlice
  sources  order ← UI
  gaps     —

SLICE  Rename / Archive Slice                [state change]
  command  RenameSlice {modelId, sliceId, name} → SliceRenamed
  command  ArchiveSlice {modelId, sliceId}      → SliceArchived
  gaps     —

SLICE  Slice Canvas  (the money read model)   [state view]
  read model  slice_canvas { sliceId, modelId, name,
                placements: [{ placedEntityId, slotRole, lane, order, name, entityType,
                               definition }],
                relations:  [{ relationId, fromId, toId, kind, meta }],
                scenarios:  [ …auto-surfaced by anchor/fact ids… ] }
  fed by      SliceDefined, EntityPlaced/Moved/Removed                (placement set)
            ⋈ entity_catalog  → name, entityType, definition, lane(=contextId)
            ⋈ relations_graph → edges among visible entities (Flow 4)
            ⋈ scenarios       → rules anchored on / referencing visible entities (Flow 5)
  sources     slotRole ← EntityPlaced;  lane ← entity_catalog.contextId (join, facts only);
              name/type/fields ← catalog;  edges ← relations_graph;  rules ← scenarios
  rules       drop placements whose catalog entry is missing or archived (no ghosts)
  gaps        —
```

**Discovered — F3 (placement = slot/order, lane derived; NOT x/y).** Backend stores
`EntityPlaced { x, y }` (freeform). Snap slots mean the **slot is a function of the entity's
type** — wireframe/automation/translation→`trigger`, command→`command`, readModel→`readModel`
(same band, distinct sub-role), fact/externalFact→`fact`. So the user never picks a slot; the
command supplies only **`order`**, and `slotRole` is **computed at placement** from the type.
The **lane is NOT stored on the placement** — it is the fact's intrinsic `contextId`, joined at
render → no drift, and re-homing a fact's lane (Flow 2) updates every slice for free. x/y
becomes a pure layout-solver output. **FIX** (amends `slice/events.ts`, `slice/slice.ts`,
`read/slicePlacements.ts`).

**Discovered — refines W4 "drag to another slot".** Since slot = type, you **cannot** drag a
command into the facts band. `MoveEntity` is a **reorder within the slot/lane only**; changing
a fact's lane is a Flow-2 re-assignment (global to the fact), not a placement move. **Amends
wireframes W4.**

Placement invariant (one placement per `(slice, entity)`) stays a single-stream rule — the
slice decider already owns it; no cross-aggregate constraint needed.

---

# Flow 4 — Relation (data in: the model graph edges)

```
SLICE  Draw Relation                         [state change]
  command  DrawRelation { modelId, relationId, fromId, toId, kind, meta? }
  fact     RelationDrawn { modelId, relationId, fromId, toId, kind, meta? }
  sources  relationId ← generated
           fromId/toId ← the two placed entities (catalog; must exist + be unarchived)
           kind ← UI selection, constrained to valid kinds for (fromType → toType)
           meta ← UI (open bag; e.g. field-mapping notes)
  valid    (fromType, toType, kind) ∈ Phase-1 pair table — checked vs catalog (evtl. consistent)
  gaps     G1 — RESOLVED (below): outbound target is `externalBusinessFact`, not `externalSystem`

SLICE  Update Relation Info / Remove         [state change]
  command  UpdateRelationInfo { modelId, relationId, kind?, meta } → RelationInfoUpdated
  command  RemoveRelation { modelId, relationId }                  → RelationRemoved
  gaps     —

SLICE  Relations Graph                        [state view]
  read model  relations_graph { relationId, modelId, fromId, toId, kind, meta }
  fed by      RelationDrawn, RelationInfoUpdated, RelationRemoved(→delete)
  sources     kind/meta ← RelationDrawn/InfoUpdated  (STORED, not derived)
  gaps        —
```

**Discovered — F4 (store kind + meta).** Backend `RelationDrawn { entityId, fromId, toId }`
derives kind at read time from the endpoint pair. Translation makes pairs ambiguous (e.g.
`externalFact→readModel` `directTranslation` vs `businessFact→readModel` `feeds`), so **kind
must be stored** on the event + read model; `meta` likewise carries future info layers. The
read-time derivation in `relations_graph`/`slice api` is replaced by a stored field (keep
derivation only as a default suggestion in the UI). **FIX** (amends `relation/events.ts`,
`read/relationsGraph.ts`, `slice/api.ts`).

**G1 — resolved (em-automations).** The `publishes` kind targets an **`externalBusinessFact`**
(yellow, a real catalog type), not a phantom `externalSystem` (removed). Outbound boundary =
`businessFact → translation → externalBusinessFact`, so `DrawRelation` always resolves `toId`.

---

# Flow 5 — Scenario (GWT / GT) (business-rule data)

```
SLICE  Define Scenario (GWT)                 [state change]
  command  DefineScenario { modelId, scenarioId, kind:'GWT', anchorCommandId,
                            given:[{factId, exists, values?}], when:{values?},
                            then: emit:[{factId, values}] | reject | error:{factId, values} }
  fact     ScenarioDefined { …same… }
  sources  scenarioId ← generated;  anchorCommandId ← UI (pick command from catalog)
           given.factId / then.factId ← UI (pick facts from catalog, by GUID)
           values ← UI (concrete example data)
  refs     anchorCommandId + factIds are SOFT references by GUID (command is unaware)
  gaps     —  (dangling ref → out-of-sync flag, not a block)

SLICE  Define Scenario (GT)                  [state change]
  command  DefineScenario { modelId, scenarioId, kind:'GT', anchorReadModelId,
                            given:[orderedFactId…], then:{ projectedState } }   (NO when)
  sources  anchorReadModelId ← UI (pick read model);  given factIds ← UI;  then ← UI example
  gaps     —

SLICE  Update / Archive Scenario             [state change]
  command  UpdateScenario {…} → ScenarioUpdated ;  ArchiveScenario → ScenarioArchived
  gaps     —

SLICE  Scenarios (auto-surface)              [state view]
  read model  scenarios { scenarioId, modelId, kind, anchorId, given, when?, then,
                          referencedEntityIds, outOfSync }
  fed by      ScenarioDefined/Updated/Archived
  indexed     by anchorId AND by every referencedEntityId  → so a slice can pull all
              scenarios touching any entity it shows (W4 auto-surface)
  sources     all content ← Scenario* facts
  derived     outOfSync ← does each referenced relation/entity still exist?
              (checked vs relations_graph + entity_catalog — computed, not a fact)
  gaps        —
```

**Discovered — F6.** The `scenarios` read model must be **queryable by anchor id and by every
referenced fact/command id** (not just by `scenarioId`) — that index is what powers W4's
"GWTs auto-surface wherever their command/facts appear." Add `referencedEntityIds` (the union
of anchorId + given/then factIds) as a queryable projection field. **NEW.**

`outOfSync` is a cross-read-model **derived** flag (a scenario references a `produces` relation
that was later removed → flag it, per `notes/gwt.md`); no dedicated fact. See D-derived.

---

# Flow 6 — Grouping / hierarchy  *(later-stage; lighter pass)*

```
SLICE  Configure Hierarchy                   [state change]
  command  ConfigureGroupingHierarchy { modelId, levels:[name…] }
  fact     GroupingHierarchyConfigured { modelId, levels }
  sources  levels ← UI (ordered, user-named level scheme)

SLICE  Create / Rename / Archive Group       [state change]
  command  CreateGroup { modelId, groupId, level, name, parentId? } → GroupCreated
           RenameGroup → GroupRenamed ;  ArchiveGroup → GroupArchived
  sources  groupId ← generated;  level ∈ configured levels;  name ← UI;  parentId ← a group

SLICE  Assign Slice / Nest Group             [state change]
  command  AssignSliceToGroup {modelId, sliceId, groupId} → SliceAssignedToGroup ; Unassign…
  command  NestGroupUnderParent {modelId, groupId, parentId} → GroupNestedUnderParent ; Unnest…

SLICE  Groups Tree                           [state view]
  read model  groups { groupId, modelId, level, name, parentId?, sliceIds[], archived }
  fed by      Group*, SliceAssigned/Unassigned, GroupNested/Unnested
  sources     all ← Group* facts;  membership is many-to-many (the model is a GRAPH)
  gaps        —
```

Mostly UI-sourced, no deep data gaps. Completeness notes: `level` must be one of the configured
levels (eventually-consistent check vs the hierarchy config); a slice/entity may belong to
several groups (graph membership, not a tree). Full treatment deferred with the structuring phase.

---

# Flow 7 — Publish / Export / Import  *(later-stage; automation + translation slices)*

These are not user-form slices — they are an **automation** (Publish) and a **translation**
(Import) plus a whole-model **state view** (Export). Detailed mechanics → **em-automations** +
`notes/serialization.md`. Sketched here so the completeness trace lands on the right source.

```
SLICE  Model Export                          [state view]
  read model  model_export { modelId, entities[], relations[], slices[], placements[],
                             contexts[], groups[], scenarios[] }   (CURRENT STATE, not history)
  fed by      every Define/Update/Assign/Draw fact in the model (full projection)
  note        current-state snapshot (notes/serialization.md); ids/positions may be cut for
              the AI-specific serialization variant
  gaps        —

SLICE  Publish To GitHub                      [automation + external fact — see em-automations T3]
  reads    model_export (content) + publish_diff (changes since last marker)
  command  PublishModel { modelId, title, description, metadata }   # title/desc/meta ← UI fill-info
  produces External Model Published* { repo, prRef, serializedModel, delta }  # yellow, published lane
           + ModelPublishedToGitHub { modelId, prRef, marker }   # internal marker (back-channel → publish_diff)
           + ModelPublishFailed { reason }                        # on failure (explicit failure process)
  external one-directional software→GitHub; a hand-edit conflict is a SIGNAL at next publish
  scope    session-scoped (the session's tagged changes) — notes/sessions-and-collaboration.md
  read model  publish_diff { modelId, changeCount, lastPublishedMarker }  (DERIVED)

SLICE  Model Import                           [translation slice — see em-automations T1]
  external  "Model File Provided"* (external fact: a JSON document arrives)
  command  ImportModel { targetModelId, document } → ModelImported + every Define*/Draw*/Assign*
           fact (fan-out rebuild);  ModelImportFailed { reason } on an invalid/partial document
  resolved O2 (v1): EXPLICIT replay as Define* commands, entityIds preserved (round-trips with
           Export), into a FRESH model (replace); merge-into-existing is later
```

**O2 — resolved (v1).** Import **replays as Define\* commands** with `entityId`s preserved
(round-trips with Export), into a **fresh** model (replace); merge-into-existing is later. See
`em-automations-results.md` (T1).

---

# Flow A — Identity / Access  *(separate context; built on better-auth)*

A distinct bounded context (`notes/auth-architecture.md`), owned by better-auth + the custom
ES adapter. Listed for total fact coverage; the backwards check is satisfied by that subsystem
(no-plaintext-PII invariant, crypto-shredding, blind-index email lookup). No `modelId` — auth
is model-independent.

```
SLICE  Register                              [state change]
  command  Register { email, password }
  fact     AccountRegistered { userId, emailBlindIndex }   (+ per-user DEK created)
  sources  email/password ← UI;  userId ← generated (better-auth)
           email stored encrypted + as HMAC blind-index (no plaintext PII) — auth-architecture
  gaps     —

SLICE  Verify Email                          [state change]
  command  VerifyEmail { token } → EmailVerified { userId }
  sources  token ← emailed link (out-of-band)
  gaps     —

SLICE  Log In / Log Out                      [state change]
  command  LogIn { email, password } → LoggedIn { userId, sessionId }
  command  LogOut { sessionId }       → LoggedOut { sessionId }
  sources  email/password ← UI;  sessionId ← generated;  email→userId via blind-index lookup
  gaps     —

SLICE  Delete Account                        [state change]
  command  DeleteAccount { userId } → AccountDeleted { userId }   (DEK shredded → irreversible)
  gaps     —

SLICE  Session / Current User                [state view]
  read model  session (better-auth) + user/account projection
  fed by      AccountRegistered, EmailVerified, LoggedIn/Out, AccountDeleted
  sources     all ← auth facts;  guards read this (notes/auth-architecture.md, frontend)
  gaps        —
```

Notes: user/account are ES + crypto-shred; session/verification are plain tables
(`auth-architecture.md`). Email uniqueness uses the same **inline-constraint** pattern as
entity names (blind-index HMAC). Detail deliberately lives in code + that note, not here.

---

# Final verification matrix — every business fact wired + checked

Every fact from `spec/em-brainstorm-results.md` → the command that produces it → the read
model(s) it feeds → status (✓ verified | ⚠ open ref | 🔒 built/auth).

| Business fact | Producing command | Feeds read model(s) | Status |
|---|---|---|---|
| ModelCreated/Renamed/Archived | CreateModel/RenameModel/ArchiveModel | models | ✓ |
| *(Model Exported — dropped: state-view query, not a fact; O1)* | ExportModel = query | model_export | ✓ |
| External Model Published *(ext)* / ModelPublishedToGitHub | PublishModel (automation, T3) | publish_diff | ✓ |
| Model Publish Failed | PublishModel (failure path) | — | ✓ |
| Model File Provided *(ext)* / ModelImported | ImportModel (translation, T1) | (rebuilds model) | ✓ |
| Model Import Failed | ImportModel (failure path) | — | ✓ |
| GroupingHierarchyConfigured | ConfigureGroupingHierarchy | groups | ✓ |
| GroupCreated/Renamed/Archived | CreateGroup/RenameGroup/ArchiveGroup | groups | ✓ |
| SliceAssigned/UnassignedToGroup | AssignSliceToGroup/Unassign | groups | ✓ |
| GroupNested/Un-nested | NestGroupUnderParent/Unnest | groups | ✓ |
| ContextDefined/Renamed/Archived | DefineContext/RenameContext/ArchiveContext | contexts | ✓ |
| BusinessFactAssignedToContext / ContextCleared | AssignBusinessFactToContext / ClearBusinessFactContext | entity_catalog.contextId, contexts | ✓ |
| BusinessFactDefined/Renamed/FieldsUpdated/Archived | DefineBusinessFact/Rename/UpdateFields/Archive | entity_catalog, slice_canvas | ✓ (F2/F5) |
| ExternalBusinessFact Defined/Renamed/FieldsUpdated/Archived | DefineExternalBusinessFact/… | entity_catalog | ✓ (O5) |
| Command Defined/Renamed/FieldsUpdated/Archived | DefineCommand/… | entity_catalog, slice_canvas | ✓ |
| ReadModel Defined/Renamed/FieldsUpdated/Archived | DefineReadModel/… | entity_catalog, slice_canvas | ✓ |
| Wireframe Defined/Renamed/ContentUpdated/Archived | DefineWireframe/…/UpdateWireframeContent | entity_catalog, slice_canvas | ✓ |
| Automation Defined/Renamed/Archived | DefineAutomation/… | entity_catalog | ✓ (G3) |
| AutomationReconfigured | ReconfigureAutomation | entity_catalog | ✓ (G3) |
| Translation Defined/Renamed/Archived | DefineTranslation/… | entity_catalog | ✓ (G3) |
| TranslationMappingUpdated | UpdateTranslationMapping | entity_catalog | ✓ (G3) |
| SliceCreated/Renamed/Archived | DefineSlice/RenameSlice/ArchiveSlice | slice_canvas, models.sliceCount | ✓ |
| EntityPlaced/Moved/RemovedFromSlice | PlaceEntity/MoveEntity/RemoveEntityFromSlice | slice_placements, slice_canvas | ✓ (F3) |
| RelationDrawn/InfoUpdated/Removed | DrawRelation/UpdateRelationInfo/RemoveRelation | relations_graph, slice_canvas | ✓ (F4) |
| Scenario(GWT/GT) Defined/Updated/Archived | DefineScenario/UpdateScenario/ArchiveScenario | scenarios, slice_canvas | ✓ (F6) |
| AccountRegistered/EmailVerified/LoggedIn/LoggedOut/AccountDeleted | Register/VerifyEmail/LogIn/LogOut/DeleteAccount | session/user/account | 🔒 |

**Result:** every business fact is produced by a named command and feeds at least one read
model; every command/read-model attribute traces to a source or a tagged-derived computation.
The non-✓ rows were the deferred items (G1 externalSystem, G3 automation/translation edit
facts, O1/O2 publish/import semantics) — **all now resolved in `em-automations-results.md`**.

---

# Information-completeness — consolidated Gap / Fix log

**FIXES discovered by the backwards walk (amend earlier phases / backend):**

| # | Fix | Amends |
|---|---|---|
| **F1** | `modelId` threads through **every** command/fact/read model; read models scoped by it | all backend events (none carry modelId) |
| **F1b** | Name uniqueness is **per-model** → constraint key `(modelId, normalized_name)` | `constraints/entityNames.ts` |
| **F2** | Drop the `context` **string** from entity definitions; lane = the Context entity via assignment; name-prefix is a display convention, not stored | `businessFact/events.ts`, `command/events.ts`, catalog |
| **F3** | Placement = `{ slotRole(computed from type), order }`; **lane derived** from the fact's `contextId`, not stored on the placement; x/y is layout-solver output | `slice/events.ts`, `slice/slice.ts`, `read/slicePlacements.ts`; refines wireframes W4 (Move = reorder, not cross-slot) |
| **F4** | `RelationDrawn` stores `{ kind, meta }`; `relations_graph` stores kind (was derived) | `relation/events.ts`, `read/relationsGraph.ts`, `slice/api.ts` |
| **F5** | `entity_catalog` carries the `definition` payload (fields/content) + `contextId` | `read/entityCatalog.ts` |
| **F6** | `scenarios` read model indexed by anchorId **and** every referencedEntityId (auto-surface) | new read model |

**Decisions (G1/G3/O1/O2 RESOLVED in `em-automations-results.md`; O4/O5 still open):**

| # | Item | Disposition |
|---|---|---|
| **G1** | `publishes` → `externalSystem` has no catalog endpoint | **RESOLVED** → target is `externalBusinessFact` (yellow); `externalSystem` removed |
| **G3** | automation `triggerConfig` + translation `mapping` have no edit fact | **RESOLVED** → `AutomationReconfigured` / `TranslationMappingUpdated` added |
| **O1** | Export: recorded audit fact vs pure query | **RESOLVED** → state view, no fact; `Model Exported` dropped |
| **O2** | Import semantics (replay-as-commands vs event-log; round-trip; merge/replace) | **RESOLVED (v1)** → explicit replay, ids preserved, fresh model; merge later |
| **O4** | `fieldType`: fixed enum vs freeform | open — lean: fixed enum + "other" |
| **O5** | external-fact lane: auto vs explicit | open — lean: explicit, distinct rendering |

**DERIVED fields (no source fact — tag so the check doesn't chase phantoms):**
`models.sliceCount`, `models.lastEditedAt`, `contexts.factCount`, `publish_diff.changeCount` /
`lastPublishedMarker`, `scenarios.outOfSync`, `slice_canvas` ghost-dropping. These are
projections/metadata computations, not holes.

**Identifiers threading (verified end-to-end):** `modelId` (all), `entityId` (catalog ⋈
placements ⋈ relations ⋈ scenarios), `sliceId` (slice ⋈ placements ⋈ groups), `contextId`
(catalog ⋈ contexts), `relationId`, `scenarioId`. Every read-model field traces to a fact or a
tagged-derived computation; every fact attribute traces to its command or is marked computed;
every command attribute traces to UI input, a read model (automation/translation slices), or a
generated id. **No unexplained data remains** — the open items above are explicit decisions/
later-phase wiring, not missing sources.

---

## Status

- **v1-core flows (0–5): complete + completeness-checked**, with 7 concrete backend fixes
  (F1–F6) surfaced.
- **Later-stage flows (6–7):** groups → structuring phase; **publish/import fully resolved in
  `em-automations-results.md`** (T1/T3; G1/G3/O1/O2 closed).
- Next: **em-scenarios** (attach GWT/GT business rules with concrete example data per slice) —
  the `scenarios` read model + W8 are already shaped for it. Still pending: reflect the
  **F1–F6 + G1/G3 changes into `notes/` + the backend**, since they change real event shapes.
