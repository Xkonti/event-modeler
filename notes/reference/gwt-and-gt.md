# Reference: GWT & GT Scenarios (canonical)

> [reference 2026-06-05] Source: `source.md` (ch 13 core; ch 3, 10, 14–17). Resolves our open GT question — see `../gwt.md`.

## GWT — Given / When / Then (State Changes)

- **GIVEN** = an ordered list of **events** establishing prior state. **Optional** (omit if no state needed). **Order matters** (left-to-right).
- **WHEN** = exactly **one command**. This is the load-bearing distinction.
- **THEN** = either **one or more events** (ordered) emitted, **or** an **error** (command rejected because GIVEN put the system in an invalid state).
- Specifies **command-handling logic** (accept → emit / reject). Anchored on the command.

## GT — Given / Then (Read Models / State Views, and Automations)

- **GIVEN** = ordered events. **THEN** = expected **read-model contents / view state**.
- **No WHEN** — no command is exercised. "Read Models only rely on previously stored events, so there is no When part necessary" (ch 3).
- Specifies **read-model projection logic** (given these events, the view shows this).
- **Automations** also use GT for their read-model/trigger half (the processor fires automatically, so no When).

## Decision rule: GWT vs GT

**WHEN exists ⇔ a command is exercised ⇔ a State Change is under test.** No command (read model just reflects events) → drop When → **GT**.

| Slice type | Form |
|---|---|
| State Change (command→event) | **GWT** |
| State View (events→read model) | **GT** |
| Automation (read model→processor→command) | **GT** for the read-model part (optional GWT for its state-change half) |

## Key properties

- **Example data is core, not decoration** — concrete values ("5,00 €", counts) make scenarios **unit-test-ready**; author **code-generates running specs** from them (ch 3, 13).
- **Errors vs failure-events**: THEN rejection can be an `error` OR a domain **failure event** (e.g. "Cart Submission Failed") — a modeling choice, don't hardcode (ch 16).
- **Validate on write, not on read** — rules enforced in the state-change GWT; don't re-check downstream (ch 15).
- Many GWTs per slice encouraged — "10+" for complex ones; "the real treasury in Event Models. Don't save on them" (ch 3, 13).
- Each GIVEN/WHEN/THEN element **references** a real model element (navigation + referential integrity); optional white-sticky free-text context (ch 13).
- Scenarios stack **vertically below the slice** → model still reads left-to-right, drill down per slice.
- Source inconsistency flagged: ch 15 "omit the Then" is a typo — the rule is **omit the When** for read-model/automation tests.

## Alignment with our design

- Confirms our `../gwt.md`: GWT anchored on command; THEN = emit / reject / error-fact. ✓
- **Resolves our open "GT" question**: **GT = read-model projection spec** (given events → then view state, no command). Update `../gwt.md`.
- Our "auto-surface GWTs by referenced entities" is *our* feature — book just stacks them under the slice. Our reference-based surfacing is an enhancement, not from the book.
