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
 * End-to-end test for the X1 chunk: context (lane) lifecycle, the per-model
 * lane-name constraint (contexts' own namespace), and lane assignment on
 * business facts (LWW re-assign, clear, cross-model reject). Read models are
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

const defineFact = (modelId: string, entityId: string, name: string) =>
  postJson('/api/business-facts', { modelId, entityId, name, fields: [] });

const defineContext = (modelId: string, contextId: string, name: string) =>
  postJson('/api/contexts', { modelId, contextId, name });

/** Poll a JSON GET until `predicate` holds (projection catch-up), else throw. */
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

type FactView = { _id: string; contextId?: string };
type ContextView = { _id: string; name: string; factCount: number };

describe('context vertical (lanes + assignment, X1)', () => {
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

  it('defines, renames, archives a context through the contexts read model', async () => {
    const modelId = uuid();
    const contextId = uuid();
    const t = tag();

    assert.equal((await defineContext(modelId, contextId, `Billing-${t}`)).status, 200);
    await poll<ContextView>(`/api/contexts/${contextId}`, (c) => c.name === `Billing-${t}`);

    assert.equal(
      (await putJson(`/api/contexts/${contextId}/name`, { name: `Payments-${t}` })).status,
      200,
    );
    await poll<ContextView>(`/api/contexts/${contextId}`, (c) => c.name === `Payments-${t}`);

    assert.equal((await jar.fetch(`/api/contexts/${contextId}`, { method: 'DELETE' })).status, 200);
    // Archived lanes drop out of the per-model list.
    await poll<ContextView[]>(
      `/api/contexts?modelId=${modelId}`,
      (list) => !list.some((c) => c._id === contextId),
    );
  });

  it('rejects a duplicate lane name in the same model (409), allows it across models', async () => {
    const mA = uuid();
    const mB = uuid();
    const t = tag();
    assert.equal((await defineContext(mA, uuid(), `Sales-${t}`)).status, 200);
    assert.equal((await defineContext(mA, uuid(), `Sales-${t}`)).status, 409);
    assert.equal((await defineContext(mB, uuid(), `Sales-${t}`)).status, 200);
  });

  it('lane name does NOT collide with an entity name (separate namespaces, G-C2)', async () => {
    const modelId = uuid();
    const t = tag();
    assert.equal((await defineFact(modelId, uuid(), `Shared-${t}`)).status, 200);
    assert.equal((await defineContext(modelId, uuid(), `Shared-${t}`)).status, 200);
  });

  it('assigns a lane to a fact (LWW re-assign), clears it, and rejects clear-when-none', async () => {
    const modelId = uuid();
    const factId = uuid();
    const cA = uuid();
    const cB = uuid();
    const t = tag();

    assert.equal((await defineFact(modelId, factId, `OrderPlaced-${t}`)).status, 200);
    assert.equal((await defineContext(modelId, cA, `LaneA-${t}`)).status, 200);
    assert.equal((await defineContext(modelId, cB, `LaneB-${t}`)).status, 200);

    // Wait for both read models so the cross-stream pre-check passes.
    await poll<FactView>(`/api/business-facts/${factId}`, (f) => f._id === factId);
    await poll<ContextView>(`/api/contexts/${cA}`, (c) => c._id === cA);
    await poll<ContextView>(`/api/contexts/${cB}`, (c) => c._id === cB);

    assert.equal((await putJson(`/api/business-facts/${factId}/context`, { contextId: cA })).status, 200);
    await poll<FactView>(`/api/business-facts/${factId}`, (f) => f.contextId === cA);

    // factCount derives from the catalog.
    await poll<ContextView>(`/api/contexts/${cA}`, (c) => c.factCount === 1);

    // LWW re-assign — no Clear needed first (E1).
    assert.equal((await putJson(`/api/business-facts/${factId}/context`, { contextId: cB })).status, 200);
    await poll<FactView>(`/api/business-facts/${factId}`, (f) => f.contextId === cB);
    await poll<ContextView>(`/api/contexts/${cA}`, (c) => c.factCount === 0);
    await poll<ContextView>(`/api/contexts/${cB}`, (c) => c.factCount === 1);

    // Clear, then clearing again rejects (no lane assigned — X1 lean).
    assert.equal(
      (await jar.fetch(`/api/business-facts/${factId}/context`, { method: 'DELETE' })).status,
      200,
    );
    await poll<FactView>(`/api/business-facts/${factId}`, (f) => f.contextId === undefined);
    assert.equal(
      (await jar.fetch(`/api/business-facts/${factId}/context`, { method: 'DELETE' })).status,
      409,
    );
  });

  it('rejects assigning a lane from a different model (422, G-C8)', async () => {
    const mA = uuid();
    const mB = uuid();
    const factId = uuid();
    const foreignContext = uuid();
    const t = tag();

    assert.equal((await defineFact(mA, factId, `Fact-${t}`)).status, 200);
    assert.equal((await defineContext(mB, foreignContext, `Foreign-${t}`)).status, 200);
    await poll<FactView>(`/api/business-facts/${factId}`, (f) => f._id === factId);
    await poll<ContextView>(`/api/contexts/${foreignContext}`, (c) => c._id === foreignContext);

    const res = await putJson(`/api/business-facts/${factId}/context`, {
      contextId: foreignContext,
    });
    assert.equal(res.status, 422);
  });

  it('assigns a lane to an EXTERNAL fact via the same path (O5)', async () => {
    const modelId = uuid();
    const extId = uuid();
    const contextId = uuid();
    const t = tag();

    assert.equal(
      (
        await postJson('/api/external-business-facts', {
          modelId,
          entityId: extId,
          name: `ExtFact-${t}`,
          fields: [],
        })
      ).status,
      200,
    );
    assert.equal((await defineContext(modelId, contextId, `ExtLane-${t}`)).status, 200);
    await poll<FactView>(`/api/external-business-facts/${extId}`, (f) => f._id === extId);
    await poll<ContextView>(`/api/contexts/${contextId}`, (c) => c._id === contextId);

    assert.equal(
      (await putJson(`/api/external-business-facts/${extId}/context`, { contextId })).status,
      200,
    );
    await poll<FactView>(`/api/external-business-facts/${extId}`, (f) => f.contextId === contextId);
  });
});
