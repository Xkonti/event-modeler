import { describe, it, expect } from 'vitest'
import { layoutSlice } from './sliceLayout.js'
import {
  EDGE_DIRECTION,
  mapSliceToFlow,
  buildStripModel,
  entityNodeId,
  boxNodeId,
  Z_BOX,
  Z_EDGE,
  Z_CARD,
} from './flowAdapter.js'

const dto = {
  _id: 's1',
  modelId: 'm1',
  name: 'Record line',
  placements: [
    { entityId: 'w', entityType: 'wireframe', slotRole: 'trigger', slot: 0, name: 'Entry Form' },
    { entityId: 'c', entityType: 'command', slotRole: 'command', name: 'Record Line' },
    { entityId: 'r', entityType: 'readModel', slotRole: 'readModel', slot: 0, name: 'Summary' },
    { entityId: 'f', entityType: 'businessFact', slotRole: 'fact', slot: 0, name: 'Line Recorded' },
  ],
  relations: [
    { _id: 'rel1', fromId: 'w', toId: 'c', kind: 'issues' },
    { _id: 'rel2', fromId: 'c', toId: 'f', kind: 'produces' },
    { _id: 'rel3', fromId: 'f', toId: 'r', kind: 'feeds' },
    { _id: 'rel4', fromId: 'r', toId: 'w', kind: 'displayedBy' },
  ],
  scenarios: [
    { _id: 'sc1', kind: 'GWT', anchorId: 'c', given: [], then: { emit: [] }, referencedEntityIds: ['c', 'f'] },
  ],
}

const layout = layoutSlice(dto.placements)
const origin = { x: 100, y: 0 }

describe('EDGE_DIRECTION — all 11 kinds covered', () => {
  it('maps every relation kind to up or down', () => {
    const kinds = [
      'displayedBy', 'monitoredBy', 'issues', 'reacts', 'produces', 'feeds',
      'inbound', 'triggers', 'directTranslation', 'outbound', 'publishes',
    ]
    for (const k of kinds) expect(['up', 'down']).toContain(EDGE_DIRECTION[k])
    expect(Object.keys(EDGE_DIRECTION)).toHaveLength(11)
  })

  it('back-edges (toward the trigger) point up; staircase flows point down', () => {
    expect(EDGE_DIRECTION.issues).toBe('down')
    expect(EDGE_DIRECTION.produces).toBe('down')
    expect(EDGE_DIRECTION.feeds).toBe('up')
    expect(EDGE_DIRECTION.displayedBy).toBe('up')
  })
})

describe('mapSliceToFlow', () => {
  const { nodes, edges } = mapSliceToFlow(dto, layout, origin)

  it('emits one box node at the origin + one scoped card node per placement', () => {
    const box = nodes.find((n) => n.id === boxNodeId('s1'))
    expect(box).toBeDefined()
    expect(box.position).toEqual(origin)
    expect(box.draggable).toBe(false)
    const cards = nodes.filter((n) => n.type === 'entityCard')
    expect(cards).toHaveLength(4)
    expect(cards.every((n) => n.parentNode === boxNodeId('s1'))).toBe(true)
    expect(cards.map((n) => n.id)).toContain(entityNodeId('s1', 'w'))
  })

  it('z-order sandwich: box < edges < cards', () => {
    const box = nodes.find((n) => n.type === 'sliceBox')
    const card = nodes.find((n) => n.type === 'entityCard')
    expect(box.zIndex).toBe(Z_BOX)
    expect(card.zIndex).toBe(Z_CARD)
    expect(edges.every((e) => e.zIndex === Z_EDGE)).toBe(true)
    expect(Z_BOX).toBeLessThan(Z_EDGE)
    expect(Z_EDGE).toBeLessThan(Z_CARD)
  })

  it('routes down-edges bottom→top and up-edges top→bottom (D1 back-edges)', () => {
    const produces = edges.find((e) => e.data.relationId === 'rel2')
    expect(produces.sourceHandle).toBe('bs')
    expect(produces.targetHandle).toBe('tt')
    const feeds = edges.find((e) => e.data.relationId === 'rel3')
    expect(feeds.sourceHandle).toBe('ts')
    expect(feeds.targetHandle).toBe('bt')
  })

  it('labels edges with the stored kind and scopes ids per box', () => {
    const issues = edges.find((e) => e.data.relationId === 'rel1')
    expect(issues.label).toBe('issues')
    expect(issues.id).toBe('rel:rel1@s1')
    expect(issues.source).toBe(entityNodeId('s1', 'w'))
    expect(issues.target).toBe(entityNodeId('s1', 'c'))
  })

  it('drops edges whose endpoints are not visible in the box', () => {
    const partial = {
      ...dto,
      relations: [...dto.relations, { _id: 'ghost', fromId: 'c', toId: 'nope', kind: 'produces' }],
    }
    const out = mapSliceToFlow(partial, layout, origin)
    expect(out.edges.find((e) => e.data.relationId === 'ghost')).toBeUndefined()
  })

  it('passes the strip model on the box node data', () => {
    const box = nodes.find((n) => n.type === 'sliceBox')
    expect(box.data.strip).toHaveLength(1)
    expect(box.data.strip[0].anchorName).toBe('Record Line')
  })
})

describe('buildStripModel', () => {
  it('groups scenarios by anchor and resolves the anchor name', () => {
    const strip = buildStripModel(
      [
        { _id: 'a', kind: 'GWT', anchorId: 'c' },
        { _id: 'b', kind: 'GWT', anchorId: 'c' },
        { _id: 'x', kind: 'GT', anchorId: 'unplaced' },
      ],
      dto.placements,
    )
    expect(strip).toHaveLength(2)
    expect(strip[0].anchorId).toBe('c')
    expect(strip[0].scenarios).toHaveLength(2)
    expect(strip[1].anchorName).toBe('(defined elsewhere)')
  })

  it('handles empty input', () => {
    expect(buildStripModel([], [])).toEqual([])
    expect(buildStripModel(undefined, undefined)).toEqual([])
  })
})
