# Design Principles

Cross-cutting principles that guide decisions, distinct from any single feature.

## Distinguish essential EM practice from whiteboard-medium workarounds

> [decision 2026-06-05]

The source book (`reference/`) describes event modeling as practiced on **unstructured freeform boards** (Miro / sticky notes). Many of its rules are shaped by that medium's limits — no rigid structure, no identity, no querying, no dynamic views.

Our tool is **structured + dynamic**. So when adopting a book practice, always ask: is this **essential to event modeling**, or a **workaround for an unstructured whiteboard** that our software can transcend?

Likely medium-driven (candidates to improve on, not copy verbatim):
- "Many small models on a board" + manual alt-flow links → maybe a Miro workaround; our scoped/queryable graph (`navigation-and-scoping.md`) might render flows dynamically from one model. (Researching.)
- Manual completeness check → we can assist/automate (`validation.md`).
- Static layout + duplicated elements → our identity + projection model removes duplication.

Essential practices to preserve regardless: the **4 patterns**, **GWT/GT as facts**, **past-tense business language**, **backwards completeness thinking**, the **roles-together blueprint**.

## Don't block organic work

> [decision 2026-06-05]

Modeling is **gradual and human-driven**, especially early on. Users start loose (a pile of business facts) and **discover structure over time** (slices, patterns, boundaries). The tool must **support gradual boundary discovery** and must **never force** structure — typed slices, enforced patterns, completeness, naming rules — as a *precondition* to working.

Smart recognition / suggestions / enforcement are **optional, future, additive** — never gates that stop a user mid-thought. (Applied to slice typing in `model-structure.md`.)
