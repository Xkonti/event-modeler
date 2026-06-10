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
 * End-to-end test for the modeling vertical after the S1/R1 rebuilds: snap-slot
 * placements (F3), stored relation kinds + the duplicate-pair constraint (F4 /
 * E3), the lane join (X1→S2), sliceCount on the models read model, and the A1
 * archive cascade. Read models are eventually consistent → assertions POLL.
 * Runs under `node --test` (testcontainers hangs under Bun).
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

const defineCmd = (modelId: string, entityId: string, name: string) =>
  postJson('/api/commands', { modelId, entityId, name, fields: [] });

const defineSlice = (modelId: string, sliceId: string, name?: string) =>
  postJson('/api/slices', { modelId, sliceId, name });

const place = (sliceId: string, placedEntityId: string) =>
  postJson(`/api/slices/${sliceId}/placements`, { placedEntityId });

const drawRelation = (
  modelId: string,
  relationId: string,
  fromId: string,
  toId: string,
  kind: string,
) => postJson('/api/relations', { modelId, relationId, fromId, toId, kind });

type Placement = {
  entityId: string;
  entityType: string;
  slotRole: string;
  slot?: number;
  lane?: string;
  name: string;
};
type SliceView = {
  _id: string;
  modelId: string;
  name?: string;
  placements: Placement[];
  relations: { _id: string; fromId: string; toId: string; kind: string }[];
  scenarios: { _id: string; anchorId: string }[];
};

/** Poll a JSON GET until `predicate` holds (projection catch-up), else throw. */
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

const pollSlice = (sliceId: string, predicate: (v: SliceView) => boolean) =>
  poll<SliceView>(`/api/slices/${sliceId}`, predicate);

/** Wait until the catalog serves the entity (placement/relation pre-checks read it). */
const awaitCataloged = (path: string, id: string) =>
  poll<{ _id: string }>(`${path}/${id}`, (v) => v._id === id);

describe('modeling vertical (slices, snap-slots, relations, cascade)', () => {
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

  it('places entities into computed bands with appended slots (F3)', async () => {
    const modelId = uuid();
    const sliceId = uuid();
    const factA = uuid();
    const factB = uuid();
    const commandId = uuid();
    const t = tag();

    assert.equal((await defineSlice(modelId, sliceId, 'Checkout')).status, 200);
    assert.equal((await defineFact(modelId, factA, `OrderPlaced-${t}`)).status, 200);
    assert.equal((await defineFact(modelId, factB, `OrderPaid-${t}`)).status, 200);
    assert.equal((await defineCmd(modelId, commandId, `PlaceOrder-${t}`)).status, 200);
    await awaitCataloged('/api/business-facts', factA);
    await awaitCataloged('/api/business-facts', factB);
    await awaitCataloged('/api/commands', commandId);
    await pollSlice(sliceId, (v) => v._id === sliceId);

    assert.equal((await place(sliceId, commandId)).status, 200);
    assert.equal((await place(sliceId, factA)).status, 200);
    assert.equal((await place(sliceId, factB)).status, 200);

    const view = await pollSlice(sliceId, (v) => v.placements.length === 3);
    const cmd = view.placements.find((p) => p.entityId === commandId);
    assert.equal(cmd?.slotRole, 'command');
    assert.equal(cmd?.slot, undefined); // single-cardinality → no slot
    const a = view.placements.find((p) => p.entityId === factA);
    const b = view.placements.find((p) => p.entityId === factB);
    assert.equal(a?.slotRole, 'fact');
    assert.equal(a?.slot, 0);
    assert.equal(b?.slot, 1);

    // A second command on the same slice violates band cardinality → 409.
    const command2 = uuid();
    assert.equal((await defineCmd(modelId, command2, `Pay-${t}`)).status, 200);
    await awaitCataloged('/api/commands', command2);
    assert.equal((await place(sliceId, command2)).status, 409);

    // Swap the two facts → slot numbers exchange.
    assert.equal(
      (
        await postJson(`/api/slices/${sliceId}/swaps`, {
          entityIdA: factA,
          entityIdB: factB,
        })
      ).status,
      200,
    );
    const swapped = await pollSlice(
      sliceId,
      (v) => v.placements.find((p) => p.entityId === factA)?.slot === 1,
    );
    assert.equal(swapped.placements.find((p) => p.entityId === factB)?.slot, 0);
  });

  it('rejects placing an entity from a different model (422, G-C8)', async () => {
    const modelId = uuid();
    const sliceId = uuid();
    const foreignFact = uuid();
    const t = tag();
    assert.equal((await defineSlice(modelId, sliceId)).status, 200);
    assert.equal((await defineFact(uuid(), foreignFact, `Foreign-${t}`)).status, 200);
    await awaitCataloged('/api/business-facts', foreignFact);
    await pollSlice(sliceId, (v) => v._id === sliceId);
    assert.equal((await place(sliceId, foreignFact)).status, 422);
  });

  it('renders the lane from the catalog contextId on the canvas (X1→S2)', async () => {
    const modelId = uuid();
    const sliceId = uuid();
    const factId = uuid();
    const contextId = uuid();
    const t = tag();
    assert.equal((await defineSlice(modelId, sliceId)).status, 200);
    assert.equal((await defineFact(modelId, factId, `Laned-${t}`)).status, 200);
    assert.equal(
      (await postJson('/api/contexts', { modelId, contextId, name: `Lane-${t}` })).status,
      200,
    );
    await awaitCataloged('/api/business-facts', factId);
    await poll<{ _id: string }>(`/api/contexts/${contextId}`, (c) => c._id === contextId);
    assert.equal(
      (await putJson(`/api/business-facts/${factId}/context`, { contextId })).status,
      200,
    );
    await pollSlice(sliceId, (v) => v._id === sliceId);
    assert.equal((await place(sliceId, factId)).status, 200);
    await pollSlice(
      sliceId,
      (v) => v.placements.find((p) => p.entityId === factId)?.lane === contextId,
    );
  });

  it('draws a relation with its stored kind, rejects bad pairs/kinds/dups (F4, E3)', async () => {
    const modelId = uuid();
    const sliceId = uuid();
    const factId = uuid();
    const commandId = uuid();
    const relId = uuid();
    const t = tag();

    assert.equal((await defineSlice(modelId, sliceId, 'Rel')).status, 200);
    assert.equal((await defineFact(modelId, factId, `Fact-${t}`)).status, 200);
    assert.equal((await defineCmd(modelId, commandId, `Cmd-${t}`)).status, 200);
    await awaitCataloged('/api/business-facts', factId);
    await awaitCataloged('/api/commands', commandId);
    await pollSlice(sliceId, (v) => v._id === sliceId);
    assert.equal((await place(sliceId, commandId)).status, 200);
    assert.equal((await place(sliceId, factId)).status, 200);

    // Wrong direction (fact → command) → invalid pair.
    assert.equal(
      (await drawRelation(modelId, uuid(), factId, commandId, 'produces')).status,
      422,
    );
    // Right pair, wrong kind label.
    assert.equal(
      (await drawRelation(modelId, uuid(), commandId, factId, 'feeds')).status,
      422,
    );
    // Missing endpoint.
    assert.equal(
      (await drawRelation(modelId, uuid(), commandId, uuid(), 'produces')).status,
      422,
    );

    const drawRes = await drawRelation(modelId, relId, commandId, factId, 'produces');
    assert.equal(drawRes.status, 200, await drawRes.text());

    // Same relation id again → 409 (stream); same (from,to,kind) under a NEW id
    // → 409 via the inline relation_pairs constraint (E3).
    assert.equal(
      (await drawRelation(modelId, relId, commandId, factId, 'produces')).status,
      409,
    );
    assert.equal(
      (await drawRelation(modelId, uuid(), commandId, factId, 'produces')).status,
      409,
    );

    const view = await pollSlice(sliceId, (v) => v.relations.length === 1);
    assert.equal(view.relations[0]?.kind, 'produces');
    assert.equal(view.relations[0]?.fromId, commandId);
    assert.equal(view.relations[0]?.toId, factId);

    // Update meta through the relation PUT; read it back on the relation GET.
    assert.equal(
      (await putJson(`/api/relations/${relId}`, { meta: { note: 'n1' } })).status,
      200,
    );
    await poll<{ meta?: { note?: string } }>(
      `/api/relations/${relId}`,
      (r) => r.meta?.note === 'n1',
    );
  });

  it('counts slices on the models read model (S1)', async () => {
    const createRes = await postJson('/api/models', { name: `Counted-${tag()}` });
    assert.equal(createRes.status, 200);
    const { modelId } = (await createRes.json()) as { modelId: string };
    const sliceId = uuid();

    await poll<{ _id: string }>(`/api/models/${modelId}`, (m) => m._id === modelId);
    assert.equal((await defineSlice(modelId, sliceId, 'First')).status, 200);
    await poll<{ sliceCount: number }>(
      `/api/models/${modelId}`,
      (m) => m.sliceCount === 1,
    );
    assert.equal((await jar.fetch(`/api/slices/${sliceId}`, { method: 'DELETE' })).status, 200);
    await poll<{ sliceCount: number }>(
      `/api/models/${modelId}`,
      (m) => m.sliceCount === 0,
    );
  });

  it('archive cascades: placements and relations are REMOVED, not just hidden (A1/E4)', async () => {
    const modelId = uuid();
    const sliceId = uuid();
    const factId = uuid();
    const commandId = uuid();
    const relId = uuid();
    const t = tag();
    assert.equal((await defineSlice(modelId, sliceId)).status, 200);
    assert.equal((await defineFact(modelId, factId, `F3-${t}`)).status, 200);
    assert.equal((await defineCmd(modelId, commandId, `C3-${t}`)).status, 200);
    await awaitCataloged('/api/business-facts', factId);
    await awaitCataloged('/api/commands', commandId);
    await pollSlice(sliceId, (v) => v._id === sliceId);
    assert.equal((await place(sliceId, commandId)).status, 200);
    assert.equal((await place(sliceId, factId)).status, 200);
    assert.equal(
      (await drawRelation(modelId, relId, commandId, factId, 'produces')).status,
      200,
    );
    await pollSlice(sliceId, (v) => v.relations.length === 1);

    // Archive the fact → the canvas drops it immediately (ghost-drop) AND the
    // cascade reactor issues real RemoveEntityFromSlice / RemoveRelation.
    assert.equal(
      (await jar.fetch(`/api/business-facts/${factId}`, { method: 'DELETE' })).status,
      200,
    );
    await pollSlice(
      sliceId,
      (v) => v.placements.length === 1 && v.relations.length === 0,
    );

    // The cascade's removals land in the read models: where-used goes empty.
    type WhereUsed = { slices: unknown[]; relations: unknown[] };
    await poll<WhereUsed>(
      `/api/entities/${factId}/where-used`,
      (w) => w.slices.length === 0 && w.relations.length === 0,
      { tries: 80, delay: 125 },
    );

    // And the freed (from,to,kind) pair can be drawn again for OTHER entities:
    // re-defining the same fact name proves entity_names freed too.
    assert.equal((await defineFact(modelId, uuid(), `F3-${t}`)).status, 200);
  });
});
