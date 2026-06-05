# AI Participation & Model Export

A whole separate aspect: the model isn't only for humans — **AI agents are first-class participants** that read and contribute to it. Captured as direction; **deliberately not designed in depth yet** (author flagged a deeper conversation for later).

## Model as complete, role-agnostic spec

> [decision 2026-06-05]

The event model is meant to be the **ultimate source of truth for the entire project** (the spec / design level — distinct from in-system *state* truth in `core-flow.md`, and *structural* truth in `model-structure.md`). It describes **frontend, backend, and API layer** in a **role-agnostic, technology-agnostic** way — enough encoded to **implement later regardless of tech**.

Claim: **GWTs + GTs + additional free-text descriptions** are enough to fully define the business rules, behavior, and look — flows defined, data defined.

## AI as a participant

> [decision 2026-06-05]

Not just humans read/contribute — **AI agents** do too. The structured nature of the model is what makes this practical.

What AI cares about (and doesn't):

- **Cares**: definitions of business facts + the **data they hold**, commands, read models, wireframes (as data), their **relationships**, and **GWTs/GTs** + descriptions.
- **Doesn't care**: whiteboard **placement / layout**. Positions are a human-rendering concern, irrelevant to AI.

Reinforces the entity-catalog spine (`model-structure.md`): layout is projection; the structured model is the real artifact, equally consumable by humans (visually) and AI (structurally).

## Access mechanisms (future, deferred)

> [speculation 2026-06-05]

Don't dump the **entire** model at an AI — same scoping logic as human navigation (`navigation-and-scoping.md`); a full dump "wouldn't make sense". Likely directions:

- **Export** a chosen part of the model to **JSON / YAML** (AI-readable).
- Later: an **MCP server** letting AI **efficiently query and modify** the model.

> [open question 2026-06-05] **Explicitly deferred.** Author does not want to design this deeply yet — flagged as an eventual requirement needing its own deeper conversation. Don't over-specify now.
