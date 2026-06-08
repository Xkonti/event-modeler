---
name: em-automations
description: >
  Deep dive + runnable workflow for the Automation & Translation patterns of Event Modeling — the
  background/glue work: processes triggered by a fact/timer/interaction that read a read model and
  issue command(s), and the translation of data to/from external systems. Covers the automation
  anatomy, the Processor-Todo-List coordination model, inbound/outbound translations, external
  business facts (integration contract / anti-corruption layer), what to MODEL vs DEFER, and the
  business decisions to SURFACE (eventual consistency, failure processes). Runs in two modes:
  AUTONOMOUS (AI models them solo, flags decisions) and COOPERATIVE (AI leads the questioning).
  Trigger: /em-automations, "automation", "background process", "processor", "translation",
  "external system / integration", "publish to other systems", "react to an event", "todo-list pattern",
  "saga", "this should happen automatically".
argument-hint: "[auto | coop | explain <subtopic> | empty → pick a mode]"
allowed-tools: Read, Glob, Grep, AskUserQuestion
---

# em-automations

The **Automation** and **Translation** patterns of Event Modeling — in depth + as a runnable workflow. For the whole process see the **event-modeling** skill; the phase that defines plain commands/read models is **em-commands** (the completeness check there applies here too). Persist artifacts + decisions via the **notes** skill.

These two patterns are how the model handles everything that *isn't* a direct user action against a screen: background work, reactions to facts, scheduled jobs, and talking to other systems. They are the hardest part of Event Modeling to get right — and the part where the biggest temptation is to model *how* it works instead of *what flows*. The discipline: model the information flow, defer the mechanics, and **surface the business decisions** (timing, failure) that hide inside background work.

> Note on naming: the user referred to this as "es-automations"; the skill family uses the `em-` prefix (Event Modeling), so it's `em-automations`. Same thing.

## Two modes

Pick from the argument (`auto` / `coop`); if neither given and it's a run, ask once with AskUserQuestion, then commit for the session.

**Autonomous** — the AI identifies automations + translations from the fact timeline / existing command+read-model model, models each (trigger, read model, command(s), fact(s), swimlane, todo-list shape), runs the completeness check, and resolves what it can. It asks the user only **occasionally** — on the genuine business decisions background work always hides (is a timing race acceptable? what happens on failure? one command or many?). Produce-then-verify, don't interrogate.

**Cooperative** — the AI is the **session leader** asking the automation-revealing questions: *"does anything happen automatically when X?"*, *"is this triggered by a fact, a timer, or a person?"*, *"how does the process know it's done?"*, *"is it OK if this is delayed or runs twice?"*, *"what if it fails?"*. The user answers from domain knowledge; the AI captures + flags. Augments, doesn't author.

Same destination: each automation/translation modeled as flow (not mechanics), completeness-checked, with its hidden business decisions surfaced. Shared foundation below; mode playbooks follow.

---

# Shared foundation (both modes)

## What an automation is

An **automation** (gear symbol) is any process that runs **in the background**, not as a direct user action. It is **triggered by** one of:
- a **business fact** (e.g. send a welcome email after `User Registered`),
- a **timer** (e.g. expire unresolved items after 24h),
- or a **user interaction**.

Structurally an automation is just **State View + State Change + a gear**: it **reads** data (a read model), does some work, and **issues a command** → which produces a fact. Nothing new — it's the patterns you already know, glued by a processor.

> Critical boundary: you do **not** model *how* the processor works. Whether it polls a read model on a schedule or is notified by a fact is an implementation detail and irrelevant to the flow. Model the trigger, the data it reads, the command(s) it issues, and the resulting fact(s). The book repeats this constantly — focusing on processor mechanics is the #1 beginner mistake.

## Automation anatomy

A full automation slice is three things wired together:
1. a **read model** providing the data the automation needs,
2. an **automation processor** (gear) that reads it and prepares the work,
3. a **command** issued by the processor → producing a **fact**.

Example (publish cart): read model `submitted cart data` → processor → `Publish Cart` command → `External Cart Published` fact (in its own swimlane). A processor **may issue more than one command** from a single trigger (e.g. a price change → one `Archive Item` command per affected cart).

## Translation — talking to external systems

Software is rarely isolated. The **Translation** pattern moves data across the system boundary, in either direction, and acts as an **Anti-Corruption Layer**: a change in an external system touches only the translation slice, never the rest of the model. The external fact is the same regardless of transport (HTTP call, queue record, CSV, even a human typing into a DB) — transport is an implementation detail.

**Inbound** (external → internal): an **external business fact** (yellow) arrives; translate it into a **command** that produces an **internal fact**. Usually no logic — it's a thin State-Change slice. e.g. external `Inventory Changed` → `Change Inventory` command → internal `Inventory Changed` fact (own swimlane). Two notational variants:
- **Explicit** (preferred): store a new internal fact via a State Change. Use when you want the data inside your model.
- **Direct**: represent the external fact straight as a read model, translation hidden. Use when the external data already matches your needs and is only displayed.

**Outbound** (internal → external): an **automation** reads internal facts via a read model and issues a command that produces an **external business fact** (yellow, separate swimlane) for other systems to consume. e.g. `submitted cart data` → processor → `Publish Cart` → `External Cart Published`.

## External business facts (the integration contract)

Distinguish **internal/domain facts** (your context's own state — they evolve freely, living documentation) from **external/integration facts** (the stable, versioned contract with other systems). When publishing:
- Make external facts **complete, not sparse** — include everything a consumer needs to act (and ideally the delta), so consumers don't rebuild your state from low-level internal facts. Coupling consumers to your internal facts is as bad as exposing your database.
- External facts get their **own swimlane** and are **versioned** (schema evolution is an impl concern — defer it, just know the contract is stable while internal facts churn).
- (The yellow external-fact notation isn't "official" Event Modeling — it's a widely-used convention.)

## The Processor-Todo-List (coordination model)

The accessible way to reason about *any* automation: imagine the processor keeps its **own technical to-do list** it checks off. For every automation ask the two questions:

1. **How does the processor get a new task?** → some fact (or timer condition) **opens** a task.
2. **What checks the task off?** → another fact **closes** it.

The open-task list is **calculated from system state by a read model**. The processor issues a command per open task; the **resulting fact feeds back into the read model** to check the task off — drawn as a **dotted back-channel** (data-only, not part of the flow), so the same task isn't done twice.

Worked shape (expire todos > 24h): `Todo Added` (with expiry) → read model `todos to expire` → processor → `Expire Todo` command → `Todo Expired` fact → dotted back-channel removes it from the list. `Todo Resolved` also closes it.

**Retries fall out for free**: if the command fails, the task stays open and is retried next time — until something closes it (or it's escalated to a dead-letter / manual handling). This is also how the book models **distributed processes instead of Sagas** (below).

Pen-and-paper test: *"if I did this by hand, I'd make a list of affected things and tick each off as I handle it."* If you can't say what opens and what closes a task, the automation isn't fully modeled yet.

## Relationship to Sagas

Distributed, multi-step processes (order → payment → inventory, with compensation on failure) are classically "Sagas," done two ways:
- **Orchestration** — a central Process Coordinator that knows all systems. Powerful but **highly coupling** (it must change whenever any participant's API does; ownership is murky).
- **Choreography / service autonomy** — each context just reacts to facts; no central place. Decoupled, but harder to debug.

The book's default: **don't build Sagas — act on the facts.** Use a Processor-Todo-List per context: the current state determines the next action. A failure emits a fact (`Inventory Reservation Failed` → `Payment Refund Registered`) that opens a task for another processor (`Refund Payment` → `Payment Refunded` closes it). Each context knows only its own job + that certain things can fail. Model compensation as ordinary facts opening/closing tasks, not as a central script.

## Completeness check still applies

An automation's **read model** and **command** are subject to the same information-completeness check as any slice (see **em-commands**): every read-model field traces to a fact; every command attribute traces to a source (here often *the read model the automation consumes* or *a translated external fact* — not UI). The read model that drives a todo-list must be fed by **both** the fact that opens a task **and** the fact that closes it (the back-channel) — miss the closing fact and tasks never clear.

## Swimlanes

Give external facts and new concepts their own **swimlane** (inventory lane, external/published lane). Name early; rename later if understanding improves. Keeps internal vs external clearly separated and the model readable.

## GWT for automations (brief — owned by em-scenarios)

Automation + read-model slices use **Given / Then** (omit the **When**) — they fire automatically off the facts in the Given. e.g. *GIVEN cart created + item added + price changed, THEN expect the item archived.* Often also add a redundant GWT for the State-Change half (command → fact) for context. Full scenario work is the next phase.

## What to MODEL vs what to DEFER

| Model (the flow) | Defer (the mechanics — dev's job) |
|---|---|
| The trigger (fact / timer / interaction) | Polling vs subscription / event-handler |
| The read model the automation reads | Idempotency / replay handling |
| The command(s) it issues (one or many) | Eventual-consistency implementation |
| The fact(s) produced | Error-handling tech (DLQ, retries, outbox) |
| What opens a task / what closes it (back-channel) | Dual-write / transactional outbox / Kafka tx |
| Inbound/outbound translation + external fact + swimlane | Saga orchestration internals, schema versioning |

## Business decisions to SURFACE (don't solve in the model — ask)

Background work hides decisions that are the *business's* to make. Raise them, don't quietly resolve:
- **Timing / eventual consistency**: read models feeding automations lag. A task can be missed or processed twice in the gap (price change misses a just-added cart; a todo expired twice). *Is that acceptable?* "If a problem isn't a problem, don't fix it with tech" — but it must be **discussed and documented**, not silently assumed.
- **Failure behavior**: *what happens when this automation fails?* In business there are no exceptions, only processes — often the right answer is to **model the error explicitly** (a `Cart Publication Failed` fact + a manual-resolution screen) rather than hide it in a technical retry. Decide with the business.
- **Idempotency / re-run safety**: is re-processing the same trigger safe?
- **Volume / fan-out**: one command or many? (a single fact may fan out to thousands of commands.)

---

## Representation

Extend the **em-commands** slice notation. Automation:

```
AUTOMATION  Archive affected items                         [automation]
  trigger     Price Changed (fact)            # fact | timer | interaction
  reads       carts with products (read model)  → cart-ids holding the product
  issues      Archive Item { cart-id, product-id }   # one per affected cart (may be many)
  produces    Item Archived { cart-id, item-id }
  todo-list   opens on: Price Changed   closes on: Item Archived (dotted back-channel → carts with products)
  GWT         GIVEN cart+item+price changed THEN item archived   # Given/Then, no When
  defer       poll vs subscribe, idempotency, error path → impl
  decisions?  timing race acceptable? failure behaviour? → ASK business
```

Inbound translation:

```
TRANSLATION (inbound)  Change Inventory                    [translation = state change]
  external fact  Inventory Changed* { product-id, inventory }   # yellow, inventory system
  command        Change Inventory { product-id, inventory }
  internal fact  Inventory Changed { product-id, inventory }    # own swimlane
  variant        explicit (store internal fact)  | direct (external → read model)
  ACL            external API change touches only this slice
```

Outbound translation / publish:

```
TRANSLATION (outbound)  Publish Cart                       [automation + external fact]
  reads       submitted cart data (read model ← Cart Submitted, …)
  issues      Publish Cart { … }
  produces    External Cart Published { full data + delta }      # yellow, external lane
  contract    complete (not sparse), versioned                   # schema detail deferred
```

(`*` marks an identifying attribute.)

## What good looks like

- Every automation has a clear **trigger**, the **read model** it reads, the **command(s)** it issues, the **fact(s)** produced, and **how its task closes** (back-channel).
- External facts live in their own swimlane and are **complete**, not sparse.
- The completeness check passes on the automation's read model + command.
- The hidden **business decisions** (timing, failure, idempotency, fan-out) are surfaced and either answered or logged as open questions.
- NO implementation mechanics baked into the model (no polling/transactions/DLQ as requirements).

## Pitfalls

- **Modeling the how.** Polling/subscription, idempotency, transactions, outbox — all deferred. Model the flow.
- **No closing fact / back-channel.** A todo-list with no "checks off" condition reprocesses forever. Always state what closes a task.
- **Read model missing the subtractive/closing fact.** The driving read model must consume both the opening and closing facts (and removals/clears), or tasks go stale.
- **External facts treated as internal.** No swimlane, no ACL, or sparse payloads that force consumers to rebuild your state. Make them complete + isolated.
- **Solving consistency/errors in the model.** Surface them as business decisions; don't silently pick "eventually consistent" or "throw an exception."
- **Central orchestrator by reflex.** Prefer acting on facts (Processor-Todo-List) over a coupling Saga coordinator unless the case truly needs orchestration.
- **Forgetting a processor can issue many commands.** One trigger → N commands is normal.

---

# Mode playbook: Autonomous

1. **Load inputs.** The fact timeline + the command/read-model model (from em-commands) + terms/questions. Confirm context scope.
2. **Spot the background work.** Scan for: facts that should cause *further* work without a user (reactions), timers/expiry rules, and any data crossing the system boundary (external systems mentioned → translations, in or out).
3. **Model each automation.** Trigger → read model it reads → command(s) it issues → fact(s) produced. State the **todo-list**: what opens a task, what closes it (back-channel). Give external facts a swimlane.
4. **Model each translation.** Inbound: external fact → command → internal fact (pick explicit/direct). Outbound: read model → processor → command → external fact (complete contract).
5. **Run the completeness check.** On every automation read model + command (defer to em-commands rules). Ensure the driving read model is fed by both opening and closing facts.
6. **Decide vs flag.** Flow + structure → resolve. The hidden business decisions (timing/consistency, failure behaviour, idempotency, fan-out) → mark as assumption or raise.
7. **Ask occasionally, batched.** One small AskUserQuestion batch for the genuine decisions only.
8. **Output.** Automation/translation slices + todo-list close conditions + surfaced decisions/open questions. Offer to persist via **notes**.

Guardrails: model flow, not mechanics; external facts isolated + complete; never silently resolve a timing/failure decision — surface it.

---

# Mode playbook: Cooperative

1. **Open + frame.** Explain we're modeling background work + system-to-system flow — *what happens automatically*, not how it's built. Confirm context scope.
2. **Hunt automations.** Per fact/step ask: *"does anything happen automatically when this occurs?"*, *"is there anything time-based (expires, reminders, timeouts)?"*, *"do we send anything to / receive anything from another system?"*
3. **Classify the trigger.** *"Is this kicked off by a fact, a clock, or a person?"* Mark the gear.
4. **Walk the anatomy with the user.** *"What data does the process need?"* → read model. *"What does it then do?"* → command(s) (probe fan-out: *"could this affect many at once?"*). *"What gets recorded?"* → fact(s).
5. **Pin the todo-list.** *"How does the process know there's work to do?"* (opens) and *"how does it know it's done?"* (closes). If the user can't answer the close, flag it — the automation isn't fully understood. Use the **pen-and-paper** prompt: *"if you did this by hand, what list would you tick off?"*
6. **For external systems**, establish direction + the external fact, and note the ACL (*"if their API changes, only this piece changes"*). For outbound, push for a **complete** contract (*"what does the receiving system need to act without asking us?"*).
7. **Surface the hidden decisions — explicitly.** *"Is it OK if this runs a little late, or occasionally twice?"* (consistency) and *"what should happen if this fails — show an error, alert a person, retry?"* (failure process). Capture the answers; these are real requirements.
8. **Read back.** Each automation: trigger → reads → issues → produces → closes-on. Confirm before moving on.
9. **Output.** Same as autonomous; persist via **notes**.

Guardrails: lead the questioning, don't supply domain answers; offer candidate flows to react to; don't bake in mechanics; always extract the timing + failure decisions.

---

## Output → next phase

Carry forward, per automation/translation: (1) trigger, (2) read model read + completeness status, (3) command(s) issued, (4) fact(s) produced (incl. external facts + swimlane), (5) todo-list open/close conditions, (6) surfaced business decisions (timing, failure, idempotency, fan-out) — answered or open. Next: **GWT scenarios** attach Given/Then behaviour to each automation slice and turn the surfaced failure decisions into explicit error flows; **structuring** groups everything into chapters/swimlanes. See the **event-modeling** skill.

## Argument modes

- `auto` → run the Autonomous playbook.
- `coop` (or `cooperative`) → run the Cooperative playbook.
- `explain <subtopic>` → just that section (e.g. `explain todo-list`, `explain translation`, `explain external facts`, `explain sagas`, `explain model vs defer`).
- empty → if it's a run, ask which mode (auto/coop) then proceed; otherwise this full guide.
