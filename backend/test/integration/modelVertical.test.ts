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
 * End-to-end test for the model (root) vertical: create / rename / archive a
 * model through the real app + real Postgres, reading it back through the async
 * `models` read model. The GET is eventually consistent → assertions POLL until
 * the projection catches up.
 *
 * These are the Flow 0 GWT scenarios (spec/em-scenarios-results.md) at the API
 * level. Runs under `node --test` (testcontainers' lifecycle hangs under Bun).
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

const putJson = (path: string, body: unknown) =>
  jar.fetch(path, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

type ModelView = {
  _id: string;
  name: string;
  archived: boolean;
  sliceCount: number;
};

/** Poll GET /api/models until `predicate` holds (projection catch-up), else throw. */
const pollModels = async (
  predicate: (ms: ModelView[]) => boolean,
  { tries = 50, delay = 100 } = {},
): Promise<ModelView[]> => {
  for (let i = 0; i < tries; i++) {
    const res = await jar.fetch('/api/models');
    if (res.status === 200) {
      const body = (await res.json()) as ModelView[];
      if (predicate(body)) return body;
    }
    await sleep(delay);
  }
  throw new Error('pollModels: predicate not satisfied');
};

describe('model vertical (create / rename / archive + models read model)', () => {
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

  it('creates a model (server-generated id) and lists it', async () => {
    const name = `Budgeting-${tag()}`;
    const res = await postJson('/api/models', { name });
    const body = await res.text();
    assert.equal(res.status, 200, body);
    const { modelId } = JSON.parse(body) as { modelId: string };
    assert.ok(modelId, 'server returns a generated modelId');

    const list = await pollModels((ms) =>
      ms.some((m) => m._id === modelId && m.name === name),
    );
    const found = list.find((m) => m._id === modelId);
    assert.equal(found?.archived, false);
    assert.equal(found?.sliceCount, 0); // F0: 0 until the slice vertical (S1)
  });

  it('rejects a blank name (400)', async () => {
    assert.equal((await postJson('/api/models', { name: '   ' })).status, 400);
    assert.equal((await postJson('/api/models', {})).status, 400);
  });

  it('renames a model and the list reflects it', async () => {
    const { modelId } = (await (await postJson('/api/models', {
      name: `M-${tag()}`,
    })).json()) as { modelId: string };
    await pollModels((ms) => ms.some((m) => m._id === modelId));

    const newName = `Renamed-${tag()}`;
    assert.equal((await putJson(`/api/models/${modelId}/name`, { name: newName })).status, 200);
    await pollModels((ms) => ms.some((m) => m._id === modelId && m.name === newName));
  });

  it('archives a model, drops it from the active list, rejects re-archive (409)', async () => {
    const { modelId } = (await (await postJson('/api/models', {
      name: `A-${tag()}`,
    })).json()) as { modelId: string };
    await pollModels((ms) => ms.some((m) => m._id === modelId));

    assert.equal((await jar.fetch(`/api/models/${modelId}`, { method: 'DELETE' })).status, 200);
    await pollModels((ms) => ms.every((m) => m._id !== modelId));

    // Re-archive is a within-stream conflict (read off the stream, not the RM) → 409, deterministic.
    assert.equal((await jar.fetch(`/api/models/${modelId}`, { method: 'DELETE' })).status, 409);
  });
});
