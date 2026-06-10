// The snap-slot LAYOUT SOLVER — the only place canvas geometry is computed.
// Pure functions, no Vue/vue-flow imports, fully unit-testable. Embodies the
// design law (notes/layout-and-rendering.md, spec/em-wireframes-results.md W4):
//
//   - slice = box; top graph = 3 role bands stacked with a STAIRCASE x-offset
//     (trigger → command → facts flow down-right so time reads left→right);
//   - trigger band: wireframes stack (slot-numbered) | single automation /
//     translation; command band: ONE command + read models stacked in a column
//     to its right; facts band: facts in SWIMLANES (lanesOn) or one flat stack;
//   - placements arrive PRE-SORTED band→slot from the server — input order IS
//     render order. The solver NEVER sorts and never reads `slot` (holes are
//     legal and invisible: rows are assigned consecutively in input order);
//   - there is no user-authored x/y anywhere — these outputs are the only
//     geometry, and reordering is a slot SWAP (swapUpId/swapDownId computed
//     here drive both the ▲▼ buttons and drag-onto-target).
//
// The bottom text strip (notes + scenarios) is CSS-auto inside the box chrome —
// boxes tile horizontally only, so strip height never affects siblings and the
// solver only computes the GRAPH height.

export const LAYOUT = {
  CARD_W: 176,
  CARD_H: 56,
  GAP_Y: 12, // between stacked cards
  BAND_GAP: 28, // vertical room between bands (edge labels live here)
  PAD: 16, // box inner padding
  HEADER_H: 36,
  STAIR_X: 56, // per-band horizontal time offset
  RM_GAP_X: 40, // command card → read-model column
  LANE_LABEL_W: 96, // gutter reserved left of the facts band for lane names
  LANE_PAD: 10, // padding inside a lane row
  GHOST_APPEND_H: 28, // compact "+ …" row under a non-empty stack
  BOX_MIN_W: 480,
  BOX_GAP_X: 64, // gap between tiled boxes
}

const stackHeight = (n, rowH = LAYOUT.CARD_H) =>
  n <= 0 ? 0 : n * (rowH + LAYOUT.GAP_Y) - LAYOUT.GAP_Y

/**
 * Lay out ONE slice box.
 * @param {Array<{entityId: string, entityType: string, slotRole: string, slot?: number, lane?: string}>} placements
 *        the slice GET's placements, VERBATIM (pre-sorted band→slot)
 * @param {{ lanesOn?: boolean }} [opts]
 * @returns {SliceLayout} box-relative geometry (see module docblock for shape)
 */
export function layoutSlice(placements, { lanesOn = false } = {}) {
  const { CARD_W, CARD_H, GAP_Y, BAND_GAP, PAD, HEADER_H, STAIR_X, RM_GAP_X, LANE_LABEL_W, LANE_PAD, GHOST_APPEND_H, BOX_MIN_W } = LAYOUT

  // Partition by band, PRESERVING input order within each.
  const byBand = { trigger: [], command: [], readModel: [], fact: [] }
  for (const p of placements) {
    if (byBand[p.slotRole]) byBand[p.slotRole].push(p)
  }

  const cards = []
  const ghosts = []

  // --- trigger band (x = PAD) -----------------------------------------------
  const triggerX = PAD
  const triggerY = HEADER_H + PAD
  const triggers = byBand.trigger
  // Wireframes are stackable; automation/translation are single — an append
  // ghost only makes sense for the stackable kind, and only when the slot
  // isn't held by a single-cardinality trigger.
  const hasSingleTrigger = triggers.some(
    (p) => p.entityType === 'automation' || p.entityType === 'translation',
  )
  triggers.forEach((p, i) => {
    cards.push(card(p, triggerX, triggerY + i * (CARD_H + GAP_Y), null))
  })
  let triggerH
  if (triggers.length === 0) {
    ghosts.push({
      id: 'ghost-trigger',
      role: 'trigger',
      variant: 'empty',
      laneId: null,
      x: triggerX,
      y: triggerY,
      w: CARD_W,
      h: CARD_H,
      label: '+ wireframe / automation / translation',
    })
    triggerH = CARD_H
  } else {
    triggerH = stackHeight(triggers.length)
    if (!hasSingleTrigger) {
      ghosts.push({
        id: 'ghost-trigger',
        role: 'trigger',
        variant: 'append',
        laneId: null,
        x: triggerX,
        y: triggerY + triggerH + GAP_Y,
        w: CARD_W,
        h: GHOST_APPEND_H,
        label: '+ wireframe',
      })
      triggerH += GAP_Y + GHOST_APPEND_H
    }
  }

  // --- command band (x = PAD + STAIR_X; read models in a column right of it) -
  const commandX = PAD + STAIR_X
  const commandY = triggerY + triggerH + BAND_GAP
  const readModelX = commandX + CARD_W + RM_GAP_X
  const command = byBand.command[0]
  if (command) {
    cards.push(card(command, commandX, commandY, null))
  } else {
    ghosts.push({
      id: 'ghost-command',
      role: 'command',
      variant: 'empty',
      laneId: null,
      x: commandX,
      y: commandY,
      w: CARD_W,
      h: CARD_H,
      label: '+ command',
    })
  }
  const readModels = byBand.readModel
  readModels.forEach((p, i) => {
    cards.push(card(p, readModelX, commandY + i * (CARD_H + GAP_Y), null))
  })
  let rmColumnH
  if (readModels.length === 0) {
    ghosts.push({
      id: 'ghost-readModel',
      role: 'readModel',
      variant: 'empty',
      laneId: null,
      x: readModelX,
      y: commandY,
      w: CARD_W,
      h: CARD_H,
      label: '+ read model',
    })
    rmColumnH = CARD_H
  } else {
    rmColumnH = stackHeight(readModels.length)
    ghosts.push({
      id: 'ghost-readModel',
      role: 'readModel',
      variant: 'append',
      laneId: null,
      x: readModelX,
      y: commandY + rmColumnH + GAP_Y,
      w: CARD_W,
      h: GHOST_APPEND_H,
      label: '+ read model',
    })
    rmColumnH += GAP_Y + GHOST_APPEND_H
  }
  const commandH = Math.max(CARD_H, rmColumnH)

  // --- facts band (x includes the lane-label gutter) -------------------------
  const factX = PAD + 2 * STAIR_X + LANE_LABEL_W
  const factY = commandY + commandH + BAND_GAP
  const facts = byBand.fact
  /** @type {Array<{laneId: string|null, label: string|null, y: number, height: number}>} */
  const lanes = []

  if (!lanesOn) {
    // Variant C — one flat pseudo-lane, facts stacked in input (slot) order.
    facts.forEach((p, i) => {
      cards.push(card(p, factX, factY + i * (CARD_H + GAP_Y), null))
    })
    let h = stackHeight(facts.length)
    const ghostY = facts.length === 0 ? factY : factY + h + GAP_Y
    ghosts.push({
      id: 'ghost-fact',
      role: 'fact',
      variant: facts.length === 0 ? 'empty' : 'append',
      laneId: null,
      x: factX,
      y: ghostY,
      w: CARD_W,
      h: facts.length === 0 ? CARD_H : GHOST_APPEND_H,
      label: '+ business fact',
    })
    h = facts.length === 0 ? CARD_H : h + GAP_Y + GHOST_APPEND_H
    lanes.push({ laneId: null, label: null, y: factY, height: h })
  } else {
    // Swimlanes — group by lane, LANE ORDER = first appearance in the
    // pre-sorted placement array (stable, no extra config). Unassigned facts
    // collect in the "(none)" lane; the fact ghost also lives there.
    const laneOrder = []
    const byLane = new Map()
    for (const p of facts) {
      const laneId = p.lane ?? null
      if (!byLane.has(laneId)) {
        byLane.set(laneId, [])
        laneOrder.push(laneId)
      }
      byLane.get(laneId).push(p)
    }
    if (!byLane.has(null)) {
      byLane.set(null, [])
      laneOrder.push(null) // the "(none)" lane always exists (hosts the ghost)
    }

    let y = factY
    for (const laneId of laneOrder) {
      const members = byLane.get(laneId)
      members.forEach((p, i) => {
        cards.push(card(p, factX, y + LANE_PAD + i * (CARD_H + GAP_Y), laneId))
      })
      let inner = stackHeight(members.length)
      if (laneId === null) {
        const ghostY = members.length === 0 ? y + LANE_PAD : y + LANE_PAD + inner + GAP_Y
        ghosts.push({
          id: 'ghost-fact',
          role: 'fact',
          variant: members.length === 0 ? 'empty' : 'append',
          laneId: null,
          x: factX,
          y: ghostY,
          w: CARD_W,
          h: members.length === 0 ? CARD_H : GHOST_APPEND_H,
          label: '+ business fact',
        })
        inner = members.length === 0 ? CARD_H : inner + GAP_Y + GHOST_APPEND_H
      }
      const height = LANE_PAD * 2 + Math.max(inner, CARD_H)
      lanes.push({ laneId, label: laneId === null ? '(none)' : laneId, y, height })
      y += height
    }
  }
  const factsH = lanes.reduce((acc, l) => acc + l.height, 0) || CARD_H

  // --- swap neighbours: same band, same lane, adjacent in input order --------
  // (single-cardinality types have no siblings by construction)
  const groups = new Map()
  for (const c of cards) {
    const key = `${c.slotRole}|${c.laneId ?? ''}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(c)
  }
  for (const group of groups.values()) {
    group.forEach((c, i) => {
      c.swapUpId = i > 0 ? group[i - 1].entityId : null
      c.swapDownId = i < group.length - 1 ? group[i + 1].entityId : null
    })
  }

  // --- box envelope -----------------------------------------------------------
  const rightEdges = [
    triggerX + CARD_W,
    readModelX + CARD_W, // always ≥ commandX + CARD_W
    factX + CARD_W,
  ]
  const width = Math.max(BOX_MIN_W, Math.max(...rightEdges) + PAD)
  const graphHeight = factY + factsH + PAD

  return {
    width,
    graphHeight,
    header: { height: HEADER_H },
    bands: {
      trigger: { x: triggerX, y: triggerY, height: triggerH },
      command: { x: commandX, y: commandY, height: commandH, readModelX },
      fact: { x: factX, y: factY, height: factsH },
    },
    lanes,
    cards,
    ghosts,
  }
}

/**
 * A solver card rect (swap ids filled in afterwards). `laneId` is the VISUAL
 * grouping key, passed verbatim: with lanes OFF every fact gets null so the
 * whole band is one swap group; with lanes ON it's the fact's lane.
 */
function card(p, x, y, laneId) {
  return {
    entityId: p.entityId,
    entityType: p.entityType,
    slotRole: p.slotRole,
    laneId,
    x,
    y,
    w: LAYOUT.CARD_W,
    h: LAYOUT.CARD_H,
    swapUpId: null,
    swapDownId: null,
  }
}

/**
 * Tile boxes left→right in the given (creation) order.
 * @param {Array<{ sliceId: string, layout: { width: number } }>} boxes
 * @returns {Array<{ sliceId: string, origin: {x: number, y: number}, layout: object }>}
 */
export function layoutCanvas(boxes) {
  let x = 0
  return boxes.map(({ sliceId, layout }) => {
    const placed = { sliceId, origin: { x, y: 0 }, layout }
    x += layout.width + LAYOUT.BOX_GAP_X
    return placed
  })
}
