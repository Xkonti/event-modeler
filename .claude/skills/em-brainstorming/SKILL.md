---
name: em-brainstorming
description: >
  Deep dive + runnable workflow for the Brainstorming phase of Event Modeling — phase 1, where the
  raw business facts (past-tense "what happened") are surfaced then ordered into a left→right story.
  Runs in two modes: AUTONOMOUS (AI fact-storms solo from the requirements, asks the user only when
  genuinely blocked) and COOPERATIVE (AI is the meeting leader, eliciting + augmenting while the user
  supplies domain knowledge). Load to run, lead, or explain brainstorming.
  Trigger: /em-brainstorming, "brainstorm business facts", "start an event model", "fact storm",
  "lead a brainstorming session", ordering the timeline, "what counts as a business fact".
argument-hint: "[auto | coop | explain <subtopic> | empty → pick a mode]"
allowed-tools: Read, Glob, Grep, AskUserQuestion
---

# em-brainstorming

Phase 1 of Event Modeling, in depth + as a runnable workflow. For the whole process and the other patterns, see the **event-modeling** skill. Persist anything worth keeping via the **notes** skill — this skill facilitates/produces, notes stores.

Brainstorming = the blank-canvas start. Surface the raw **business facts** of the domain, then order them into a story that reads correctly left→right. Nothing else yet — no commands, read models, UI, or tech.

## Two modes

This skill runs one of two ways. Pick from the argument (`auto` / `coop`); if neither given and it's clearly a run (not an `explain`), ask once with AskUserQuestion which mode, then commit for the session.

**Autonomous** — the AI *is* the room. It generates the fact dump itself from whatever requirements exist, dedups, and orders the timeline solo. It asks the user only **occasionally** — when something is genuinely unknowable from the requirements (a real business decision, an ambiguous term, a missing rule). Bias to produce, then verify; don't interrogate.

**Cooperative** — the AI is the **meeting leader**, the user is the domain expert (the "room"). The AI runs the session conversationally: elicits facts from the user, seeds a few to break the ice, reframes, dedups, surfaces tensions, builds + reads back the timeline, calls the exit. It **augments, doesn't author** — it does not dump a finished model; it draws facts out of the user and only contributes facts to prime or unblock.

Same destination either way (ordered timeline + surfaced questions). What differs is *who supplies the domain knowledge* and *how much the AI drives vs draws out*. The shared foundation below applies to both; the mode playbooks follow.

---

# Shared foundation (both modes)

## Why start here

Project Paradox: the biggest, least-reversible decisions land earliest, when knowledge is lowest — so defer them. Listing facts is the one thing doable with almost no assumptions; it surfaces maximum domain knowledge before anyone commits to architecture or a "perfect" model.

Anti-start: jumping to tech, UML, "find the nouns", or a clean up-front model. That path breaks projects early. The only input needed is a **loose set of requirements**.

## Scope to one context

Model from the point of view of **one system / bounded context**. Assume other systems' outputs are simply available; don't model their internals. This keeps the fact set bounded and the vocabulary consistent (the same word means different things in different contexts — see ubiquitous language). If the requirements clearly span multiple contexts, name them and brainstorm one at a time.

## The core unit: a business fact

A **business fact** = something that happened in the domain, worth remembering. Past tense. Orange.

- It's "what remains of the system when powered off then on" — the durable record of what occurred. Reading the facts alone shows what the system can do.
- Examples: `Item Added`, `Cart Submitted`, `Price Changed`, `Customer Registered`.
- **Persistence-agnostic** — says data was recorded, NOT how. No claim about event sourcing, tables, or streams.

### Good granularity

- **Business-meaningful, not UI mechanics.** `Item Added` ✓ — `Button Clicked` / `Form Validated` ✗.
- **Atomic** — one thing that happened. `Order Processed` is probably hiding several facts.
- **Domain vocabulary** — the words the business actually uses. The fact text *is* the start of the shared language.

### Internal vs external facts

Most facts are **internal/domain** facts (your context's own state; they'll keep evolving). Some surface as **external/integration** facts — data arriving from or published to other systems (e.g. inventory or pricing notifications). Keep those in the dump but mark them as external; don't model the other system's internals. External facts later become a stable contract — not a brainstorming concern, just note the origin.

### Not a business fact

- A **command** ("Add Item") — instruction, imperative. Later phase. The #1 mistake is writing commands as facts.
- A **UI/screen action** ("Button Clicked") — later phase, wrong altitude.
- A **read/query** ("Cart Viewed") — usually not a fact unless the *viewing* itself is a recorded domain occurrence.
- A **wish/requirement** ("must be fast") — not something that happened.

## Ubiquitous language (emerges here)

Naming facts is where the shared business↔IT language is born. Treat it as a first-class output, not a side effect.

- **Capture domain terms** as they appear; they become the project's vocabulary.
- **Near-duplicate facts are signal**, not noise — two slightly different facts for "the same" thing expose where people use different words or mean different things. Don't silently merge; surface the tension and resolve it with whoever owns the word (coop: ask the user; auto: flag as a question).
- **Watch for the same term meaning different things** — a hint you've crossed a context boundary.
- **Facts naturally cluster** by concept. A cluster with a clear business name is a future aggregate/context; if a cluster has no good name, it's not detailed enough yet. Note clusters; don't force aggregate-finding during brainstorm.

## The two movements

Brainstorming is **diverge then converge** — both in one session.

**1. Diverge — the fact dump.** Facts onto orange stickies, fast. No filtering, judging, or ordering. **No wrong answers** — this is the safest phase, you cannot make a mistake. **Duplicates + chaos are good.** Missing facts are fine — gaps get caught later (esp. the information-completeness check in downstream phases). Don't chase completeness.

**2. Converge — the timeline.** Arrange facts **chronologically, left→right**, into one story. The test: read it aloud L→R and it sounds like a coherent story everyone recognizes. **Order disputes are the point** — they expose hidden conditions, branches, or missing concepts. Don't model branches/loops/error paths here; pick the main story, alternatives come later.

## What good looks like

- A set that went chaotic (many facts, duplicates) then resolved into one readable L→R timeline.
- A story a non-expert can follow start to finish.
- A captured list of domain terms, plus surfaced disagreements / unknown terms / open questions to carry forward.
- NOT a complete, tidy, tech-flavored, dispute-free model — that's a smell (filtering/anchoring happened too early).

## Pitfalls (both modes)

- **Commands disguised as facts** — enforce past tense, the cheap guard.
- **UI/technical altitude** ("Row Inserted", "Button Clicked") — pull back up to domain level.
- **Premature convergence** — judging/merging/ordering during the dump. Keep the two movements separate.
- **Tech talk** — DB/REST/queues/schema. Out of scope. Redirect to "what happened".
- **Completeness chasing** — stop at a rough story, not every fact.
- **Cross-context scope creep** — modeling other systems' internals. Stay in one context.
- **Silent merges** of near-duplicates — destroys the language signal. Keep the disagreement visible.

---

# Mode playbook: Autonomous

The AI plays the whole room. Goal: a generous fact dump + ordered timeline produced solo, with minimal, batched questions.

1. **Read the requirements.** Whatever loose requirements exist (prompt, notes/, docs). Fix the context scope; state it.
2. **Diverge solo.** Generate business facts liberally across all plausible perspectives the room would have (customer, ops, finance, external systems…). Past tense. Lean inclusive — duplicates and maybes are fine, like a real wall.
3. **Self-police altitude.** Drop/reframe commands, UI actions, queries, wishes. Keep facts atomic + domain-named.
4. **Dedup + cluster.** Merge true duplicates; keep near-duplicates that signal a vocabulary question. Note natural clusters and candidate names.
5. **Converge.** Order into one L→R timeline; write the story out as prose so it can be read back.
6. **Know what you may NOT invent.** Generic domain mechanics → infer freely. **Business decisions / policy / rules** (e.g. "does a price change remove the item from the cart?", "max items per cart?", an ambiguous term's meaning, an unstated lifecycle) → do **not** fabricate. Either mark as an explicit **assumption** or raise it.
7. **Ask occasionally, batched.** Collect the genuine unknowns and ask the user in a small batch (AskUserQuestion), not a stream of interruptions. Only things that actually change the model.
8. **Output.** The timeline story + the captured terms + the open questions/assumptions. Offer to persist via **notes**.

Guardrails: produce-then-verify, don't interrogate. Never silently bake a business decision into a fact — flag it. Stay in one context.

---

# Mode playbook: Cooperative

The AI leads the meeting; the user supplies the domain knowledge. Augment, don't author.

1. **Open + set the rules.** State the one task — *"Tell me what could have happened in the system. Assume it already happened."* — and the one rule: **past tense** (`Product added`, not `Add product`). Keep the brief this minimal. Fix the context scope with the user.
2. **Break the ice.** Expect hesitation. Seed the first 1–3 facts yourself, then hand it back — your job now is to draw facts out, not supply them.
3. **Run the dump (diverge).** Keep facts coming with light prompts: *"what happened right before / after that?"*, *"what else could happen here?"*, *"who else touches this?"*. Protect **no wrong answers** — no judging during the dump. Keep energy light and fast.
4. **Reframe live, gently.** When the user gives a command/UI action/wish, mirror it back as a past-tense fact and confirm (*"so the fact is `Item Removed`?"*). Don't lecture.
5. **Surface tensions, let the user resolve.** On near-duplicates or fuzzy terms, ask *"are these the same thing? what do you call it?"* — you're capturing their ubiquitous language, not imposing yours. Ask the name of natural clusters.
6. **Converge together.** Walk the facts into a L→R timeline with the user; let order disputes surface real rules/branches. Then **read the story back** aloud and ask "does this sound right?".
7. **Call the exit.** Stop at a rough coherent story — don't push for completeness. Note it's a clean pause point.
8. **Output.** Same as autonomous; offer to persist via **notes**, and capture surfaced terms + open questions for later phases.

Guardrails: you are the leader, not the author. Contribute facts only to prime or unblock. Don't dump a finished model. Don't bulldoze the user's vocabulary. Match their energy — rapid brain-dump → capture fast, hold questions; reflective → engage deeper.

---

## Output → next phase

Carry forward: (1) the ordered timeline of business facts, (2) captured domain terms (ubiquitous language seed), (3) surfaced disagreements / unknown terms / open questions / assumptions. Next phases — **wireframes**, then **commands + read models** — take this timeline and, use case by use case, sketch UI and work backwards from facts to commands and from screens to read models. See the **event-modeling** skill for the full sequence.

## Argument modes

- `auto` → run the Autonomous playbook.
- `coop` (or `cooperative`) → run the Cooperative playbook.
- `explain <subtopic>` → just that section (e.g. `explain business fact`, `explain converge`, `explain ubiquitous language`).
- empty → if it's a run, ask which mode (auto/coop) then proceed; otherwise this full guide.
