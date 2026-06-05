# Reference: Benefits vs Traditional Planning (canonical)

> [reference 2026-06-05] Source: `source.md` (ch 1, 3, 10, 11, 43). Grounds our `../vision.md` + `../ai-participation.md`.

## Core benefits claimed

- **Single left-to-right "story"** of the whole system, readable by everyone (ch 3, 11).
- **Minimal vocabulary** — 4 patterns + GWT/GT describe any system "in an easy-to-read manner" (ch 3).
- **Information Completeness Check** — mechanically catches false data assumptions **at planning time, not in implementation** (the standout, enforceable benefit) (ch 3).
- **GWT/GT = facts, not prose** → directly translatable to unit tests / running specs / code-gen (ch 3).
- **Works before the system exists**; **technology-agnostic** (any system, not just event-sourced) (ch 3).
- **Predictable estimation** via slices (illustrative "100 slices × 2 days"; no data) (ch 43).
- **Defers irreversible decisions** (Project Paradox) (ch 11).

## Contrast with traditional approaches

- **Prose requirements** → subjective interpretation; silent disagreement (the "default set" + Vienna anecdotes) (ch 3).
- **UML** → "never translated to the business side"; noun/UML-first modeling = "the worst thing you can do" (ch 3, 11).
- **Scattered Confluence/Jira + legacy code + stale docs** → no one can trace data flow (ch 3).
- **Layered / horizontal team split** → the "bubbling effect": a one-field change cascades across DTOs/layers ("a week of meaningless work"). Vertical slices localize change (ch 10).

## Brings roles together / shared language

- Collaborative by construction — get all domain-knowers in early; "the more people the better" (ch 11).
- **Screens included** because "everybody, including business, understands a simple mockup"; visual people need something visual (ch 3).
- **GWTs defined jointly with business** → real rules in software-translatable form (ch 3).
- Per-role "**What's in it for me?**" (ch 43): business (validate/model before build), on-call (incident triage via dependency view), PM (slice estimation), architecture (integration-point visibility), QA (acceptance criteria upfront), vendor mgmt (per-slice SLAs).

## Spec / maintainability

- Closest planning technique to **actual implementation**; "completely describe any part of any system" via GWT/GT (ch 3).
- **Model-first + code-gen** → model always reflects current state; great **onboarding** doc (no reading stale docs) (ch 3).
- Slices → isolated implementation, parallel dev, "exactly one place where code belongs"; GWT tests survive rewrites (ch 10).

## Honest caveats (book's own)

Needs **100% management buy-in** or "likely to fail"; opinionated/rigid (no cherry-picking patterns); documenting a large existing system "becomes a project"; most claims are the author's experiential opinion, framed as "my way," not empirical (ch 1, 11, 43).

## Memorable quotes

- "Commands describe what should happen, events describe what actually happened." (ch 3)
- "Written text allows interpretation, while GWTs provide facts." (ch 3)
- Brandolini: "It's developers' understanding, not your business knowledge, that becomes software." (ch 3)
- Bogard: "Minimize coupling between slices, and maximize coupling within a slice." (ch 10)
- "Information is the new gold." (ch 1)

## Alignment

Validates our `../vision.md` (roles together, shared language, scale) and the `../ai-participation.md` claim that the model is a **complete, tech-agnostic spec** that can drive implementation. The book's "code-gen running specs from GWTs" is the human-era precursor to our AI-participation idea.
