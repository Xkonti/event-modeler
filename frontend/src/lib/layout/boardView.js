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
 * @param {object[]} placements slice DTO placements, VERBATIM
 * @param {Array<{laneId: string|null}>} laneRows
 * @returns {{
 *   trigger: { cards: object[], ghost: object|null },
 *   command: { card: object|null, ghost: object|null },
 *   readModels: { cards: object[], ghost: object },
 *   factLanes: Array<{ laneId: string|null, cards: object[], ghost: object|null }>,
 * }}
 */
export function buildBands(placements, laneRows) {
  const byBand = { trigger: [], command: [], readModel: [], fact: [] }
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

  const readModels = byBand.readModel
  const readModelGhost = ghost(
    'readModel',
    readModels.length === 0 ? 'empty' : 'append',
    '+ read model',
  )

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
  const groups = [triggers, readModels, ...factLanes.map((l) => l.cards)]
  for (const group of groups) {
    group.forEach((c, i) => {
      c.swapUpId = i > 0 ? group[i - 1].entityId : null
      c.swapDownId = i < group.length - 1 ? group[i + 1].entityId : null
    })
  }

  return {
    trigger: { cards: triggers, ghost: triggerGhost },
    command: { card: command, ghost: commandGhost },
    readModels: { cards: readModels, ghost: readModelGhost },
    factLanes,
  }
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
 * @param {object[]} placements slice DTO placements
 * @param {object[]} relations slice DTO relations ({fromId, toId, kind})
 * @returns {Map<string, { incoming: object[], outgoing: object[] }>} by entityId
 */
export function relationOptions(placements, relations) {
  const existing = new Set((relations ?? []).map((r) => `${r.fromId}→${r.toId}`))
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
 * @returns {Array<{ anchorId: string, anchorName: string, kind: string, scenarios: object[] }>}
 */
export function buildStripModel(scenarios, placements) {
  const nameById = new Map((placements ?? []).map((p) => [p.entityId, p.name]))
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
