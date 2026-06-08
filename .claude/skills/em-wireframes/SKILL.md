---
name: em-wireframes
description: >
  Deep dive + runnable workflow for the Wireframing phase of Event Modeling — phase 2, the bridge
  that turns the brainstorm's ordered business-fact story into rough screen sketches that reveal what
  DATA each screen needs and what ACTIONS the user takes. Outputs ASCII-art wireframes (simple cases)
  or .excalidraw files (complex cases). Runs in two modes: AUTONOMOUS (AI sketches solo from the
  timeline, asks only on real UX/data decisions) and COOPERATIVE (AI leads, sketching with the user).
  Load to run, lead, or explain wireframing.
  Trigger: /em-wireframes, "wireframe this", "sketch the screens", "mock up the UI", "what data does
  this screen need", connecting brainstorm output to UI, ASCII/excalidraw wireframes.
argument-hint: "[auto | coop | explain <subtopic> | empty → pick a mode]"
allowed-tools: Read, Write, Edit, Glob, Grep, AskUserQuestion, Bash(ls:*), Bash(mkdir:*), Bash(mv:*)
---

# em-wireframes

Phase 2 of Event Modeling — in depth + as a runnable workflow. For the whole process see the **event-modeling** skill; for the phase before this, **em-brainstorming**. Persist artifacts + decisions via the **notes** skill.

Wireframing is the **bridge**: take the brainstorm's ordered story of business facts and, use case by use case, sketch rough screens. The point is not pretty UI — it's to make the story tangible, reveal **what data each screen needs** and **what actions the user can take**, and confirm a consistent data flow. Those revealed data-needs + actions hand straight into the next phase (commands + read models), which works backwards from them.

## Two modes

Pick from the argument (`auto` / `coop`); if neither given and it's a run, ask once with AskUserQuestion, then commit for the session.

**Autonomous** — the AI sketches solo from the timeline. Generates a wireframe per use case, marks focus/data/actions, derives the data-needs + action lists. Asks the user only **occasionally** — when a screen encodes a genuine UX or business-data decision that can't be inferred (what info a user must see, an unstated field, a missing screen). Produce-then-verify, don't interrogate.

**Cooperative** — the AI is the **session leader**; the user holds the domain/UX intent. The AI proposes a rough sketch, then draws detail out: *"what's on this screen?"*, *"what does the user need to see here?"*, *"what can they do?"*. It refines from feedback. Augments, doesn't author — it offers a starting sketch to react to, not a finished design.

Same destination either way: a rough wireframe per use case + marked data/actions + the handoff lists. What differs is who supplies the UX/data intent and how much the AI drives vs draws out. Shared foundation below; mode playbooks follow.

---

# Shared foundation (both modes)

## Purpose + mindset

- Screens exist to **foster shared understanding** and to **surface data needs** — not to design UX. Expect resistance ("screens are unnecessary / a waste of time"); the payoff is everyone seeing the same thing and data gaps showing up early.
- **Rough + minimal.** They should look like something you'd never ship. Detail goes into *what data is captured/shown*, not visual polish. Real UX is an expert's job, later.
- **Data-first.** A screen's job here is to expose which data flows in (to display) and which actions flow out (to change state).
- **One context POV.** Sketch from the viewpoint of the system being modeled. Assume upstream data is simply available (e.g. don't model how products got into the catalogue — just show them).
- Cooperative sessions are **small** (≈4–6 with domain knowledge), unlike the big brainstorm.

## Connecting from brainstorm

Input = the ordered business-fact story (+ surfaced terms/questions) from **em-brainstorming**. For each meaningful step / use case in that story:

1. Ask: *what screen would a user be looking at when this happens?* (Some facts have no screen — automations, external facts. Skip those.)
2. Sketch the screen rough.
3. The sketch reveals data + actions → mark them (below) → that's the bridge to phase 3.

## Marking convention (the whole value)

The book marks the in-focus element **blue** and the data elements **green**. Reproduce that in text:

- **Focus** — the one element this use case is about (the button/field in play for this slice). It implies a **command** later.
- **Data** — every element whose value is read from the system. Each implies a field on a **read model** later.
- **Actions** — interactive elements (buttons, inputs) the user triggers.

For every wireframe, always emit two lists beneath it — this is the handoff:

- **Data shown** (→ read-model fields): list each, and if known, which business fact(s) could supply it. Unknown source = open question (the downstream information-completeness check will force it).
- **Actions** (→ commands): list each, with the business fact it should produce.

## Reuse + examples

- The **same screen / data view often recurs** across use cases (e.g. one cart list feeds both the add and remove flows). Mark reused elements as the same thing (link/name them) rather than redrawing a new concept.
- **Work with concrete examples** — show the screen with real sample data, and show empty/after states (e.g. the empty cart after the last item is removed). More example states = fewer assumptions.

---

# Output formats

Default to **ASCII**. Escalate to **.excalidraw** when ASCII can't carry the layout. In cooperative mode, ask the user's preference; in autonomous mode, choose by complexity and say which and why.

## ASCII wireframes (default — simple cases)

Best for: a single screen, few fields, linear layout. Fast, inline, diffable, lives in markdown/notes.

Convention:
- Screen frame with box-drawing chars: `┌ ─ ┐ │ └ ┘`.
- Buttons: `[ Submit ]`.
- **Focus** element of the slice: wrap with `»…«` (the blue mark).
- **Data** read from the system: wrap value/field with `«…»`? No — reserve `»«` for focus. Mark data with a trailing `°` and/or list it below. Keep markers distinct and add a legend.

Example — Cart screen, "Remove Item" use case (focus = the remove button):

```
┌─ Cart ───────────────────────────────┐
│  [img]  Espresso Blend°               │
│         Premium dark roast°           │
│         € 9,90°        in stock: 12°  │
│                          » [Remove] « │
│                                       │
│  Total: € 9,90°                       │
│                         [ Order now ] │
└───────────────────────────────────────┘
legend:  » … «  focus (this slice → command)    °  data from system (→ read-model field)
```

Data shown (→ read model `cart items`): image, description, price, inventory, totalPrice — sources: `Item Added` (image/description/price/product-id), inventory from `Inventory Changed`, totalPrice derived.
Actions (→ commands): `[Remove]` → `Remove Item` (produces `Item Removed`); `[Order now]` → `Submit Cart` (produces `Cart Submitted`).

## .excalidraw wireframes (complex cases)

Best for: multiple linked screens, spatial layout, arrows between screens/states, anything ASCII would mangle. Produces an editable `.excalidraw` file.

Save to `notes/wireframes/<context>/<use-case>.excalidraw` (mkdir as needed) and reference it from the relevant note. Confirm location in coop mode.

File envelope:

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://excalidraw.com",
  "elements": [],
  "appState": { "viewBackgroundColor": "#ffffff", "gridSize": null },
  "files": {}
}
```

Each element needs these fields (keep `id`s unique; `seed`/`version`/`versionNonce`/`updated` can be any fixed integers — Excalidraw recomputes on open):

Rectangle (screen frame / button):
```json
{ "id": "screen", "type": "rectangle", "x": 0, "y": 0, "width": 360, "height": 220,
  "angle": 0, "strokeColor": "#1e1e1e", "backgroundColor": "transparent",
  "fillStyle": "solid", "strokeWidth": 1, "strokeStyle": "solid", "roughness": 1,
  "opacity": 100, "groupIds": [], "frameId": null, "roundness": { "type": 3 },
  "seed": 1, "version": 1, "versionNonce": 1, "isDeleted": false,
  "boundElements": [], "updated": 1, "link": null, "locked": false }
```

Text (label / data field) — placed as a standalone element positioned inside the rect (avoid container binding for simplicity):
```json
{ "id": "title", "type": "text", "x": 16, "y": 12, "width": 120, "height": 24,
  "angle": 0, "strokeColor": "#1e1e1e", "backgroundColor": "transparent",
  "fillStyle": "solid", "strokeWidth": 1, "strokeStyle": "solid", "roughness": 1,
  "opacity": 100, "groupIds": [], "frameId": null, "roundness": null,
  "seed": 2, "version": 1, "versionNonce": 2, "isDeleted": false,
  "boundElements": [], "updated": 1, "link": null, "locked": false,
  "text": "Cart", "fontSize": 20, "fontFamily": 1, "textAlign": "left",
  "verticalAlign": "top", "containerId": null, "originalText": "Cart", "lineHeight": 1.25 }
```

Arrow (link screens / show a flow) — `points` are relative to `x,y`:
```json
{ "id": "flow", "type": "arrow", "x": 360, "y": 110, "width": 80, "height": 0,
  "angle": 0, "strokeColor": "#1e1e1e", "backgroundColor": "transparent",
  "fillStyle": "solid", "strokeWidth": 1, "strokeStyle": "solid", "roughness": 1,
  "opacity": 100, "groupIds": [], "frameId": null, "roundness": { "type": 2 },
  "seed": 3, "version": 1, "versionNonce": 3, "isDeleted": false,
  "boundElements": [], "updated": 1, "link": null, "locked": false,
  "points": [[0,0],[80,0]], "lastCommittedPoint": null,
  "startBinding": null, "endBinding": null, "startArrowhead": null, "endArrowhead": "arrow" }
```

Conventions in excalidraw to preserve the marks:
- **Focus** element → `strokeColor: "#1971c2"` (blue) + `strokeWidth: 2`.
- **Data** elements → `strokeColor: "#2f9e44"` (green) or a green text color, matching the book's green.
- Group a screen's elements with a shared `groupIds` value so it moves as one; optionally wrap each screen in a `frame`.
- Still emit the **Data shown** + **Actions** lists in text alongside the file — the file is the picture, the lists are the handoff.

Validity check: it must be parseable JSON, `type:"excalidraw"`, `elements` an array. When in doubt, fewer elements that open cleanly beats a rich file that won't load.

---

# Mode playbook: Autonomous

1. **Load inputs.** The brainstorm timeline + terms/questions (from prompt, notes/, em-brainstorming output). Confirm the context scope.
2. **Pick the screens.** Walk the story; for each use case that a user touches, decide the screen. Skip purely automated/external steps.
3. **Sketch.** Rough wireframe per use case — ASCII by default, escalate to .excalidraw on complexity (state which + why). Show example data + key empty/after states.
4. **Mark + derive.** Mark focus/data/actions. Emit the **Data shown** (→ read-model fields, with candidate source facts) and **Actions** (→ commands → facts) lists.
5. **Flag, don't invent.** Generic screen mechanics → infer. Real UX/business-data decisions (must a user see X? is there a field for Y? is there a screen at all?) → mark as assumption or raise.
6. **Ask occasionally, batched.** Collect genuine unknowns; ask in one small batch (AskUserQuestion). Only things that change the model.
7. **Output.** Wireframes + handoff lists + open questions/assumptions. Offer to persist via **notes** (and save .excalidraw files under `notes/wireframes/…`).

Guardrails: rough not pretty; data-first; one context; never silently encode a UX/business decision — flag it.

---

# Mode playbook: Cooperative

1. **Open + frame.** Remind that these are rough, throwaway, about data not looks. Confirm the context scope. Ask ASCII vs .excalidraw preference (and where to save files).
2. **Per use case, propose then draw out.** Offer a quick starter sketch for the current step, then elicit: *"what's on this screen?"*, *"what does the user need to see?"*, *"what can they do here?"*. Refine from their answers.
3. **Mark live.** As elements settle, mark focus/data/actions and reflect them back.
4. **Surface gaps.** When a data element has no obvious source fact, or a term doesn't match the brainstorm vocabulary, raise it — that's a real find. Reuse existing screens/data views instead of inventing parallel ones; confirm "is this the same cart list as before?".
5. **Work examples together.** Fill in sample data; sketch empty/after states to pin behavior.
6. **Read back the handoff.** Confirm the **Data shown** and **Actions** lists with the user before moving on.
7. **Output.** Same as autonomous; persist via **notes**, save .excalidraw files to the agreed location.

Guardrails: lead, don't author. Offer sketches to react to; don't impose a finished design or override the user's vocabulary. Match energy.

---

## Output → next phase

Carry forward, per use case: (1) the rough wireframe (ASCII inline or a saved .excalidraw), (2) **Data shown** → candidate read-model fields with source facts, (3) **Actions** → candidate commands with the facts they produce, (4) open questions / missing screens / data-source gaps. The next phase — **commands + read models** — takes these lists and works backwards (screen data → read-model fields → source facts; screen actions → commands → events), applying the information-completeness check. See the **event-modeling** skill.

## Argument modes

- `auto` → run the Autonomous playbook.
- `coop` (or `cooperative`) → run the Cooperative playbook.
- `explain <subtopic>` → just that section (e.g. `explain marking`, `explain excalidraw`, `explain bridge`).
- empty → if it's a run, ask which mode (auto/coop) then proceed; otherwise this full guide.
