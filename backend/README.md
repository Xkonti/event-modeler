# Event Modeler — Backend

Event-sourced backend for **Event Modeler**. Stack: **Bun + TypeScript + Emmett + Pongo + PostgreSQL**.

Implements the architecture in [`../notes/event-sourcing-architecture.md`](../notes/event-sourcing-architecture.md):

- **One stream per entity** — `businessFact-{id}`, `command-{id}`, … (a stream is a `stream_id` in the single `emt_messages` table, not its own table).
- **Deciders** — `decide(command, state)` + `evolve(state, event)`, optimistic concurrency on stream version, state re-folded per command (no snapshots needed).
- **Read models** — built async from the global ordered log into Pongo (JSONB) documents the UI queries.
- **Constraint inline projections** — cross-aggregate *set* invariants (global name uniqueness, session ownership) enforced by load-bearing Postgres `UNIQUE`/`PK` tables written **in the append transaction**. See [`../notes/constraint-inline-projection-pattern.md`](../notes/constraint-inline-projection-pattern.md).

## Layout

```
src/
  config.ts                 env / connection string
  eventStore.ts             createEventStore factory + INLINE constraint registration
  consumers.ts              ASYNC read-model projectors
  db.ts                     Pongo client (read-side queries)
  index.ts                  entry: migrate → serve → start consumers
  migrations/
    constraints.ts          creates entity_names / entity_claims (load-bearing)
  shared/
    streams.ts              stream-id construction (one per entity)
    naming.ts               name normalization for the uniqueness key
  constraints/              CONSTRAINT projections (inline, write-path)
    entityNames.ts            global name uniqueness
  read/                     READ MODELS (async, query-side)
    entityCatalog.ts          per-entity catalog document (+ pure evolveCatalog)
  domain/
    businessFact/           example entity: events, decider, handler, HTTP api
                            (*.test.ts = co-located unit tests)
test/
  integration/              testcontainers integration tests (run on Node)
    nameUniqueness.test.ts
```

`constraints/` vs `read/` is the structural line: constraints register **inline**, read models register **async**. A table is a constraint the moment a write depends on it.

## Run

```bash
bun install
bun run db:up        # start Postgres (docker compose)
bun run dev          # migrate + start consumers + serve on :3000
```

`.env` is assumed identical to `.env.example` for local dev.

## Try it

```bash
# define a fact
curl -XPOST localhost:3000/business-facts \
  -H 'content-type: application/json' \
  -d '{"factId":"f1","name":"BudgetYearDefined","context":"Budgeting"}'

# duplicate name on a different entity → 409 (entity_names constraint rolls the append back)
curl -XPOST localhost:3000/business-facts \
  -H 'content-type: application/json' \
  -d '{"factId":"f2","name":"BudgetYearDefined","context":"Budgeting"}'

# read it back (async catalog read model)
curl localhost:3000/business-facts/f1
```

## Testing

Two layers, split by runtime:

```bash
bun run test              # unit tests (fast, no Docker)
bun run test:integration  # testcontainers integration (needs Docker, runs on Node)
bun run test:all          # both
```

- **Unit** (`bun test`, co-located `src/**/*.test.ts`) — pure logic, no I/O:
  - the decider via Emmett's `DeciderSpecification` (GIVEN events / WHEN command / THEN events),
  - the read-model fold (`evolveCatalog`), the name-normalization key.
- **Integration** (`node --test`, `test/integration/`) — spins a throwaway Postgres with
  **testcontainers** and exercises the real event store + inline constraint: a duplicate
  name rolls the append back; archiving frees the name for reuse.

> **Why integration runs on Node, not Bun:** testcontainers-node's container-lifecycle
> readiness probe hangs under the current Bun runtime (the container starts and is healthy,
> but `start()` never resolves). Node runs it reliably. `migrateConstraints` therefore uses
> `pg` (not `Bun.SQL`) so it works under both runtimes. Unit tests stay on Bun for speed.

## Status

Skeleton proving the patterns end-to-end with one example entity (`businessFact`).
Backend stack is **leaning, gated on the Emmett license RFC** — see [`../notes/tech-stack.md`](../notes/tech-stack.md).
