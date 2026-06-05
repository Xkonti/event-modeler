# Reference: Element Types (canonical)

> [reference 2026-06-05] Source: `source.md`. Our design renames/reshapes some of these — see divergence flags + `../model-structure.md`, `../core-flow.md`, `../terminology.md`.

## The four patterns (the entire vocabulary)

Every system step is one of four **patterns** (compositions), plus business rules (GWT/GT) (ch 3):

1. **State Change** — Command → Event. The **only** way to change the system.
2. **State View** — Event(s) → Read Model. The **only** way to read.
3. **Automation** — State View + gear + State Change (read a view → issue command(s)).
4. **Translation** — External Event → internal Event (bridge external systems).

"You can't invent new patterns" (ch 43) — the constrained vocabulary is the point.

## Element definitions

- **Event** (orange; past-tense fact) — something that **happened**; immutable; the **source of truth**; "what remains when the system is powered off and on" (ch 2, 3). In EM, an event just means *data was persisted* — no assumption of event sourcing (ch 3). → our **business fact** (`../terminology.md`).
- **Command** (blue; imperative intent) — instruction to do something; **can be rejected** (aggregate validates invariants); a *successful* command **always** yields ≥1 event (ch 3, 6). Must supply all data its event persists.
- **Wireframe / Screen** — rough, low-fidelity UI mockup; about **what data is captured**, not UX polish. Drives backwards derivation: screen → read-model fields → event data → command data (ch 12).
- **Read Model / Query** (green) — a **projection/query** over already-stored events; only way to pull data out; many views from same events; any medium (DB, in-memory, CSV) (ch 2, 3). Impl variants: Database-Projected (eventually consistent), Live (folded in-memory, always consistent), Logic (calculated, **no side-effects**), Partial-Live (hybrid) (ch 30–33).
- **Automation / Processor** (gear) — background process triggered by **event, timer, or user interaction**; reads a read model → issues command(s) (one event can fan out to many commands); tested with **GT** (no When). "Most complex part" of an event-sourced system; concerns: eventual consistency, replays, idempotency (ch 3, 26, 35).
- **Translation** — **anti-corruption layer**; converts external data ↔ internal. Flow: consume external record/API → map to a **Command** → submit → internal Event. Usually **no validation**. External Event modeled in **yellow** (non-standard notation). Shields the domain; swap integration → replace one slice. Bidirectional (also publishes internal → external) (ch 24, 26).

## Colors (ch 3 authoritative; book is internally inconsistent)

Event = orange, Command = blue, Read Model = green, External Event = yellow, Automation = gear symbol, context note = white, model-name = pink (left). Ch 12 uses blue/green as *highlight* markers (focus element / marked data), not type colors — flagged inconsistency.

## How they connect (the cycle)

`wireframe|automation → command → (accepted) → event → read model → wireframe|automation → command …`
Commands describe what *should* happen; events what *actually* happened (ch 3).

## DIVERGENCE flags (our tool vs book)

> [open question 2026-06-05]

- **Translation + External Events** — canonical element types our design has **not** modeled. Our `../core-flow.md` only has wireframe/automation/command/fact/read-model. Cross-system integration + anti-corruption is a real gap to consider.
- **Internal vs external events** — book draws a hard boundary; external events are the system's **versioned public API/contract**, never direct internal-event access. Our cross-context story (`../core-flow.md` fan-out) doesn't yet model this contract boundary.
- Naming "business fact" vs "event" — see `../terminology.md`.
