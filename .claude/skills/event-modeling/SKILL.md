---
name: event-modeling
description: >
  Overview of the Event Modeling process + its building blocks, patterns, and structuring tools.
  Load to understand or explain how event modeling works, what an element/pattern means, or when
  reasoning about this tool's domain (the thing being built models exactly this process).
  Trigger: /event-modeling, questions about event modeling concepts/terms/patterns, business facts,
  commands, read models, slices, GWT, swimlanes, information completeness.
argument-hint: "[term or pattern to explain | empty for full overview]"
allowed-tools: Read, Glob, Grep
---

# event-modeling

Reference for the **Event Modeling** process. Use to give a proper overview, or to explain a single term/pattern on demand. This tool (event-modeler) is a structured whiteboard for exactly this process → the vocabulary here is the domain vocabulary.

## Terminology note

This project calls the orange "fact" element a **business fact**, NOT an "event". Standard event modeling literature says "event" — we diverge on purpose: the tool isn't tied to event sourcing, and "business fact" reads clearer to non-technical stakeholders. Everywhere external material says *event* (the recorded fact), read *business fact*. The methodology name stays "Event Modeling".

## What it is

Visual language for **data flow** through a system. Single timeline, read left→right like a story. Whiteboard + colored sticky notes. Works even when the system doesn't exist yet.

Why: words need interpretation → interpretation subjective → two people "agree" while meaning different things → projects fail. A visual model = facts, not interpretation. Like sitting at a screen clicking through real software — except on a whiteboard, before code exists.

Not tied to event sourcing. Models *how data flows*. Any system has data flow → any system can be modeled.

## Building blocks

| Element | Color | What |
|---|---|---|
| **Business Fact** | orange | A thing that happened, past tense ("Item Added"). What persisted; survives power-off. Foundation of everything. |
| **Command** | blue | Instruction/input to the system ("Add Item"). Black box → produces business fact(s). |
| **Read Model** (Query) | green | Structured data pulled out of the system. Feeds screens + background processes. |
| **Screen / Wireframe** | — | Rough UI mockup. About *data*, not UX polish. Minimal detail. |
| **External Business Fact** | yellow | Data arriving from an outside system (API / queue record / file). Tech-agnostic. |
| **Automation** | gear | Background process. Triggered by a business fact, a timer, or an interaction. |

Key distinction: **commands = what should happen, business facts = what actually happened.**

## The four patterns

Everything in a model is one of these four:

1. **State Change** — Command → Business Fact. The *only* way to change the system.
2. **State View** — Business Fact → Read Model. The *only* way to read the system.
3. **Automation** — State View + gear + State Change. Background work (e.g. send email after signup). Reads data, does work, issues a command.
4. **Translation** — External ↔ internal. The anti-corruption layer. Two variants:
   - explicit: external business fact → translate → internal business fact (via a State Change)
   - direct: external mapped straight to a read model, translation hidden

Patterns 3 + 4 (Automation + Translation — background work, the Processor-Todo-List, external/integration facts) → deep dive: **em-automations** skill.

## The process

Session by session, left→right. Tech decisions deferred as long as possible (biggest decisions come earliest, when knowledge is lowest — don't lock them in).

1. **Brainstorm business facts** — big group (everyone with domain knowledge). Write what *could have happened*, past tense. No wrong answers. Duplicates + chaos = good. Then order chronologically → a story that reads L→R and makes sense to all. → deep dive: **em-brainstorming** skill.
2. **Wireframes** — smaller group (4–6). Rough UI per use case. Mark the focus area. Reveals what data is actually needed. → deep dive: **em-wireframes** skill.
3. **Commands + Read Models, thinking backwards** —
   - per business fact: "what command must have run for this to happen?"
   - per screen element: what data shows here? → read-model fields → which business fact delivers each field? → which command populates that fact?
   - backwards thinking focuses on the solution, not the problem.
   - → deep dive: **em-commands** skill.
4. **Use case by use case** — apply the four patterns repeatedly. Model the good case first; error/alternative cases as separate flows or GWTs.

Throughout: talk **data flow**, never technology (no DB / REST / queues). Both business + devs understand data flow.

Each phase/pattern has (or will have) its own deep-dive skill, prefixed `em-`: **em-brainstorming** (phase 1), **em-wireframes** (phase 2), **em-commands** (phase 3 — commands, read models, backwards completeness check), **em-automations** (patterns 3+4 — automations, translations, external facts, applied per use case), **em-scenarios** (phase 4 — GWT/GT business rules per slice), **em-structuring** (organizing the model — swimlanes, chapters, multiple models, alt-flows, links; continuous + organize-pass). Load the relevant skill when actually running or explaining that step in detail.

## Information Completeness Check

The core validation. Every read-model attribute MUST trace to a source business fact. Every business-fact attribute MUST be provided by its command. Any attribute with no source = gap (drawn as a red arrow) → can't proceed until resolved.

Catches false data assumptions *before* implementation — the usual cause of project delays. Forces you to find the real source of every piece of data.

## GWT scenarios (business rules)

Given / When / Then (from BDD). Business rules placed *vertically below* the slice they belong to → model still reads L→R, drill down for detail.

- **State Change** → Given (business facts as precondition) / When (the command) / Then (resulting business fact(s) **or** an error if put in an invalid state).
- **Read Model & Automation** → Given / Then only (no When).
- Use concrete example data ("add 5€ item → total shows 5€").
- Multiple events in a Given/Then are **ordered** left→right.
- Define WITH the business side. Don't skimp — GWTs are the real treasure of a model.
- **Validate on write, not read** — trust data already stored; don't re-check the same rule downstream.
- → deep dive: **em-scenarios** skill.

## Slices

Smallest functional unit = one **slice** (a single State Change or single State View). Name them, box them. A slice maps later to one implementation unit (~a day of work). Use cases break into slices along the timeline.

Principle: **use cases shape the model, not the reverse.** Build the simplest model that serves the use case at hand — not a general-purpose model.

## Structuring tools (optional, for growth)

→ deep dive: **em-structuring** skill (disambiguates the three grouping axes + split decision-guide + de-collided legend).

- **Swimlanes** — horizontal lanes grouping facts by concept (e.g. internal vs external, an "inventory" lane).
- **Chapters / sub-chapters** — group adjacent slices by context (arrows above the model). Like book chapters.
- **Multiple models per board** — prefer many small models over one giant one. Name each.
- **Alternative / error flows** — don't branch the timeline. Pick one flow; put alternatives in a separate model, link with a marker under the slice.
- **Element links** — mark duplicated elements that are the same (e.g. one read model reused across two screens).
- **Backlinks** (dotted arrows) — a later business fact affecting an earlier read model; data-only, doesn't alter the flow.

## Signals & principles

- Term used in a workshop but absent from the model → missing concept. Investigate (e.g. people saying "cart session" → a missing "Cart Created" fact).
- Work with **examples + copies** — more examples = fewer assumptions.
- **Model-first discipline** — change the model before code → model stays current = living documentation.
- Planning/modeling = ~60–70% of total effort. Time in the model is the best investment.

## When asked to explain just one thing

Argument names a term/pattern → give that section only, concise, with the one-line essence first. Empty argument → the full overview above.
