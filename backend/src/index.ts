import { getApplication, startAPI } from '@event-driven-io/emmett-expressjs';
import { port } from './config.ts';
import { eventStore } from './eventStore.ts';
import { startConsumers } from './consumers.ts';
import { migrateConstraints } from './migrations/constraints.ts';
import { businessFactApi } from './domain/businessFact/api.ts';

/**
 * Event Modeler — backend entry point.
 *
 * Boot order matters: the Emmett `emt_*` schema (tables + stored functions)
 * must exist before consumers register and before any guarded append; the
 * constraint tables must exist before the first guarded append. So: migrate
 * schema → migrate constraints → serve → start consumers (background).
 */
const main = async (): Promise<void> => {
  await eventStore.schema.migrate();
  await migrateConstraints();

  const application = getApplication({
    apis: [businessFactApi(eventStore)],
  });
  startAPI(application, { port });
  console.log(`🚀 Event Modeler backend listening on :${port}`);

  // Read-model consumers run in the background.
  const consumer = startConsumers();

  // Graceful shutdown — stop the consumer so it releases its processor lock,
  // then close the store. Without this, a killed process leaves a stale lock.
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n${signal} received — shutting down.`);
    try {
      await consumer.stop();
      await eventStore.close();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
};

await main();
