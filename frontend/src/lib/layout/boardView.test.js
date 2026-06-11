import { describe, it, expect } from 'vitest'
import {
  laneRowsFor,
  buildBands,
  relationOptions,
  buildStripModel,
  autoReadModels,
} from './boardView'

const p = (entityId, entityType, slotRole, extra = {}) => ({
  entityId,
  entityType,
  slotRole,
  name: entityId,
  ...extra,
})

describe('laneRowsFor', () => {
  it('lanes off → one flat pseudo-lane', () => {
    const boards = [{ placements: [p('f1', 'businessFact', 'fact', { lane: 'ctx-a' })] }]
    expect(laneRowsFor(boards, false)).toEqual([{ laneId: null }])
  })

  it('lanes on → first-appearance union across boards + trailing (none) lane', () => {
    const boards = [
      { placements: [p('f1', 'businessFact', 'fact', { lane: 'ctx-b' })] },
      {
        placements: [
          p('f2', 'businessFact', 'fact', { lane: 'ctx-a' }),
          p('f3', 'businessFact', 'fact', { lane: 'ctx-b' }),
          p('f4', 'businessFact', 'fact'),
        ],
      },
    ]
    expect(laneRowsFor(boards, true)).toEqual([
      { laneId: 'ctx-b' },
      { laneId: 'ctx-a' },
      { laneId: null },
    ])
  })

  it('non-fact placements never contribute lanes', () => {
    const boards = [{ placements: [p('c1', 'command', 'command', { lane: 'ctx-x' })] }]
    expect(laneRowsFor(boards, true)).toEqual([{ laneId: null }])
  })
})

describe('buildBands', () => {
  const rows = [{ laneId: null }]

  it('partitions by band preserving input order, never sorting', () => {
    const bands = buildBands(
      [
        p('w1', 'wireframe', 'trigger'),
        p('c1', 'command', 'command'),
        p('fB', 'businessFact', 'fact'),
        p('fA', 'businessFact', 'fact'),
      ],
      rows,
    )
    expect(bands.trigger.cards.map((c) => c.entityId)).toEqual(['w1'])
    expect(bands.command.card.entityId).toBe('c1')
    expect(bands.factLanes[0].cards.map((c) => c.entityId)).toEqual(['fB', 'fA'])
  })

  it('ignores historic readModel placements (auto-displayed, never a band)', () => {
    const bands = buildBands([p('r1', 'readModel', 'readModel')], rows)
    expect(bands.trigger.cards).toEqual([])
    expect(bands.command.card).toBeNull()
    expect(bands.factLanes[0].cards).toEqual([])
    expect(bands.readModels).toBeUndefined()
  })

  it('empty board → empty-variant ghosts everywhere', () => {
    const bands = buildBands([], rows)
    expect(bands.trigger.ghost.variant).toBe('empty')
    expect(bands.command.ghost.variant).toBe('empty')
    expect(bands.factLanes[0].ghost.variant).toBe('empty')
  })

  it('append ghosts under non-empty stacks; no trigger ghost for single-cardinality trigger', () => {
    const withWf = buildBands([p('w1', 'wireframe', 'trigger')], rows)
    expect(withWf.trigger.ghost).toEqual({ role: 'trigger', variant: 'append', label: '+ wireframe' })

    const withAuto = buildBands([p('a1', 'automation', 'trigger')], rows)
    expect(withAuto.trigger.ghost).toBeNull()

    const withCmd = buildBands([p('c1', 'command', 'command')], rows)
    expect(withCmd.command.ghost).toBeNull()
  })

  it('swap neighbours: adjacent within band+lane only', () => {
    const laneRows = [{ laneId: 'ctx-a' }, { laneId: null }]
    const bands = buildBands(
      [
        p('f1', 'businessFact', 'fact', { lane: 'ctx-a' }),
        p('f2', 'businessFact', 'fact', { lane: 'ctx-a' }),
        p('f3', 'businessFact', 'fact'),
      ],
      laneRows,
    )
    const [laneA, laneNone] = bands.factLanes
    expect(laneA.cards.map((c) => [c.swapUpId, c.swapDownId])).toEqual([
      [null, 'f2'],
      ['f1', null],
    ])
    expect(laneNone.cards.map((c) => [c.swapUpId, c.swapDownId])).toEqual([[null, null]])
  })

  it('every shared lane row gets a cell; fact ghost lives in the (none) lane', () => {
    const laneRows = [{ laneId: 'ctx-a' }, { laneId: null }]
    const bands = buildBands([], laneRows)
    expect(bands.factLanes.map((l) => l.laneId)).toEqual(['ctx-a', null])
    expect(bands.factLanes[0].ghost).toBeNull()
    expect(bands.factLanes[1].ghost.role).toBe('fact')
  })

  it('exposes definition fields on the card', () => {
    const bands = buildBands(
      [p('c1', 'command', 'command', { definition: { fields: [{ fieldName: 'amount', fieldType: 'number' }] } })],
      rows,
    )
    expect(bands.command.card.fields).toEqual([{ fieldName: 'amount', fieldType: 'number' }])
  })
})

describe('relationOptions', () => {
  const placements = [
    p('w1', 'wireframe', 'trigger'),
    p('c1', 'command', 'command'),
    p('f1', 'businessFact', 'fact'),
  ]
  const catalog = [{ _id: 'r1', entityType: 'readModel', name: 'r1' }]

  it('splits legal pairs by direction', () => {
    const opts = relationOptions(placements, [])
    const cmd = opts.get('c1')
    expect(cmd.incoming.map((o) => o.entityId)).toEqual(['w1']) // wireframe → command
    expect(cmd.outgoing.map((o) => o.entityId)).toEqual(['f1']) // command → fact
    const wf = opts.get('w1')
    expect(wf.outgoing.map((o) => o.entityId)).toEqual(['c1'])
  })

  it('excludes pairs that already have a relation', () => {
    const opts = relationOptions(placements, [{ fromId: 'w1', toId: 'c1', kind: 'issues' }])
    expect(opts.get('w1').outgoing).toEqual([])
    expect(opts.get('c1').incoming).toEqual([])
    // the reverse direction was never legal anyway
    expect(opts.get('c1').outgoing.map((o) => o.entityId)).toEqual(['f1'])
  })

  it('offers catalog read models: incoming for triggers, outgoing for facts', () => {
    const all = [
      ...placements,
      p('a1', 'automation', 'trigger'),
      p('x1', 'externalBusinessFact', 'fact'),
    ]
    const opts = relationOptions(all, [], [], catalog)
    expect(opts.get('w1').incoming.map((o) => o.entityId)).toContain('r1') // displayedBy
    expect(opts.get('a1').incoming.map((o) => o.entityId)).toContain('r1') // monitoredBy
    expect(opts.get('f1').outgoing.map((o) => o.entityId)).toContain('r1') // feeds
    expect(opts.get('x1').outgoing.map((o) => o.entityId)).toContain('r1') // directTranslation
    expect(opts.get('c1').incoming.map((o) => o.entityId)).not.toContain('r1') // no command↔RM pair
    expect(opts.get('c1').outgoing.map((o) => o.entityId)).not.toContain('r1')
  })

  it('excludes RM pairs that already exist at MODEL level', () => {
    const modelRelations = [
      { _id: 'rel1', fromId: 'r1', toId: 'w1', kind: 'displayedBy' },
      { _id: 'rel2', fromId: 'f1', toId: 'r1', kind: 'feeds' },
    ]
    const opts = relationOptions(placements, [], modelRelations, catalog)
    expect(opts.get('w1').incoming.map((o) => o.entityId)).not.toContain('r1')
    expect(opts.get('f1').outgoing.map((o) => o.entityId)).not.toContain('r1')
  })
})

describe('autoReadModels', () => {
  const rmCatalog = [
    { _id: 'r1', entityType: 'readModel', name: 'Entity Catalog', definition: { fields: [{ fieldName: 'n', fieldType: 'string' }] } },
    { _id: 'r2', entityType: 'readModel', name: 'Other RM' },
  ]
  const board = (id, placements) => ({ _id: id, placements })
  const displayed = (id, rm, wf) => ({ _id: id, fromId: rm, toId: wf, kind: 'displayedBy' })
  const monitored = (id, rm, a) => ({ _id: id, fromId: rm, toId: a, kind: 'monitoredBy' })
  const feeds = (id, fact, rm) => ({ _id: id, fromId: fact, toId: rm, kind: 'feeds' })

  it('shows an RM read by a wireframe, with fields from the catalog', () => {
    const boards = [board('s1', [p('w1', 'wireframe', 'trigger')])]
    const vm = autoReadModels(boards, [displayed('e1', 'r1', 'w1')], rmCatalog).get('s1')
    expect(vm.cards).toHaveLength(1)
    expect(vm.cards[0]).toMatchObject({
      entityId: 'r1',
      entityType: 'readModel',
      name: 'Entity Catalog',
      straddle: false,
    })
    expect(vm.cards[0].fields).toEqual([{ fieldName: 'n', fieldType: 'string' }])
    expect(vm.edges).toEqual([
      {
        relationId: 'e1',
        kind: 'displayedBy',
        from: { sliceId: 's1', entityId: 'r1' },
        to: { sliceId: 's1', entityId: 'w1' },
      },
    ])
  })

  it('shows an RM monitored by an automation', () => {
    const boards = [board('s1', [p('a1', 'automation', 'trigger')])]
    const vm = autoReadModels(boards, [monitored('e1', 'r1', 'a1')], rmCatalog).get('s1')
    expect(vm.cards.map((c) => c.entityId)).toEqual(['r1'])
  })

  it('dedups: two readers in one slice → one card, two edges', () => {
    const boards = [
      board('s1', [p('w1', 'wireframe', 'trigger'), p('a1', 'automation', 'trigger')]),
    ]
    const rels = [displayed('e1', 'r1', 'w1'), monitored('e2', 'r1', 'a1')]
    const vm = autoReadModels(boards, rels, rmCatalog).get('s1')
    expect(vm.cards).toHaveLength(1)
    expect(vm.edges).toHaveLength(2)
  })

  it('straddles when fed by a fact in the slice immediately left', () => {
    const boards = [
      board('s1', [p('f1', 'businessFact', 'fact')]),
      board('s2', [p('w1', 'wireframe', 'trigger')]),
    ]
    const rels = [displayed('e1', 'r1', 'w1'), feeds('e2', 'f1', 'r1')]
    const vm = autoReadModels(boards, rels, rmCatalog).get('s2')
    expect(vm.cards[0].straddle).toBe(true)
    expect(vm.edges).toContainEqual({
      relationId: 'e2',
      kind: 'feeds',
      from: { sliceId: 's1', entityId: 'f1' },
      to: { sliceId: 's2', entityId: 'r1' },
    })
  })

  it('straddles on directTranslation feeds too', () => {
    const boards = [
      board('s1', [p('x1', 'externalBusinessFact', 'fact')]),
      board('s2', [p('w1', 'wireframe', 'trigger')]),
    ]
    const rels = [
      displayed('e1', 'r1', 'w1'),
      { _id: 'e2', fromId: 'x1', toId: 'r1', kind: 'directTranslation' },
    ]
    expect(autoReadModels(boards, rels, rmCatalog).get('s2').cards[0].straddle).toBe(true)
  })

  it('same-slice and non-adjacent feeds: no straddle AND no edge (locality rule)', () => {
    const boards = [
      board('s1', [p('f1', 'businessFact', 'fact')]),
      board('s2', []),
      board('s3', [p('w1', 'wireframe', 'trigger'), p('f2', 'businessFact', 'fact')]),
    ]
    const rels = [displayed('e1', 'r1', 'w1'), feeds('e2', 'f1', 'r1'), feeds('e3', 'f2', 'r1')]
    const vm = autoReadModels(boards, rels, rmCatalog).get('s3')
    expect(vm.cards[0].straddle).toBe(false)
    // Only the same-slice display edge survives — distant/same-slice feeds undrawn.
    expect(vm.edges.map((e) => e.relationId)).toEqual(['e1'])
  })

  it('first slice never straddles', () => {
    const boards = [board('s1', [p('w1', 'wireframe', 'trigger')])]
    const rels = [displayed('e1', 'r1', 'w1'), feeds('e2', 'f1', 'r1')]
    expect(autoReadModels(boards, rels, rmCatalog).get('s1').cards[0].straddle).toBe(false)
  })

  it('skips RMs missing from the catalog (archived / stale edge)', () => {
    const boards = [board('s1', [p('w1', 'wireframe', 'trigger')])]
    const vm = autoReadModels(boards, [displayed('e1', 'gone', 'w1')], rmCatalog).get('s1')
    expect(vm.cards).toEqual([])
    expect(vm.edges).toEqual([])
  })

  it('an RM read in two slices appears in each', () => {
    const boards = [
      board('s1', [p('w1', 'wireframe', 'trigger')]),
      board('s2', [p('w2', 'wireframe', 'trigger')]),
    ]
    const rels = [displayed('e1', 'r1', 'w1'), displayed('e2', 'r1', 'w2')]
    const vms = autoReadModels(boards, rels, rmCatalog)
    expect(vms.get('s1').cards.map((c) => c.entityId)).toEqual(['r1'])
    expect(vms.get('s2').cards.map((c) => c.entityId)).toEqual(['r1'])
  })

  it('a feeder fact placed in two slices: only the immediate-left instance draws', () => {
    const boards = [
      board('s1', [p('f1', 'businessFact', 'fact')]),
      board('s2', [p('f1', 'businessFact', 'fact'), p('w1', 'wireframe', 'trigger')]),
    ]
    const rels = [displayed('e1', 'r1', 'w1'), feeds('e2', 'f1', 'r1')]
    const vm = autoReadModels(boards, rels, rmCatalog).get('s2')
    const feedEdges = vm.edges.filter((e) => e.relationId === 'e2')
    expect(feedEdges.map((e) => e.from.sliceId)).toEqual(['s1']) // s2's own copy undrawn
    expect(vm.cards[0].straddle).toBe(true) // s1 is immediately left
  })
})

describe('buildStripModel', () => {
  it('groups by anchor and resolves names from placements', () => {
    const strip = buildStripModel(
      [
        { _id: 's1', anchorId: 'c1', kind: 'GWT' },
        { _id: 's2', anchorId: 'c1', kind: 'GWT' },
        { _id: 's3', anchorId: 'ghost', kind: 'GT' },
      ],
      [p('c1', 'command', 'command', { name: 'Record Budget Line' })],
    )
    expect(strip).toHaveLength(2)
    expect(strip[0].anchorName).toBe('Record Budget Line')
    expect(strip[0].scenarios).toHaveLength(2)
    expect(strip[1].anchorName).toBe('(defined elsewhere)')
  })
})
