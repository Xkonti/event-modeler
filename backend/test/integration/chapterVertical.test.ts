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
 * End-to-end test for the C1 chunk: chapter lifecycle, the per-model
 * chapter-name constraint (chapters' own namespace, separate from entity AND
 * context names), slice→chapter assignment on the slice stream (LWW re-assign,
 * clear, clear-when-none reject, cross-model reject), and the band read
 * (`/models/:id/chapters` creation order + `chapterId` on the slice list).
 * Read models are eventually consistent → assertions POLL. Runs under
 * `node --test`.
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

const defineChapter = (modelId: string, chapterId: string, name: string) =>
  postJson('/api/chapters', { modelId, chapterId, name });

const defineSlice = (modelId: string, sliceId: string, name: string) =>
  postJson('/api/slices', { modelId, sliceId, name });

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

type ChapterView = { _id: string; name: string; archived: boolean };
type SliceListItem = { _id: string; name?: string; chapterId?: string };

describe('chapter vertical (band + slice assignment, C1)', () => {
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

  it('defines, renames, archives a chapter; band lists in creation order', async () => {
    const modelId = uuid();
    const chA = uuid();
    const chB = uuid();
    const t = tag();

    assert.equal((await defineChapter(modelId, chA, `Setup-${t}`)).status, 200);
    assert.equal((await defineChapter(modelId, chB, `Catalog-${t}`)).status, 200);
    await poll<ChapterView>(`/api/chapters/${chA}`, (c) => c.name === `Setup-${t}`);

    // Band = creation order.
    await poll<SliceListItem[]>(
      `/api/models/${modelId}/chapters`,
      (list) => list.length === 2 && list[0]?._id === chA && list[1]?._id === chB,
    );

    assert.equal(
      (await putJson(`/api/chapters/${chA}/name`, { name: `Intro-${t}` })).status,
      200,
    );
    await poll<ChapterView>(`/api/chapters/${chA}`, (c) => c.name === `Intro-${t}`);

    assert.equal((await jar.fetch(`/api/chapters/${chA}`, { method: 'DELETE' })).status, 200);
    // Archived chapters drop out of the band.
    await poll<SliceListItem[]>(
      `/api/models/${modelId}/chapters`,
      (list) => !list.some((c) => c._id === chA),
    );
  });

  it('rejects a duplicate chapter name in the same model (409), allows it across models', async () => {
    const mA = uuid();
    const mB = uuid();
    const t = tag();
    assert.equal((await defineChapter(mA, uuid(), `Rules-${t}`)).status, 200);
    assert.equal((await defineChapter(mA, uuid(), `Rules-${t}`)).status, 409);
    assert.equal((await defineChapter(mB, uuid(), `Rules-${t}`)).status, 200);
  });

  it('chapter name does NOT collide with entity or lane names (separate namespaces, G-C2)', async () => {
    const modelId = uuid();
    const t = tag();
    assert.equal(
      (
        await postJson('/api/business-facts', {
          modelId,
          entityId: uuid(),
          name: `Shared-${t}`,
          fields: [],
        })
      ).status,
      200,
    );
    assert.equal(
      (await postJson('/api/contexts', { modelId, contextId: uuid(), name: `Shared-${t}` }))
        .status,
      200,
    );
    assert.equal((await defineChapter(modelId, uuid(), `Shared-${t}`)).status, 200);
  });

  it('assigns a slice to a chapter (LWW re-assign), clears it, rejects clear-when-none', async () => {
    const modelId = uuid();
    const sliceId = uuid();
    const chA = uuid();
    const chB = uuid();
    const t = tag();

    assert.equal((await defineSlice(modelId, sliceId, `Record-${t}`)).status, 200);
    assert.equal((await defineChapter(modelId, chA, `BandA-${t}`)).status, 200);
    assert.equal((await defineChapter(modelId, chB, `BandB-${t}`)).status, 200);

    // Wait for both read models so the cross-stream pre-check passes.
    await poll<{ name?: string }>(`/api/slices/${sliceId}`, (s) => s.name === `Record-${t}`);
    await poll<ChapterView>(`/api/chapters/${chA}`, (c) => c._id === chA);
    await poll<ChapterView>(`/api/chapters/${chB}`, (c) => c._id === chB);

    assert.equal((await putJson(`/api/slices/${sliceId}/chapter`, { chapterId: chA })).status, 200);
    await poll<SliceListItem[]>(
      `/api/models/${modelId}/slices`,
      (list) => list.find((s) => s._id === sliceId)?.chapterId === chA,
    );

    // LWW re-assign — no Clear needed first (E1 mirror).
    assert.equal((await putJson(`/api/slices/${sliceId}/chapter`, { chapterId: chB })).status, 200);
    await poll<SliceListItem[]>(
      `/api/models/${modelId}/slices`,
      (list) => list.find((s) => s._id === sliceId)?.chapterId === chB,
    );

    // Clear, then clearing again rejects (no chapter assigned).
    assert.equal(
      (await jar.fetch(`/api/slices/${sliceId}/chapter`, { method: 'DELETE' })).status,
      200,
    );
    await poll<SliceListItem[]>(
      `/api/models/${modelId}/slices`,
      (list) => list.find((s) => s._id === sliceId)?.chapterId === undefined,
    );
    assert.equal(
      (await jar.fetch(`/api/slices/${sliceId}/chapter`, { method: 'DELETE' })).status,
      409,
    );
  });

  it('rejects assigning a chapter from a different model (422, G-C8) and an archived chapter', async () => {
    const mA = uuid();
    const mB = uuid();
    const sliceId = uuid();
    const foreignChapter = uuid();
    const doomedChapter = uuid();
    const t = tag();

    assert.equal((await defineSlice(mA, sliceId, `Slice-${t}`)).status, 200);
    assert.equal((await defineChapter(mB, foreignChapter, `Foreign-${t}`)).status, 200);
    assert.equal((await defineChapter(mA, doomedChapter, `Doomed-${t}`)).status, 200);
    await poll<{ name?: string }>(`/api/slices/${sliceId}`, (s) => s.name === `Slice-${t}`);
    await poll<ChapterView>(`/api/chapters/${foreignChapter}`, (c) => c._id === foreignChapter);
    await poll<ChapterView>(`/api/chapters/${doomedChapter}`, (c) => c._id === doomedChapter);

    assert.equal(
      (await putJson(`/api/slices/${sliceId}/chapter`, { chapterId: foreignChapter })).status,
      422,
    );

    assert.equal(
      (await jar.fetch(`/api/chapters/${doomedChapter}`, { method: 'DELETE' })).status,
      200,
    );
    await poll<ChapterView>(`/api/chapters/${doomedChapter}`, (c) => c.archived);
    assert.equal(
      (await putJson(`/api/slices/${sliceId}/chapter`, { chapterId: doomedChapter })).status,
      422,
    );
  });

  it('exports chapters + slice chapterId (C1 in model_export)', async () => {
    const modelId = (await (await postJson('/api/models', { name: `Chaptered-${tag()}` })).json())
      .modelId as string;
    const sliceId = uuid();
    const chapterId = uuid();
    const t = tag();

    assert.equal((await defineChapter(modelId, chapterId, `Story-${t}`)).status, 200);
    assert.equal((await defineSlice(modelId, sliceId, `Step-${t}`)).status, 200);
    await poll<ChapterView>(`/api/chapters/${chapterId}`, (c) => c._id === chapterId);
    await poll<{ name?: string }>(`/api/slices/${sliceId}`, (s) => s.name === `Step-${t}`);
    assert.equal(
      (await putJson(`/api/slices/${sliceId}/chapter`, { chapterId })).status,
      200,
    );

    await poll<{ chapters: Array<{ id: string }>; slices: Array<{ id: string; chapterId?: string }> }>(
      `/api/models/${modelId}/export`,
      (e) =>
        e.chapters.some((c) => c.id === chapterId) &&
        e.slices.find((s) => s.id === sliceId)?.chapterId === chapterId,
    );
  });
});
