# Reference: The Event Modeling Process (canonical)

> [reference 2026-06-05] Source: `source.md` (ch 1, 3, 10, 11, 12, 13, 18, 43). Strongly aligns with `../process-and-collaboration.md` + `../validation.md`.

## Philosophy

- The problem solved is **communication, not technology**. Words require interpretation; two people hold different understandings of the "same" requirement and never find out — claimed "biggest reason IT projects fail" (ch 3).
- A model is a **blueprint** read **left-to-right like a story**, understandable by business + devs; feels like "sitting at a screen together" even before the system exists (ch 3).
- **Model data flow, never technology** (no DBs/REST/messaging) (ch 3, 12).
- **Facts over prose**: "written text allows interpretation, GWTs provide facts" (ch 3).
- **Model-first**: change the model before the code; ideally generate code from it (ch 3).
- **Project Paradox** (ch 11): biggest, least-reversible decisions get made earliest when you know least → defer tech/architecture, front-load fact-gathering. Planning ≈ **60–70%** of total effort (ch 3).

## The process, step by step

1. **Brainstorm events** — large group (~15; dev + business + CEO, "more is better"). Orange stickies, **past tense** ("Product added"). Chaotic, dupes fine, no mistakes possible (ch 11).
2. **Order into a timeline** — arrange events left-to-right into a coherent story; one person **reads it aloud** to validate (ch 11).
3. **Wireframe use cases** — **smaller group (~4–6)** with domain knowledge. Low-fidelity screens; mark data (green) + active control (blue). Model from **one context's view** at a time (ch 12).
4. **Derive commands/read-models/events backwards** — for each event: "what command caused it?"; for each screen: "what data to display it?" → read-model fields → "what event data feeds it?" → "what command data feeds the event?" (ch 12).
5. **Information Completeness Check** (continuous) — read models may only read **already-stored** event data; every attribute must trace to a source, else **red arrow** + can't proceed (ch 3, 12). → our completeness walk, `../validation.md`.
6. **Slice** — break into smallest functional units; each slice is one of the 4 patterns; ~1 day of work (ch 10, 13).
7. **GWT / GT scenarios** — define business rules per slice **with stakeholders**; stack vertically below slice; concrete example data → unit tests (ch 13). See `gwt-and-gt.md`.
8. **Iterate** per use case; work with **copied examples** not assumed state; add automations, translations, external events (ch 12, 15).
9. **Structure** — group slices into Chapters/Sub-Chapters; prefer many small models; error/alt cases as separate linked flows (ch 18). See `organizing-large-models.md`.
10. **Implement** — slice → code package/ticket; GWT → unit tests; chapters → epics (ch 10, 43).

## Participation by phase (confirms our `../process-and-collaboration.md`)

- Brainstorm: large mixed group (~15).
- Wireframe + detailed modeling: small focused group (~4–6).
- GWTs: modelers **+ business stakeholders**.
- A **facilitator** keeps balance (stop devs going too deep → loses business; stop dwelling on business → loses devs); park blockers with a **red sticky** and move on. Sessions ≤ ~2 hrs; ~2–4 hrs/week to start; ~3 months to get comfortable (ch 43).

## Color / notation quick ref

Orange=Event, Blue=Command, Green=Read Model, Yellow=External Event, Gear=Automation, White=context note, Pink=model name, Red=missing data / parked blocker (ch 3, 11, 12, 18, 43).

## DIVERGENCE flags (our tool vs book)

> [open question 2026-06-05]

- Book leans on **multi-user co-located sessions** for brainstorming; our v1 is single-user/screen-share (`../vision.md`). Book's core modeling loop (steps 3–9) is largely single-user-viable — one person at a whiteboard — so v1 covers most of the method; real-time collab mainly helps the brainstorm step.
- Book's **backwards completeness check on attributes** (step 5) is exactly our completeness walk — but presumes per-element **attribute/field** definitions exist; we made fields a *later pass* (`../validation.md`). Consistent, just sequencing.
