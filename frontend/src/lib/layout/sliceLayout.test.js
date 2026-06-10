import { describe, it, expect } from 'vitest'
import { LAYOUT, layoutSlice, layoutCanvas } from './sliceLayout.js'

// Helpers — placements as the server sends them (pre-sorted band→slot).
const wf = (id, slot = 0) => ({ entityId: id, entityType: 'wireframe', slotRole: 'trigger', slot })
const auto = (id) => ({ entityId: id, entityType: 'automation', slotRole: 'trigger' })
const cmd = (id) => ({ entityId: id, entityType: 'command', slotRole: 'command' })
const rm = (id, slot = 0) => ({ entityId: id, entityType: 'readModel', slotRole: 'readModel', slot })
const fact = (id, slot = 0, lane) => ({
  entityId: id,
  entityType: 'businessFact',
  slotRole: 'fact',
  slot,
  ...(lane !== undefined ? { lane } : {}),
})

const cardOf = (layout, id) => layout.cards.find((c) => c.entityId === id)

describe('layoutSlice — staircase + bands', () => {
  it('staircase invariant: trigger.x < command.x < fact.x', () => {
    const l = layoutSlice([wf('w'), cmd('c'), fact('f')])
    expect(l.bands.trigger.x).toBeLessThan(l.bands.command.x)
    expect(l.bands.command.x).toBeLessThan(l.bands.fact.x)
  })

  it('bands stack downward: trigger above command above facts', () => {
    const l = layoutSlice([wf('w'), cmd('c'), fact('f')])
    expect(l.bands.trigger.y).toBeLessThan(l.bands.command.y)
    expect(l.bands.command.y).toBeLessThan(l.bands.fact.y)
  })

  it('read models stack in a column right of the command', () => {
    const l = layoutSlice([cmd('c'), rm('r1', 0), rm('r2', 1)])
    const c = cardOf(l, 'c')
    const r1 = cardOf(l, 'r1')
    const r2 = cardOf(l, 'r2')
    expect(r1.x).toBe(l.bands.command.readModelX)
    expect(r1.x).toBeGreaterThan(c.x)
    expect(r2.x).toBe(r1.x)
    expect(r2.y).toBe(r1.y + LAYOUT.CARD_H + LAYOUT.GAP_Y) // Variant A spacing
  })

  it('width covers the widest band + padding, min BOX_MIN_W', () => {
    const empty = layoutSlice([])
    expect(empty.width).toBe(LAYOUT.BOX_MIN_W)
    const l = layoutSlice([fact('f')])
    expect(l.width).toBeGreaterThanOrEqual(l.bands.fact.x + LAYOUT.CARD_W + LAYOUT.PAD)
  })
})

describe('layoutSlice — input order is render order (never sorts)', () => {
  it('preserves placement input order in the cards array', () => {
    const input = [wf('w'), cmd('c'), rm('r'), fact('f1'), fact('f2', 5)]
    const l = layoutSlice(input)
    expect(l.cards.map((c) => c.entityId)).toEqual(['w', 'c', 'r', 'f1', 'f2'])
  })

  it('slot holes are invisible — rows are consecutive regardless of slot values', () => {
    const l = layoutSlice([fact('a', 0), fact('b', 4), fact('c', 9)])
    const ys = ['a', 'b', 'c'].map((id) => cardOf(l, id).y)
    expect(ys[1] - ys[0]).toBe(LAYOUT.CARD_H + LAYOUT.GAP_Y)
    expect(ys[2] - ys[1]).toBe(LAYOUT.CARD_H + LAYOUT.GAP_Y)
  })
})

describe('layoutSlice — ghosts', () => {
  it('empty slice exposes all four ghost slots, full-size', () => {
    const l = layoutSlice([])
    const ids = l.ghosts.map((g) => g.id).sort()
    expect(ids).toEqual(['ghost-command', 'ghost-fact', 'ghost-readModel', 'ghost-trigger'])
    expect(l.ghosts.every((g) => g.variant === 'empty')).toBe(true)
    expect(l.ghosts.every((g) => g.h === LAYOUT.CARD_H)).toBe(true)
  })

  it('non-empty stackable bands get a compact append ghost; command never does', () => {
    const l = layoutSlice([wf('w'), cmd('c'), rm('r'), fact('f')])
    const byId = Object.fromEntries(l.ghosts.map((g) => [g.id, g]))
    expect(byId['ghost-trigger'].variant).toBe('append')
    expect(byId['ghost-readModel'].variant).toBe('append')
    expect(byId['ghost-fact'].variant).toBe('append')
    expect(byId['ghost-command']).toBeUndefined() // command present → no ghost
  })

  it('a single automation in the trigger slot suppresses the wireframe append ghost', () => {
    const l = layoutSlice([auto('a')])
    expect(l.ghosts.find((g) => g.id === 'ghost-trigger')).toBeUndefined()
  })
})

describe('layoutSlice — lanes (Variant C off / swimlanes on)', () => {
  const facts = [fact('f1', 0, 'ctx-budget'), fact('f2', 1, 'ctx-audit'), fact('f3', 2, 'ctx-budget')]

  it('lanes OFF: one flat pseudo-lane, vertical stack in input order', () => {
    const l = layoutSlice(facts, { lanesOn: false })
    expect(l.lanes).toHaveLength(1)
    expect(l.lanes[0].laneId).toBeNull()
    const ys = facts.map((f) => cardOf(l, f.entityId).y)
    expect(ys[0]).toBeLessThan(ys[1])
    expect(ys[1]).toBeLessThan(ys[2])
  })

  it('lanes ON: grouped by lane, lane order = first appearance, plus the "(none)" lane', () => {
    const l = layoutSlice(facts, { lanesOn: true })
    expect(l.lanes.map((x) => x.laneId)).toEqual(['ctx-budget', 'ctx-audit', null])
    expect(l.lanes[2].label).toBe('(none)')
    // f1 + f3 share the budget lane, stacked in input order.
    const f1 = cardOf(l, 'f1')
    const f3 = cardOf(l, 'f3')
    expect(f1.laneId).toBe('ctx-budget')
    expect(f3.laneId).toBe('ctx-budget')
    expect(f3.y).toBe(f1.y + LAYOUT.CARD_H + LAYOUT.GAP_Y)
    // f2 sits inside the audit lane's vertical range.
    const audit = l.lanes[1]
    const f2 = cardOf(l, 'f2')
    expect(f2.y).toBeGreaterThanOrEqual(audit.y)
    expect(f2.y + f2.h).toBeLessThanOrEqual(audit.y + audit.height)
  })

  it('a fact without a lane lands in the "(none)" lane when lanes are on', () => {
    const l = layoutSlice([fact('f1', 0, 'ctx-a'), fact('f2', 1)], { lanesOn: true })
    expect(cardOf(l, 'f2').laneId).toBeNull()
    const none = l.lanes.find((x) => x.laneId === null)
    expect(none).toBeDefined()
  })
})

describe('layoutSlice — swap neighbours', () => {
  it('links adjacent same-band siblings (drives ▲▼ + drag targets)', () => {
    const l = layoutSlice([fact('a'), fact('b'), fact('c')])
    expect(cardOf(l, 'a').swapUpId).toBeNull()
    expect(cardOf(l, 'a').swapDownId).toBe('b')
    expect(cardOf(l, 'b').swapUpId).toBe('a')
    expect(cardOf(l, 'b').swapDownId).toBe('c')
    expect(cardOf(l, 'c').swapDownId).toBeNull()
  })

  it('single-cardinality command has no swap neighbours', () => {
    const l = layoutSlice([cmd('c'), fact('f1'), fact('f2')])
    expect(cardOf(l, 'c').swapUpId).toBeNull()
    expect(cardOf(l, 'c').swapDownId).toBeNull()
  })

  it('lanes ON: swap neighbours never cross a lane boundary', () => {
    const l = layoutSlice(
      [fact('f1', 0, 'a'), fact('f2', 1, 'b'), fact('f3', 2, 'a')],
      { lanesOn: true },
    )
    expect(cardOf(l, 'f1').swapDownId).toBe('f3') // a-lane sibling, skipping f2
    expect(cardOf(l, 'f2').swapUpId).toBeNull()
    expect(cardOf(l, 'f2').swapDownId).toBeNull()
  })

  it('lanes OFF: the whole facts band is one swap group', () => {
    const l = layoutSlice(
      [fact('f1', 0, 'a'), fact('f2', 1, 'b')],
      { lanesOn: false },
    )
    expect(cardOf(l, 'f1').swapDownId).toBe('f2')
  })

  it('wireframes stack and swap within the trigger band', () => {
    const l = layoutSlice([wf('w1', 0), wf('w2', 1)])
    expect(cardOf(l, 'w1').swapDownId).toBe('w2')
    expect(cardOf(l, 'w2').swapUpId).toBe('w1')
  })
})

describe('layoutCanvas — left→right tiling', () => {
  it('tiles boxes by running width + gap, all at y=0', () => {
    const a = { sliceId: 's1', layout: { width: 500 } }
    const b = { sliceId: 's2', layout: { width: 600 } }
    const tiled = layoutCanvas([a, b])
    expect(tiled[0].origin).toEqual({ x: 0, y: 0 })
    expect(tiled[1].origin).toEqual({ x: 500 + LAYOUT.BOX_GAP_X, y: 0 })
  })

  it('preserves the given (creation) order', () => {
    const tiled = layoutCanvas([
      { sliceId: 'later', layout: { width: 480 } },
      { sliceId: 'earlier', layout: { width: 480 } },
    ])
    expect(tiled.map((t) => t.sliceId)).toEqual(['later', 'earlier'])
  })
})
