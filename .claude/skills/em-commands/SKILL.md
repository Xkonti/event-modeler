---
name: em-commands
description: >
  Deep dive + runnable workflow for the Commands & Read Models phase of Event Modeling — phase 3,
  where the wireframe handoff + fact timeline become commands (state changes) and read models (state
  views), then the whole flow is walked BACKWARDS to verify every attribute has a real data source
  (the information-completeness check). Runs in two modes: AUTONOMOUS (AI derives + verifies solo,
  asks only on real gaps/decisions) and COOPERATIVE (AI leads the backwards questioning with the user).
  Load to run, lead, or explain commands, read models, or completeness checking.
  Trigger: /em-commands, "define commands", "define read models", "what command produced this fact",
  "where does this data come from", "information completeness", backwards data-flow check.
argument-hint: "[auto | coop | explain <subtopic> | empty → pick a mode]"
allowed-tools: Read, Glob, Grep, AskUserQuestion
---

# em-commands

Phase 3 of Event Modeling — commands + read models, in depth + as a runnable workflow. For the whole process see the **event-modeling** skill; the phase before this is **em-wireframes**. Persist artifacts + decisions via the **notes** skill.

This phase turns the wireframe handoff (per-screen **Data shown** + **Actions**) and the brainstorm's **business-fact timeline** into the two operational halves of the model — **commands** (how data gets in) and **read models** (how data comes out) — and then **walks the flow backwards** to prove every piece of data has a source. The backwards walk *is* the value: it surfaces missing data long before implementation.

## Two modes

Pick from the argument (`auto` / `coop`); if neither given and it's a run, ask once with AskUserQuestion, then commit for the session.

**Autonomous** — the AI derives commands + read models solo from the wireframes + facts, runs the backwards completeness check solo, and resolves what it can. It asks the user only **occasionally** — on a genuine gap (data with no source), or a real design decision (computed vs stored attribute, where an identifier originates, an unstated rule). Produce-then-verify, don't interrogate.

**Cooperative** — the AI is the **session leader** running the backwards questioning: *"what command must have produced this fact?"*, *"where does this attribute come from?"*, *"which fact supplies this screen field?"*. The user answers from domain knowledge; the AI captures, traces, and flags gaps. Augments, doesn't author.

Same destination: commands + read models fully attributed, every attribute traced to a source, gaps either resolved or raised. What differs is who answers the backwards questions. Shared foundation below; mode playbooks follow.

---

# Shared foundation (both modes)

## Command (blue) — the way data gets IN

- A command is an **instruction to do something** ("Add Item", "Clear Cart", "Submit Cart"). Imperative. It's the system's input/parameters.
- A **successful command produces one or more business facts.** Command = what *should* happen; fact = what *did*.
- **A command can have multiple outcomes.** One command may produce several facts — e.g. `Add Item` on a non-existent cart produces `Cart Created` *then* `Item Added`. Order matters (left→right).
- **A command is usually triggered by a user action, but not always.** It can be **issued by an automation** reading a read model (e.g. `Archive Item` off `carts with products`; `Publish Cart` off `submitted cart data`), or by a **translation** of an incoming external fact (e.g. `Change Inventory` from the inventory system). Same rules apply — its data must still trace back (the source is then the read model or the external fact, not UI). Detailed automation/translation modeling is a later phase; here, just recognise the trigger so the completeness trace lands on the right source.
- **A command must supply all data its fact(s) need** — except attributes computed during processing (below). This is the state-change half of the completeness check.

## Read model (green) — the way data comes OUT

- A **query against stored facts** — structured data pulled out of the system. Feeds **screens** and **background processes/automations** (both need data).
- **Only reads data already stored as facts.** You cannot query what was never recorded. Every field must trace to a fact.
- It is **just data + where it comes from** — NOT a table, not technology. Resist implementation drift. A table-with-example-data view can aid understanding, but don't let it imply a specific implementation (might be one table, several, or a document store).
- **Fed by many facts — additive *and* subtractive.** A read model usually projects from several facts that all affect its data — e.g. `cart items` is built from `Item Added` + `Item Removed` + `Cart Cleared` (+ later `Item Archived`). Don't list only the "created" fact; removal/clear/archival facts are contributors too. Add each as you discover it. When a *later* fact retroactively affects an *earlier* read model (data-only, doesn't change the flow), record it as a **backlink** (dotted) and add it to that read model's "fed by" list — e.g. `Item Archived` → `cart items` (ch.17).
- **Use-case-specific, not general-purpose.** Build the read model this use case needs, not a universal one. Use cases shape the model, not the reverse. (e.g. `carts with products`: product-id → list of cart-ids, built just to answer "which carts hold this product?".)

## Slices (the unit being assembled)

Each piece you produce is a **slice** — the smallest functional unit:
- **State Change** slice = Command → Fact(s). (data in)
- **State View** slice = Fact(s) → Read Model. (data out)
Name + box each. Slices are what later get GWT scenarios and become implementation units. Detailed GWT belongs to the next phase, not here.

## The backwards walk (the method)

Think backwards — it focuses on the solution (the data), not the problem. Per use case:

**For each action (→ state change):** ("action" = a user interaction, an automation reading a read model, a timer, or a translated external fact — not only a button click.)
1. Action → name the **command**.
2. Command produces which **fact(s)**? (watch for multiple outcomes.)
3. List the **fact's attributes**. For each: source = a command attribute, OR **computed during processing** (mark it).
4. The **command's attributes** must cover all non-computed fact attributes. For each command attribute, ask *where does this come from?* — UI input, or data the user already has on screen (which itself must trace back). Trace to the **ultimate source fact**. Unresolved → gap.

**For each screen's data (→ state view):**
1. Screen data elements → name the **read model** + its **fields**.
2. Each field → which stored **fact** supplies it (directly or derived). List *all* contributing facts.
3. Unresolved field → gap.

## Information-completeness check (the verification)

The invariants — hold all of them:

- Every **read-model field** ← a fact (or derived from fact data).
- Every **fact attribute** ← its command (or explicitly computed during processing).
- Every **command attribute** ← an available source: UI input, a prior read-model field that itself traces back, **a translated external fact**, or **a read model an automation consumes** (for automation/translation-issued commands). If a command's data comes wholly from a read model or external fact, that's the source — trace to it, don't expect UI input.
- **Identifiers thread consistently** across command → fact → read model. Adding an attribute in one place is not enough — define it **everywhere** along the path.

A missing source = a **gap** (the book's red arrow). Resolve it by finding the real source — very often a **carry-forward attribute** placed on an earlier fact (e.g. `itemId` (ch.12) / `product-id` (ch.16) don't appear from nowhere on `Remove Item`; they originate on `Item Added` and are carried forward). **Resolving a gap can *relocate* it, not close it** — add `itemId` to the command and the red arrow just moves up to the UI; keep walking the chain until it grounds in a real source fact (or an external fact). If no source exists anywhere, that's a real requirements hole → raise it. This is exactly how the model finds gaps (e.g. discovering `product-id` was never modeled) *before* code.

## Recurring sub-patterns

- **Computed vs stored attribute.** A fact attribute may be calculated at processing time rather than passed by the command (e.g. `totalPrice` on `Cart Submitted`). Or maintained incrementally (running total per add/remove). Either is valid — it's a design decision; if unclear, note it and move on, the goal is that all data is *mapped*.
- **Identifiers / aggregateId.** A session/business-concept identifier ties all a flow's facts together (cart-id). Use a plain name (`cart-id`) over `aggregateId` if the technical term confuses stakeholders. It must be present and consistent across the whole flow.
- **Reuse.** The same read model often serves multiple screens/use cases — link/name it as one, don't invent parallels.
- **Automations & translations are produced here too.** This phase isn't only user-facing slices. Per ch.15/16/17 you'll also surface **automation slices** (a read model + processor that issues a command — `Publish Cart`, `Archive Item`) and **translation slices** (incoming external fact → translated to an internal fact → feeds commands/read models — `Inventory Changed`, `Price Changed`). Define their commands/read models and run the **same completeness check** (e.g. the ch.16 red arrow: external inventory data must match a `product-id` that exists in the cart model). Deeper pattern mechanics (gear processors, external/integration-event design, versioning) are out of scope here — see the **event-modeling** skill / a future `em-automations`.
- **Trust stored data.** Read models trust facts already written; don't re-check business rules at read time. Rules are enforced on the **write / state-change side** — GWTs *document* them (next phase) but enforcement is a write-side property, not something deferred.

## Representation

Emit compact, attributed text (persist via **notes**):

```
SLICE  Add Item              [state change]
  command  Add Item { product-id, image, description, price }
  fact     Item Added { product-id, image, description, price }
           Cart Created { cart-id }     (only if cart absent; emitted first)
  sources  product-id ← UI (catalogue selection)
           image/description/price ← product catalogue (different context)
           cart-id ← generated on first add
  gaps     image/description/price → out-of-context (catalogue): boundary assumption,
           not a hole — we model from the cart context and assume products available (ch.12)

SLICE  Cart Items            [state view]
  read model  cart items { product-id, image, description, price, totalPrice }
  fed by      Item Added, Item Removed, Cart Cleared
  sources     totalPrice ← derived (sum of price)
  gaps        —
```

Keep a running **gap log** (red arrows) across the flow: `attribute → missing source → status (resolved how | open question)`.

## What good looks like

- Every screen field and every fact attribute traces to a source; the gap log is empty or every entry is an explicit open question.
- Identifiers consistent end-to-end.
- Read models are use-case-shaped and list all contributing facts.
- NO technology talk baked in (no tables/DB/REST as requirements). NO general-purpose "master" read models.

## Pitfalls

- **Read model fields with no source fact** — the central thing the check exists to catch. Trace or raise.
- **Command missing data its fact needs** — and not marked computed.
- **Inventing data out of thin air** — every attribute has an origin; find the carry-forward source.
- **Inconsistent identifiers** — added in the fact but not the command/read model (or vice versa).
- **Implementation drift** — modeling tables/queries/tech instead of data + source.
- **General-purpose read models** — build for the use case at hand.
- **Re-validating rules at read time** — trust written data; rules live on the write side.

---

# Mode playbook: Autonomous

1. **Load inputs.** Wireframe handoff lists (Data shown / Actions) + the fact timeline + terms/questions, from prompt/notes/em-wireframes output. Confirm context scope.
2. **Define state changes.** Per action: command → fact(s) (watch multiple outcomes) → attribute the fact → attribute the command.
3. **Define state views.** Per screen data block: read model + fields → contributing fact(s).
4. **Walk backwards + check completeness.** Trace every read-model field, fact attribute, and command attribute to a source. Carry forward identifiers/attributes onto earlier facts where needed. Maintain the gap log.
5. **Decide vs flag.** Generic data plumbing → resolve (incl. choosing carry-forward sources, marking computed attrs). Real decisions/holes (computed vs stored, identifier origin, a field with no possible source) → mark as assumption or raise.
6. **Ask occasionally, batched.** One small AskUserQuestion batch for genuine gaps/decisions only.
7. **Output.** Attributed slices + gap log + open questions/assumptions. Offer to persist via **notes**.

Guardrails: data-flow only (no tech); use-case-shaped read models; never invent a source — trace it or flag it.

---

# Mode playbook: Cooperative

1. **Open + frame.** Remind: we're tracing data, backwards, to prove nothing is missing — no implementation talk. Confirm context scope.
2. **Per fact, ask the command.** *"What command must have run for `X` to happen?"* Capture it; catch multiple outcomes (*"does anything else get recorded the first time?"*).
3. **Per screen, ask the read model.** *"What data does this screen show?"* → fields → *"which fact gives us each one?"*.
4. **Trace each attribute with the user.** *"Where does this value come from?"* Push until an ultimate source fact is named, or a gap is admitted. Surface carry-forward needs (*"if Remove needs the itemId, where did the user get it? → it must be on Item Added"*).
   - **Listen for unmodeled terms.** Any noun the user says that isn't yet a fact/command/read model is a likely missing concept — chase it (ch.17: "cart session" surfaced the missing `Cart Created`). This is a prime gap-discovery moment during backwards questioning.
5. **Log + resolve gaps live.** Name the red arrows out loud; let the user resolve from domain knowledge or accept as an open question. Reuse existing read models (*"same cart list as before?"*).
6. **Confirm identifiers thread through.** Check the id appears in command, fact, and read model consistently.
7. **Read back.** Summarize each slice's command/fact/read-model + sources before moving on.
8. **Output.** Same as autonomous; persist via **notes**.

Guardrails: lead the questioning, don't supply the domain answers; offer candidate sources to react to, not decrees; don't override the user's vocabulary or bake in tech.

---

## Output → next phase

Carry forward, per slice: (1) command + attributes with sources, (2) fact(s) + attributes (sources / computed), (3) read model + fields + contributing facts, (4) the gap log (resolved + open). With the data flow proven complete, the next phase — **GWT scenarios** — attaches business rules (Given/When/Then for state changes, Given/Then for state views) to each slice, turning the structure into testable behavior. See the **event-modeling** skill.

## Argument modes

- `auto` → run the Autonomous playbook.
- `coop` (or `cooperative`) → run the Cooperative playbook.
- `explain <subtopic>` → just that section (e.g. `explain backwards walk`, `explain completeness`, `explain read model`).
- empty → if it's a run, ask which mode (auto/coop) then proceed; otherwise this full guide.
