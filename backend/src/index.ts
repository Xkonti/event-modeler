import { startAPI } from '@event-driven-io/emmett-expressjs';
import { port } from './config.ts';
import { eventStore } from './eventStore.ts';
import { startConsumers } from './consumers.ts';
import { migrateConstraints } from './migrations/constraints.ts';
import { auth } from './auth/auth.ts';
import { buildAuthApp } from './http/app.ts';

/**
 * Event Modeler — backend entry point.
 *
 * Boot order matters: the Emmett `emt_*` schema (tables + stored functions)
 * must exist before consumers register and before any guarded append; the
 * constraint tables (incl. the auth keystore + blind indexes) must exist before
 * the first guarded append or session lookup. So: migrate schema → migrate
 * constraints → serve → start consumers (background).
 *
 * `buildAuthApp` (src/http/app.ts) is the SINGLE HTTP assembly source shared
 * with the integration harness; it owns the auth-raw-before-json ordering and
 * mounts domain routers under `/api`. `startAPI` here just `http.createServer`s
 * the plain Express app and listens (confirmed: it accepts any Express
 * Application).
 */
const main = async (): Promise<void> => {
  await eventStore.schema.migrate();
  await migrateConstraints();

  const app = buildAuthApp({ auth, eventStore });
  startAPI(app, { port });
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
