import type { PostgreSQLEventStoreConsumer } from '@event-driven-io/emmett-postgresql';
import { IllegalStateError } from '@event-driven-io/emmett';
import type { AppEventStore } from '../eventStore.ts';
import { documents } from '../db.ts';
import type { SlicePlacementsDoc } from '../read/slicePlacements.ts';
import type { RelationEdgeDoc } from '../read/relationsGraph.ts';
import { handleSlice } from '../domain/slice/commandHandler.ts';
import { decide as decideSlice } from '../domain/slice/slice.ts';
import { handleRelation } from '../domain/relation/commandHandler.ts';
import { decide as decideRelation } from '../domain/relation/relation.ts';

/**
 * A1 — the entity-archive cascade (E4 decision, em-scenarios). A BACKGROUND
 * reactor, not request handling: when any catalog entity is archived, fan-out
 * remove every placement and relation that references it, so the store/export
 * stay tidy (archive is terminal — nothing rebuilds on it). The canvas GET's
 * ghost-drop remains only as the render-time safety net for the eventual-
 * consistency window this reactor runs in.
 *
 * Targets are found via the async read models (slice_placements,
 * relations_graph) fed by the SAME consumer — their checkpoints may trail this
 * reactor's by a beat, so the handler waits a short settle delay before
 * reading. Removal commands go through the regular deciders; "not placed" /
 * "not drawn" rejections mean someone (or a previous run) already cleaned up —
 * the cascade is idempotent and swallows exactly those.
 *
 * Cascade-driven RemoveRelation does NOT prompt about dependent scenarios
 * (the A1 prompt is user-driven only); affected rules simply derive
 * `outOfSync` at read time.
 */
const ARCHIVE_EVENTS = [
  'BusinessFactArchived',
  'ExternalBusinessFactArchived',
  'CommandArchived',
  'ReadModelArchived',
  'WireframeArchived',
  'AutomationArchived',
  'TranslationArchived',
] as const;

type ArchiveEvent = {
  type: (typeof ARCHIVE_EVENTS)[number];
  data: { modelId: string; entityId: string };
};

const SETTLE_DELAY_MS = 300;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Swallow only the decider's "already cleaned up" rejections (idempotency). */
const ignoreIllegalState = (error: unknown): void => {
  if (error instanceof IllegalStateError) return;
  throw error;
};

export const cascadeArchivedEntity = async (
  eventStore: AppEventStore,
  modelId: string,
  entityId: string,
): Promise<void> => {
  // Let the placement/relation projectors (same consumer, separate
  // checkpoints) catch up to the archive position before reading them.
  await sleep(SETTLE_DELAY_MS);

  const slices = await documents
    .collection<SlicePlacementsDoc>('slice_placements')
    .find({ modelId });
  const placedOn = slices.filter(
    (s) => !s.archived && s.placements.some((p) => p.placedEntityId === entityId),
  );
  for (const slice of placedOn) {
    await handleSlice(eventStore, slice._id, (state) =>
      decideSlice(
        {
          type: 'RemoveEntityFromSlice',
          data: { sliceId: slice._id, placedEntityId: entityId },
        },
        state,
      ),
    ).catch(ignoreIllegalState);
  }

  const edges = await documents
    .collection<RelationEdgeDoc>('relations_graph')
    .find({ modelId });
  const touching = edges.filter((e) => e.fromId === entityId || e.toId === entityId);
  for (const edge of touching) {
    await handleRelation(eventStore, edge._id, (state) =>
      decideRelation({ type: 'RemoveRelation', data: { relationId: edge._id } }, state),
    ).catch(ignoreIllegalState);
  }
};

/** Register the cascade reactor on the shared background consumer. */
export const registerArchiveCascade = (
  consumer: PostgreSQLEventStoreConsumer,
  eventStore: AppEventStore,
): void => {
  consumer.reactor<ArchiveEvent>({
    processorId: 'reactor:archive_cascade',
    canHandle: [...ARCHIVE_EVENTS],
    // Same policy as the projectors: wait out a lock a previous (ungracefully
    // killed) instance hasn't released, instead of dying on `fail`.
    lock: {
      acquisitionPolicy: {
        type: 'retry',
        retries: 30,
        minTimeout: 500,
        maxTimeout: 2000,
      },
    },
    eachMessage: async (event) => {
      const { modelId, entityId } = event.data;
      try {
        await cascadeArchivedEntity(eventStore, modelId, entityId);
      } catch (error) {
        // Re-throw: the reactor is at-least-once, so a transient failure
        // (concurrency conflict, DB hiccup) gets re-delivered instead of
        // advancing the checkpoint past a half-done cascade and silently
        // leaking a dangling placement/relation. Benign "already cleaned up"
        // rejections were swallowed per-command (ignoreIllegalState).
        console.error('[archiveCascade] cascade failed, will retry:', error);
        throw error;
      }
    },
  });
};
