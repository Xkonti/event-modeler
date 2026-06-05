# Model Validation & Completeness

Integrity checks the tool runs over the model. Two so far — **completeness** (no missing data along the dataflow) and **GWT/GT sync** (rules match real relations). Likely a growing family.

## Completeness check (backward data-sufficiency walk)

> [decision 2026-06-05]

A known event-modeling technique: **walk the model backwards** along the dataflow and verify that, at every hop, the upstream source can supply everything the downstream consumer needs. No data may be missing from the graph.

The walk (downstream → upstream):

1. **Wireframe** — what data does it need to display? Look at the **read model** feeding it: does the read model supply *all* of it? (read model sufficient?)
2. **Read model** — what info must it contain? Is it connected to **all the business facts** needed, and can it **derive** all required info from them?
3. **Business fact** — given the data it must hold, is it created by a **command** that carries enough information to produce it?
4. **Command** — what info must it hold? Can the **wireframe / automation** that issues it supply enough to do so?

Each backward hop checks **required (downstream) vs available (upstream)**. If every hop passes, the model is **complete** — every piece of data has a traceable origin. Walks the same relations defined in `core-flow.md`, in reverse.

> [reference 2026-06-05] This is the book's **Information Completeness Check** — "read models may only read already-stored event data; every attribute must trace to a source." Unresolved sources are shown as a **red arrow** between elements. The book runs it *continuously while modeling*, not as a separate phase. See `reference/event-modeling-process.md`.

## Human/AI-assisted, not auto-gated

> [decision 2026-06-05]

The completeness walk is performed by **humans or AI**, tool-**supported** — **not necessarily automated**. The field/data definitions it relies on are often **vague**: a person or AI reading them grasps "this links to that", but a purely programmatic checker would struggle. The tool should **surface the chain and hold the data** to support a backward review, rather than enforce a fully-automated pass/fail gate. Over-automation is explicitly *not* wanted here.

## Operates on the data/fields layer (a later pass)

> [context 2026-06-05]

The walk compares each element's **data / field definition** across relations. But that fields/data layer is **not mandatory core** — in the modeling process it's filled during a **later, focused pass** (`process-and-collaboration.md`), after the structural model exists. So completeness checking applies **once data is being defined**, not from the first sticky note. (An earlier framing that fields are mandatory-from-start was an overreach — corrected.)

## Related: GWT/GT sync check

See `gwt.md` — GWTs are flagged out-of-sync when they reference relations not defined in the model. Same family: the tool actively checks model integrity and surfaces problems. The "consistency machinery may generalize" note there → this is part of that generalization.

## Open questions

> [open question 2026-06-05]

- **On-demand vs continuous**: user runs the completeness walk over a scope, or live flags as you edit?
- **Granularity**: field-level matching? type-aware? or coarse presence checks?
- **Surfacing**: inline canvas markers, a report, a punch-list? (cf. GWT validation UI.)
- **Cycles** (sparring #3, confirmed real): backward walk must guard against infinite loops in the cyclic graph (fact → read model → automation → command → fact).
