# Event Modeling — Scenarios (GWT/GT) Results

> Phase 5 (Scenarios) for the **event-modeler** app. Turns every slice from Phases 3–4
> (`spec/em-commands-results.md`, `spec/em-automations-results.md`) into **behavioural,
> testable** Given/When/Then rules with concrete example data. State changes → **G/W/T**;
> read models + automations → **G/T** (no When). These scenarios are the **running
> specification**: each becomes a unit test using its example data during implementation.
>
> Session date: 2026-06-08. Autonomous, exhaustive pass. Grounded in `notes/` (rule digest)
> and `~/repos/es-book` (canonical GWT/GT style: ch. 13 + use-cases 14–17). Per the user's
> directive, **nothing is left to interpretation** — even "obvious" structural rules are
> written, lifted into the **Global conventions** so the per-slice blocks stay focused on the
> rules unique to each slice.

## Recursion note (read first)

We are scenario-ing the **event-modeler itself**. Each "command" below is one of the app's own
commands (`DefineBusinessFact`, `PlaceEntity`, `DrawRelation`, …). The **example data** is a
user building a small **"Budgeting"** model — so a scenario for `DefineBusinessFact` shows the
user defining the orange sticky *"Budget Line Recorded"*. Two senses of "fact": the **element
type** the user draws, and the **domain fact of the app** (`BusinessFactDefined` = the user drew
one). Names are kept unambiguous.

---

## How to read these scenarios (notation + legend)

```
COMMAND / SLICE  <name>                          [state change → G/W/T]
  enforces   <invariants this slice owns on the write side>
  trusts     <rules already enforced upstream — NOT re-checked here>
  scenarios
    happy  GIVEN …                 WHEN <command> …   THEN <fact(s)> …      (ex: …)
    rule   GIVEN <invalid state>   WHEN <command> …   THEN reject (reason)  (ex: …)
    edge   GIVEN …                 WHEN …             THEN …                (ex: …)
    multi  GIVEN …                 WHEN …             THEN <fact, fact>     (ordered L→R)

READ MODEL / AUTOMATION  <name>                  [state view / automation → G/T, no When]
  scenarios
    GIVEN <ordered facts>                         THEN read model shows … / fact stored
```

- **GIVEN** = business facts that establish state, **ordered left→right** (order matters).
  Omitted (`GIVEN —`) when no prior state is needed.
- **WHEN** = exactly one command (state changes only).
- **THEN** = one or more facts (ordered L→R) **or** a **reject** (invalid state) **or** an
  explicit **failure fact** (cross-system flows only — see error-decision log).
- tags: `happy` · `rule` (invariant) · `edge` (boundary/zero/empty) · `error` · `multi`
  (ordered multi-fact) · `idem` (idempotency) · `cascade` (fan-out).
- **reject** = the command is refused, no fact persisted (the app's structural validation —
  decision E2 below). It is *behaviour at the edge*, not an implementation detail.

---

## Decisions taken this phase

Four error/rule decisions confirmed by the user 2026-06-08 (they shape outcomes below):

| # | Decision | Effect |
|---|---|---|
| **E1** | **Lane re-assign = last-write-wins** | `AssignBusinessFactToContext` on an already-laned fact **reassigns** (B replaces A); no Clear needed first. |
| **E2** | **Structural failures = command rejection** | Dup name, invalid relation pair, wrong-type lane assign, cross-band placement, 2nd command in a slice → **reject** (THEN: error). Explicit **failure facts** reserved for cross-system flows (`ModelImportFailed`, `ModelPublishFailed`). |
| **E3** | **Duplicate relation = reject** | `DrawRelation` with an existing `(fromId,toId,kind)` → reject ("relation already exists"). Relations have no name, so this is the one relation uniqueness rule. |
| **E4** | **Archive = cascade cleanup** | `<T>Archived` **triggers an automation** that fan-out-removes every placement + relation of the entity (`RemoveEntityFromSlice` / `RemoveRelation`). **Supersedes em-automations A2's read-time-ghost-drop lean** — see *Automations § Entity Archive Cascade*. Ghost-drop remains only as a render-time safety net. |

---

## Global conventions (apply to EVERY slice unless a block overrides)

These are the "obvious" structural rules, stated once so they are unambiguous and **not
duplicated** per command (enforce-once: each lives on the command that writes it).

- **G-C1 — Name non-blank.** Every `Define*` / `Rename*` rejects a blank / whitespace-only
  name. (structural)
- **G-C2 — Name unique per model, across ALL catalog types (F1b).** `(modelId, normalized_name)`
  is unique over the 7 named types (businessFact, externalBusinessFact, command, readModel,
  wireframe, automation, translation). A command named the same as an existing **fact** is
  rejected — one namespace. Enforced by the inline `entity_names` constraint in the append tx
  (tx abort → command fails). **Contexts** have their own per-model name-uniqueness namespace;
  **slices** names are optional + not unique; **groups** + **relations** carry no uniqueness.
- **G-C3 — Archiving releases the name.** Uniqueness (G-C2) is among **non-archived** entities;
  after `<T>Archived` the name is free to reuse. (lean — confirm)
- **G-C4 — Operate-on-missing → reject.** Any command targeting a non-existent id (`entityId`,
  `sliceId`, `contextId`, `relationId`, `scenarioId`, `groupId`, `modelId`) → reject ("not found").
- **G-C5 — Operate-on-archived → reject.** Rename / Update / Place / Assign / Draw-onto an
  **archived** entity (or a command inside an archived slice/model) → reject ("archived; terminal").
- **G-C6 — Re-archive → reject (idem).** `Archive*` on an already-archived entity → reject
  ("already archived"). Archive is terminal — there is **no un-archive command**.
- **G-C7 — No-op rename allowed.** Renaming to the identical current value still emits `*Renamed`
  (decider stays simple; harmless in ES). (lean)
- **G-C8 — Single-model scoping.** Every id a command references must belong to the **same
  `modelId`** as the command; a cross-model reference → reject. Auth (Flow A) is the sole
  model-independent context (no `modelId`).
- **G-C9 — Definitions are self-sourcing.** A `Define*` IS the source of its own authored data
  (name/fields/content) — no GIVEN, no upstream gap. The completeness check (A3) never chases a
  definition's own fields.
- **G-C10 — Validation never gates.** The completeness / out-of-sync analyses (A3, A1) are
  **advisory** — they record no facts and **never reject** a command (`validation.md`). Rejections
  above are structural integrity rules, not completeness rules.

---

## Example world (concrete data threaded through every scenario)

| ref | entity | detail |
|---|---|---|
| `m-budget` | model | "Budgeting" |
| `bf-line` | businessFact | "Budget Line Recorded" · fields `{amount: money, lineId: id}` |
| `bf-logged` | businessFact | "Entry Logged" · fields `{entryId: id}` |
| `bf-year` | businessFact | "Budget Year Defined" · fields `{year: number}` |
| `cmd-record` | command | "Record Budget Line" · fields `{amount, lineId}` |
| `rm-summary` | readModel | "Budget Summary" · fields `{total: money}` |
| `rm-table` | readModel | "Budget Lines Table" |
| `wf-form` | wireframe | "Budget Entry Form" |
| `auto-roll` | automation | "Nightly Roll-Forward" |
| `ext-bank` | externalBusinessFact | "Bank Statement Received" · `{statementJson}` |
| `tr-fx` | translation | "FX Translation" · inbound |
| `ctx-budget` / `ctx-audit` | context | lanes "Budget" / "Audit" |
| `sl-record` | slice | "Record Budget Line" |
| `rel-prod` | relation | `cmd-record →produces→ bf-line` |
| `grp-prepare` | group | "Prepare Year" (level `flow`) |
| `sc-1` | scenario | GWT anchored on `cmd-record` |

---

# Flow 0 — Model lifecycle (the root)

### COMMAND  CreateModel                              [state change → G/W/T]
```
enforces   modelId generation (root id); G-C1 (non-blank name)
scenarios
  happy  GIVEN —                          WHEN CreateModel{name:"Budgeting"}
                                          THEN ModelCreated{modelId:m-budget, name:"Budgeting"}
         ex: server generates modelId = m-budget
  rule   GIVEN —                          WHEN CreateModel{name:"   "}        THEN reject (G-C1 blank)
  edge   GIVEN ModelCreated{name:"Budgeting"}   WHEN CreateModel{name:"Budgeting"}
                                          THEN ModelCreated{modelId:m-budget-2}  (distinct model)
         note: model NAMES are not unique across a user's models (no constraint) — edge, confirm
```

### COMMAND  RenameModel                              [state change → G/W/T]
```
enforces   G-C1, G-C4
scenarios
  happy  GIVEN ModelCreated(m-budget)     WHEN RenameModel{m-budget,"Household Budget"}
                                          THEN ModelRenamed{m-budget,"Household Budget"}
  rule   GIVEN ModelCreated(m-budget)     WHEN RenameModel{m-budget,""}       THEN reject (G-C1)
  edge   GIVEN —                          WHEN RenameModel{m-ghost,"X"}       THEN reject (G-C4 not found)
  idem   GIVEN ModelCreated(m-budget,"Budgeting") WHEN RenameModel{m-budget,"Budgeting"}
                                          THEN ModelRenamed (no-op allowed, G-C7)
```

### COMMAND  ArchiveModel                             [state change → G/W/T]
```
enforces   G-C6
scenarios
  happy  GIVEN ModelCreated(m-budget)     WHEN ArchiveModel{m-budget}         THEN ModelArchived{m-budget}
  rule   GIVEN ModelArchived(m-budget)    WHEN ArchiveModel{m-budget}         THEN reject (G-C6 already archived)
  edge   GIVEN ModelArchived(m-budget)    WHEN RenameModel{m-budget,"X"}      THEN reject (G-C5 archived)
  note   archiving a MODEL does not cascade-clean its entities (E4 cascade is per-entity-archive,
         not model-archive); a model archive simply hides the whole model. — confirm
```

### READ MODEL  models                                [state view → G/T]
```
fields  {modelId, name, archived, sliceCount, lastEditedAt}   (sliceCount, lastEditedAt DERIVED)
scenarios
  GIVEN ModelCreated(m-budget,"Budgeting")
        THEN models: [{m-budget,"Budgeting", archived:false, sliceCount:0}]
  GIVEN ModelCreated, SliceDefined(s1), SliceDefined(s2)
        THEN models: sliceCount = 2
  GIVEN ModelCreated, SliceDefined(s1), SliceDefined(s2), SliceArchived(s1)
        THEN models: sliceCount = 1            (Defined − Archived, scoped by modelId)
  GIVEN ModelCreated, ModelRenamed("Household Budget")
        THEN models: name = "Household Budget"
  GIVEN ModelCreated, ModelArchived
        THEN models: row excluded from the default (active) list   (archived filtered)
  GIVEN any event in the model at t=T
        THEN models: lastEditedAt = T  (max event timestamp across the model's streams)
```

---

# Flow 1 — Entity definition (the catalog)

Generic across the 7 named types. Shown on `businessFact`; per-type deltas listed after. The
command/fact pair and rules are **identical per type** (`Define<T>`, `Update<T>Fields|Content`,
`Rename<T>`, `Archive<T>`); only the `definition` payload differs.

### COMMAND  DefineBusinessFact  (and Define<T>)      [state change → G/W/T]
```
enforces   entityId generation; G-C1 (non-blank); G-C2 (unique per model, all types); G-C9 (self-sourcing)
trusts     — (a definition is the root of its own data; no upstream)
scenarios
  happy  GIVEN —                          WHEN DefineBusinessFact{name:"Budget Line Recorded",
                                               fields:[{amount,money},{lineId,id}]}
                                          THEN BusinessFactDefined{entityId:bf-line, name:…, fields:…}
  rule   GIVEN BusinessFactDefined(bf-line,"Budget Line Recorded")
                                          WHEN DefineCommand{name:"Budget Line Recorded"}
                                          THEN reject (G-C2 name taken — ACROSS types, fact vs command)
  rule   GIVEN —                          WHEN DefineBusinessFact{name:""}     THEN reject (G-C1)
  edge   GIVEN BusinessFactDefined(bf-line), BusinessFactArchived(bf-line)
                                          WHEN DefineBusinessFact{name:"Budget Line Recorded"}
                                          THEN BusinessFactDefined{entityId:bf-line-2}  (G-C3 name freed)
  edge   GIVEN —                          WHEN DefineBusinessFact{name:"X", fields:[]}
                                          THEN BusinessFactDefined{fields:[]}  (zero-field fact allowed;
                                               fields are added later via UpdateFields — validation.md:
                                               structure is valid before fields exist)
  rule   GIVEN —                          WHEN DefineBusinessFact{fields:[{amount,money},{amount,€}]}
                                          THEN reject (duplicate fieldName within one definition) — structural, confirm
  note   fieldType is FREE-FORM TEXT (O4) — "money","id","whatever"; no enum validation
  note   NO context in the payload (F2) — fact is lane-less at definition; lane set in Flow 2
```

**Per-type deltas** (same command/rule shape; payload + edit-command differ):

| Type | `Define<T>` payload | Edit command → fact | Lane control? |
|---|---|---|---|
| businessFact | `fields:[{fieldName,fieldType}]` | `UpdateBusinessFactFields` → `…FieldsUpdated` | yes (Flow 2) |
| externalBusinessFact | `fields:[…]` | `UpdateExternalBusinessFactFields` → `…FieldsUpdated` | **yes, explicit** (O5) |
| command | `fields:[…]` | `UpdateCommandFields` → `…FieldsUpdated` | **no** (lane-agnostic) |
| readModel | `fields:[…]` | `UpdateReadModelFields` → `…FieldsUpdated` | **no** |
| wireframe | `content` (layout/text) | `UpdateWireframeContent` → `WireframeContentUpdated` | **no** |
| automation | `triggerConfig{triggerType∈fact\|timer\|interaction, monitoredReadModelId?, issuedCommandId?}` | `ReconfigureAutomation` → `AutomationReconfigured` (G3) | **no** |
| translation | `mapping{direction∈inbound\|outbound, pairs:[{externalField,internalField}]}` | `UpdateTranslationMapping` → `TranslationMappingUpdated` (G3) | **no** |

### COMMAND  UpdateBusinessFactFields  (and Update<T>Fields / Content)   [state change → G/W/T]
```
enforces   G-C4, G-C5
scenarios
  happy  GIVEN BusinessFactDefined(bf-line, fields:[{amount,money}])
                                          WHEN UpdateBusinessFactFields{bf-line, fields:[{amount,money},{lineId,id}]}
                                          THEN BusinessFactFieldsUpdated{bf-line, fields:[{amount,money},{lineId,id}]}
         note: full-replace semantics — the new field list is authoritative (one schema on the identity)
  edge   GIVEN BusinessFactDefined(bf-line, fields:[{amount,money}])
                                          WHEN UpdateBusinessFactFields{bf-line, fields:[]}
                                          THEN BusinessFactFieldsUpdated{fields:[]}  (clearing all fields allowed)
  rule   GIVEN BusinessFactArchived(bf-line)  WHEN UpdateBusinessFactFields{bf-line,…}  THEN reject (G-C5)
  edge   GIVEN —                          WHEN UpdateBusinessFactFields{bf-ghost,…}   THEN reject (G-C4)
```
```
WIREFRAME variant — UpdateWireframeContent{wf-form, content} → WireframeContentUpdated  (no FieldsUpdated)
AUTOMATION variant — ReconfigureAutomation{auto-roll, triggerConfig} → AutomationReconfigured
  rule  triggerConfig.monitoredReadModelId / issuedCommandId, IF set, must reference existing
        entities of the right type — else reject (G-C4 + type). (advisory completeness aside)
TRANSLATION variant — UpdateTranslationMapping{tr-fx, mapping} → TranslationMappingUpdated
```

### COMMAND  RenameBusinessFact  (and Rename<T>)      [state change → G/W/T]
```
enforces   G-C1, G-C2, G-C4, G-C5, G-C7
scenarios
  happy  GIVEN BusinessFactDefined(bf-line,"Budget Line Recorded")
                                          WHEN RenameBusinessFact{bf-line,"Line Recorded"}
                                          THEN BusinessFactRenamed{bf-line,"Line Recorded"}
         note: references are by ID → safe; auto-surfaced scenarios + relations unaffected
  rule   GIVEN BusinessFactDefined(bf-line), DefineCommand(cmd-record,"Record Budget Line")
                                          WHEN RenameBusinessFact{bf-line,"Record Budget Line"}
                                          THEN reject (G-C2 name taken across types)
  idem   GIVEN BusinessFactDefined(bf-line,"Budget Line Recorded")
                                          WHEN RenameBusinessFact{bf-line,"Budget Line Recorded"}
                                          THEN BusinessFactRenamed (no-op allowed, G-C7)
```

### COMMAND  ArchiveBusinessFact  (and Archive<T>)    [state change → G/W/T]
```
enforces   G-C6;  TRIGGERS Entity Archive Cascade (E4 — see Automations)
scenarios
  happy  GIVEN BusinessFactDefined(bf-line)   WHEN ArchiveBusinessFact{bf-line}   THEN BusinessFactArchived{bf-line}
  rule   GIVEN BusinessFactArchived(bf-line)  WHEN ArchiveBusinessFact{bf-line}   THEN reject (G-C6)
  cascade GIVEN BusinessFactDefined(bf-line), EntityPlaced(bf-line @ sl-record),
                RelationDrawn(rel-prod: cmd-record→bf-line)
                                          WHEN ArchiveBusinessFact{bf-line}
                                          THEN BusinessFactArchived{bf-line}
                                          → (cascade automation) EntityRemovedFromSlice{bf-line@sl-record},
                                             RelationRemoved{rel-prod}
  note   archiving a fact does NOT auto-archive scenarios referencing it — those flag out-of-sync (A1)
```

### READ MODEL  entity_catalog                        [state view → G/T]
```
fields  {entityId, modelId, entityType, name, archived, definition, contextId?}   (F5)
scenarios
  GIVEN BusinessFactDefined(bf-line,"Budget Line Recorded", fields:[{amount,money}])
        THEN entity_catalog: {bf-line, businessFact, "Budget Line Recorded",
                              definition:{fields:[{amount,money}]}, archived:false, contextId:null}
  GIVEN …Defined, BusinessFactFieldsUpdated(bf-line, fields:[{amount,money},{lineId,id}])
        THEN entity_catalog.definition.fields = [{amount,money},{lineId,id}]   (latest wins)
  GIVEN …Defined, BusinessFactRenamed(bf-line,"Line Recorded")
        THEN entity_catalog.name = "Line Recorded"   (entityId stable)
  GIVEN …Defined, BusinessFactAssignedToContext(bf-line, ctx-budget)
        THEN entity_catalog.contextId = ctx-budget
  GIVEN …Defined, BusinessFactArchived(bf-line)
        THEN entity_catalog: row excluded from active queries (archived filtered)
  GIVEN WireframeDefined(wf-form, content:"…"), WireframeContentUpdated(wf-form,"…v2")
        THEN entity_catalog.definition.content = "…v2"
  GIVEN AutomationDefined(auto-roll, triggerConfig:{fact}), AutomationReconfigured(auto-roll,{timer})
        THEN entity_catalog.definition.triggerConfig.triggerType = timer
```

---

# Flow 2 — Context (lane) + assignment

### COMMAND  DefineContext                            [state change → G/W/T]
```
enforces   contextId generation; G-C1; context-name uniqueness per model (own namespace, G-C2 note)
scenarios
  happy  GIVEN —                          WHEN DefineContext{name:"Budget"}
                                          THEN ContextDefined{contextId:ctx-budget, name:"Budget"}
  rule   GIVEN ContextDefined(ctx-budget,"Budget")  WHEN DefineContext{name:"Budget"}
                                          THEN reject (duplicate context name in model)
  rule   GIVEN —                          WHEN DefineContext{name:""}          THEN reject (G-C1)
  note   a context name does NOT collide with a catalog-entity name (separate namespace) —
         a "Budget" lane and a "Budget" read model can coexist
```

### COMMAND  RenameContext / ArchiveContext           [state change → G/W/T]
```
scenarios
  happy  GIVEN ContextDefined(ctx-budget) WHEN RenameContext{ctx-budget,"Budgets"}   THEN ContextRenamed
  happy  GIVEN ContextDefined(ctx-budget) WHEN ArchiveContext{ctx-budget}            THEN ContextArchived
  rule   GIVEN ContextArchived(ctx-budget) WHEN ArchiveContext{ctx-budget}           THEN reject (G-C6)
  edge   GIVEN ContextDefined(ctx-budget), BusinessFactAssignedToContext(bf-line, ctx-budget)
                                          WHEN ArchiveContext{ctx-budget}
                                          THEN ContextArchived{ctx-budget}
         note: facts assigned to an archived lane are NOT auto-cleared — they keep contextId;
               render falls back to "lane-less / archived lane". (lean — confirm; mirrors E4 only
               for catalog entities, not contexts)
```

### COMMAND  AssignBusinessFactToContext              [state change → G/W/T]
```
enforces   only facts may be laned (REJECT other types); context must exist; E1 (last-write-wins)
trusts     fact existence/uniqueness (Flow 1)
scenarios
  happy  GIVEN BusinessFactDefined(bf-line), ContextDefined(ctx-budget)
                                          WHEN AssignBusinessFactToContext{bf-line, ctx-budget}
                                          THEN BusinessFactAssignedToContext{bf-line, ctx-budget}
         note: lane becomes intrinsic to bf-line's identity → travels into EVERY slice showing it
  rule   GIVEN DefineCommand(cmd-record), ContextDefined(ctx-budget)
                                          WHEN AssignBusinessFactToContext{cmd-record, ctx-budget}
                                          THEN reject (commands/read models are lane-agnostic — only facts)
  rule   GIVEN BusinessFactDefined(bf-line)   (no ContextDefined)
                                          WHEN AssignBusinessFactToContext{bf-line, ctx-ghost}
                                          THEN reject (G-C4 context not found)
  edge   GIVEN ExternalBusinessFactDefined(ext-bank), ContextDefined(ctx-ext)
                                          WHEN AssignBusinessFactToContext{ext-bank, ctx-ext}
                                          THEN BusinessFactAssignedToContext{ext-bank, ctx-ext}
         note: external facts use the SAME assign path (O5) — no auto-assign at define
  reassign GIVEN BusinessFactDefined(bf-line), ContextDefined(ctx-budget), ContextDefined(ctx-audit),
                 BusinessFactAssignedToContext(bf-line, ctx-budget)
                                          WHEN AssignBusinessFactToContext{bf-line, ctx-audit}
                                          THEN BusinessFactAssignedToContext{bf-line, ctx-audit}   (E1: B replaces A;
                                               no Clear needed; every slice updates for free)
  idem   GIVEN …AssignedToContext(bf-line, ctx-budget)
                                          WHEN AssignBusinessFactToContext{bf-line, ctx-budget}
                                          THEN BusinessFactAssignedToContext (no-op allowed)
```

### COMMAND  ClearBusinessFactContext                 [state change → G/W/T]
```
scenarios
  happy  GIVEN BusinessFactDefined(bf-line), …AssignedToContext(bf-line, ctx-budget)
                                          WHEN ClearBusinessFactContext{bf-line}
                                          THEN BusinessFactContextCleared{bf-line}  (back to lane-less)
  edge   GIVEN BusinessFactDefined(bf-line)   (never assigned)
                                          WHEN ClearBusinessFactContext{bf-line}
                                          THEN reject (no context assigned — nothing to clear). (lean — confirm)
```

### READ MODEL  contexts                              [state view → G/T]
```
fields  {contextId, modelId, name, archived, factCount}   (factCount DERIVED)
scenarios
  GIVEN ContextDefined(ctx-budget,"Budget")
        THEN contexts: [{ctx-budget,"Budget", archived:false, factCount:0}]
  GIVEN ContextDefined(ctx-budget), …AssignedToContext(bf-line, ctx-budget),
        …AssignedToContext(bf-logged, ctx-budget)
        THEN contexts: factCount = 2
  GIVEN … as above, BusinessFactContextCleared(bf-logged)
        THEN contexts: factCount = 1                     (Assigned − Cleared)
  GIVEN … AssignedToContext(bf-line, ctx-budget), then AssignedToContext(bf-line, ctx-audit)  (E1 reassign)
        THEN contexts: ctx-budget.factCount = 0, ctx-audit.factCount = 1  (reassign nets out)
  GIVEN ContextDefined(ctx-budget), ContextArchived(ctx-budget)
        THEN contexts: row excluded from active list
```

---

# Flow 3 — Slice + placement (the snap-slot core)

### COMMAND  DefineSlice                              [state change → G/W/T]
```
enforces   sliceId generation; name optional (NO G-C1/G-C2 — slice names blank-ok + non-unique)
scenarios
  happy  GIVEN —                          WHEN DefineSlice{name:"Record Budget Line"}
                                          THEN SliceDefined{sliceId:sl-record, name:"Record Budget Line"}
  edge   GIVEN —                          WHEN DefineSlice{}   THEN SliceDefined{sliceId:sl-2, name:null}
         note: unnamed slices allowed (a slice is a freeform bucket — model-structure.md)
  edge   GIVEN SliceDefined(sl-record,"Record Budget Line")
                                          WHEN DefineSlice{name:"Record Budget Line"}
                                          THEN SliceDefined{sliceId:sl-3}  (duplicate slice names allowed)
```

### COMMAND  PlaceEntity                              [state change → G/W/T]
```
enforces   slotRole COMPUTED from type; band cardinality (single vs multi); one placement per (slice,entity)
trusts     entity existence (Flow 1), lane assignment (Flow 2 — lane is derived at render, NOT stored here)
scenarios
  happy  GIVEN SliceDefined(sl-record), DefineCommand(cmd-record)
                                          WHEN PlaceEntity{sl-record, cmd-record}
                                          THEN EntityPlaced{sl-record, cmd-record, slotRole:command}  (no slot — single band)
  happy  GIVEN SliceDefined(sl-record), BusinessFactDefined(bf-line), …(bf-logged)
                                          WHEN PlaceEntity{sl-record, bf-line, slot:0}
                                          THEN EntityPlaced{sl-record, bf-line, slotRole:fact, slot:0}
                                          WHEN PlaceEntity{sl-record, bf-logged, slot:1}
                                          THEN EntityPlaced{sl-record, bf-logged, slotRole:fact, slot:1}
         note: facts/read-models/wireframes are MULTIPLE, slot-numbered (0=top)
  rule   GIVEN SliceDefined(sl-record), DefineCommand(cmd-record), DefineCommand(cmd-other),
               EntityPlaced(cmd-record @ sl-record)
                                          WHEN PlaceEntity{sl-record, cmd-other}
                                          THEN reject (command is SINGLE per slice — one already placed)
         (same rule for automation, translation — single-cardinality bands)
  rule   GIVEN SliceDefined(sl-record), BusinessFactDefined(bf-line), EntityPlaced(bf-line @ sl-record)
                                          WHEN PlaceEntity{sl-record, bf-line, slot:2}
                                          THEN reject (one placement per (slice, entity) — already placed)
  rule   GIVEN —                          WHEN PlaceEntity{sl-record, ent-ghost}   THEN reject (G-C4 not found)
  rule   GIVEN BusinessFactArchived(bf-line)  WHEN PlaceEntity{sl-record, bf-line} THEN reject (G-C5 archived)
  edge   GIVEN SliceDefined(sl-record), DefineWireframe(wf-form), DefineWireframe(wf-other)
                                          WHEN PlaceEntity{sl-record, wf-form, slot:0}, PlaceEntity{sl-record, wf-other, slot:1}
                                          THEN both EntityPlaced (trigger band: wireframes MULTIPLE; D2 resolved)
  note   slot is OMITTED for single-cardinality bands (command/automation/translation); the user
         never picks slotRole (it = f(type)); no x/y anywhere (F3)
  note   NO composition rule — a slice may hold any subset (a lone fact, a wireframe with no
         command, etc.); the 4-pattern shape is guidance, never enforced (model-structure.md)
```

### COMMAND  SwapEntitySlots                          [state change → G/W/T]
```
enforces   both placements in the SAME band; no cross-band moves
scenarios
  happy  GIVEN EntityPlaced(bf-line @ slot 0), EntityPlaced(bf-logged @ slot 1)  (both fact band)
                                          WHEN SwapEntitySlots{sl-record, bf-line, bf-logged}
                                          THEN EntitySlotsSwapped{sl-record, bf-line↔bf-logged}
                                               (now bf-line slot 1, bf-logged slot 0)
  rule   GIVEN EntityPlaced(cmd-record @ command band), EntityPlaced(bf-line @ fact band)
                                          WHEN SwapEntitySlots{sl-record, cmd-record, bf-line}
                                          THEN reject (cross-band swap — band fixed by type)
  rule   GIVEN EntityPlaced(bf-line @ sl-record)   (bf-logged not placed here)
                                          WHEN SwapEntitySlots{sl-record, bf-line, bf-logged}
                                          THEN reject (G-C4 — bf-logged not placed in this slice)
  note   swap is the SOLE reorder primitive; a fact's LANE changes only via Flow-2 re-assign (global),
         never a placement move
```

### COMMAND  RemoveEntityFromSlice                    [state change → G/W/T]
```
scenarios
  happy  GIVEN EntityPlaced(bf-line @ sl-record)   WHEN RemoveEntityFromSlice{sl-record, bf-line}
                                          THEN EntityRemovedFromSlice{sl-record, bf-line}
         note: the entity itself (catalog) is UNTOUCHED — only the placement is removed
  edge   GIVEN SliceDefined(sl-record)   (bf-line not placed)
                                          WHEN RemoveEntityFromSlice{sl-record, bf-line}
                                          THEN reject (not placed here — nothing to remove)
```

### COMMAND  RenameSlice / ArchiveSlice               [state change → G/W/T]
```
scenarios
  happy  GIVEN SliceDefined(sl-record)   WHEN RenameSlice{sl-record,"Record Line"}   THEN SliceRenamed
  happy  GIVEN SliceDefined(sl-record)   WHEN ArchiveSlice{sl-record}                THEN SliceArchived
  rule   GIVEN SliceArchived(sl-record)  WHEN ArchiveSlice{sl-record}                THEN reject (G-C6)
  note   archiving a SLICE drops it from models.sliceCount; placements inside are hidden with it.
         (Per E4, entity-archive cascades; a slice-archive does NOT delete the placed entities —
          they live in the catalog independent of any slice.)
```

### READ MODEL  slice_canvas  (the money read model)  [state view → G/T]
```
fields  {sliceId, modelId, name, placements:[{placedEntityId, slotRole, lane, slot, name, entityType,
         definition}], relations:[{relationId,fromId,toId,kind,meta}], scenarios:[…auto-surfaced…]}
scenarios
  GIVEN SliceDefined(sl-record,"Record Budget Line"),
        DefineWireframe(wf-form), DefineCommand(cmd-record), DefineReadModel(rm-summary),
        BusinessFactDefined(bf-line), BusinessFactAssignedToContext(bf-line, ctx-budget),
        EntityPlaced(wf-form, trigger), EntityPlaced(cmd-record, command),
        EntityPlaced(rm-summary, readModel slot 0), EntityPlaced(bf-line, fact slot 0),
        RelationDrawn(rel-prod: cmd-record→bf-line, kind:produces)
        THEN slice_canvas shows: trigger=[wf-form]; command=[cmd-record] + readModel=[rm-summary];
             fact band lane "Budget"=[bf-line]; edges=[cmd-record→bf-line produces];
             bf-line.lane = "Budget"  (DERIVED from entity_catalog.contextId — NOT stored on placement)
  GIVEN … above, then BusinessFactAssignedToContext(bf-line, ctx-audit)   (re-home, E1)
        THEN slice_canvas: bf-line now renders in lane "Audit" — WITHOUT any placement event
             (lane derived at render → re-home updates every slice for free)
  GIVEN … above, then BusinessFactArchived(bf-line)
        THEN slice_canvas: bf-line dropped (E4 cascade removes the placement; ghost-drop is the
             render-time backstop) and the cmd-record→bf-line edge gone
  GIVEN SliceDefined(sl-record), DefineScenario(sc-1, GWT anchor cmd-record), EntityPlaced(cmd-record)
        THEN slice_canvas.scenarios includes sc-1 (auto-surfaced: cmd-record is present)
```

---

# Flow 4 — Relation (the model graph edges)

### COMMAND  DrawRelation                             [state change → G/W/T]
```
enforces   relationId generation; (fromType,toType,kind) ∈ 11-pair allow-list; endpoints exist+unarchived;
           kind STORED (F4); E3 (no duplicate (from,to,kind))
trusts     entity existence (Flow 1)
scenarios
  happy  GIVEN DefineCommand(cmd-record), BusinessFactDefined(bf-line)
                                          WHEN DrawRelation{fromId:cmd-record, toId:bf-line, kind:produces}
                                          THEN RelationDrawn{relationId:rel-prod, cmd-record→bf-line, produces}
  happy  GIVEN DefineReadModel(rm-summary), DefineWireframe(wf-form)
                                          WHEN DrawRelation{rm-summary, wf-form, kind:displayedBy}
                                          THEN RelationDrawn{…, displayedBy}  (back-edge; read model feeds trigger)
  rule   GIVEN DefineCommand(cmd-record), DefineReadModel(rm-summary)
                                          WHEN DrawRelation{cmd-record, rm-summary, kind:produces}
                                          THEN reject (invalid pair — command→readModel/produces ∉ 11-pair table)
  rule   GIVEN BusinessFactDefined(bf-line)   (cmd-record not defined)
                                          WHEN DrawRelation{cmd-ghost, bf-line, produces}
                                          THEN reject (G-C4 endpoint not found — evtl-consistent catalog read, v1)
  rule   GIVEN DefineCommand(cmd-record), BusinessFactArchived(bf-line)
                                          WHEN DrawRelation{cmd-record, bf-line, produces}
                                          THEN reject (G-C5 endpoint archived)
  rule   GIVEN RelationDrawn(rel-prod: cmd-record→bf-line, produces)
                                          WHEN DrawRelation{cmd-record, bf-line, produces}
                                          THEN reject (E3 — relation already exists, same from/to/kind)
  edge   GIVEN ExternalBusinessFactDefined(ext-bank), DefineTranslation(tr-fx)
                                          WHEN DrawRelation{ext-bank, tr-fx, kind:inbound}
                                          THEN RelationDrawn{…, inbound}  (4th-pattern edge; kind STORED resolves
                                               the externalFact→? ambiguity)
  edge   GIVEN BusinessFactDefined(bf-line), DefineReadModel(rm-summary)
                                          WHEN DrawRelation{bf-line, rm-summary, kind:feeds}
                                          THEN RelationDrawn{…, feeds}
         note: vs externalFact→readModel/directTranslation — SAME shape, different stored kind (why F4 exists)
  note   v1 endpoint-existence is EVENTUALLY consistent (async catalog read), safe single-user.
         Future A6 adds a STRONG inline entity_claims check (both endpoints must be free) — distinct rule.
```

### COMMAND  UpdateRelationInfo / RemoveRelation      [state change → G/W/T]
```
scenarios
  happy  GIVEN RelationDrawn(rel-prod, kind:produces, meta:{})
                                          WHEN UpdateRelationInfo{rel-prod, meta:{note:"computed total"}}
                                          THEN RelationInfoUpdated{rel-prod, kind:produces, meta:{note:…}}
  edge   GIVEN RelationDrawn(rel-prod, produces)
                                          WHEN UpdateRelationInfo{rel-prod, kind:feeds}
                                          THEN reject IF (fromType,toType,feeds) invalid for cmd→fact
                                          (kind change re-validated against the 11-pair table)
  happy  GIVEN RelationDrawn(rel-prod)   WHEN RemoveRelation{rel-prod}              THEN RelationRemoved{rel-prod}
  prompt GIVEN RelationDrawn(rel-prod: cmd-record→bf-line, produces),
               DefineScenario(sc-1, GWT anchor cmd-record, then-emit bf-line)
                                          WHEN RemoveRelation{rel-prod}   (USER-driven)
                                          THEN RelationRemoved{rel-prod}
                                          → app PROMPTS in the same interaction: "delete dependent
                                            scenarios, or flag them out-of-sync?" (gwt.md, A1)
         note: a CASCADE-driven RemoveRelation (from E4 archive) does NOT prompt (automated) —
               it just leaves the scenario flagged out-of-sync (derived).
```

### READ MODEL  relations_graph                       [state view → G/T]
```
fields  {relationId, modelId, fromId, toId, kind, meta}   (kind/meta STORED — F4)
scenarios
  GIVEN RelationDrawn(rel-prod: cmd-record→bf-line, kind:produces, meta:{})
        THEN relations_graph: [{rel-prod, cmd-record, bf-line, produces, {}}]
  GIVEN …Drawn, RelationInfoUpdated(rel-prod, meta:{note:"x"})
        THEN relations_graph: rel-prod.meta = {note:"x"}  (kind unchanged)
  GIVEN …Drawn, RelationRemoved(rel-prod)
        THEN relations_graph: rel-prod absent (hard delete from read model)
```

---

# Flow 5 — Scenario (GWT / GT) — the app modeling its own rules

(Meta-recursion: these are the GWT/GTs of the **DefineScenario** command — i.e. the rules the
app applies when a user authors a scenario.)

### COMMAND  DefineScenario (GWT)                     [state change → G/W/T]
```
enforces   scenarioId generation; kind='GWT' ⇒ exactly ONE anchor command; refs are SOFT (by GUID)
trusts     entity existence is NOT a precondition — dangling refs allowed (flag, don't block)
scenarios
  happy  GIVEN DefineCommand(cmd-record), BusinessFactDefined(bf-year), BusinessFactDefined(bf-line)
                                          WHEN DefineScenario{kind:GWT, anchorCommandId:cmd-record,
                                               given:[{bf-year, exists, values:{year:2026}}],
                                               when:{values:{amount:€5}},
                                               then:{emit:[{bf-line, values:{amount:€5}}]}}
                                          THEN ScenarioDefined{sc-1, …}
  rule   GIVEN DefineReadModel(rm-summary)   (not a command)
                                          WHEN DefineScenario{kind:GWT, anchorCommandId:rm-summary,…}
                                          THEN reject (GWT anchor MUST be a command — rm-summary is a read model)
  rule   GIVEN DefineCommand(cmd-record)  WHEN DefineScenario{kind:GWT, anchorCommandId:cmd-record,
                                               given:[…], when:{…}}   (no then)
                                          THEN reject (GWT requires a THEN: emit | reject | error)
  edge   GIVEN DefineCommand(cmd-record)  WHEN DefineScenario{kind:GWT, anchorCommandId:cmd-record,
                                               given:[], when:{amount:€5}, then:{emit:[{bf-line,…}]}}
                                          THEN ScenarioDefined  (empty GIVEN allowed — happy-path scenario)
  edge   GIVEN —   (cmd-ghost never defined)
                                          WHEN DefineScenario{kind:GWT, anchorCommandId:cmd-ghost,…}
                                          THEN ScenarioDefined{outOfSync:true}  (SOFT ref — dangling allowed,
                                               flagged out-of-sync, NOT rejected — the command is unaware)
  note   THEN is one of: emit:[facts ordered L→R] | reject | error:{fact}. The emit/reject/error
         CHOICE per modeled rule is the USER's domain decision (this is the app letting them record it).
```

### COMMAND  DefineScenario (GT)                      [state change → G/W/T]
```
enforces   kind='GT' ⇒ anchorEntityId ∈ {readModel | automation} (both take G/T); NO when
scenarios
  happy  GIVEN DefineReadModel(rm-summary), BusinessFactDefined(bf-line)
                                          WHEN DefineScenario{kind:GT, anchorEntityId:rm-summary,
                                               given:[bf-line{amount:€5}], then:{projectedState:{total:€5}}}
                                          THEN ScenarioDefined{sc-2, …}
  happy  GIVEN DefineAutomation(auto-roll), BusinessFactDefined(bf-year)
                                          WHEN DefineScenario{kind:GT, anchorEntityId:auto-roll,
                                               given:[bf-year{year:2026}], then:{projectedState:"Prepare Next Year issued"}}
                                          THEN ScenarioDefined{sc-3, …}  (automation anchor — G/T, no When)
  rule   GIVEN DefineReadModel(rm-summary)
                                          WHEN DefineScenario{kind:GT, anchorEntityId:rm-summary,
                                               when:{…}, …}
                                          THEN reject (GT must NOT carry a When — read model/automation has no command)
  rule   GIVEN DefineCommand(cmd-record)  WHEN DefineScenario{kind:GT, anchorEntityId:cmd-record,…}
                                          THEN reject (GT anchor must be a read model / automation, not a command)
```

### COMMAND  UpdateScenario / ArchiveScenario         [state change → G/W/T]
```
scenarios
  happy  GIVEN ScenarioDefined(sc-1)     WHEN UpdateScenario{sc-1, then:{emit:[{bf-line,{amount:€7}}]}}
                                          THEN ScenarioUpdated{sc-1, …}
  happy  GIVEN ScenarioDefined(sc-1)     WHEN ArchiveScenario{sc-1}                 THEN ScenarioArchived{sc-1}
  note   scenarios are SECOND-CLASS — they reference relations/entities but never define them; the
         app may PROMPT ArchiveScenario when its anchor relation is removed (A1), but never forces it.
```

### READ MODEL  scenarios                             [state view → G/T]
```
fields  {scenarioId, modelId, kind, anchorId, given, when?, then, referencedEntityIds, outOfSync}
        indexed by anchorId AND every referencedEntityId (F6 — powers auto-surface)
scenarios
  GIVEN ScenarioDefined(sc-1, GWT anchor cmd-record, given:[bf-year], then:emit:[bf-line])
        THEN scenarios: sc-1 with referencedEntityIds = {cmd-record, bf-year, bf-line}; outOfSync:false
  GIVEN … sc-1, BusinessFactArchived(bf-line)
        THEN scenarios: sc-1.outOfSync = true  (DERIVED — a referenced entity no longer resolves)
  GIVEN … sc-1, RelationRemoved(rel-prod: cmd-record→bf-line)
        THEN scenarios: sc-1.outOfSync = true  (the produces relation it represents is gone — gwt.md)
  GIVEN … sc-1, ScenarioUpdated(sc-1, then:emit:[bf-logged])
        THEN scenarios: sc-1.referencedEntityIds now includes bf-logged; re-evaluated
  GIVEN … sc-1, ScenarioArchived(sc-1)
        THEN scenarios: sc-1 excluded; no longer auto-surfaces
  GIVEN ScenarioDefined(sc-1, anchor cmd-record), EntityPlaced(cmd-record @ sl-record),
        EntityPlaced(cmd-record @ sl-other)
        THEN scenarios: sc-1 auto-surfaces in BOTH sl-record and sl-other (no per-slice position)
```

---

# Flow 6 — Grouping / hierarchy  *(later-stage; lighter — exhaustive but flagged not-v1)*

### COMMAND  ConfigureGroupingHierarchy              [state change → G/W/T]
```
scenarios
  happy  GIVEN ModelCreated(m-budget)    WHEN ConfigureGroupingHierarchy{levels:["flow","feature"]}
                                          THEN GroupingHierarchyConfigured{m-budget, levels:["flow","feature"]}
  edge   GIVEN GroupingHierarchyConfigured(["flow"])
                                          WHEN ConfigureGroupingHierarchy{levels:["flow","feature","area"]}
                                          THEN GroupingHierarchyConfigured  (reconfigure replaces; existing groups
                                               keep their level name — orphaned-level handling deferred to structuring)
  rule   GIVEN ModelCreated              WHEN ConfigureGroupingHierarchy{levels:[]}   THEN reject (≥1 level) (lean)
```

### COMMAND  CreateGroup / RenameGroup / ArchiveGroup [state change → G/W/T]
```
enforces   level ∈ configured levels (evtl-consistent vs hierarchy config)
scenarios
  happy  GIVEN GroupingHierarchyConfigured(["flow","feature"])
                                          WHEN CreateGroup{level:"flow", name:"Prepare Year"}
                                          THEN GroupCreated{grp-prepare, level:flow, name:"Prepare Year"}
  rule   GIVEN GroupingHierarchyConfigured(["flow","feature"])
                                          WHEN CreateGroup{level:"epic", name:"X"}
                                          THEN reject (level "epic" not in configured levels)
  happy  GIVEN GroupCreated(grp-prepare)  WHEN RenameGroup{grp-prepare,"Prep Year"}   THEN GroupRenamed
  happy  GIVEN GroupCreated(grp-prepare)  WHEN ArchiveGroup{grp-prepare}              THEN GroupArchived
  rule   GIVEN GroupArchived(grp-prepare) WHEN ArchiveGroup{grp-prepare}              THEN reject (G-C6)
```

### COMMAND  AssignSliceToGroup / UnassignSliceFromGroup / NestGroupUnderParent / UnnestGroup  [state change → G/W/T]
```
scenarios
  happy  GIVEN GroupCreated(grp-prepare), SliceDefined(sl-record)
                                          WHEN AssignSliceToGroup{sl-record, grp-prepare}
                                          THEN SliceAssignedToGroup{sl-record, grp-prepare}
  edge   GIVEN SliceAssignedToGroup(sl-record, grp-prepare), GroupCreated(grp-other)
                                          WHEN AssignSliceToGroup{sl-record, grp-other}
                                          THEN SliceAssignedToGroup{sl-record, grp-other}
         note: membership is MANY-TO-MANY (a GRAPH, not a tree) — a slice may belong to several groups
  happy  GIVEN SliceAssignedToGroup(sl-record, grp-prepare)
                                          WHEN UnassignSliceFromGroup{sl-record, grp-prepare}
                                          THEN SliceUnassignedFromGroup{sl-record, grp-prepare}
  happy  GIVEN GroupCreated(grp-prepare, flow), GroupCreated(grp-q1, feature)
                                          WHEN NestGroupUnderParent{grp-q1, grp-prepare}
                                          THEN GroupNestedUnderParent{grp-q1, grp-prepare}
  rule   GIVEN GroupCreated(grp-a), GroupCreated(grp-b), GroupNestedUnderParent(grp-b, grp-a)
                                          WHEN NestGroupUnderParent{grp-a, grp-b}
                                          THEN reject (would create a cycle in the nesting tree) (lean — confirm)
```

### READ MODEL  groups                                [state view → G/T]
```
fields  {groupId, modelId, level, name, parentId?, sliceIds[], archived}
scenarios
  GIVEN GroupCreated(grp-prepare, flow,"Prepare Year")
        THEN groups: [{grp-prepare, flow,"Prepare Year", parentId:null, sliceIds:[], archived:false}]
  GIVEN … GroupCreated, SliceAssignedToGroup(sl-record, grp-prepare)
        THEN groups: grp-prepare.sliceIds = [sl-record]
  GIVEN … SliceAssignedToGroup then SliceUnassignedFromGroup(sl-record, grp-prepare)
        THEN groups: grp-prepare.sliceIds = []
  GIVEN … GroupNestedUnderParent(grp-q1, grp-prepare)
        THEN groups: grp-q1.parentId = grp-prepare
```

---

# Flow 7 — Publish / Export / Import  *(system boundary — T1/T2/T3)*

### STATE VIEW  ExportModel                           [state view → G/T, NO fact (O1)]
```
read model  model_export {modelId, entities[], relations[], slices[], placements[], contexts[],
            groups[], scenarios[]}   — CURRENT STATE snapshot, not history
scenarios
  GIVEN ModelCreated(m-budget), DefineBusinessFact(bf-line), DefineCommand(cmd-record),
        DrawRelation(rel-prod), DefineSlice(sl-record), EntityPlaced(cmd-record @ sl-record)
        THEN model_export contains: entities[bf-line, cmd-record], relations[rel-prod],
             slices[sl-record], placements[cmd-record@sl-record]  (whole-model projection)
  GIVEN … above, BusinessFactArchived(bf-line)  (E4 cascade removes its placement + relations)
        THEN model_export EXCLUDES bf-line and its placements/relations (clean — cascade keeps export tidy;
             this is a concrete payoff of choosing E4 cascade over read-time ghost-drop)
  GIVEN ModelCreated(m-budget)   (empty model)
        THEN model_export: all sections empty arrays (valid; export of an empty model)
  note   Export records NO domain fact (O1 — "Model Exported" dropped); two serializations —
         automation-JSON (round-trips with Import, ids preserved) + AI-semantic (LOSSY, ids/timestamps cut).
```

### TRANSLATION  ImportModel                          [inbound translation; fan-out; FAILURE FACT]
```
external fact  Model File Provided* {document(JSON)}   (yellow, "external/file" lane)
scenarios (GT for the translation + GWT for the failure decision)
  GIVEN ModelFileProvided{document: <valid export of "Budgeting">}, targetModel is EMPTY
                                          WHEN ImportModel{targetModelId:m-fresh, document}
                                          THEN ModelImported{m-fresh, source}
                                          → fan-out: CreateModel?, DefineBusinessFact(bf-line, id PRESERVED),
                                            DefineCommand(cmd-record), DrawRelation(rel-prod), … (rebuild)
         note: entityIds PRESERVED → round-trips with Export; explicit REPLAY as Define* commands,
               NOT raw event-log ingestion; history not imported (O2 v1, serialization.md)
  failure GIVEN ModelFileProvided{document: <malformed / partial JSON>}
                                          WHEN ImportModel{m-fresh, document}
                                          THEN ModelImportFailed{reason:"schema invalid at entities[3]"}
                                          → NOTHING imported (all-or-nothing) + error screen
         (E2 exception: this IS a failure fact, not a bare reject — cross-system flow, em-automations D-import)
  failure GIVEN ModelCreated(m-budget) WITH existing entities  (target NOT empty)
                                          WHEN ImportModel{m-budget, document}
                                          THEN ModelImportFailed{reason:"target model not empty — import is initial-load only"}
         (serialization.md: import refuses a populated model; user resets first. v1 = replace into fresh.)
  failure GIVEN ModelFileProvided{document: schemaVersion older than the ~3-version import window}
                                          WHEN ImportModel{…}
                                          THEN ModelImportFailed{reason:"unsupported schema version"}
         (backward-only import window; new app imports old exports, never the reverse)
```

### AUTOMATION  PublishModel (to GitHub)              [outbound automation + external fact; FAILURE FACT]
```
trigger      explicit user interaction (W11 "Open Pull Request")   — not a timer
reads        model_export (content) + publish_diff (changeCount, lastPublishedMarker)
scenarios
  happy  GIVEN ModelCreated(m-budget) + edits since last publish (changeCount > 0)
                                          WHEN PublishModel{m-budget, title:"Q1 budget rules",
                                               description:"…", metadata:{}}    (title/desc/meta ← UI fill-info)
                                          THEN External Model Published* {repo, prRef, serializedModel(COMPLETE), delta}
                                               + ModelPublishedToGitHub{m-budget, prRef, marker}
                                          → publish_diff rebaselines (changeCount → 0; back-channel, dotted)
         note: contract is COMPLETE not sparse; one-directional software→GitHub
  GT     GIVEN BusinessFactDefined(bf-line), ModelPublishedToGitHub(prev marker), edits after the marker
                                          THEN publish_diff.changeCount = (events since marker)   (DERIVED)
  failure GIVEN PublishModel issued, GitHub PR creation fails (network/auth/API)
                                          THEN ModelPublishFailed{reason:"GitHub 403"}
                                          → manual "retry publish" affordance; the publish todo stays OPEN
                                            (explicit failure process — NOT silent infinite retry)
         (E2 exception: failure fact, em-automations D-publish)
  edge   GIVEN External Model Published (last), a human hand-edits the GitHub PR, THEN next PublishModel
                                          THEN surfaces as a PR MERGE CONFLICT on GitHub (conflict = signal);
                                               v1 does NOT read GitHub back in-app (one-directional boundary)
  edge   GIVEN no edits since last publish (changeCount = 0)
                                          WHEN PublishModel
                                          THEN reject ("nothing to publish") OR publish an empty delta — confirm (lean: reject)
```

### READ MODELS  publish_diff / model_validation      [state view → G/T]
```
publish_diff {modelId, changeCount, lastPublishedMarker}  — DERIVED (events since latest marker)
  GIVEN ModelPublishedToGitHub(marker@t1), 3 Define* facts after t1
        THEN publish_diff.changeCount = 3, lastPublishedMarker = marker@t1
  GIVEN … then ModelPublishedToGitHub(marker@t2)
        THEN publish_diff.changeCount = 0  (rebaselined)

model_validation {gaps:[{location, missingSource, kind}]}  — DERIVED analysis, advisory (A3), cycle-guarded
  GIVEN DefineReadModel(rm-summary, fields:[{total,money}]), NO fact feeding "total"
        THEN model_validation.gaps += {location: rm-summary.total, missingSource: "no contributing fact", kind: completeness}
  GIVEN DefineReadModel(rm-summary, fields:[{total}]), BusinessFactDefined(bf-line, fields:[{amount}]),
        RelationDrawn(bf-line→rm-summary, feeds)
        THEN model_validation.gaps: total still flagged UNLESS a field-level source maps amount→total
             (semantic/presence check — fieldType is free-form, O4; NOT strict type-match)
  GIVEN a cyclic graph (fact→readModel→automation→command→fact)
        THEN model_validation completes (cycle-guard / visited-set MANDATORY — never blocks, records no fact)
```

---

# Flow A — Identity / Access  *(separate context; better-auth + ES adapter; no modelId)*

Owned by the auth subsystem; listed for total coverage. Non-negotiable invariant threaded
through every scenario: **no plaintext PII at rest, ever** (`auth-architecture.md`).

### COMMAND  Register                                 [state change → G/W/T]
```
enforces   email uniqueness via blind index (HMAC PK, inline constraint); no plaintext PII; per-user DEK
scenarios
  happy  GIVEN —                          WHEN Register{email:"ben@x.tech", password:"…"}
                                          THEN AccountRegistered{userId, emailBlindIndex}  (+ DEK created)
         note: email stored ENCRYPTED + as HMAC blind-index; never cleartext in log/read-model/index
  rule   GIVEN AccountRegistered(emailBlindIndex of "ben@x.tech")
                                          WHEN Register{email:"ben@x.tech", …}
                                          THEN reject (duplicate email — blind-index PK collision → tx abort)
```

### COMMAND  VerifyEmail / LogIn / LogOut / DeleteAccount  [state change → G/W/T]
```
scenarios
  happy  GIVEN AccountRegistered(userId)  WHEN VerifyEmail{token}     THEN EmailVerified{userId}
         note: token out-of-band (emailed link); v1 may DISABLE verification (table inert) — still spec'd
  happy  GIVEN AccountRegistered, EmailVerified  WHEN LogIn{email,password}  THEN LoggedIn{userId, sessionId}
         note: email→userId via blind-index lookup; sessionId generated (plain session table, not ES)
  rule   GIVEN AccountRegistered          WHEN LogIn{email, WRONG password}   THEN reject ("invalid credentials")
  happy  GIVEN LoggedIn(sessionId)        WHEN LogOut{sessionId}      THEN LoggedOut{sessionId}
  happy  GIVEN AccountRegistered(userId)  WHEN DeleteAccount{userId}  THEN AccountDeleted{userId}
                                          → per-user DEK SHREDDED (irreversible; user + all accounts erased)
  edge   GIVEN AccountDeleted(userId)     WHEN LogIn{email,…}  (stale session / race)
                                          THEN reject "no such user"  (DEK gone → adapter returns null,
                                               auth-architecture.md L64)
```

### READ MODEL  session / current-user                [state view → G/T]
```
scenarios
  GIVEN AccountRegistered, EmailVerified, LoggedIn(sessionId)
        THEN session: {userId, authenticated:true}; guards read this (frontend, write-path only in v1)
  GIVEN … LoggedOut(sessionId)
        THEN session: unauthenticated
  GIVEN AccountDeleted(userId)
        THEN current-user: null  (crypto-shred → no decryptable identity remains)
```

---

# Automations (background / system work)

### AUTOMATION  Entity Archive Cascade  ★ supersedes em-automations A2  [automation → G/T]
```
DECISION E4: archiving an entity TRIGGERS this cascade (chosen over read-time ghost-drop).
trigger      <T>Archived fact (any catalog entity)
reads        slice_placements + relations_graph for refs to the archived entityId
issues       RemoveEntityFromSlice (per placement) + RemoveRelation (per relation) — fan-out
todo-list    opens on <T>Archived   closes when all placements + relations of the entity are removed
scenarios
  GIVEN BusinessFactDefined(bf-line), EntityPlaced(bf-line @ sl-record), EntityPlaced(bf-line @ sl-other),
        RelationDrawn(rel-prod: cmd-record→bf-line), RelationDrawn(rel-feed: bf-line→rm-summary),
        BusinessFactArchived(bf-line)
        THEN (cascade) EntityRemovedFromSlice{bf-line@sl-record}, EntityRemovedFromSlice{bf-line@sl-other},
             RelationRemoved{rel-prod}, RelationRemoved{rel-feed}   (fan-out, each its own fact)
  GIVEN BusinessFactDefined(bf-line)  (no placements, no relations), BusinessFactArchived(bf-line)
        THEN cascade no-op (todo opens + immediately closes — nothing to remove)
  GIVEN cascade RemoveRelation(rel-prod) fires, DefineScenario(sc-1) referencing rel-prod
        THEN scenarios.sc-1.outOfSync = true  (NO user prompt — cascade is automated; the A1 prompt is
             only for USER-driven RemoveRelation)
  note   ghost-drop in slice_canvas remains as a render-time backstop for the brief window before the
         cascade completes (eventual consistency). Export reads post-cascade → tidy (no dangling refs).
  note   em-automations A2 + D-archive already reconciled to cascade cleanup (read-time-drop → cascade).
```

### A1 — Scenario out-of-sync flagging  *(NOT an automation — derived + in-flow prompt)*
```
- DERIVED: scenarios.outOfSync recomputed at read (refs vs entity_catalog + relations_graph). No fact.
- IN-FLOW PROMPT: USER-driven RemoveRelation / Archive* prompts "delete dependent scenarios or flag?"
  synchronously in the same interaction (gwt.md). Not background work.
GT  GIVEN ScenarioDefined(sc-1 refs bf-line), BusinessFactArchived(bf-line)
        THEN scenarios.sc-1.outOfSync = true   (live read of state — no trigger, no command, no fact)
```

### A3 — Model Validation / A5 — Where-Used  *(on-demand analyses; G/T)*
```
- Read-only graph analyses; record NO facts; advisory; cycle-guard MANDATORY (graph is cyclic).
A3 GT (completeness) — see model_validation above.
A5 GT  GIVEN RelationDrawn(rel-feed: bf-line→rm-summary), RelationDrawn(rel-prod: cmd-record→bf-line)
           THEN where-used(bf-line) = {fed-by: cmd-record (via produces), feeds: rm-summary (via feeds)}
           (cycle-guarded traversal; grayed-preview neighborhood — navigation-and-scoping.md)
```

### A4 — AI / MCP Participant  *(agent interaction; reuses the whole command surface)*
```
- The AI is JUST ANOTHER COMMAND SOURCE — issues the SAME Define*/Draw*/Place*/Assign*/DefineScenario
  commands a human does, producing the SAME facts. No new slices, no new rules.
GT  GIVEN AI session active, AI reads model_export (AI-semantic serialization)
        WHEN AI issues DefineBusinessFact{name:"Budget Line Recorded",…}
        THEN BusinessFactDefined  — validated by the EXACT SAME write-path rules (G-C1/G-C2/…); the
             value of validate-on-write: AI-issued commands obey every invariant by construction
  attribution: AI edits belong to a distinct AI session (sessions = attribution bag). MCP transport deferred.
```

---

# Error-decision log (consolidated)

`rule → encoding → status`

| Rule / failure | Encoding | Status |
|---|---|---|
| Blank name (G-C1) | reject | decided (structural) |
| Duplicate name per model, across types (G-C2) | reject (inline constraint, tx abort) | decided (F1b) |
| Operate-on-missing / archived / re-archive (G-C4/5/6) | reject | decided (structural) |
| Lane assign to non-fact type | reject | decided (E2) |
| Lane re-assign on already-laned fact | last-write-wins (no error) | decided (E1) |
| Clear lane when none assigned | reject ("nothing to clear") | lean — confirm |
| 2nd command/automation/translation in a slice (single band) | reject | decided (E2) |
| Cross-band placement / swap | reject | decided (F3 + E2) |
| Place same entity twice in a slice | reject (one placement per (slice,entity)) | decided |
| Invalid relation type-pair | reject | decided (E2) |
| Relation endpoint missing / archived | reject (evtl-consistent v1) | decided |
| Duplicate relation (same from/to/kind) | reject | decided (E3) |
| Relation kind-change to invalid pair (UpdateRelationInfo) | reject | decided |
| GWT anchor not a command / no THEN / GT with a When | reject | decided (structural) |
| Scenario dangling ref (anchor/fact removed) | NOT rejected → outOfSync flag | decided (soft ref) |
| Group level not in configured scheme | reject | decided |
| Group nesting cycle | reject | lean — confirm |
| **Import: malformed / partial document** | **failure fact** `ModelImportFailed` + error screen, all-or-nothing | decided (E2 carve-out) |
| **Import: target model not empty** | **failure fact** `ModelImportFailed` | decided (serialization.md) |
| **Import: unsupported schema version** | **failure fact** `ModelImportFailed` | decided (~3-version window) |
| **Publish: PR creation fails** | **failure fact** `ModelPublishFailed` + manual retry, todo stays open | decided (E2 carve-out) |
| Publish: GitHub hand-edit conflict | GitHub-side PR merge conflict (not read back v1) | decided (one-directional) |
| Publish: nothing to publish (changeCount 0) | reject | lean — confirm |
| Register: duplicate email | reject (blind-index collision) | decided (auth) |
| Login: wrong credentials | reject | decided (auth) |
| Login after account deletion | reject "no such user" (DEK shredded) | decided (auth) |
| Validation / completeness / where-used failures | NEVER reject (advisory, no fact) | decided (G-C10) |

**Principle applied (book ch.15):** every invariant is enforced **once, on its write command**;
no rule is re-checked downstream (e.g. lane-only-on-facts lives on `AssignBusinessFactToContext`,
not re-validated on `PlaceEntity`; band cardinality lives on `PlaceEntity`, not on `DrawRelation`).
Read paths **trust** stored data.

---

# Open questions carried to Structuring (Phase 6)

1. **Model-name uniqueness** — currently none (two "Budgeting" models allowed). Confirm or add
   per-user uniqueness.
2. **Clear-lane-when-none** — reject vs no-op. (lean: reject)
3. **Context archived while facts assigned** — auto-clear those facts vs leave dangling contextId.
   (lean: leave; render fallback) — note this is the ONE place E4 cascade does *not* extend
   (contexts aren't catalog entities); confirm the asymmetry is intended.
4. **Publish with zero changes** — reject vs empty delta. (lean: reject)
5. **Group nesting cycle guard** + orphaned group level on hierarchy reconfigure — full treatment
   deferred to structuring.
6. **GIVEN-value / WHEN-value expression** (`gwt.md` L68) — free text vs structured predicates;
   determines how checkable scenarios are at read time. Affects A3 semantic checks.
7. **Orphan GWT surfacing** (`gwt.md` L69) — a scenario whose referenced entities never co-occur
   in any single slice: where does it render?
8. **Duplicate fieldName within one definition** — reject (assumed structural); confirm.
9. **A6 (future, must not be designed out):** the inline `entity_claims` "both endpoints free"
   relation check, claim lifetime/release, collision→merge flow, partial-publish consistency.

---

## Status

- **Every command across Flows 0–7 + A has GWT scenarios; every read model + automation has GT
  scenarios** — happy path + each invariant + edges/errors, with concrete example data from the
  "Budgeting" example world. State changes use G/W/T; read models + automations use G/T.
- **"Obvious" rules captured** as Global conventions (G-C1…G-C10) so nothing is left to
  interpretation, without duplicating a rule across slices (enforce-once discipline).
- **4 decisions confirmed** (E1 reassign LWW · E2 structural=reject · E3 dup-relation=reject ·
  E4 archive=cascade) + the existing Import/Publish failure facts → full **error-decision log**.
- **E4 supersedes em-automations A2** (read-time ghost-drop → cascade cleanup). The new **Entity
  Archive Cascade** automation is modeled; **`spec/em-automations-results.md` A2 / D-archive
  already reconciled to match**.
- **9 open questions** carried to **Structuring** (Phase 6 — the last phase): swimlanes/chapters,
  alternative/error flows split into their own models, and the carried decisions above.
- These scenarios ARE the running specification → unit tests using the example data at
  implementation time.
