// Pure adapter: slice DTO + solver layout + box origin → vue-flow nodes/edges.
// No Vue imports — unit-testable beside the solver.
//
// Node id scheme: entity nodes are SCOPED per box (`${sliceId}:${entityId}`) —
// the same entity identity can be placed in several visible slices (slices
// reference, don't own), and vue-flow ids must be unique. e2e never relies on
// node ids: testids carry the raw entityId. Edge ids are scoped the same way
// (`rel:${relationId}@${sliceId}` — one relation renders in every box where
// both endpoints are visible).
//
// Z-order sandwich: box chrome 0 < edges 5 < entity cards 10.

/** kind → vertical direction on the staircase (D1: back-edges point UP). */
export const EDGE_DIRECTION = {
  // down the staircase (source band above target band)
  issues: 'down', // wireframe → command
  reacts: 'down', // automation → command
  produces: 'down', // command → fact
  triggers: 'down', // translation → command
  publishes: 'down', // translation → externalFact
  // back-edges, up the staircase (source band below target band)
  displayedBy: 'up', // readModel → wireframe
  monitoredBy: 'up', // readModel → automation
  feeds: 'up', // fact → readModel
  inbound: 'up', // externalFact → translation
  directTranslation: 'up', // externalFact → readModel
  outbound: 'up', // fact → translation
}

/** Handle ids per card (stable for e2e): down-edges leave the bottom-left pair,
 * up-edges leave the top-right pair — so opposing flows never overlap. */
const HANDLES = {
  down: { source: 'bs', target: 'tt' }, // bottom-source → top-target
  up: { source: 'ts', target: 'bt' }, // top-source → bottom-target
}

export const Z_BOX = 0
export const Z_EDGE = 5
export const Z_CARD = 10

/** @param {string} sliceId @param {string} entityId */
export const entityNodeId = (sliceId, entityId) => `${sliceId}:${entityId}`
/** @param {string} sliceId */
export const boxNodeId = (sliceId) => `box:${sliceId}`

/**
 * Map ONE slice board to vue-flow nodes + edges.
 * @param {{ _id: string, name?: string, placements: object[], relations: object[], scenarios: object[] }} dto
 *        the GET /api/slices/:id response
 * @param {object} layout output of layoutSlice(dto.placements, …)
 * @param {{x: number, y: number}} origin box position from layoutCanvas
 * @returns {{ nodes: object[], edges: object[] }}
 */
export function mapSliceToFlow(dto, layout, origin) {
  const sliceId = dto._id
  const nameById = new Map(dto.placements.map((p) => [p.entityId, p.name]))

  const boxNode = {
    id: boxNodeId(sliceId),
    type: 'sliceBox',
    position: origin,
    draggable: false,
    selectable: false,
    zIndex: Z_BOX,
    // vue-flow strips pointer events from non-draggable/non-selectable nodes —
    // the box CHROME (ghost slots, strip buttons, header actions) must stay
    // clickable, so force them back on the wrapper.
    style: { width: `${layout.width}px`, pointerEvents: 'all' },
    data: {
      sliceId,
      name: dto.name ?? '',
      layout,
      strip: buildStripModel(dto.scenarios, dto.placements),
    },
  }

  const cardNodes = layout.cards.map((c) => ({
    id: entityNodeId(sliceId, c.entityId),
    type: 'entityCard',
    parentNode: boxNode.id,
    position: { x: c.x, y: c.y },
    draggable: false, // gestures arrive with the swap phase; positions are solver truth
    zIndex: Z_CARD,
    style: { pointerEvents: 'all' }, // ditto — keep clicks/handles/▲▼ live

    data: {
      sliceId,
      entityId: c.entityId,
      entityType: c.entityType,
      slotRole: c.slotRole,
      laneId: c.laneId,
      name: nameById.get(c.entityId) ?? '',
      swapUpId: c.swapUpId,
      swapDownId: c.swapDownId,
    },
  }))

  // Edges only between entities VISIBLE in this box (the DTO already filters);
  // drop defensively anyway so a stale relation never crashes the render.
  const visible = new Set(layout.cards.map((c) => c.entityId))
  const edges = (dto.relations ?? []).flatMap((r) => {
    if (!visible.has(r.fromId) || !visible.has(r.toId)) return []
    const dir = EDGE_DIRECTION[r.kind] ?? 'down'
    const h = HANDLES[dir]
    return [
      {
        id: `rel:${r._id}@${sliceId}`,
        type: 'relation',
        source: entityNodeId(sliceId, r.fromId),
        target: entityNodeId(sliceId, r.toId),
        sourceHandle: h.source,
        targetHandle: h.target,
        zIndex: Z_EDGE,
        label: r.kind,
        data: { relationId: r._id, kind: r.kind, direction: dir, sliceId },
      },
    ]
  })

  return { nodes: [boxNode, ...cardNodes], edges }
}

/**
 * Strip view-model: scenarios grouped by anchor, anchor names resolved from the
 * placements (an anchor placed elsewhere still surfaces — name falls back).
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
