# Core Flow & System Principles

How the element types relate **in motion** — the behavioral cycle an event-modeled system follows, and the principles the tool assumes. Structural/identity concerns live in `model-structure.md`; this note is about dataflow + behavior.

## Element roles

> [decision 2026-06-05]

- **Wireframe** — UI. Reads info (via read models) and lets a user **issue commands**.
- **Automation** — the non-UI counterpart of a wireframe. **Monitors read models** and **issues commands** when something changes. (Saga / policy / processor / AI agent.)
- **Command** — a request to change the system (≈ an API request). Backend logic verifies it; it is **accepted or rejected**. On acceptance → emits **business fact(s)**. **The only way to introduce change** (principle below).
- **Business fact** — the **persisted truth**. Created when a command is accepted. Ultimate source of truth for system **state**.
- **Read model** — a **projection** built from business facts. How wireframes and automations *read* the world.

## The canonical cycle

> [decision 2026-06-05]

```
wireframe ─┐
           ├─▶ command ──(accepted)──▶ business fact ──▶ read model ──┬─▶ wireframe (reads)
automation ┘                                                          └─▶ automation (monitors) ──▶ command ...
```

Confirmed model-level relation types (see also `model-structure.md`):

- wireframe → command (user action issues)
- automation → command (reaction issues)
- command → business fact (on acceptance; may instead be **rejected** / emit an **error fact** — see `gwt.md`)
- business fact → read model (feeds / projects)
- read model → wireframe (read by / displayed by)
- read model → automation (monitored by)

The loop closes: facts feed read models → read models drive automations (and wireframes) → those issue commands → commands produce new facts.

> [decision 2026-06-05] **Will model Translation + External Events.** Confirmed important — the tool must let you model cross-system integration: **Translation** (external → internal, an anti-corruption layer) and **External Events** (the system's *versioned public-API* boundary; not direct internal-event access). These are new element types / a 4th pattern to add to our cycle. Detailed design TBD. See `reference/element-types.md`, `reference/organizing-large-models.md`.

## Principle: command is the ONLY way to change the system

> [decision 2026-06-05]

**Nothing changes system state except through a command** that is accepted and produces a persisted business fact. No back-door mutation. This is why an automation that needs to "change something" must **issue a command**, never write state directly.

## Principle: business facts are the source of truth (state)

> [decision 2026-06-05]

Persisted business facts are the **ultimate source of truth for system state**. Read models are derived, disposable projections of them.

> Don't conflate two different "source of truth" claims: **relations** are the source of truth for the *model's structure* (`model-structure.md`); **business facts** are the source of truth for the *modeled system's data/state* (here). Different layers.

## Triggering automations (loop-closing)

> [decision 2026-06-05]

The tool-relevant mechanism: **a business fact being emitted, or a read model being updated, can trigger an automation** — which may then issue further commands. This is what closes the loop and lets one change cascade into others.

### Example technique: cross-context sync (implementation-level, NOT enforced)

> [context 2026-06-05]

One event-modeling / **implementation** technique this enables — **not** something the application specifies or enforces, just a pattern you *can* model: contexts avoid constantly calling each other; each keeps **local copies** of values it needs. A settings change (e.g. "number of forecast years") emits a fact → automations fan out → issue commands into other contexts to update their kept copy (a saga; typically **distinct facts per context** at the implementation level). The tool only needs to represent "fact / read-model change → automation → commands"; how teams realize it is out of scope.
