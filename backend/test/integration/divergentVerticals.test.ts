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
 * End-to-end tests for the divergent catalog verticals E6 (automation,
 * triggerConfig + cross-entity ref pre-check) and E7 (translation, mapping).
 * Both share the per-model `entity_names` namespace with all other types.
 * Runs under `node --test`.
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

const poll = async <T>(
  path: string,
  predicate: (v: T) => boolean,
  { tries = 50, delay = 100 } = {},
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

type EntityView = {
  _id: string;
  entityType: string;
  name: string;
  definition?: Record<string, unknown>;
  archived: boolean;
};

describe('divergent verticals E6/E7 (automation, translation)', () => {
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

  it('defines an automation with valid refs, reconfigures it, reads triggerConfig back', async () => {
    const modelId = uuid();
    const rmId = uuid();
    const cmdId = uuid();
    const autoId = uuid();
    const t = tag();

    assert.equal(
      (
        await postJson('/api/read-models', {
          modelId,
          entityId: rmId,
          name: `LowStock-${t}`,
          fields: [],
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await postJson('/api/commands', {
          modelId,
          entityId: cmdId,
          name: `Reorder-${t}`,
          fields: [],
        })
      ).status,
      200,
    );
    // Refs are checked against the catalog — wait for it to catch up.
    await poll<EntityView>(`/api/read-models/${rmId}`, (v) => v._id === rmId);
    await poll<EntityView>(`/api/commands/${cmdId}`, (v) => v._id === cmdId);

    const create = await postJson('/api/automations', {
      modelId,
      entityId: autoId,
      name: `RestockBot-${t}`,
      triggerConfig: {
        triggerType: 'fact',
        monitoredReadModelId: rmId,
        issuedCommandId: cmdId,
      },
    });
    assert.equal(create.status, 200, await create.text());

    const view = await poll<EntityView>(`/api/automations/${autoId}`, (v) => v._id === autoId);
    assert.equal(view.entityType, 'automation');
    assert.deepEqual(view.definition, {
      triggerConfig: {
        triggerType: 'fact',
        monitoredReadModelId: rmId,
        issuedCommandId: cmdId,
      },
    });

    // Reconfigure (G3) — full replace.
    assert.equal(
      (
        await putJson(`/api/automations/${autoId}/trigger-config`, {
          triggerConfig: { triggerType: 'timer' },
        })
      ).status,
      200,
    );
    await poll<EntityView>(
      `/api/automations/${autoId}`,
      (v) =>
        (v.definition as { triggerConfig?: { triggerType?: string } })?.triggerConfig
          ?.triggerType === 'timer',
    );
  });

  it('rejects automation refs that are missing, wrong-typed, or cross-model (422)', async () => {
    const modelId = uuid();
    const factId = uuid();
    const otherModelRm = uuid();
    const t = tag();

    assert.equal(
      (
        await postJson('/api/business-facts', {
          modelId,
          entityId: factId,
          name: `Fact-${t}`,
          fields: [],
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await postJson('/api/read-models', {
          modelId: uuid(), // a different model
          entityId: otherModelRm,
          name: `Foreign-${t}`,
          fields: [],
        })
      ).status,
      200,
    );
    await poll<EntityView>(`/api/business-facts/${factId}`, (v) => v._id === factId);
    await poll<EntityView>(`/api/read-models/${otherModelRm}`, (v) => v._id === otherModelRm);

    // Missing ref.
    assert.equal(
      (
        await postJson('/api/automations', {
          modelId,
          entityId: uuid(),
          name: `A1-${t}`,
          triggerConfig: { triggerType: 'fact', monitoredReadModelId: uuid() },
        })
      ).status,
      422,
    );
    // Wrong type (a fact is not a read model).
    assert.equal(
      (
        await postJson('/api/automations', {
          modelId,
          entityId: uuid(),
          name: `A2-${t}`,
          triggerConfig: { triggerType: 'fact', monitoredReadModelId: factId },
        })
      ).status,
      422,
    );
    // Cross-model ref (G-C8).
    assert.equal(
      (
        await postJson('/api/automations', {
          modelId,
          entityId: uuid(),
          name: `A3-${t}`,
          triggerConfig: { triggerType: 'fact', monitoredReadModelId: otherModelRm },
        })
      ).status,
      422,
    );
  });

  it('defines a translation, updates its mapping, reads it back', async () => {
    const modelId = uuid();
    const trId = uuid();
    const t = tag();

    assert.equal(
      (
        await postJson('/api/translations', {
          modelId,
          entityId: trId,
          name: `OrderImport-${t}`,
          mapping: {
            direction: 'inbound',
            pairs: [{ externalField: 'sku', internalField: 'productId' }],
          },
        })
      ).status,
      200,
    );

    const view = await poll<EntityView>(`/api/translations/${trId}`, (v) => v._id === trId);
    assert.equal(view.entityType, 'translation');
    assert.deepEqual(view.definition, {
      mapping: {
        direction: 'inbound',
        pairs: [{ externalField: 'sku', internalField: 'productId' }],
      },
    });

    assert.equal(
      (
        await putJson(`/api/translations/${trId}/mapping`, {
          mapping: { direction: 'outbound', pairs: [] },
        })
      ).status,
      200,
    );
    await poll<EntityView>(
      `/api/translations/${trId}`,
      (v) =>
        (v.definition as { mapping?: { direction?: string } })?.mapping?.direction ===
        'outbound',
    );
  });

  it('automation/translation names share the per-model entity namespace (F1b)', async () => {
    const modelId = uuid();
    const t = tag();
    assert.equal(
      (
        await postJson('/api/business-facts', {
          modelId,
          entityId: uuid(),
          name: `Clash-${t}`,
          fields: [],
        })
      ).status,
      200,
    );
    // Same name as the fact, same model → 409 via entity_names rollback.
    assert.equal(
      (
        await postJson('/api/automations', {
          modelId,
          entityId: uuid(),
          name: `Clash-${t}`,
          triggerConfig: { triggerType: 'timer' },
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await postJson('/api/translations', {
          modelId,
          entityId: uuid(),
          name: `Clash-${t}`,
          mapping: { direction: 'inbound', pairs: [] },
        })
      ).status,
      409,
    );
    // Different model → free.
    assert.equal(
      (
        await postJson('/api/translations', {
          modelId: uuid(),
          entityId: uuid(),
          name: `Clash-${t}`,
          mapping: { direction: 'inbound', pairs: [] },
        })
      ).status,
      200,
    );
  });
});
