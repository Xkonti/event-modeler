# GWT — Business Rules (Given / When / Then)

How behavioral rules are captured. GWTs are where the **actual business logic** of the model lives — central to the eventual formal requirements (project end goal).

## What a GWT is

> [decision 2026-06-05]

A **GWT** (Given / When / Then) is a rule describing system behavior, expressed over existing catalog entities:

- **GIVEN** — a list of **business facts**: whether each exists or not, and optionally whether it has certain **values** or not (preconditions / current state).
- **WHEN** — the **command** being issued, optionally with specific **values**.
- **THEN** — the outcome, one of:
  - one or more **business facts emitted**, or
  - **rejection** of the command, or
  - emission of a business fact representing an **error to be recorded**.

So a GWT references **commands + business facts** (catalog entities) and ties them into a behavioral rule.

## Anchored on a command

> [decision 2026-06-05]

A GWT is **bound to a command** — its **WHEN**. It *is* that command's accept/reject/emit specification: given some fact-state, when this command is issued, then emit fact(s) / reject / record an error. Every GWT has exactly one anchoring command; the GIVEN facts and THEN outcomes hang off it. (A **GT**, with no When, anchors elsewhere — see below.)

## GT — Given/Then (read-model projection spec)

> [decision 2026-06-05] Resolved via the book — see `reference/gwt-and-gt.md`.

**GT = Given / Then, no When** — used for **read models** (State Views) and the read-model half of **automations**. GIVEN ordered events → THEN the **read model shows specific state**. No command is exercised, so no When. Canonical rule: *When exists ⇔ a command is tested ⇔ a State Change*; no command → GT.

So: **GWT specifies command logic** (state changes, accept/reject/emit); **GT specifies projection logic** (what a read model derives from facts). Both stack under their slice; both auto-surface by reference in our design.

## GWTs are an element type, reused *implicitly*

> [decision 2026-06-05]

GWT (and GT) is **just another element type** — but reused **implicitly**, not by manual placement:

- First considered **binding a GWT to one slice** (a slice = a specific flow, so define its rules in that context).
- Reconsidered: a GWT operates on entities that are "all around" — the commands + facts it references appear in many slices. So instead:
- **A slice automatically pulls in all GWTs/GTs that reference the commands and business facts present in that slice.** The user sees the logic surrounding those entities without placing anything.
- Add a GWT in one slice → it **automatically shows up in every other slice** that references the same command/facts.

So GWTs are **not "explicitly reused"** — they **auto-surface wherever their referenced entities appear**. Unlike placed entities, the user does **not** manage a per-slice position for them; they're pulled in by reference. (Visually they tend to sit **below** the element they concern — see `layers.md`.)

## Second-class citizens: sync & validation

> [decision 2026-06-05]

The **explicit relations** (`model-structure.md`) are the source of truth. **GWTs/GTs are second-class** — an additional layer that *references / suggests* relations but never defines them. So they can fall **out of sync**, and the tool guards that:

- **Removing a relation** (e.g. command → fact) → system **auto-checks** for GWTs that represent that relation, and **prompts** the user: delete those GWTs, or just flag them.
- A GWT can be **flagged out-of-sync / invalid** when it references a relation not defined in the model ("this GWT suggests issuing this command relates to that fact, but no such relation exists").
- **Surfacing**: a validation interface / notifications / pop-ups — e.g. "this change will break this GWT/GT."

Keeps the rule layer honest against the structural truth without making GWTs authoritative. This is one member of a broader **model-integrity** family — see `validation.md` (which also covers the backward **completeness check**).

## Why this matters

GWTs are the model's executable-ish business logic. Capturing them precisely is the bridge from event model → formal requirements / business rules. This is arguably the highest-value content the tool produces.

## Open questions

> [open question 2026-06-05]

- Where does a GWT "live" for **editing** — purely catalog-level (slices are views), or does it have a canonical home?
- How are GIVEN value-conditions and WHEN command-values **expressed** — free text vs structured predicates? Determines whether GWTs become **checkable / executable** later.
- If a GWT references entities that are **never co-present** in any single slice, does it still surface somewhere (so it's not orphaned/invisible)?
