import { describe, it, expect } from 'vitest'
import { laneRowsFor, buildBands, relationOptions, buildStripModel } from './boardView'

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
        p('r1', 'readModel', 'readModel'),
        p('fB', 'businessFact', 'fact'),
        p('fA', 'businessFact', 'fact'),
      ],
      rows,
    )
    expect(bands.trigger.cards.map((c) => c.entityId)).toEqual(['w1'])
    expect(bands.command.card.entityId).toBe('c1')
    expect(bands.readModels.cards.map((c) => c.entityId)).toEqual(['r1'])
    expect(bands.factLanes[0].cards.map((c) => c.entityId)).toEqual(['fB', 'fA'])
  })

  it('empty board → empty-variant ghosts everywhere', () => {
    const bands = buildBands([], rows)
    expect(bands.trigger.ghost.variant).toBe('empty')
    expect(bands.command.ghost.variant).toBe('empty')
    expect(bands.readModels.ghost.variant).toBe('empty')
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
    p('r1', 'readModel', 'readModel'),
  ]

  it('splits legal pairs by direction', () => {
    const opts = relationOptions(placements, [])
    const cmd = opts.get('c1')
    expect(cmd.incoming.map((o) => o.entityId)).toEqual(['w1']) // wireframe → command
    expect(cmd.outgoing.map((o) => o.entityId)).toEqual(['f1']) // command → fact
    const wf = opts.get('w1')
    expect(wf.incoming.map((o) => o.entityId)).toEqual(['r1']) // readModel → wireframe
    expect(wf.outgoing.map((o) => o.entityId)).toEqual(['c1'])
  })

  it('excludes pairs that already have a relation', () => {
    const opts = relationOptions(placements, [{ fromId: 'w1', toId: 'c1', kind: 'issues' }])
    expect(opts.get('w1').outgoing).toEqual([])
    expect(opts.get('c1').incoming).toEqual([])
    // the reverse direction was never legal anyway
    expect(opts.get('c1').outgoing.map((o) => o.entityId)).toEqual(['f1'])
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
