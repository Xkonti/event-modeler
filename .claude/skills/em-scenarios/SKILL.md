---
name: em-scenarios
description: >
  Deep dive + runnable workflow for the Scenarios phase of Event Modeling — attaching business rules
  to each slice as Given/When/Then (state changes) and Given/Then (read models + automations), with
  concrete example data. This is where domain rules and invariants get pinned precisely, where error
  cases are decided (exception vs explicit failure fact), and where the model becomes testable
  behaviour. Runs in two modes: AUTONOMOUS (AI derives scenarios solo, flags real rule/error
  decisions) and COOPERATIVE (AI leads, co-authoring rules with the business — the book's preferred way).
  Trigger: /em-scenarios, "GWT", "given when then", "business rules", "scenarios", "acceptance
  criteria", "invariant", "what should never happen", "edge cases", "error case", "spec for this slice".
argument-hint: "[auto | coop | explain <subtopic> | empty → pick a mode]"
allowed-tools: Read, Glob, Grep, AskUserQuestion
---

# em-scenarios

The Scenarios phase of Event Modeling — Given/When/Then business rules, in depth + as a runnable workflow. For the whole process see the **event-modeling** skill; the slices these rules attach to come from **em-commands** (state changes, state views) and **em-automations** (automations, translations). Persist artifacts + decisions via the **notes** skill.

Once the data flow is proven complete, this phase makes the model **behavioural and testable**: for each slice, capture the rules as scenarios with concrete examples. This is the highest-value phase — "GWTs are the real treasury of an event model." Plain text invites interpretation; a Given/When/Then states a **fact**. Rules live **in the model, directly under the slice they govern**, not scattered across people, tickets, and workflow docs.

## Two modes

Pick from the argument (`auto` / `coop`); if neither given and it's a run, ask once with AskUserQuestion, then commit for the session.

**Autonomous** — the AI derives scenarios per slice from the model: the happy path, the rules implied by the structure, and candidate edge/error cases, each with concrete example data. It asks the user only **occasionally** — on genuine domain rules it can't know (max counts, eligibility, what counts as an error) and the error-modeling decision (exception vs explicit failure fact). Produce-then-verify, don't interrogate.

**Cooperative** — the AI is the **session leader**, and this is the mode the book pushes hardest: rules must be **co-authored with the business**, who own them. The AI walks each slice asking *"what must be true first?"*, *"what rules always apply here?"*, *"what should never happen?"*, *"give me a concrete example with real numbers"*. The user supplies domain rules; the AI shapes them into GWT/GT and flags gaps. Augments, doesn't author.

Same destination: every slice carries its happy path + known rules/invariants as scenarios with example data, error cases decided. Shared foundation below; mode playbooks follow.

---

# Shared foundation (both modes)

## What a scenario is

Given/When/Then comes from BDD: **GIVEN** some facts have already happened, **WHEN** a command is executed, **THEN** the system reaches a specific outcome. It describes State Change and State View behaviour far more precisely than prose, and stays readable: place scenarios **vertically below each slice** so the model still reads left→right and you only drill down when you want the detail.

## The three parts

- **Given** — a set of **business facts** that put the system into the needed state (e.g. an `Item Added` fact so there's something to remove). Multiple facts are **ordered left→right** and the order matters. **Omit Given** when no prior state is required (e.g. adding to an empty cart).
- **When** — exactly **one command**. Given the state from Given, executing this command leads to Then.
- **Then** — one or more **resulting facts**, **or** an **error** (when the Given intentionally put the system in an invalid state). Multiple facts are ordered left→right.

## Which slices get GWT vs GT

| Slice type | Form | Why |
|---|---|---|
| **State Change** (command → fact) | full **G/W/T** | there's a command to execute |
| **State View** (read model) | **G/T** (omit When) | no command — it reacts to the facts in Given |
| **Automation** | **G/T** (omit When) | fires automatically off the facts in Given |

For State View / Automation: put the system into a state (Given) and assert the read model shows the right data, or the resulting fact was stored (Then). (One book chapter phrases the automation rule as "omit the Then"; the consistent rule across the book is **omit the When** — read models and automations both use Given/Then.)

## Always use concrete example data

A rule without an example is half-specified. Attach real values: *add an item priced 5,00 € → total shows 5,00 €; remove it → total 0,00 €.* Concrete examples make it obvious which rule applies and translate directly into test data later. The book: don't describe the rule abstractly when you can show it.

## Don't skimp — cover the slice

A single slice may warrant **10+ scenarios**. Cover:
- the **happy path** (often Given-omitted),
- every **invariant / business rule** that applies (each as its own scenario),
- the **edge/error cases**.

"Define as many scenarios as necessary — don't save on them."

## Invariants → error scenarios

An **invariant** is something always true ("never more than 3 items in a cart", "never submit an empty cart", "blocked customers can't order"). Model each as a scenario whose Given places the system in the invalid state and whose Then is an error:
> GIVEN 3 items already in the cart, WHEN Add Item, THEN error (max 3 — fulfillment limit).

Keep the rule even when the *reason* is unclear ("it comes from the Fulfillment System, not sure why") — record it, annotate the context.

## Enforce once — don't duplicate rules across slices

Rules are enforced **on the write side**, when data is stored, not when it's read. So a rule already enforced on one slice should **not** be re-checked on another. The book's example: "max 3 items" is enforced on `Add Item`; re-checking it on `Submit Cart` is redundant and adds no value — **trust the stored data**. Put each rule on the one slice that owns it.

## Error: exception vs explicit failure fact (a decision to surface)

`Then` can be an *error*, but often the better model is an explicit **failure fact** + an error flow rather than a thrown exception — "in business there are no exceptions, only processes." e.g. instead of "THEN error", model `Cart Submission Failed` / `Cart Publication Failed` as a fact, with a follow-up process (a screen for manual resolution). Which one to use is a **business decision** — surface it, especially for the failure cases handed over from **em-automations**. Good case first; error/alternative cases as extra scenarios or a separate flow.

## Scenarios as black-box behaviour (→ tests)

A scenario describes the slice **at its edges**: data in (Given/When) → data out (Then). It says nothing about *how* the slice works, so it survives refactoring — even a slice rebuilt from scratch still passes its scenarios. This is exactly why scenarios become the **unit tests / running specification** during implementation (ideally using the example data). Write behaviour, never implementation.

## Placement, links, context

- Stack scenarios **under** the slice, top to bottom.
- **Link** the facts/commands in a scenario to the corresponding model elements, so you can navigate scenario ↔ model.
- Extra documentation for a scenario goes on a **white sticky** (context note) inside it.

---

## Representation

Extend the **em-commands / em-automations** slice notation with a `scenarios` block. Mark each scenario's intent (happy / rule / error / multi). Example data inline or on its own line.

```
SLICE  Add Item                                   [state change → G/W/T]
  scenarios
    happy  GIVEN —                         WHEN Add Item   THEN Item Added
           ex: product 4711, price 5,00 €
    rule   GIVEN 3 items already added     WHEN Add Item   THEN error  (max 3 — fulfillment limit)
    rule   GIVEN inventory of item = 0     WHEN Add Item   THEN error  (out of stock)
    multi  GIVEN nothing happened          WHEN Add Item   THEN Cart Created, Item Added
           note: cart created only if absent; Then order is L→R

SLICE  Cart Items                                 [state view → G/T, no When]
  scenarios
    GIVEN Item Added(5,00 €)                               THEN read model: 1 item, total 5,00 €
    GIVEN Item Added, Item Removed                         THEN read model: empty, total 0,00 €
    GIVEN Item Added, inventory → 0                        THEN read model: item stays, inventory 0

AUTOMATION  Publish Cart                          [G/T, no When]
  scenarios
    GIVEN Item Added, Cart Submitted                       THEN External Cart Published stored
```

Keep an **error-decision log**: `rule → exception | failure-fact (+ flow) → status (decided | open)`.

## What good looks like

- Every slice carries its happy path + all known rules/invariants + edge cases, each with concrete example data.
- State changes use G/W/T; read models + automations use G/T.
- Each rule lives on exactly one slice (enforced on write, not duplicated downstream).
- Error cases are decided (exception vs failure fact) and logged; failure flows from em-automations are turned into explicit scenarios where the business wants them.
- Scenarios read as edge behaviour, implementation-free → ready to become tests.

## Pitfalls

- **Abstract rules, no example data** — half a spec. Always show numbers.
- **One happy-path scenario per slice** — skimping. Cover invariants + edges; don't save on GWTs.
- **Duplicated rules** — re-checking a write-side rule on a later slice. Enforce once; trust stored data.
- **When on read-model/automation scenarios** — those are Given/Then.
- **Inventing domain invariants** — derive structural/happy-path freely, but real rules (limits, eligibility, what's an error) must come from / be confirmed by the business.
- **All errors as exceptions** — when the business wants a failure fact + recovery process. Surface the choice.
- **Forgetting Then/Given ordering** — multiple facts are ordered left→right.
- **Implementation-coupled scenarios** — testing how, not behaviour at the edge.

---

# Mode playbook: Autonomous

1. **Load inputs.** The slices (state changes, state views, automations, translations) + their attributes + the surfaced rules/decisions from em-commands/em-automations + any brainstorm terms/open questions. Confirm context scope.
2. **Per slice, draft scenarios.** State change → G/W/T; read model/automation → G/T. Always start with the happy path (Given often omitted).
3. **Add the rules you can justify.** Structural rules (e.g. "can't act on what isn't there"), info-completeness-implied cases, and obvious invariants. Each as its own scenario with example data.
4. **Cover edges + errors.** Empty/zero/limit/duplicate/missing cases. For each error, draft it both ways (exception vs failure fact) so the decision is visible.
5. **Enforce once.** Check you're not repeating a rule already owned by an earlier slice; if you are, drop it and note where it lives.
6. **Decide vs flag.** Happy path + structural rules → resolve. Real domain invariants and the error-modeling choice → mark as assumption or raise.
7. **Ask occasionally, batched.** One small AskUserQuestion batch for genuine rule unknowns + error decisions only.
8. **Output.** Per-slice scenario blocks with example data + the error-decision log + open questions. Offer to persist via **notes**.

Guardrails: behaviour not implementation; concrete examples always; never fabricate a domain rule — derive the obvious, flag the rest; one rule, one slice.

---

# Mode playbook: Cooperative

1. **Open + frame.** Explain we're capturing the rules of each slice as Given/When/Then, with real examples — and that the business owns the rules. Confirm context scope. (Mention they can even add scenarios themselves.)
2. **Per slice, start with the happy path.** *"In the normal case — what's already happened (Given), what's the action (When), what results (Then)?"* Capture, then ask for a concrete example with real values.
3. **Elicit the rules.** *"What rules always apply when doing this?"*, *"what should never be allowed?"*, *"is there a limit / a precondition / an eligibility check?"* Each answer → its own scenario. Probe for the *reason*, but keep the rule even if the reason is fuzzy (annotate).
4. **Drive out edges + errors.** *"What happens if it's empty / zero / at the limit / already done?"* For each error: *"should the system just refuse (error), or should we record that it failed and do something about it?"* — capture the choice (exception vs failure fact + flow).
5. **Check for duplication.** If a rule was already pinned on an earlier slice, say so and don't re-add it (*"we already enforce max-3 on Add — we trust that here"*).
6. **Insist on examples.** For each scenario, get concrete numbers/ids; they become the test data.
7. **Read back.** Summarize the slice's scenarios (happy + rules + errors) and confirm before moving on.
8. **Output.** Same as autonomous; persist via **notes**, including the error-decision log.

Guardrails: lead, don't author the rules; offer candidate scenarios to react to; never invent or override a business rule; always extract example data and the error decision.

---

## Output → next phase

Carry forward, per slice: scenarios (G/W/T or G/T) with concrete example data, the set of invariants captured, and the error-decision log (exception vs failure fact + any new error flows). These are the **running specification** — during implementation they become unit tests using the example data. Remaining phase: **structuring** — group slices + scenarios into chapters/swimlanes, split alternative/error flows into their own models (see the **event-modeling** skill).

## Argument modes

- `auto` → run the Autonomous playbook.
- `coop` (or `cooperative`) → run the Cooperative playbook.
- `explain <subtopic>` → just that section (e.g. `explain given`, `explain gt vs gwt`, `explain invariants`, `explain error decision`, `explain black-box`).
- empty → if it's a run, ask which mode (auto/coop) then proceed; otherwise this full guide.
