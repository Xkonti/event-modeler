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
 * End-to-end test for the modeling vertical: create entities, place them on a
 * slice, draw a relation, and read it all back through the canvas GET — exercising
 * the per-entity write streams AND the async read-model projections together.
 *
 * Reuses `_authHarness` (real Postgres + real app) and additionally starts the
 * read-model consumer (`startConsumers`), since the auth suites don't need it.
 * The GET is eventually consistent, so assertions POLL until projections catch up.
 *
 * Runs under `node --test` (testcontainers' lifecycle hangs under Bun).
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

type SliceView = {
  _id: string;
  name?: string;
  placements: {
    entityId: string;
    x: number;
    y: number;
    name: string;
    entityType: string;
  }[];
  relations: { _id: string; fromId: string; toId: string; kind: string }[];
};

/** Poll the canvas GET until `predicate` holds (projection catch-up), else throw. */
const pollSlice = async (
  sliceId: string,
  predicate: (v: SliceView) => boolean,
  { tries = 50, delay = 100 } = {},
): Promise<SliceView> => {
  for (let i = 0; i < tries; i++) {
    const res = await jar.fetch(`/api/slices/${sliceId}`);
    if (res.status === 200) {
      const body = (await res.json()) as SliceView;
      if (predicate(body)) return body;
    }
    await sleep(delay);
  }
  throw new Error(`pollSlice: predicate not satisfied for ${sliceId}`);
};

describe('modeling vertical (slice + placements + relations)', () => {
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

  it('places entities on a slice and reads them back joined with the catalog', async () => {
    const sliceId = uuid();
    const factId = uuid();
    const commandId = uuid();
    const t = tag();

    assert.equal(
      (await postJson('/api/slices', { entityId: sliceId, name: 'Checkout' }))
        .status,
      200,
    );
    assert.equal(
      (
        await postJson('/api/business-facts', {
          entityId: factId,
          name: `OrderPlaced-${t}`,
          context: 'Ordering',
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await postJson('/api/commands', {
          entityId: commandId,
          name: `PlaceOrder-${t}`,
          context: 'Ordering',
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await postJson(`/api/slices/${sliceId}/placements`, {
          placedEntityId: commandId,
          x: 10,
          y: 20,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await postJson(`/api/slices/${sliceId}/placements`, {
          placedEntityId: factId,
          x: 200,
          y: 20,
        })
      ).status,
      200,
    );

    // Poll until both placements resolve through the catalog join.
    const view = await pollSlice(sliceId, (v) => v.placements.length === 2);
    const types = view.placements.map((p) => p.entityType).sort();
    assert.deepEqual(types, ['businessFact', 'command']);
    const cmd = view.placements.find((p) => p.entityId === commandId);
    assert.equal(cmd?.entityType, 'command');
    assert.equal(cmd?.x, 10);
  });

  it('draws a valid command→businessFact relation and renders it as an edge', async () => {
    const sliceId = uuid();
    const factId = uuid();
    const commandId = uuid();
    const relId = uuid();
    const t = tag();

    await postJson('/api/slices', { entityId: sliceId, name: 'Rel' });
    await postJson('/api/business-facts', {
      entityId: factId,
      name: `Fact-${t}`,
      context: 'C',
    });
    await postJson('/api/commands', {
      entityId: commandId,
      name: `Cmd-${t}`,
      context: 'C',
    });
    await postJson(`/api/slices/${sliceId}/placements`, {
      placedEntityId: commandId,
      x: 0,
      y: 0,
    });
    await postJson(`/api/slices/${sliceId}/placements`, {
      placedEntityId: factId,
      x: 100,
      y: 0,
    });
    // Ensure endpoints are in the catalog before drawing (avoids spurious 422).
    await pollSlice(sliceId, (v) => v.placements.length === 2);

    const drawRes = await postJson('/api/relations', {
      entityId: relId,
      fromId: commandId,
      toId: factId,
    });
    assert.equal(drawRes.status, 200, await drawRes.text());

    const view = await pollSlice(sliceId, (v) => v.relations.length === 1);
    assert.equal(view.relations[0]?.kind, 'produces');
    assert.equal(view.relations[0]?.fromId, commandId);
    assert.equal(view.relations[0]?.toId, factId);
  });

  it('rejects an invalid type-pair (422) and a missing endpoint (422)', async () => {
    const factId = uuid();
    const commandId = uuid();
    const sliceId = uuid();
    const t = tag();
    await postJson('/api/slices', { entityId: sliceId });
    await postJson('/api/business-facts', {
      entityId: factId,
      name: `F-${t}`,
      context: 'C',
    });
    await postJson('/api/commands', {
      entityId: commandId,
      name: `C-${t}`,
      context: 'C',
    });
    await postJson(`/api/slices/${sliceId}/placements`, {
      placedEntityId: factId,
      x: 0,
      y: 0,
    });
    await postJson(`/api/slices/${sliceId}/placements`, {
      placedEntityId: commandId,
      x: 0,
      y: 0,
    });
    await pollSlice(sliceId, (v) => v.placements.length === 2);

    // businessFact → command is NOT a valid directed pair.
    const wrongPair = await postJson('/api/relations', {
      entityId: uuid(),
      fromId: factId,
      toId: commandId,
    });
    assert.equal(wrongPair.status, 422);

    // Endpoint that does not exist in the catalog.
    const missing = await postJson('/api/relations', {
      entityId: uuid(),
      fromId: commandId,
      toId: uuid(),
    });
    assert.equal(missing.status, 422);
  });

  it('rejects drawing the same relation id twice (409)', async () => {
    const factId = uuid();
    const commandId = uuid();
    const relId = uuid();
    const t = tag();
    const sliceId = uuid();
    await postJson('/api/slices', { entityId: sliceId });
    await postJson('/api/business-facts', {
      entityId: factId,
      name: `F2-${t}`,
      context: 'C',
    });
    await postJson('/api/commands', {
      entityId: commandId,
      name: `C2-${t}`,
      context: 'C',
    });
    await postJson(`/api/slices/${sliceId}/placements`, {
      placedEntityId: factId,
      x: 0,
      y: 0,
    });
    await postJson(`/api/slices/${sliceId}/placements`, {
      placedEntityId: commandId,
      x: 0,
      y: 0,
    });
    await pollSlice(sliceId, (v) => v.placements.length === 2);

    const first = await postJson('/api/relations', {
      entityId: relId,
      fromId: commandId,
      toId: factId,
    });
    assert.equal(first.status, 200);
    const second = await postJson('/api/relations', {
      entityId: relId,
      fromId: commandId,
      toId: factId,
    });
    assert.equal(second.status, 409);
  });

  it('drops an archived endpoint and its edge from the canvas GET', async () => {
    const sliceId = uuid();
    const factId = uuid();
    const commandId = uuid();
    const relId = uuid();
    const t = tag();
    await postJson('/api/slices', { entityId: sliceId });
    await postJson('/api/business-facts', {
      entityId: factId,
      name: `F3-${t}`,
      context: 'C',
    });
    await postJson('/api/commands', {
      entityId: commandId,
      name: `C3-${t}`,
      context: 'C',
    });
    await postJson(`/api/slices/${sliceId}/placements`, {
      placedEntityId: commandId,
      x: 0,
      y: 0,
    });
    await postJson(`/api/slices/${sliceId}/placements`, {
      placedEntityId: factId,
      x: 100,
      y: 0,
    });
    await pollSlice(sliceId, (v) => v.placements.length === 2);
    assert.equal(
      (
        await postJson('/api/relations', {
          entityId: relId,
          fromId: commandId,
          toId: factId,
        })
      ).status,
      200,
    );
    await pollSlice(sliceId, (v) => v.relations.length === 1);

    // Archive the fact → it + its edge must disappear from the GET.
    assert.equal(
      (await jar.fetch(`/api/business-facts/${factId}`, { method: 'DELETE' }))
        .status,
      200,
    );
    const view = await pollSlice(
      sliceId,
      (v) => v.placements.length === 1 && v.relations.length === 0,
    );
    assert.equal(view.placements[0]?.entityId, commandId);
  });
});
