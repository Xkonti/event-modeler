import type { PostgreSQLEventStoreConsumer } from '@event-driven-io/emmett-postgresql';
import { eventStore } from './eventStore.ts';
import { modelsProjection } from './read/models.ts';
import { entityCatalogProjection } from './read/entityCatalog.ts';
import { slicePlacementsProjection } from './read/slicePlacements.ts';
import { relationsGraphProjection } from './read/relationsGraph.ts';

/**
 * Async background consumer that runs read-model projectors with checkpointing.
 * Read models live here (async); constraints live inline in the event store —
 * see notes/constraint-inline-projection-pattern.md.
 *
 * The lock acquisition policy is `retry` so a restarted process waits out a
 * lock the previous (ungracefully killed) instance hasn't released yet, instead
 * of dying with the default `fail` policy.
 */
export const startConsumers = (): PostgreSQLEventStoreConsumer => {
  const consumer = eventStore.consumer();

  // Shared lock policy: `retry` so a restarted process waits out a lock the
  // previous (ungracefully killed) instance hasn't released yet.
  const lock = {
    acquisitionPolicy: {
      type: 'retry' as const,
      retries: 30,
      minTimeout: 500,
      maxTimeout: 2000,
    },
  };

  // The consumer resolves its DB connection from POSTGRESQL_CONNECTION_STRING
  // (config.ts surfaces the built string into the env). One consumer-owned pool,
  // closed cleanly on stop() — no per-projector pools to leak.
  consumer.projector({ projection: modelsProjection, lock });
  consumer.projector({ projection: entityCatalogProjection, lock });
  consumer.projector({ projection: slicePlacementsProjection, lock });
  consumer.projector({ projection: relationsGraphProjection, lock });

  // Do NOT await — `start()` only resolves once the consumer stops.
  void consumer.start();
  return consumer;
};
