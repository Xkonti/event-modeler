import type { PostgreSQLEventStoreConsumer } from '@event-driven-io/emmett-postgresql';
import { eventStore } from './eventStore.ts';
import { entityCatalogProjection } from './read/entityCatalog.ts';

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

  consumer.projector({
    projection: entityCatalogProjection,
    lock: {
      acquisitionPolicy: {
        type: 'retry',
        retries: 30,
        minTimeout: 500,
        maxTimeout: 2000,
      },
    },
  });

  // Do NOT await — `start()` only resolves once the consumer stops.
  void consumer.start();
  return consumer;
};
