import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
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
 * End-to-end tests for the three v1-frontend read endpoints added on top of the
 * completed verticals: the per-model catalog list (`/models/:id/entities`, W3
 * palette), the per-model slice list (`/models/:id/slices`, W3 tiling in
 * creation order), and the whole-model export (`/models/:id/export`, O1
 * state-view query). All reads are eventually consistent → assertions POLL.
 * Runs under `node --test` (testcontainers' lifecycle hangs under Bun).
 */
let h: AuthHarness;
let jar: CookieJar;
let consumer: PostgreSQLEventStoreConsumer;

const tag = () => randomBytes(4).toString('hex');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const postJson = (path: string, body: unknown) =>
  jar.fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

/** Poll a GET until `predicate` holds on its JSON body (projection catch-up). */
const pollGet = async <T>(
  path: string,
  predicate: (body: T) => boolean,
  { tries = 50, delay = 100 } = {},
): Promise<T> => {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    const res = await jar.fetch(path);
    if (res.status === 200) {
      const body = (await res.json()) as T;
      last = body;
      if (predicate(body)) return body;
    }
    await sleep(delay);
  }
  throw new Error(`pollGet(${path}): predicate not satisfied; last=${JSON.stringify(last)}`);
};

const createModel = async (): Promise<string> => {
  const res = await postJson('/api/models', { name: `M-${tag()}` });
  assert.equal(res.status, 200);
  const { modelId } = (await res.json()) as { modelId: string };
  return modelId;
};

type EntityRow = {
  _id: string;
  entityType: string;
  name: string;
  contextId?: string;
  definedAtPosition?: number;
};
type SliceRow = { _id: string; name?: string };

describe('model list endpoints + export (v1 frontend reads)', () => {
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

  it('lists a model entities in creation order, excluding slices and archived', async () => {
    const modelId = await createModel();
    const factId = randomUUID();
    const cmdId = randomUUID();
    const sliceId = randomUUID();

    assert.equal(
      (await postJson('/api/business-facts', {
        modelId,
        entityId: factId,
        name: `FactA-${tag()}`,
        fields: [],
      })).status,
      200,
    );
    assert.equal(
      (await postJson('/api/commands', {
        modelId,
        entityId: cmdId,
        name: `CmdB-${tag()}`,
        fields: [],
      })).status,
      200,
    );
    assert.equal(
      (await postJson('/api/slices', { modelId, sliceId, name: 'S' })).status,
      200,
    );

    const list = await pollGet<EntityRow[]>(
      `/api/models/${modelId}/entities`,
      (es) => es.length === 2,
    );
    // Creation order: the fact was defined before the command.
    assert.deepEqual(
      list.map((e) => e._id),
      [factId, cmdId],
    );
    assert.ok(
      list.every((e) => e.entityType !== 'slice'),
      'slices never appear in the entity list',
    );
    assert.ok(
      list.every((e) => typeof e.definedAtPosition === 'number'),
      'definedAtPosition is stamped',
    );

    // Archive the fact → it drops from the list.
    assert.equal(
      (await jar.fetch(`/api/business-facts/${factId}`, { method: 'DELETE' }))
        .status,
      200,
    );
    await pollGet<EntityRow[]>(
      `/api/models/${modelId}/entities`,
      (es) => es.length === 1 && es[0]?._id === cmdId,
    );
  });

  it('lists a model slices in creation order and drops archived ones', async () => {
    const modelId = await createModel();
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    for (const [i, sliceId] of ids.entries()) {
      assert.equal(
        (await postJson('/api/slices', { modelId, sliceId, name: `S${i}` }))
          .status,
        200,
      );
    }

    const list = await pollGet<SliceRow[]>(
      `/api/models/${modelId}/slices`,
      (ss) => ss.length === 3,
    );
    assert.deepEqual(
      list.map((s) => s._id),
      ids,
      'tiling order = creation order',
    );

    // Archive the middle slice → list keeps the outer two, order preserved.
    assert.equal(
      (await jar.fetch(`/api/slices/${ids[1]}`, { method: 'DELETE' })).status,
      200,
    );
    const after = await pollGet<SliceRow[]>(
      `/api/models/${modelId}/slices`,
      (ss) => ss.length === 2,
    );
    assert.deepEqual(after.map((s) => s._id), [ids[0], ids[2]]);
  });

  it('exports the whole model as version-stamped current-state JSON', async () => {
    const modelId = await createModel();
    const factId = randomUUID();
    const cmdId = randomUUID();
    const contextId = randomUUID();
    const sliceId = randomUUID();
    const relationId = randomUUID();
    const scenarioId = randomUUID();

    assert.equal(
      (await postJson('/api/contexts', { modelId, contextId, name: 'Budget' }))
        .status,
      200,
    );
    assert.equal(
      (await postJson('/api/business-facts', {
        modelId,
        entityId: factId,
        name: `LineRecorded-${tag()}`,
        fields: [{ fieldName: 'amount', fieldType: 'money' }],
      })).status,
      200,
    );
    // Lane assignment pre-checks read the async contexts + catalog read models
    // — wait for both projections before assigning.
    await pollGet<Array<{ _id: string }>>(
      `/api/contexts?modelId=${modelId}`,
      (cs) => cs.some((c) => c._id === contextId),
    );
    await pollGet<EntityRow[]>(
      `/api/models/${modelId}/entities`,
      (es) => es.some((e) => e._id === factId),
    );
    assert.equal(
      (await jar.fetch(`/api/business-facts/${factId}/context`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contextId }),
      })).status,
      200,
    );
    assert.equal(
      (await postJson('/api/commands', {
        modelId,
        entityId: cmdId,
        name: `RecordLine-${tag()}`,
        fields: [{ fieldName: 'amount', fieldType: 'money' }],
      })).status,
      200,
    );
    assert.equal(
      (await postJson('/api/slices', { modelId, sliceId, name: 'Record line' }))
        .status,
      200,
    );
    // Placement pre-checks read the async catalog — wait for both entities.
    await pollGet<EntityRow[]>(
      `/api/models/${modelId}/entities`,
      (es) => es.length === 2,
    );
    for (const placedEntityId of [cmdId, factId]) {
      assert.equal(
        (await postJson(`/api/slices/${sliceId}/placements`, { placedEntityId }))
          .status,
        200,
      );
    }
    assert.equal(
      (await postJson('/api/relations', {
        modelId,
        relationId,
        fromId: cmdId,
        toId: factId,
        kind: 'produces',
      })).status,
      200,
    );
    assert.equal(
      (await postJson('/api/scenarios', {
        modelId,
        scenarioId,
        kind: 'GWT',
        anchorId: cmdId,
        given: [],
        when: { values: { amount: 5 } },
        then: { emit: [{ factId, values: { amount: 5 } }] },
      })).status,
      200,
    );

    type Export = {
      schemaVersion: number;
      exportedAt: string;
      model: { id: string; name: string };
      contexts: Array<{ id: string; name: string }>;
      entities: Array<{ id: string; entityType: string; contextId?: string }>;
      slices: Array<{
        id: string;
        placements: Array<{ entityId: string; slotRole: string; slot?: number }>;
      }>;
      relations: Array<{ id: string; kind: string }>;
      scenarios: Array<{ id: string; kind: string; anchorId: string }>;
    };
    const out = await pollGet<Export>(
      `/api/models/${modelId}/export`,
      (e) =>
        e.entities?.length === 2 &&
        e.slices?.[0]?.placements?.length === 2 &&
        e.relations?.length === 1 &&
        e.scenarios?.length === 1 &&
        e.entities.some((en) => en.contextId === contextId),
    );

    assert.equal(out.schemaVersion, 1);
    assert.ok(Date.parse(out.exportedAt) > 0, 'exportedAt is an ISO timestamp');
    assert.equal(out.model.id, modelId);
    assert.deepEqual(out.contexts, [{ id: contextId, name: 'Budget' }]);
    assert.deepEqual(
      out.entities.map((e) => e.id),
      [factId, cmdId],
      'entities in creation order',
    );
    const placements = out.slices[0]?.placements ?? [];
    assert.ok(
      placements.some((p) => p.entityId === cmdId && p.slotRole === 'command'),
    );
    assert.ok(
      placements.some((p) => p.entityId === factId && p.slotRole === 'fact'),
    );
    assert.deepEqual(out.relations, [
      { id: relationId, fromId: cmdId, toId: factId, kind: 'produces' },
    ]);
    assert.equal(out.scenarios[0]?.anchorId, cmdId);

    // Archived model → export 404s.
    assert.equal(
      (await jar.fetch(`/api/models/${modelId}`, { method: 'DELETE' })).status,
      200,
    );
    for (let i = 0; i < 50; i++) {
      const res = await jar.fetch(`/api/models/${modelId}/export`);
      if (res.status === 404) return;
      await sleep(100);
    }
    assert.fail('archived model export never 404ed');
  });
});
