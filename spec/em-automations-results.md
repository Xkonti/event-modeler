# Event Modeling — Automations & Translations Results

> Phase 4 (Automations + Translations) for the **event-modeler** app. The em-commands phase
> modeled the **user-driven** slices (a person at a screen issuing a command). This phase finds
> the **background / system-boundary** work that has no direct user action — and resolves the
> items em-commands deferred here (**G1, G3, O1, O2**).
>
> Session date: 2026-06-08. Autonomous. The user confirmed **changing existing events is fine
> (no production deployments)** — so the F-fixes from em-commands and the resolutions below are
> treated as decisions, not just notes. Discipline: model the **flow**, defer the **mechanics**,
> **surface** the timing/failure decisions.

## Recursion + scope

We model the event-modeler itself, so its automations are the app's own background behaviour.
Scan of the model for non-user-driven work:

| Kind | Found in the event-modeler | Section |
|---|---|---|
| **Inbound translation** | Import a model from JSON | **T1** |
| **Outbound state view** | Export a model to JSON (two serializations) | **T2** |
| **Outbound automation + external fact** | Publish a model to GitHub (PR) | **T3** |
| **Reaction** | Scenario out-of-sync flagging | **A1** |
| **Reaction** | Entity-archive cascade / ghost cleanup | **A2** |
| **Analysis** | The information-completeness / validation walk | **A3** |
| **Agent interaction** | AI / MCP participant issuing commands | **A4** |
| **Analysis** | "Show where used" / contributing-facts graph traversal | **A5** |
| **Coordination (FUTURE)** | Session ownership, claims, collision→merge | **A6** |
| **User-driven (cut v1)** | Element status marking (verified/complete/implemented) | **A7** |
| **Identity (built)** | Crypto-shred the DEK on Account Deleted | §Identity |
| **NOT an automation** | Projection consumers + inline constraints = mechanics | §Boundary |
| **Timer** | *(none in v1 — no expiry/scheduling in the modeling domain)* | — |

Three of the reactions turn out **not** to be background automations (A1 scenario-sync, A2
archive-cascade, A7 status-marking) — finding that is part of the value. The system-boundary
three (T1–T3) are the real new v1 slices; A5–A6 + §Identity/§Boundary come from mining `notes/`.

---

## Resolve G1 first — the `externalSystem` phantom

em-commands G1: the `publishes` relation pointed at `externalSystem`, which is not a catalog
entity. **Resolution:** there is no `externalSystem` node. In Event Modeling the thing that
crosses the boundary outward is an **external business fact** (yellow) — which already exists as
an entity type. So the outbound edge is `translation → externalBusinessFact`, not
`translation → externalSystem`. Corrected 4th-pattern pair table:

| From | To | kind | direction |
|---|---|---|---|
| externalBusinessFact | translation | `inbound` | external → in |
| translation | command | `triggers` | external → in |
| externalBusinessFact | readModel | `directTranslation` | external → in (direct variant) |
| businessFact | translation | `outbound` | in → external |
| translation | externalBusinessFact | `publishes` | in → external |

`externalBusinessFact` is dual-role: a **source** when inbound (data arriving), a **target**
when outbound (data leaving) — both yellow, both an integration contract, distinguished by
relation direction. **G1 resolved with no new entity type.** (Amends the brainstorm pair table
+ `notes/core-flow.md`; removes `externalSystem` everywhere.)

---

# T1 — Import a model  *(inbound translation)*

```
TRANSLATION (inbound)  Import Model                        [translation = state change, fan-out]
  external fact  Model File Provided* { document(JSON) }      # yellow, "external/file" lane
  command        ImportModel { targetModelId, document }
  internal       → fans out into a STREAM of internal commands that rebuild the model:
                   CreateModel, Define<T>… , AssignBusinessFactToContext, PlaceEntity,
                   DrawRelation, DefineScenario, ConfigureGroupingHierarchy, …
  produces       ModelImported { modelId, source }    + every Define*/Draw*/Place*/Assign* fact
  variant        EXPLICIT (rebuild via real commands → fresh events that re-derive state)
  todo-list      opens on: Model File Provided   closes on: ModelImported (all sub-commands applied)
  ACL            a change to the JSON schema touches ONLY this translator
  fan-out        one document → N commands (a whole model). Normal.
  defer          transport (upload/paste/CLI), parser mechanics, transactionality → impl
```

- **Completeness:** every rebuilt command's data comes from **the document** (the external
  fact), never UI — the document must be a complete export (it is; T2 produces it). The
  `entityId`s in the file are **preserved** so identity round-trips with Export.
- **Decisions to surface (D-import):**
  - **Merge vs replace** — v1: import into a **fresh empty model** (replace). Merge-into-existing
    (id collisions, diffs) is later. (Resolves O2's merge question for v1.)
  - **Failure** — invalid/partial document → record **`ModelImportFailed { reason }`** + show an
    error screen, rather than a silent throw (business-style explicit failure). All-or-nothing:
    a bad doc imports nothing.
  - **O2 semantics** — **explicit replay** (Define* commands preserving ids), **not** raw
    event-log ingestion. Current-state in → fresh events out; history is not imported
    (`notes/serialization.md`). Confirm.

---

# T2 — Export a model  *(outbound state view; two serializations)*

```
STATE VIEW  Export Model                                   [state view → file artifact]
  reads        model_export (read model): whole model, CURRENT STATE (not history)
                 entities[] (name,type,fields/content,lane), relations[] (from,to,kind,meta),
                 slices[] + placements[] (slotRole,order), contexts[], groups[], scenarios[]
  fed by       every Define*/Update*/Assign*/Draw*/Place*/Scenario* fact in the model
  outputs      two distinct serializations (notes/serialization.md):
                 • automation-JSON — whole-model, round-trips with T1 Import (ids preserved)
                 • AI-semantic     — cuts ids/timestamps, reorganized for comprehension (LOSSY)
  produces     — (a download/file; NOT a domain fact — see O1)
```

- **O1 resolved:** Export is a **state view** (a query that renders the model out). It records
  **no domain fact** — drop `Model Exported` from the fact catalog (amends brainstorm; the user
  OK'd event changes). If an audit trail is ever wanted, add it then; nothing depends on it now
  (publish uses its own marker, T3).
- **Completeness:** `model_export` is fed by the whole model — every field traces to a define/
  draw/assign fact. The AI-semantic variant is a **lossy projection** of the same read model.
- **Decision to surface (D-export):** which serialization is the **GitHub mirror** (T3) —
  automation-JSON (round-trippable) or AI-semantic (readable diffs)? `serialization.md` leaves
  this open. **Lean: automation-JSON** is the mirror (round-trip + import fidelity matter more
  than human-readable diffs); AI-semantic is the MCP/AI channel (A4).

---

# T3 — Publish a model to GitHub  *(outbound automation + external fact)*

```
AUTOMATION  Publish To GitHub                              [automation + external fact]
  trigger      user interaction (W11 "Open Pull Request")   # not a timer; explicit + manual
  reads        model_export (the content to push)
             + publish_diff (changeCount + lastPublishedMarker → what changed since last time)
  issues       PublishModel { modelId, title, description, metadata }   # title/desc/meta ← UI fill-info form
  produces     External Model Published* { repo, prRef, serializedModel(complete), delta }
                 # yellow, "published" lane — the integration contract
             + ModelPublishedToGitHub { modelId, prRef, marker }   # internal marker
  todo-list    opens on: the publish interaction        closes on: External Model Published
               (a failed PR keeps the task open → retried / escalated to manual)
  contract     COMPLETE not sparse (full serialized model + delta), one-directional sw→GitHub
  back-channel ModelPublishedToGitHub → publish_diff resets the "since last publish" baseline (dotted)
  defer        git/GitHub API, auth, branch/PR mechanics, schema versioning → impl
```

- **Completeness:** the **content** comes from `model_export` + `publish_diff` (read models);
  only the **fill-info** (`title`, `description`, `metadata`) is UI — publish is "a deliberate
  act, not a side effect of editing" (`notes/sessions-and-collaboration.md`), so the user
  annotates the change. `publish_diff.changeCount` / `lastPublishedMarker` are **derived**
  (events since the latest `ModelPublishedToGitHub` position). The external fact's
  `serializedModel` ← `model_export` (complete contract). The marker fact closes the todo and
  rebaselines the diff (back-channel).
- **Session-scoping (`notes/sessions-and-collaboration.md`):** a publish carries **only the
  current session's tagged changes**, not the whole-model diff. In v1 (one session) that equals
  "everything since last publish"; multi-session scoping arrives with **A6**. → decision
  **D-publish-scope**.
- **Decisions to surface (D-publish):**
  - **Failure** — PR creation fails → record **`ModelPublishFailed { reason }`** + a manual
    "retry publish" affordance (explicit failure process), not a silent infinite retry. The open
    todo means the next publish naturally retries.
  - **Hand-edit conflict** — sync is **one-directional**; a GitHub-side hand edit surfaces as a
    **PR merge conflict on GitHub**, the "conflict = signal to fix it in the model"
    (`notes/tech-stack.md`). v1 does **not** read GitHub back to detect it in-app. Document the
    boundary.
  - **Timing** — publish is explicit/manual, so there is **no eventual-consistency race** in v1
    (the model is quiescent when the user clicks publish). Noted, not a problem.

---

# A1 — Scenario out-of-sync flagging  *(reaction → turns out NOT to be a background automation)*

The question: when a `produces` relation is removed or an entity archived, the GWT/GT scenarios
referencing it must be flagged (`notes/gwt.md`). Is that a background automation?

**Finding: no.** It decomposes into two non-automation pieces:
1. **Derived flag** — `scenarios.outOfSync` is **computed at read time** by checking each
   scenario's `referencedEntityIds` against `entity_catalog` + `relations_graph` (em-commands
   tagged it derived, F6). No trigger, no command, no fact — the read model just recomputes.
2. **In-flow prompt** — removing a relation already prompts the user *in the same interaction*
   ("delete the dependent scenarios, or just flag them?", gwt.md). That is a synchronous UI
   confirm on the user's `RemoveRelation`/`Archive*` action, **not** background work.

So A1 needs **no automation slice**. (Proactive push-notifications — "this change will break
that GWT" across the model — would be a reaction, but that's deferred beyond v1.) Pen-and-paper
test fails on purpose: there's no task to tick off — the flag is just a live read of state.

---

# A2 — Entity-archive cascade  *(decision → no automation in v1)*

When an entity is archived, its placements and relations become ghosts. Options:
- **(a) read-time ghost-drop** — `slice_canvas` already drops placements whose catalog entry is
  archived/missing, and renders no edges to them. The placement/relation records stay in the
  store but are invisible. **No automation.**
- **(b) cascade-cleanup automation** — `*Archived` → read placements/relations referencing the
  entity → issue `RemoveEntityFromSlice` / `RemoveRelation` per occurrence (fan-out) → removal
  facts; todo opens on archive, closes per removal.

**Lean: (a) for v1.** Archive is terminal (no un-archive command), so dangling refs to a
permanently-archived entity are harmless and hidden. A cleanup automation is pure housekeeping —
defer. **Decision to surface (D-archive):** confirm read-time-drop is acceptable, or do we want
the cascade for a tidy store/export? (Export currently would still carry the dangling refs — a
small reason to prefer (b) later.)

---

# A3 — The completeness / validation walk  *(analysis; the signature feature)*

The information-completeness check (`notes/validation.md`) — the backward walk that finds
attributes with no source (the red arrows) — modeled as the app's own analysis.

```
ANALYSIS  Model Validation                                 [on-demand read model / analysis]
  trigger      on-demand (user/AI runs "validate")   # may also run on-change later
  reads        the whole model graph: entity_catalog (fields), relations_graph (kind),
               scenarios (refs), slice placements
  computes     • read-model field → has a contributing fact?        (completeness)
               • fact attribute  → supplied by its command / computed?
               • command attribute → has a source?
               • GWT/GT-sync: every scenario ref resolves            (= scenarios.outOfSync)
               • cycle-guard: the model graph HAS cycles
                 (fact→readModel→automation→command→fact) — traversal must guard loops
  produces     model_validation (read model): list of gaps { location, missingSource, kind }
               — NOT facts; a live analysis, human/AI-assisted, NOT an auto-gate
  defer        when/where it runs, incremental vs full recompute → impl
```

- This is a **read model / derived analysis**, not a state change — it records no facts and
  **never blocks** a command (validation.md: human/AI-assisted, not auto-gated). It is the
  in-app realization of the very method these specs are built with.
- **Cycle-guard is mandatory** — the model graph is cyclic (`notes/navigation-and-scoping.md`),
  so "where used" / "contributing facts" / the completeness walk must all guard against infinite
  loops. (Carries forward to implementation.)
- **Operates on the fields/data layer** (`notes/validation.md`) — completeness only becomes
  meaningful **once fields are defined** (a deliberate later pass, `process-and-collaboration.md`),
  not from the first sticky. The structural model is valuable before fields exist; the check
  switches on when data does.
- **Decision to surface (D-validate):** on-demand only (v1) vs continuous background recompute
  with notifications (later); and **surfacing** — inline canvas red-arrows vs a report vs a
  punch-list (`notes/validation.md` open). **Lean: on-demand v1, inline red-arrow markers.**

---

# A4 — AI / MCP participation  *(agent interaction; reuses everything)*

```
AUTOMATION  AI Participant                                 [agent interaction trigger]
  trigger      agent action (via MCP / tool call)          # acts like a user, programmatically
  reads        model_export (AI-semantic serialization, T2)  → comprehension input
  issues       the SAME commands a human issues: Define<T>, DrawRelation, PlaceEntity,
               AssignBusinessFactToContext, DefineScenario, …
  produces     the SAME internal facts (no new command/fact types)
  attribution  AI edits belong to an AI session (sessions = attribution bag,
               notes/sessions-and-collaboration.md)
  defer        MCP server, tool schemas, JSON/YAML export channel → later (ai-participation.md)
```

- **Finding:** the AI is **just another command source** — exactly as the brainstorm noted (a
  command may be issued by a UI, an automation, or an AI agent). No new slices; it reuses the
  whole command surface and consumes the AI-semantic export (T2). This confirms the model
  already supports AI participation **by construction** (write-side rules apply identically to
  AI-issued commands — the value of validate-on-write).
- **Decision to surface (D-ai):** AI edits attributed to a distinct **AI session**; MCP exposure
  + the JSON/YAML channel are **deferred** (ai-participation.md). v1 = the surface exists; the
  MCP transport is later.

---

# Additional background work — mined from `notes/`

The user asked to check `notes/` for more background-work requirements. Several surfaced;
most are **collaboration-stage (future)** or clarify what is **not** a domain automation.

## A5 — Graph-traversal queries ("show where used")  *(on-demand analysis)*

```
ANALYSIS  Where-Used / Contributing-Facts                  [on-demand read model / query]
  trigger      user focuses an element (interaction)
  reads        relations_graph + slice_placements + entity_catalog
  produces     neighborhood (read model): the slices/elements that reference the focus,
               or all facts contributing to a read model — as grayed preview nodes / a list
  cycle-guard  MANDATORY — the graph is cyclic (navigation-and-scoping.md)
  defer        preview vs list rendering, lazy expansion → impl
```

Same family as A3 (a graph query, not a state change, records no facts). Powered by entity
identity; the cyclic-graph **loop guard** is shared with A3's completeness walk.

## A6 — Session ownership, claims & collision-merge  *(FUTURE — collaboration stage, NOT v1)*

`notes/sessions-and-collaboration.md`. v1 is **one driver + screen-share, single session** → none
of this is built yet. Captured so v1 makes no decision that designs it out.

- **Conflict PREVENTION is an inline constraint, not a background automation.** An
  `entity_claims(entity_id PK, session_id)` table maintained **inline in the append tx** (same
  shape as `entity_names`, F1b): editing / placing / **referencing** an entity claims it; a
  relation claims **both** endpoints (two upserts, one tx); a double-claim → rollback. This is a
  write-path mechanic (the coordination substrate), surfaced here for context.
- **Session = attribution bag** (not a branch): a read model of `(entity → change-event IDs)` per
  session over the app's own change log; scoped publish (T3) reads it.
- **Collision → live session-merge** (humans reconcile meaning) — a coordination **flow**, never
  an auto data-merge ("not code or a JSON schema… you cannot safely auto-merge a highly-connected
  semantic system"). Explicitly **not** automatable.
- **Open (carried):** claim lifetime/release (on publish? session end? hand-off?), merge UX,
  partial-publish consistency (a scoped delta referencing another session's unpublished entity),
  session boundary, real-time substrate (CRDT/OT/server-authoritative — foundational, deferred).
- **Hard constraint:** the real-time shared-model substrate must not be designed out in v1.

## A7 — Element status marking  *(user-driven; cut from v1)*

`notes/process-and-collaboration.md` + `notes/layers.md`. A toggleable completion layer — mark an
element **verified / complete / implemented**; new elements start unmarked. em-wireframes **cut**
this from v1. It is **user-driven** (`MarkElementStatus { entityId, status }` → `ElementStatusMarked`),
**not** background. One future automation variant: the **AI marks elements "implemented"** as it
generates code (ties to A4 / `ai-participation.md`). Deferred; no v1 fact.

## Identity — crypto-shred on Account Deleted  *(separate context; built)*

`notes/auth-architecture.md`: `AccountDeleted` → the per-user **DEK is deleted** from the keystore
(one DEK shreds the user **and** their accounts; irreversible erasure). A reaction at the identity
boundary, owned by the auth subsystem (not the modeling domain). Listed for completeness.

## §Boundary — what is NOT a domain automation (model-vs-defer)

Per the skill ("model the flow, defer the mechanics"), these are **implementation**, not domain
gears — do **not** model them as automations:

- **Async read-model projection consumers** (`notes/event-sourcing-architecture.md`) — the
  background workers that fold the global log into `entity_catalog` / `slice_placements` /
  `relations_graph` / the new read models. They are the **how** of every read model;
  poll-vs-subscribe is explicitly deferred.
- **Inline constraint projections** (`notes/constraint-inline-projection-pattern.md`) —
  `entity_names` (F1b), `entity_claims` (A6, future), the auth blind-index / account indexes.
  Write-path uniqueness mechanics that run in the append transaction, not background gears.

This boundary matters: the temptation in this phase is to model the processor mechanics; the
projection consumers + constraint projections are exactly that mechanic, and stay deferred.

---

## G3 — automation/translation edit facts (confirm)

em-commands G3: automation `triggerConfig` and translation `mapping` are editable but had no
edit fact. **Confirmed additions** (the user OK'd event changes):
- `ReconfigureAutomation { modelId, entityId, triggerConfig }` → `AutomationReconfigured`
- `UpdateTranslationMapping { modelId, entityId, mapping }` → `TranslationMappingUpdated`

`triggerConfig = { triggerType ∈ fact|timer|interaction, monitoredReadModelId?, issuedCommandId? }`;
`mapping = { direction ∈ inbound|outbound, pairs:[{externalField, internalField}] }`. Both feed
`entity_catalog.definition`. **G3 resolved.**

---

## Swimlanes (external/integration lanes)

Per the skill, external facts get their own lanes:
- **"external/file" lane** — `Model File Provided` (inbound, T1).
- **"published" lane** — `External Model Published` (outbound, T3).

These are `externalBusinessFact`-typed and render distinctly (yellow) from internal facts. They
are the event-modeler's **own** integration contracts (file import format; GitHub publish payload).

---

## Completeness check — automation read models + commands

- **T1 Import:** `ImportModel` data ← the external document (complete export). Fan-out commands'
  data ← document fields. ✓ (gap only on invalid doc → explicit `ModelImportFailed`).
- **T2 Export:** `model_export` ← every model fact (full projection). ✓
- **T3 Publish:** `PublishModel` data ← `model_export` + `publish_diff` (read models, no UI). ✓
  Todo opens on the interaction, closes on `External Model Published`; `publish_diff` is fed by
  the closing marker (back-channel) → baseline resets, no double-publish.
- **A3 Validation:** reads the whole graph; produces a gap list; cycle-guarded. ✓ (analysis, not
  a state change.)
- **A4 AI:** reuses checked commands. ✓

No automation drives a todo-list that lacks a closing condition; no read model is missing its
closing/subtractive fact.

---

## Business decisions to confirm (surfaced, with leans)

1. **D-import — merge vs replace + failure.** v1: import into a **fresh** model (replace);
   invalid doc → **`ModelImportFailed`** + error screen (all-or-nothing). Merge later.
2. **D-export / O1 — Export records no fact** (pure state view); drop `Model Exported`.
3. **D-export mirror — which serialization is the GitHub mirror?** Lean **automation-JSON**;
   AI-semantic = the MCP/AI channel.
4. **D-publish — failure + conflict.** Failure → **`ModelPublishFailed`** + manual retry; GitHub
   hand-edit conflict surfaces as a **PR merge conflict on GitHub** (one-way; not read back in v1).
5. **D-archive — read-time ghost-drop** (no cascade automation) in v1; revisit if export should
   be tidy.
6. **D-validate — on-demand** validation in v1 (not continuous); always advisory, never gates.
7. **D-ai — AI = a command source** under its own session; MCP transport deferred.
8. **D-publish-scope — publish is session-scoped** (the session's tagged changes), with a
   user fill-info form (title/description/metadata). v1 = single session ⇒ "since last publish";
   multi-session scoping ships with **A6**.
9. **A6 (future) open items** — claim lifetime/release, collision-merge UX, partial-publish
   consistency — logged for the collaboration stage; **no v1 decision may design out** the
   real-time shared-model substrate.

(These are the timing/failure/scope decisions the skill says to surface, not silently resolve —
all have a recommended lean; confirm or adjust.)

---

## Gap / Fix log — updates

| Item | Status |
|---|---|
| **G1** externalSystem phantom | **RESOLVED** → outbound target is `externalBusinessFact`; `externalSystem` removed from pair table + notes |
| **G3** automation/translation edit facts | **RESOLVED** → `ReconfigureAutomation` / `UpdateTranslationMapping` added |
| **O1** Export-as-fact? | **RESOLVED** → state view, no fact; drop `Model Exported` |
| **O2** Import semantics | **RESOLVED (v1)** → explicit replay, ids preserved, fresh model; merge later |
| **New facts** | `Model File Provided`* (ext), `ModelImported`, `ModelImportFailed`, `External Model Published`* (ext), `ModelPublishedToGitHub`, `ModelPublishFailed`, `AutomationReconfigured`, `TranslationMappingUpdated` |
| **New read models** | `model_export`, `publish_diff` (derived), `model_validation` (analysis), AI-semantic export (derived) |
| **Dropped** | `Model Exported` fact (Export is a query) |

---

## Status

- **Background work fully scanned** (model + `notes/`). System-boundary flows (T1 Import, T2
  Export, T3 Publish) modeled with todo-lists, contracts, and failure facts. Three suspected
  automations (A1 scenario-sync, A2 archive-cascade, A7 status-marking) shown to be **not**
  background automations (derived / read-time / user-driven). A3 validation + A5 where-used are
  the cycle-guarded **analyses**. A4 AI reuses the whole command surface. **No timer automations
  in v1.**
- **From `notes/`:** A6 session ownership/claims + collision-merge is **future** (an inline
  `entity_claims` constraint + a live session-merge flow — not a v1 automation); the §Boundary
  note pins projection consumers + inline constraints as **mechanics, not domain automations**;
  publish is **session-scoped with fill-info** (D-publish-scope); identity crypto-shred noted.
- **All deferred items (G1/G3/O1/O2) resolved**; 9 business decisions surfaced with leans.
- Next: **em-scenarios** — attach Given/Then to the automation slices (no When), turn the
  surfaced **failure** decisions (`ModelImportFailed`, `ModelPublishFailed`) into explicit error
  flows, and write GWT/GT example data. Before that, the user may want the consolidated
  **F1–F6 + G1/G3 + new facts** reflected into `notes/` and the backend (event shapes change).
