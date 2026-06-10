# Build Plan — F7 → E4b → C1

> **STATUS: IMPLEMENTED 2026-06-10.** 225 backend unit tests, 56 integration
> tests (incl. new `chapterVertical` + F7 catalog cases), 8 e2e specs (incl.
> `chapter.spec.js`) — all green. Self-model rebuilt against a throwaway
> testcontainer backend: 127 entities, 66 slices (all chaptered across the
> 8-chapter band), 198 relations, 17 scenarios, **0 validation findings** (was
> 18 false positives). Rebuild script: `backend/scripts/build-self-model.mjs`
> (`EM_BASE` overrides the target; rerun against devbox once it's up to refresh
> the dev DB copy).
>
> Implementation plan for the three 2026-06-10 self-model-test decisions. Sources:
> `em-commands-results.md` (F7 + Flow 6/C1), `em-automations-results.md` (E4b),
> `em-structuring-results.md` (chunk C1), `em-scenarios-results.md` (A3 GTs, E4b),
> `em-wireframes-results.md` (W5/6 + W10 notes). `notes/` already reconciled.
>
> Order is dependency-driven: F7 is an event-shape change (touches the shared FieldDef),
> E4b is data/spec-only, C1 is a new vertical that reuses existing templates untouched by F7.

---

## F7 — derived markers (`FieldDef.derived?` + readModel `mode`)

**Goal:** A3 validation stops flagging legitimately computed data. Acceptance = the three A3
GTs in `em-scenarios-results.md` § A3 (derived skipped · live skipped · projected-no-feeds
still flagged) + the self-model revalidates with **0** of its 18 false positives.

Event-shape note: both additions are **optional fields with defaults** (`derived` absent =
false; `mode` absent = `projected`), so existing events replay fine — **no wipe strictly
required**; wipe+rebuild stays the routine option (`no-db-migrations` policy).

1. **`shared/fields.ts`** — `FieldDef = { fieldName, fieldType, derived?: boolean }`.
   `hasDuplicateFieldName` unchanged. Sanitize `derived` at the API edge (coerce to boolean,
   drop when false to keep events lean).
2. **`domain/readModel/events.ts`** — `ReadModelDefined` + `ReadModelFieldsUpdated` gain
   `mode?: 'projected' | 'live'`. Export `ReadModelMode`.
3. **`domain/readModel/readModel.ts` (decider)** — pass `mode` through; no new rules
   (mode is descriptive, not guarded).
4. **`domain/readModel/api.ts`** — `POST /read-models` + `PUT /read-models/:id/fields`
   accept `{ fields, mode? }`; parse/whitelist `mode` (reject unknown strings → 400).
   Other catalog APIs only need the `derived` passthrough in their fields parsing
   (businessFact / command / externalBusinessFact — shared sanitizer in `shared/fields.ts`).
5. **`read/entityCatalog.ts`** — readModel `definition` becomes `{ fields, mode }`;
   default `projected` when absent (replay of pre-F7 events).
6. **`read/modelValidation.ts`** —
   - `field-without-source`: skip fields with `derived === true`.
   - `readmodel-without-source`: skip entries whose `definition.mode === 'live'`.
   - (deferred, optional) info-level `derived-unverified` finding kind — the ch 33
     "verify derivable from sourced events" nudge. NOT in v1 scope; advisory noise risk.
7. **Tests** — `modelValidation.test.ts`: the three A3 GTs verbatim. `readModel.test.ts`:
   define-with-mode + update-mode round-trip. `entityCatalog.test.ts`: definition carries mode.
8. **Frontend (`frontend/src/…` inspector)** — W5/6: per-field **derived** checkbox
   (ƒ-prefix rendering on cards), **mode toggle** (projected | live) on readModel inspector;
   plumb through the existing UpdateReadModelFields call.
9. **Self-model refresh** — extend `/tmp/build-eventmodeler.mjs`: mark the derived fields
   (`sliceCount`, `archived`×4, `factCount`, `entityType`, `definition`, `definedAtPosition`,
   `referencedEntityIds`, `outOfSync`, `placements`×2, `relations`, `scenarios`) and set
   `mode:'live'` on `model_export` / `model_validation` / `where_used`. Also add the F7
   fields themselves to the model's `ReadModelDefined`/`FieldsUpdated` fact + `DefineReadModel`/
   `UpdateReadModelFields` command definitions (`mode` attr) — the self-model stays 1:1.
   Rerun, assert `GET /models/:id/validation` → 0 findings.

## E4b — cascade as two automations (no backend change)

**Goal:** model-level conformance with es-book ch 35; reactor untouched (model ≠ deployment).

1. **Backend:** none. `reactors/archiveCascade.ts` stays one reactor. `triggerConfig` stays
   single `issuedCommandId` (decision: `issuedCommandIds[]` rejected).
2. **Self-model script:** replace the single `Entity Archive Cascade` automation with
   - `Cascade Placements` — `{ triggerType:'fact', monitoredReadModelId: slice_placements, issuedCommandId: RemoveEntityFromSlice }`
   - `Cascade Relations` — `{ triggerType:'fact', monitoredReadModelId: relations_graph, issuedCommandId: RemoveRelation }`
   Adjust: `monitoredBy` edges (slice_placements→Cascade Placements, relations_graph→Cascade
   Relations), `reacts` edges (one each), the two React-chapter slices (one automation each),
   and the cascade GT anchor (split into one GT per automation, per em-scenarios E4b note).
3. **Docs:** already done (spec + notes, 2026-06-10).

## C1 — chapter band (new vertical, E1/X1 template)

**Goal:** single-level chapter band; the self-model can express Setup | Catalog | Streams |
Assembly | Rules | React | Analyze. Acceptance = chapters CRUD + assignment GWTs pass,
canvas renders the band, self-model rebuilt with its 7 chapters.

1. **`domain/chapter/`** (mirror `domain/context/` — closest template: named, per-model,
   own namespace, assignment lives on the *other* aggregate's stream):
   - `events.ts`: `ChapterDefined/Renamed/Archived { modelId, chapterId, name }`.
   - `chapter.ts` decider: G-C1 blank-name, G-C4/5/6 missing/archived/re-archive.
   - `commandHandler.ts`, `api.ts`: `POST /chapters`, `PUT /chapters/:id/name`,
     `DELETE /chapters/:id`, `GET /models/:id/chapters` (creation order = band order v1).
   - **`constraints/chapterNames.ts`**: per-model name uniqueness, own namespace
     (mirror `contextNames.ts`; chapters ≠ entity_names — they're organizing units, G-C2 logic).
2. **Slice assignment (on the SLICE stream — mirrors X1 lane-on-fact):**
   - `slice/events.ts`: `SliceAssignedToChapter { modelId, sliceId, chapterId, previousChapterId? }`,
     `SliceChapterCleared { modelId, sliceId, previousChapterId? }`.
   - `slice/slice.ts` decider: assign = **last-write-wins** (E1 mirror); clear-when-none →
     reject ("nothing to clear" — same lean as lane-clear); archived slice → reject.
   - `slice/api.ts`: `PUT /slices/:id/chapter { chapterId }` (pre-check chapter exists, active,
     same model → 422, retry convention), `DELETE /slices/:id/chapter`.
3. **Read models:**
   - `read/chapters.ts`: `{ _id, modelId, name, archived, sliceIds[] }` fed by `Chapter*` +
     assignment events. Chapters NOT in `entity_catalog` (not entities).
   - `read/slicePlacements.ts`: add `chapterId?` (drives the band + export).
   - `read/modelExport.ts`: include `chapters[]`.
4. **Chapter archive with assigned slices:** v1 = **read-time fallback** (slices render
   unchaptered; assignment dangles) — mirrors the "context archived with facts" lean. No
   cascade. Flag as open lean in `notes/open-questions.md` when implementing.
5. **Frontend:** chapter band row above slice headers in the canvas grid
   (`layout-and-rendering.md` — one more shared row; label spans assigned slices in creation
   order); slice-header dropdown to assign/clear; chapter manager inline (mirror lane `+ new`).
6. **Tests:** decider units (define/rename/archive/dup-name/assign-LWW/clear-none) +
   `chapters` projection test + e2e: create chapters, assign slices, band renders.
7. **Self-model refresh:** add the 7 chapters, assign all 60 slices; add the C1 facts/commands/
   read model entities + their slices to the self-model content (keep 1:1).

## Sequencing & verification

1. F7 backend → tests green → frontend → self-model rerun → validation = 0 false positives.
2. E4b self-model script edit (can ride the same rerun as F7's).
3. C1 backend → tests → frontend band → self-model rerun with chapters.
4. Each rerun: fresh model via `/tmp/build-eventmodeler.mjs` (move to `backend/scripts/` or
   `e2e` fixtures if it earns permanence), verify via `GET /models/:id/validation` + export.

**Out of scope (backlogged, recorded):** `MoveSliceAfter` slice reordering
(`em-structuring` C1 note), info-level `derived-unverified` finding, G1 full hierarchy
(chapters become level-1), continuous validation mode.
