import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { PostgreSQLEventStoreConsumer } from '@event-driven-io/emmett-postgresql';
import {
  bootAuthHarness,
  stopAuthHarness,
  signup,
  freshCreds,
  hasSessionCookie,
  type AuthHarness,
  type CookieJar,
} from './_authHarness.ts';

/**
 * End-to-end tests for V1 (scenarios: GWT/GT lifecycle, the F6 reference index,
 * the derived outOfSync flag, canvas auto-surfacing) and A2 (on-demand model
 * validation + where-used). Runs under `node --test`.
 */
let h: AuthHarness;
let jar: CookieJar;
let consumer: PostgreSQLEventStoreConsumer;

const uuid = () => randomBytes(16).toString('hex');
const tag = () => randomBytes(4).toString('hex');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const postJson = (path: string, body: unknown) =>
  jar.fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const poll = async <T>(
  path: string,
  predicate: (v: T) => boolean,
  { tries = 60, delay = 100 } = {},
): Promise<T> => {
  for (let i = 0; i < tries; i++) {
    const res = await jar.fetch(path);
    if (res.status === 200) {
      const body = (await res.json()) as T;
      if (predicate(body)) return body;
    }
    await sleep(delay);
  }
  throw new Error(`poll: predicate not satisfied for ${path}`);
};

type ScenarioView = {
  _id: string;
  kind: string;
  anchorId: string;
  referencedEntityIds: string[];
  outOfSync: boolean;
  archived: boolean;
};

describe('scenarios + analysis (V1, A2)', () => {
  before(async () => {
    h = await bootAuthHarness();
    const { startConsumers } = await import('../../src/consumers.ts');
    consumer = startConsumers();
    jar = h.jar();
    assert.equal((await signup(jar, freshCreds())).status, 200);
    assert.ok(hasSessionCookie(jar));
  });

  after(async () => {
    await consumer?.stop().catch(() => {});
    await stopAuthHarness();
  });

  it('defines a GWT scenario, derives outOfSync when a referenced entity is archived', async () => {
    const modelId = uuid();
    const commandId = uuid();
    const factId = uuid();
    const scenarioId = uuid();
    const t = tag();

    assert.equal(
      (
        await postJson('/api/commands', {
          modelId,
          entityId: commandId,
          name: `Record-${t}`,
          fields: [],
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await postJson('/api/business-facts', {
          modelId,
          entityId: factId,
          name: `Recorded-${t}`,
          fields: [],
        })
      ).status,
      200,
    );

    // Soft refs: the scenario can be drafted immediately, no catalog wait.
    assert.equal(
      (
        await postJson('/api/scenarios', {
          modelId,
          scenarioId,
          kind: 'GWT',
          anchorId: commandId,
          given: [],
          when: { values: { amount: 250 } },
          then: { emit: [{ factId, values: { amount: 250 } }] },
        })
      ).status,
      200,
    );

    const view = await poll<ScenarioView>(
      `/api/scenarios/${scenarioId}`,
      (s) => s._id === scenarioId && s.outOfSync === false,
    );
    assert.deepEqual(view.referencedEntityIds.sort(), [commandId, factId].sort());

    // Archive the emitted fact → the scenario derives outOfSync (never blocked).
    assert.equal(
      (await jar.fetch(`/api/business-facts/${factId}`, { method: 'DELETE' })).status,
      200,
    );
    await poll<ScenarioView>(`/api/scenarios/${scenarioId}`, (s) => s.outOfSync === true);
  });

  it('rejects a GT with a When (400→409 path) and lists scenarios by referenced entity (F6)', async () => {
    const modelId = uuid();
    const rmId = uuid();
    const factId = uuid();
    const scenarioId = uuid();
    const t = tag();

    assert.equal(
      (
        await postJson('/api/read-models', {
          modelId,
          entityId: rmId,
          name: `Totals-${t}`,
          fields: [],
        })
      ).status,
      200,
    );
    // GT with a When violates the shape → decider rejects → 409.
    assert.equal(
      (
        await postJson('/api/scenarios', {
          modelId,
          scenarioId: uuid(),
          kind: 'GT',
          anchorId: rmId,
          given: [],
          when: {},
          then: { state: {} },
        })
      ).status,
      409,
    );

    assert.equal(
      (
        await postJson('/api/scenarios', {
          modelId,
          scenarioId,
          kind: 'GT',
          anchorId: rmId,
          given: [{ factId, values: { amount: 100 } }],
          then: { state: { total: 100 } },
        })
      ).status,
      200,
    );

    const byFact = await poll<ScenarioView[]>(
      `/api/scenarios?modelId=${modelId}&entityId=${factId}`,
      (list) => list.length === 1,
    );
    assert.equal(byFact[0]?._id, scenarioId);
    const byOther = await poll<ScenarioView[]>(
      `/api/scenarios?modelId=${modelId}&entityId=${uuid()}`,
      (list) => list.length === 0,
    );
    assert.equal(byOther.length, 0);
  });

  it('auto-surfaces scenarios on the slice canvas via visible entities (F6/S2)', async () => {
    const modelId = uuid();
    const sliceId = uuid();
    const commandId = uuid();
    const scenarioId = uuid();
    const t = tag();

    assert.equal(
      (
        await postJson('/api/commands', {
          modelId,
          entityId: commandId,
          name: `Anchor-${t}`,
          fields: [],
        })
      ).status,
      200,
    );
    assert.equal(
      (await postJson('/api/slices', { modelId, sliceId, name: `S-${t}` })).status,
      200,
    );
    assert.equal(
      (
        await postJson('/api/scenarios', {
          modelId,
          scenarioId,
          kind: 'GWT',
          anchorId: commandId,
          given: [],
          when: {},
          then: { reject: { reason: 'limit' } },
        })
      ).status,
      200,
    );
    await poll<{ _id: string }>(`/api/commands/${commandId}`, (v) => v._id === commandId);
    await poll<{ _id: string }>(`/api/slices/${sliceId}`, (v) => v._id === sliceId);
    assert.equal(
      (await postJson(`/api/slices/${sliceId}/placements`, { placedEntityId: commandId }))
        .status,
      200,
    );

    type Canvas = { scenarios: { _id: string; anchorId: string }[] };
    const canvas = await poll<Canvas>(
      `/api/slices/${sliceId}`,
      (v) => v.scenarios.length === 1,
    );
    assert.equal(canvas.scenarios[0]?._id, scenarioId);
    assert.equal(canvas.scenarios[0]?.anchorId, commandId);
  });

  it('validates a model on demand: complete loop is clean, gaps are advisory findings (A2)', async () => {
    const modelId = uuid();
    const w = uuid();
    const c = uuid();
    const f = uuid();
    const r = uuid();
    const orphanFact = uuid();
    const t = tag();

    assert.equal(
      (await postJson('/api/wireframes', { modelId, entityId: w, name: `Form-${t}`, content: '' }))
        .status,
      200,
    );
    assert.equal(
      (
        await postJson('/api/commands', {
          modelId,
          entityId: c,
          name: `Add-${t}`,
          fields: [{ fieldName: 'amount', fieldType: 'money' }],
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await postJson('/api/business-facts', {
          modelId,
          entityId: f,
          name: `Added-${t}`,
          fields: [{ fieldName: 'amount', fieldType: 'money' }],
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await postJson('/api/read-models', {
          modelId,
          entityId: r,
          name: `List-${t}`,
          fields: [{ fieldName: 'amount', fieldType: 'money' }],
        })
      ).status,
      200,
    );
    // An orphan: no producer → exactly one finding expected for it.
    assert.equal(
      (
        await postJson('/api/business-facts', {
          modelId,
          entityId: orphanFact,
          name: `Orphan-${t}`,
          fields: [],
        })
      ).status,
      200,
    );
    // where-used 404s until the entity is cataloged; a 200 means it landed.
    for (const id of [w, c, f, r, orphanFact])
      await poll<{ entityId: string }>(`/api/entities/${id}/where-used`, () => true);

    assert.equal((await postJson('/api/relations', { modelId, relationId: uuid(), fromId: w, toId: c, kind: 'issues' })).status, 200);
    assert.equal((await postJson('/api/relations', { modelId, relationId: uuid(), fromId: c, toId: f, kind: 'produces' })).status, 200);
    assert.equal((await postJson('/api/relations', { modelId, relationId: uuid(), fromId: f, toId: r, kind: 'feeds' })).status, 200);

    type Validation = { findings: { entityId: string; kind: string }[] };
    const result = await poll<Validation>(
      `/api/models/${modelId}/validation`,
      (v) =>
        v.findings.length === 1 &&
        v.findings[0]?.entityId === orphanFact &&
        v.findings[0]?.kind === 'fact-without-producer',
    );
    assert.equal(result.findings.length, 1);
  });

  it('reports where-used across slices, relations, and scenarios (A2)', async () => {
    const modelId = uuid();
    const sliceId = uuid();
    const c = uuid();
    const f = uuid();
    const relId = uuid();
    const scenarioId = uuid();
    const t = tag();

    assert.equal(
      (await postJson('/api/commands', { modelId, entityId: c, name: `Cmd-${t}`, fields: [] }))
        .status,
      200,
    );
    assert.equal(
      (
        await postJson('/api/business-facts', {
          modelId,
          entityId: f,
          name: `Fct-${t}`,
          fields: [],
        })
      ).status,
      200,
    );
    assert.equal((await postJson('/api/slices', { modelId, sliceId })).status, 200);
    await poll<{ _id: string }>(`/api/commands/${c}`, (v) => v._id === c);
    await poll<{ _id: string }>(`/api/business-facts/${f}`, (v) => v._id === f);
    await poll<{ _id: string }>(`/api/slices/${sliceId}`, (v) => v._id === sliceId);
    assert.equal(
      (await postJson(`/api/slices/${sliceId}/placements`, { placedEntityId: f })).status,
      200,
    );
    assert.equal(
      (
        await postJson('/api/relations', {
          modelId,
          relationId: relId,
          fromId: c,
          toId: f,
          kind: 'produces',
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await postJson('/api/scenarios', {
          modelId,
          scenarioId,
          kind: 'GWT',
          anchorId: c,
          given: [{ factId: f }],
          when: {},
          then: { reject: {} },
        })
      ).status,
      200,
    );

    type WhereUsed = {
      slices: { _id: string }[];
      relations: { _id: string }[];
      scenarios: { _id: string }[];
    };
    const used = await poll<WhereUsed>(
      `/api/entities/${f}/where-used`,
      (wu) =>
        wu.slices.length === 1 && wu.relations.length === 1 && wu.scenarios.length === 1,
    );
    assert.equal(used.slices[0]?._id, sliceId);
    assert.equal(used.relations[0]?._id, relId);
    assert.equal(used.scenarios[0]?._id, scenarioId);
  });
});
