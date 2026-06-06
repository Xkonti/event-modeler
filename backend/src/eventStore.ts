import { projections } from '@event-driven-io/emmett';
import { getPostgreSQLEventStore } from '@event-driven-io/emmett-postgresql';
import { connectionString } from './config.ts';
import { entityNamesConstraint } from './constraints/entityNames.ts';
import { authUserEmailIndex } from './constraints/authUserEmailIndex.ts';
import { authAccountIndex } from './constraints/authAccountIndex.ts';

/**
 * Builds an event store for a given connection string. Tests inject a
 * throwaway testcontainers DB; the app uses the singleton below.
 *
 * INLINE projections = constraints only (run in the append tx). Read models are
 * NOT registered here — they run async via src/consumers.ts. That inline-vs-async
 * split is the structural marker between a constraint and a read model
 * (notes/constraint-inline-projection-pattern.md).
 */
export const createEventStore = (connectionStr: string) =>
  getPostgreSQLEventStore(connectionStr, {
    schema: { autoMigration: 'CreateOrUpdate' },
    projections: projections.inline([
      entityNamesConstraint,
      authUserEmailIndex,
      authAccountIndex,
    ]),
  });

/** The app-wide event store (lazily connects on first use). */
export const eventStore = createEventStore(connectionString);

export type AppEventStore = ReturnType<typeof createEventStore>;
