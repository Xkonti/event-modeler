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
 * End-to-end test for the E3/E4/E5 catalog verticals (readModel, wireframe,
 * externalBusinessFact): define through the real app, read back through the
 * async `entity_catalog` (definition payloads included, F5), and prove the
 * per-model cross-type name constraint (G-C2) covers the new types. GETs are
 * eventually consistent → assertions POLL. Runs under `node --test`.
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

const putJson = (path: string, body: unknown) =>
  jar.fetch(path, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

type EntityView = {
  _id: string;
  modelId?: string;
  entityType: string;
  name: string;
  definition?: { fields?: unknown[]; content?: string; mode?: string };
  archived: boolean;
};

/** Poll an entity GET until `predicate` holds (projection catch-up), else throw. */
const pollEntity = async (
  path: string,
  predicate: (v: EntityView) => boolean,
  { tries = 50, delay = 100 } = {},
): Promise<EntityView> => {
  for (let i = 0; i < tries; i++) {
    const res = await jar.fetch(path);
    if (res.status === 200) {
      const body = (await res.json()) as EntityView;
      if (predicate(body)) return body;
    }
    await sleep(delay);
  }
  throw new Error(`pollEntity: predicate not satisfied for ${path}`);
};

describe('catalog verticals E3/E4/E5 (readModel, wireframe, externalBusinessFact)', () => {
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

  it('defines a read model and reads its definition from the catalog', async () => {
    const modelId = uuid();
    const entityId = uuid();
    const name = `Budget Summary ${tag()}`;
    assert.equal(
      (
        await postJson('/api/read-models', {
          modelId,
          entityId,
          name,
          fields: [{ fieldName: 'total', fieldType: 'money' }],
        })
      ).status,
      200,
    );
    const view = await pollEntity(`/api/read-models/${entityId}`, (v) => v.name === name);
    assert.equal(view.entityType, 'readModel');
    assert.equal(view.modelId, modelId);
    // F7: the catalog stamps the default mode on read-model definitions.
    assert.deepEqual(view.definition, {
      fields: [{ fieldName: 'total', fieldType: 'money' }],
      mode: 'projected',
    });
  });

  it('defines a live read model and switches mode via the fields update (F7)', async () => {
    const modelId = uuid();
    const entityId = uuid();
    const name = `Export Snapshot ${tag()}`;
    assert.equal(
      (
        await postJson('/api/read-models', {
          modelId,
          entityId,
          name,
          fields: [{ fieldName: 'entities', fieldType: 'json', derived: true }],
          mode: 'live',
        })
      ).status,
      200,
    );
    const view = await pollEntity(
      `/api/read-models/${entityId}`,
      (v) => v.definition?.mode === 'live',
    );
    assert.deepEqual(view.definition, {
      fields: [{ fieldName: 'entities', fieldType: 'json', derived: true }],
      mode: 'live',
    });

    assert.equal(
      (await putJson(`/api/read-models/${entityId}/fields`, { fields: [], mode: 'projected' }))
        .status,
      200,
    );
    await pollEntity(
      `/api/read-models/${entityId}`,
      (v) => v.definition?.mode === 'projected',
    );
  });

  it('rejects an invalid read-model mode (F7)', async () => {
    const res = await postJson('/api/read-models', {
      modelId: uuid(),
      entityId: uuid(),
      name: `Bad Mode ${tag()}`,
      fields: [],
      mode: 'sideways',
    });
    assert.equal(res.status, 400);
  });

  it('defines a wireframe, updates its content, catalog shows the latest', async () => {
    const modelId = uuid();
    const entityId = uuid();
    const name = `Entry Form ${tag()}`;
    assert.equal(
      (
        await postJson('/api/wireframes', { modelId, entityId, name, content: 'v1' })
      ).status,
      200,
    );
    await pollEntity(`/api/wireframes/${entityId}`, (v) => v.definition?.content === 'v1');

    assert.equal(
      (await putJson(`/api/wireframes/${entityId}/content`, { content: 'v2' })).status,
      200,
    );
    const view = await pollEntity(
      `/api/wireframes/${entityId}`,
      (v) => v.definition?.content === 'v2',
    );
    assert.equal(view.entityType, 'wireframe');
  });

  it('defines an external business fact and reads it back typed', async () => {
    const modelId = uuid();
    const entityId = uuid();
    const name = `Bank Statement Received ${tag()}`;
    assert.equal(
      (
        await postJson('/api/external-business-facts', {
          modelId,
          entityId,
          name,
          fields: [{ fieldName: 'statementJson', fieldType: 'json' }],
        })
      ).status,
      200,
    );
    const view = await pollEntity(
      `/api/external-business-facts/${entityId}`,
      (v) => v.name === name,
    );
    assert.equal(view.entityType, 'externalBusinessFact');
    assert.deepEqual(view.definition, {
      fields: [{ fieldName: 'statementJson', fieldType: 'json' }],
    });
  });

  it('enforces the per-model cross-type namespace on the NEW types (G-C2)', async () => {
    const modelId = uuid();
    const name = `Shared Name ${tag()}`;
    // readModel claims the name in this model...
    assert.equal(
      (
        await postJson('/api/read-models', { modelId, entityId: uuid(), name, fields: [] })
      ).status,
      200,
    );
    // ...a wireframe in the SAME model collides (409)...
    assert.equal(
      (
        await postJson('/api/wireframes', { modelId, entityId: uuid(), name, content: '' })
      ).status,
      409,
    );
    // ...an external fact in the SAME model collides too...
    assert.equal(
      (
        await postJson('/api/external-business-facts', {
          modelId,
          entityId: uuid(),
          name,
          fields: [],
        })
      ).status,
      409,
    );
    // ...but the SAME name in a DIFFERENT model is free (per-model namespace).
    assert.equal(
      (
        await postJson('/api/wireframes', {
          modelId: uuid(),
          entityId: uuid(),
          name,
          content: '',
        })
      ).status,
      200,
    );
  });
});
