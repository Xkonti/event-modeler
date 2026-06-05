# Terminology & Domain Language

Decisions about what to *call* things in the tool. Naming matters here: the whole pitch is a shared language across roles, so the words are part of the product.

## "Business fact" instead of "event"

> [decision 2026-06-05]

The thing event modeling normally calls an **event**, this tool calls a **business fact**.

**Rationale:**

- "Event" is heavily overloaded by other technical meanings (message bus events, DOM events, event emitters, etc.).
- "Event" *sounds* temporary — something in transit, used for transport, then gone.
- "Business fact" signals the opposite: something that **gets saved**, that is **true**, a piece of recorded truth rather than a transient message. It's a fact about the business that happened and remains so.

**Status:** Author's strong preference, stated as a decision. Open to revisit if it causes friction (see tension below).

## Open tension: divergence from canonical event-modeling vocabulary

> [open question 2026-06-05]

Event modeling as a practice already has an established vocabulary (Events, Commands, Read Models, etc.), and part of the tool's value is that people *already familiar with event modeling* can use it. Renaming the central concept "event" → "business fact" could create friction for that audience — they think and speak in "events".

Worth tracking: do we relabel everything in our own dialect, or keep canonical terms with "business fact" as an explanatory framing? Not resolved.

## Canonical vocabulary (book) + gaps

> [reference 2026-06-05]

Canonical EM element names + colors (`reference/element-types.md`): **Event** (orange) → our *business fact*; **Command** (blue); **Read Model / Query** (green); **Wireframe / Screen**; **Automation / Processor** (gear); **Translation** + **External Event** (yellow). Notes use color heavily (red = missing data, pink = model name, white = context note).

Two canonical element types we have **not** adopted: **Translation** and **External Event** (see `core-flow.md` divergence flag). Decide whether our dialect includes them.
