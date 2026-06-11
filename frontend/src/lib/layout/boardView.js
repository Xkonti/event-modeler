// Board VIEW-MODEL — the only canvas "layout" code left after the CSS-grid
// rework (notes/layout-and-rendering.md → "Rendering mechanism"). No pixels:
// geometry is CSS grid + subgrid; these pure functions only decide WHAT goes in
// each cell — band partitioning, lane rows, ghost slots, swap neighbours,
// relation-button candidates, scenario strip grouping. No Vue imports,
// unit-testable.
//
// Invariants carried over from the solver era:
//   - placements arrive PRE-SORTED band→slot from the server — input order IS
//     render order; nothing here sorts or reads `slot`;
//   - reorder = slot SWAP between same-band/same-lane neighbours.

import { validKindsForPair } from '@/lib/relationKinds'

/**
 * The shared grid rows for the facts area, unioned across every visible board
 * (lane order = first appearance scanning boards left→right). Lanes OFF → one
 * flat pseudo-lane. Lanes ON → discovered lanes + the "(none)" lane last (it
 * always exists: hosts unassigned facts and the fact ghost).
 * @param {Array<{placements?: object[]}>} boards slice DTOs in display order
 * @param {boolean} lanesOn
 * @returns {Array<{laneId: string|null}>}
 */
export function laneRowsFor(boards, lanesOn) {
  if (!lanesOn) return [{ laneId: null }]
  const seen = new Set()
  const rows = []
  for (const board of boards) {
    for (const p of board.placements ?? []) {
      if (p.slotRole !== 'fact') continue
      const laneId = p.lane ?? null
      if (laneId === null || seen.has(laneId)) continue
      seen.add(laneId)
      rows.push({ laneId })
    }
  }
  rows.push({ laneId: null })
  return rows
}

/**
 * Partition one board's placements into band cells, with ghost slots and swap
 * neighbours. Cards keep input order. `laneRows` comes from laneRowsFor — every
 * board renders a cell for EVERY shared lane row (empty cells keep the subgrid
 * rows aligned across slices).
 * Read models are NOT a band anymore — they are auto-displayed from relations
 * (see autoReadModels); any historic readModel placement is ignored.
 * @param {object[]} placements slice DTO placements, VERBATIM
 * @param {Array<{laneId: string|null}>} laneRows
 * @returns {{
 *   trigger: { cards: object[], ghost: object|null },
 *   command: { card: object|null, ghost: object|null },
 *   factLanes: Array<{ laneId: string|null, cards: object[], ghost: object|null }>,
 * }}
 */
export function buildBands(placements, laneRows) {
  const byBand = { trigger: [], command: [], fact: [] }
  for (const p of placements) {
    if (byBand[p.slotRole]) byBand[p.slotRole].push(card(p))
  }

  // Trigger: wireframes stack; automation/translation are single-cardinality —
  // append ghost only for the stackable kind.
  const triggers = byBand.trigger
  const hasSingleTrigger = triggers.some(
    (c) => c.entityType === 'automation' || c.entityType === 'translation',
  )
  const triggerGhost =
    triggers.length === 0
      ? ghost('trigger', 'empty', '+ wireframe / automation / translation')
      : hasSingleTrigger
        ? null
        : ghost('trigger', 'append', '+ wireframe')

  const command = byBand.command[0] ?? null
  const commandGhost = command ? null : ghost('command', 'empty', '+ command')

  // Facts bucketed into the SHARED lane rows; unassigned facts (and any fact
  // whose lane isn't a row, e.g. lanes off) land in the null lane, which also
  // hosts the fact ghost.
  const laneIds = new Set(laneRows.map((r) => r.laneId))
  const byLane = new Map(laneRows.map((r) => [r.laneId, []]))
  for (const c of byBand.fact) {
    const laneId = c.lane != null && laneIds.has(c.lane) ? c.lane : null
    byLane.get(laneId).push(c)
  }
  const factLanes = laneRows.map(({ laneId }) => ({
    laneId,
    cards: byLane.get(laneId),
    ghost:
      laneId === null
        ? ghost('fact', byLane.get(null).length === 0 ? 'empty' : 'append', '+ business fact')
        : null,
  }))

  // Swap neighbours: adjacent in input order within the same band+lane group.
  const groups = [triggers, ...factLanes.map((l) => l.cards)]
  for (const group of groups) {
    group.forEach((c, i) => {
      c.swapUpId = i > 0 ? group[i - 1].entityId : null
      c.swapDownId = i < group.length - 1 ? group[i + 1].entityId : null
    })
  }

  return {
    trigger: { cards: triggers, ghost: triggerGhost },
    command: { card: command, ghost: commandGhost },
    factLanes,
  }
}

/**
 * Auto-displayed read models — derived per slice from the MODEL-level relation
 * graph, never placed. A read model shows in slice S (left column, command-band
 * height) when a trigger placed in S reads it (`displayedBy` readModel→wireframe
 * or `monitoredBy` readModel→automation). One card per RM per slice (dedup
 * across readers, first-reader order). `straddle` = the RM is also fed
 * (`feeds` businessFact→RM / `directTranslation` externalBusinessFact→RM) by a
 * fact placed in the slice IMMEDIATELY LEFT of S → render half over the shared
 * boundary. Feed edges are emitted for EVERY slice the feeder is placed in
 * (cross-slice arrows); display edges stay within S.
 * @param {object[]} boards slice DTOs in display order
 * @param {Array<{_id: string, fromId: string, toId: string, kind: string}>} modelRelations
 * @param {Array<{_id: string, entityType: string, name: string, definition?: object}>} catalog
 * @returns {Map<string, {
 *   cards: Array<{entityId, entityType, slotRole, name, fields, straddle, swapUpId, swapDownId}>,
 *   edges: Array<{relationId, kind, from: {sliceId, entityId}, to: {sliceId, entityId}}>,
 * }>} keyed by slice id
 */
export function autoReadModels(boards, modelRelations, catalog) {
  const catalogById = new Map((catalog ?? []).map((c) => [c._id, c]))
  const displayRels = []
  const feedsByRm = new Map() // rmId -> relations feeding it
  for (const r of modelRelations ?? []) {
    if (r.kind === 'displayedBy' || r.kind === 'monitoredBy') displayRels.push(r)
    else if (r.kind === 'feeds' || r.kind === 'directTranslation') {
      if (!feedsByRm.has(r.toId)) feedsByRm.set(r.toId, [])
      feedsByRm.get(r.toId).push(r)
    }
  }

  // Every slice each fact-band entity is placed in (a fact can sit in several).
  const factSlices = new Map() // factEntityId -> sliceId[]
  for (const board of boards ?? []) {
    for (const p of board.placements ?? []) {
      if (p.slotRole !== 'fact') continue
      if (!factSlices.has(p.entityId)) factSlices.set(p.entityId, [])
      factSlices.get(p.entityId).push(board._id)
    }
  }

  const result = new Map()
  ;(boards ?? []).forEach((board, i) => {
    const prevSliceId = i > 0 ? (boards[i - 1]?._id ?? null) : null
    const cardsByRm = new Map() // ordered: first-reader appearance
    const edges = []
    const seenEdge = new Set()
    const pushEdge = (relationId, kind, from, to) => {
      const key = `${relationId}@${from.sliceId}->${to.sliceId}`
      if (seenEdge.has(key)) return
      seenEdge.add(key)
      edges.push({ relationId, kind, from, to })
    }

    const triggers = (board.placements ?? []).filter(
      (p) =>
        p.slotRole === 'trigger' &&
        (p.entityType === 'wireframe' || p.entityType === 'automation'),
    )
    for (const t of triggers) {
      for (const r of displayRels) {
        if (r.toId !== t.entityId) continue
        const entry = catalogById.get(r.fromId)
        // Missing/archived catalog row or a stale edge → skip defensively.
        if (!entry || entry.entityType !== 'readModel') continue
        if (!cardsByRm.has(r.fromId)) {
          cardsByRm.set(r.fromId, {
            entityId: entry._id,
            entityType: 'readModel',
            slotRole: 'readModel',
            lane: null,
            name: entry.name ?? '',
            fields: entry.definition?.fields ?? null,
            straddle: false,
            swapUpId: null,
            swapDownId: null,
          })
        }
        pushEdge(
          r._id,
          r.kind,
          { sliceId: board._id, entityId: entry._id },
          { sliceId: board._id, entityId: t.entityId },
        )
      }
    }

    for (const [rmId, rmCard] of cardsByRm) {
      for (const r of feedsByRm.get(rmId) ?? []) {
        for (const feederSliceId of factSlices.get(r.fromId) ?? []) {
          pushEdge(
            r._id,
            r.kind,
            { sliceId: feederSliceId, entityId: r.fromId },
            { sliceId: board._id, entityId: rmId },
          )
          if (feederSliceId === prevSliceId) rmCard.straddle = true
        }
      }
    }

    result.set(board._id, { cards: [...cardsByRm.values()], edges })
  })
  return result
}

function card(p) {
  return {
    entityId: p.entityId,
    entityType: p.entityType,
    slotRole: p.slotRole,
    lane: p.lane ?? null,
    name: p.name ?? '',
    fields: p.definition?.fields ?? null,
    swapUpId: null,
    swapDownId: null,
  }
}

function ghost(role, variant, label) {
  return { role, variant, label }
}

/**
 * Candidates for the per-card relation buttons (the dumb replacement for
 * drag-to-connect): for each placed entity, every OTHER placement in the same
 * slice it could legally relate to, split by direction. Pairs that already
 * have a relation are excluded.
 *   - outgoing: this card is the SOURCE (its "→" button)
 *   - incoming: this card is the TARGET (its "←" button — picks the source)
 *
 * Read models are never placed, so they're offered from the CATALOG instead:
 * incoming for triggers (displayedBy/monitoredBy), outgoing for facts
 * (feeds/directTranslation). RM pairs are excluded against the MODEL-level
 * relations (RM edges no longer appear in the slice DTO).
 * @param {object[]} placements slice DTO placements
 * @param {object[]} relations slice DTO relations ({fromId, toId, kind})
 * @param {object[]} [modelRelations] model-level relations (RM-pair exclusion)
 * @param {object[]} [catalog] catalog entries ({_id, entityType, name})
 * @returns {Map<string, { incoming: object[], outgoing: object[] }>} by entityId
 */
export function relationOptions(placements, relations, modelRelations = [], catalog = []) {
  const existing = new Set(
    [...(relations ?? []), ...(modelRelations ?? [])].map((r) => `${r.fromId}→${r.toId}`),
  )
  const readModels = (catalog ?? []).filter((c) => c.entityType === 'readModel')
  const result = new Map()
  for (const me of placements) {
    const incoming = []
    const outgoing = []
    for (const other of placements) {
      if (other.entityId === me.entityId) continue
      if (
        validKindsForPair(me.entityType, other.entityType).length > 0 &&
        !existing.has(`${me.entityId}→${other.entityId}`)
      ) {
        outgoing.push(option(other))
      }
      if (
        validKindsForPair(other.entityType, me.entityType).length > 0 &&
        !existing.has(`${other.entityId}→${me.entityId}`)
      ) {
        incoming.push(option(other))
      }
    }
    for (const rm of readModels) {
      if (
        validKindsForPair(me.entityType, 'readModel').length > 0 &&
        !existing.has(`${me.entityId}→${rm._id}`)
      ) {
        outgoing.push({ entityId: rm._id, entityType: 'readModel', name: rm.name ?? '' })
      }
      if (
        validKindsForPair('readModel', me.entityType).length > 0 &&
        !existing.has(`${rm._id}→${me.entityId}`)
      ) {
        incoming.push({ entityId: rm._id, entityType: 'readModel', name: rm.name ?? '' })
      }
    }
    result.set(me.entityId, { incoming, outgoing })
  }
  return result
}

function option(p) {
  return { entityId: p.entityId, entityType: p.entityType, name: p.name ?? '' }
}

/**
 * Strip view-model (moved verbatim from the retired flow adapter): scenarios
 * grouped by anchor, anchor names resolved from the placements (an anchor
 * placed elsewhere still surfaces — name falls back).
 * @param {object[]} scenarios slice DTO scenarios (F6 auto-surfaced)
 * @param {object[]} placements slice DTO placements
 * @param {object[]} [catalog] catalog entries — name fallback for anchors that
 *        aren't placed (auto-displayed read models)
 * @returns {Array<{ anchorId: string, anchorName: string, kind: string, scenarios: object[] }>}
 */
export function buildStripModel(scenarios, placements, catalog = []) {
  const nameById = new Map([
    ...(catalog ?? []).map((c) => [c._id, c.name]),
    ...(placements ?? []).map((p) => [p.entityId, p.name]),
  ])
  const groups = []
  const byAnchor = new Map()
  for (const s of scenarios ?? []) {
    if (!byAnchor.has(s.anchorId)) {
      const group = {
        anchorId: s.anchorId,
        anchorName: nameById.get(s.anchorId) ?? '(defined elsewhere)',
        kind: s.kind,
        scenarios: [],
      }
      byAnchor.set(s.anchorId, group)
      groups.push(group)
    }
    byAnchor.get(s.anchorId).scenarios.push(s)
  }
  return groups
}
