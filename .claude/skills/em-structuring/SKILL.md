---
name: em-structuring
description: >
  Deep dive + runnable workflow for Structuring an Event Model — the organizing layer that keeps a
  model readable as it grows: slices, swimlanes, chapters/sub-chapters, multiple models per board,
  alternative/error flows, element links, backlinks, and context clustering. Disambiguates the three
  grouping axes the book leaves implicit and gives an explicit split decision-guide + a de-collided
  legend. Applied continuously AND as a dedicated organize pass. Runs in two modes: AUTONOMOUS (AI
  structures the model solo, flags boundary decisions) and COOPERATIVE (AI leads the organizing).
  Trigger: /em-structuring, "structure the model", "organize the event model", "swimlanes", "chapters",
  "split into models", "alternative/error flow", "this model is getting messy", "group slices".
argument-hint: "[auto | coop | explain <subtopic> | empty → pick a mode]"
allowed-tools: Read, Glob, Grep, AskUserQuestion
---

# em-structuring

Structuring an Event Model — in depth + as a runnable workflow. For the whole process see the **event-modeling** skill; the elements being organized come from **em-brainstorming / em-wireframes / em-commands / em-automations / em-scenarios**. Persist artifacts + decisions via the **notes** skill.

Structuring is the **organizing layer**: it doesn't add new facts/commands/rules — it arranges what the other phases produced so the model reads as a clean story and scales without becoming a wall of stickies. Two modes of use: applied **continuously** while modeling, and as a dedicated **organize pass** when a model has grown messy.

> **Canonical vs flexible (read this first).** The four patterns (State Change, State View, Automation, Translation) and GWT are the **fixed core** — you don't invent or pick-and-choose those. Everything in *this* skill is the opposite: the structuring tools are explicitly **optional, practical extensions, not official Event Modeling notation** — conventions selected by practitioners, meant to be adapted. Present them as opinionated defaults the user (and this tool) can swap, not as law.

## Two modes

Pick from the argument (`auto` / `coop`); if neither given and it's a run, ask once with AskUserQuestion, then commit for the session.

**Autonomous** — the AI structures the model solo: assigns facts to swimlanes, groups slices into chapters, splits into multiple models, marks element links / backlinks, lifts alternative/error paths into their own models, applies the legend. It asks the user only **occasionally** — on genuine boundary judgments (where one context ends and another begins; whether an error path is a separate model or just a GWT; what to name a cluster). Produce-then-verify, don't interrogate.

**Cooperative** — the AI is the **session leader** running the organize: *"does this read left-to-right as a story?"*, *"which capability does this fact belong to?"*, *"where does one context end?"*, *"should this error be its own flow?"*, *"what do you call this cluster?"*. The user supplies domain boundaries + names; the AI arranges + flags. Augments, doesn't author.

Same destination: a model (or set of models) that reads L→R as a story, grouped on the right axes, split where it should be, with a consistent legend. Shared foundation below; mode playbooks follow.

---

# Shared foundation (both modes)

## The master invariant: read left→right like a story

The single timeline read L→R like a book is the thing every structuring choice protects. The two axes are **orthogonal**:
- **Horizontal = flow** (the timeline / story).
- **Vertical = detail + context**: GWT scenarios stack *below* a slice; chapter bands sit *above*. You scan horizontally for the story, drop down for a slice's rules, glance up for the current context.

If a structuring choice breaks L→R readability, it's the wrong choice — move the thing off the timeline (to a band above, a stack below, or a separate model).

## The three grouping axes — disambiguated

The book groups along three different axes and never relates them. They are NOT alternatives; they compose. Keep them straight:

| Axis | Groups… | Direction | Notation | Use for |
|---|---|---|---|---|
| **Slice** | one command→fact or fact→read-model | a box *on* the timeline | named box around the elements | the atomic unit; everything else groups slices/facts |
| **Swimlane** | business **facts** by **capability** | horizontal **lane** spanning the timeline | stacked lanes; internal vs external separated | "which capability/stream does this fact belong to" |
| **Chapter / sub-chapter** | consecutive **slices** by **context/phase** | band **above** the model (two layers) | blue arrows, above, e.g. Shopping › Items | "which part of the process am I reading" |

Above all three sits **bounded-context clustering** (DDD): facts naturally cluster into *areas of interest* → contexts; a cluster with a real business name is also an aggregate candidate (no good name → not detailed enough yet). Context boundaries decide where one **model** ends and another begins.

> **"Swimlane" warning.** This skill (following the book) uses *swimlane = a lane grouping facts by business capability* (and separating internal from external facts). Mainstream Event Modeling elsewhere often uses "swimlane" for fixed **element-type rows** (UI / command / fact / read-model). They are different conventions — flag the ambiguity when talking to people who learned EM elsewhere, and decide per project which the tool presents.

## Slices — the structural unit

Smallest functional unit: one **State Change** (command→fact) or **State View** (fact→read model); automations/translations are composite. Draw as a named box around its elements; GWT stacks below. Slices are what chapters group and what later map to one implementation/ownership unit — see *model vs defer*.

## Swimlanes

Horizontal lanes grouping facts by capability (e.g. `Cart`, `Inventory`, `Pricing`, `External/Order`). Introduce a lane the moment a distinct concept appears; **name it early even if provisional** — renaming is cheap. Keep **internal facts (orange) separate from external/integration facts (yellow)**, external in their own lane. Two validation tricks:
- **Read one lane aloud.** Hide all lanes but one; read its facts L→R to someone who can't see the model — it should form a coherent story. If not, the lane boundary is wrong.
- **Right→left data walk.** Hide everything; uncover facts from the right one at a time, checking each is supplied by preceding facts (the information-completeness check, run backwards).

## Chapters / sub-chapters

Bands **above** the model (blue arrows, two layers) grouping consecutive slices by context/phase, so the eye captures "what part of the system am I in" while reading. e.g. chapter `Shopping` › sub-chapters `Items`, `Inventory`, `Price Change`, `Submission`. Non-invasive, easy to adjust as slices move. (Term collides with "book chapter" and with these skills — say "chapter band" if confusion looms; "workflow" is a community alt the author dislikes.)

## Multiple models per board + context naming

Prefer **many small models over one big one** — aim for **one business context per model**, sized to read L→R without visual interruption. Name each with a **pink sticky on its left edge** (the model context). This is the rule, not the exception.

## Alternative / error flows

Event Modeling models **one flow per timeline** — no inline conditionals/loops. Model the **good case first**; push each alternative/error path to **its own model** (with its own pink context name), linked by a **marker sticky placed below the slice** it branches from. If a case is tiny, a **GWT is enough** — don't spin up a model. (Surfacing-an-error often reveals a new rule, e.g. "3 failed submits → cart aborted".) Whether an error is an *exception* or an explicit *failure fact* + recovery flow is decided in **em-scenarios / em-automations** — structuring just decides where the flow lives.

## Element links + deliberate duplication

The same element often recurs (one read model across two screens; a re-copied `Add Item` slice to establish example state). **Mark recurrences as the same element** (the book uses a blue corner arrow) rather than implying two different concepts — name-only matching is fragile under rename. **Duplicate freely for concrete examples** ("more examples = fewer assumptions"); the links keep duplicates honest. (In a software tool, this is a first-class typed connector, not a color convention — see *tooling*.)

## Backlinks (dotted arrows)

When a **later** fact affects an **earlier** read model (data only, not the flow) — e.g. `Item Archived` feeding the earlier `cart items` — draw a **dotted arrow from the fact back to the read model**, and add the fact to that read model's "fed by" list. **Default to the dotted-backward convention** (the book's preference); the alternative is to copy the read model forward — pick one and stay consistent. Don't reorder the timeline to avoid a backlink. (Same dotted convention as a Processor-Todo-List back-channel.)

## High-level vs detailed views

The same model serves different audiences at different detail. For executives, a **TL;DR view** — hide attributes/GWTs/most facts, show key screens + headline facts (or a redrawn 5-slide summary). A genuine modeling-presentation technique, not new content.

## De-collided legend

The book's colors overload **blue** (command, chapter arrows, element-link arrows, screen-focus highlight) and **red** (parking sticky, missing-data arrow). Disambiguate by **shape + position**, not color alone:

- **Element fills:** orange = internal business fact · yellow = external/integration fact · blue = command · green = read model · gear = automation · sketch = screen/wireframe.
- **Annotation stickies:** pink (left of model) = model context name · white (in a scenario) = context note · red = parked/unresolved.
- **Arrows/links:** blue band *above* = chapter · small corner arrow = element link (same element) · **dotted** arrow = backlink/back-channel (data-only) · red arrow = missing-data gap (info-completeness) · marker below a slice = alternative-flow link.

When building the tool: prefer **typed connectors + element kinds** over reusing one color for several meanings — it removes every collision above.

## What to MODEL (structure) vs DEFER (implementation)

| Structure (modeling altitude) | Defer (implementation) |
|---|---|
| Swimlanes as capability grouping; internal/external separation | physical streams, stream IDs, partitions, snapshots, "closing the books" |
| Slice as a unit you can name / own / estimate; "maps cleanly to one code unit" | packages, modules, framework wiring, dependency rules, coupling tradeoffs |
| Clustering facts → named contexts/aggregates; context boundaries | aggregate roots, locking, transaction scope, consistency code |
| External/integration fact = a context's stable contract (own lane, yellow) | schema versioning, transport (HTTP/queue/CSV) |
| Chapters/slices map to epics/tickets, team ownership (note only) | actual backlog/PM mechanics |

State the bridges ("a slice maps to one code/ownership unit"; "a context cluster may become a bounded context"), but stop there — don't model the mechanics.

## Tooling note (this project)

Multiple-models navigation, element links, backlinks, and alternative-flow markers are exactly the **board affordances** the tool being built can formalize (typed links, jump-to-model, same-element references, de-collided element kinds) — on a physical whiteboard they're just hand-drawn references. When reasoning about the product, treat these structuring conventions as feature candidates.

---

## Representation

Annotate the model with structure metadata (persist via **notes**):

```
MODEL  Shopping                              [context: pink]   reads L→R: yes
  swimlanes   Cart (internal) | Inventory (internal) | Pricing (internal) | External (yellow)
  chapters    Shopping › [Items | Inventory | Price Change | Submission]
  slices      Add Item, Remove Item, Clear Cart, Submit Cart, Publish Cart, Archive Item, …
  links       cart items (read model) reused by Add/Remove screens  → element-link
  backlinks   Item Archived ⇢ cart items (dotted, data-only)
  alt-flows   Submit Cart →(marker)→ model "Submit Cart Error"

MODEL  Submit Cart Error                     [context: pink]   linked-from: Submit Cart
  …good-case-free; error path + its GWTs…
```

Keep a **structure log**: open boundary questions (context edges, lane names, split-or-not decisions) → status.

## What good looks like

- Every model reads L→R as a coherent story; one business context per model.
- Facts sit in the right capability swimlane; internal vs external cleanly separated.
- Slices grouped into chapter bands; the eye always knows the current context.
- Alternatives/errors live in their own linked models (or as GWTs); the main timeline stays linear.
- Reused elements are linked; later-fact→earlier-read-model shown as backlinks; no timeline reordering hacks.
- One consistent, de-collided legend; no implementation mechanics baked in.

## Pitfalls

- **Conflating the three axes** — using a swimlane where a chapter belongs (or vice versa). Facts→lanes (capability), slices→chapters (phase), contexts→separate models.
- **One giant model.** Split by context; prefer many small.
- **Inline branching/loops.** Push alternatives to separate models or GWTs; keep one flow per timeline.
- **Reordering the timeline** to avoid a backlink — use the dotted backlink instead.
- **Color-only notation** that collides (blue/red). Disambiguate by shape+position; in the tool, type the connectors.
- **Structuring into implementation** — streams/packages/aggregate-locking. Stay at the grouping altitude; defer mechanics.
- **Treating these conventions as canon.** They're flexible extensions; the four patterns + GWT are the fixed part.
- **Premature context splitting.** Logical splits (models on a board) are cheap — do them; system/deployment splits are expensive — defer until you know more.

---

# Mode playbook: Autonomous

1. **Load the model.** Facts, slices, scenarios, automations/translations + any brainstorm clusters/terms. Confirm overall scope.
2. **Check the story.** Read each model's facts L→R — does it hold together? Where it doesn't, that's a split or reorder signal.
3. **Lane the facts.** Assign each fact to a capability swimlane; separate internal (orange) from external (yellow). Name lanes (provisional ok).
4. **Chapter the slices.** Group consecutive slices into chapter/sub-chapter bands by phase/context.
5. **Split by context.** Where a model spans >1 business context or is too wide to read, split into multiple named models. Cluster facts → name contexts (DDD); flag boundary calls you can't make.
6. **Lift alternatives.** Move error/alternative paths off the main timeline into linked models (marker below the branching slice); keep tiny ones as GWTs.
7. **Wire links.** Mark reused elements (element links); add backlinks (dotted) for later-fact→earlier-read-model.
8. **Apply the legend.** Normalize to the de-collided legend; note any collisions resolved.
9. **Decide vs flag.** Mechanical grouping → resolve. Boundary judgments (context edges, lane names, split-or-not, error-flow-or-GWT) → assumption or raise.
10. **Ask occasionally, batched.** One small AskUserQuestion batch for genuine boundary decisions only.
11. **Output.** Structured model(s) + structure log + open questions. Offer to persist via **notes**.

Guardrails: protect L→R readability; keep the three axes distinct; modeling altitude only; never silently draw a context boundary you're unsure of — flag it.

---

# Mode playbook: Cooperative

1. **Open + frame.** Explain we're organizing, not adding — keeping the model a readable story. Confirm scope. Note these conventions are flexible.
2. **Read the story together.** Walk the timeline L→R with the user. *"Does this read like a coherent story? Where does it stop making sense?"* — friction marks where to split/reorder.
3. **Find the lanes.** *"Which capability does this fact belong to?"*, *"is this ours or another system's?"* (internal vs external). Name lanes with the user's words.
4. **Find the chapters + contexts.** *"What would you call this run of steps?"* (chapter), *"is this still the same part of the business, or a different context?"* (split into a new model). Use the cluster-naming heuristic: no good business name → not a clean boundary yet.
5. **Handle alternatives.** *"What happens when this fails or branches?"* and *"is that big enough to be its own flow, or just a rule here?"* — separate model vs GWT.
6. **Confirm reuse + backlinks.** *"Is this the same cart list as before?"* (element link); *"does anything later change this view's data?"* (backlink).
7. **Read back.** Summarize: models + their contexts, lanes, chapters, split points, links. Confirm the story still reads.
8. **Output.** Same as autonomous; persist via **notes**, including the structure log.

Guardrails: lead the organizing, don't redraw the domain; the user owns context boundaries + names; protect readability; don't bake in implementation.

---

## Output → done

Structuring completes the modeling cycle: the model is now a readable, navigable set of small context-scoped models, grouped on the right axes, with alternatives isolated and a consistent legend. Carry forward the **structure log** (boundary decisions, provisional lane/context names to revisit) for the next organize pass. From here the model is the living spec feeding requirements + (eventually) implementation — re-run this skill as an organize pass whenever the model grows. See the **event-modeling** skill for the full picture.

## Argument modes

- `auto` → run the Autonomous playbook.
- `coop` (or `cooperative`) → run the Cooperative playbook.
- `explain <subtopic>` → just that section (e.g. `explain three axes`, `explain swimlanes`, `explain chapters`, `explain alternative flows`, `explain legend`, `explain split decision`).
- empty → if it's a run, ask which mode (auto/coop) then proceed; otherwise this full guide.
