import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { createEventStore, type AppEventStore } from '../../src/eventStore.ts';
import { migrateConstraints } from '../../src/migrations/constraints.ts';
import { handleBusinessFact } from '../../src/domain/businessFact/commandHandler.ts';
import { decide } from '../../src/domain/businessFact/businessFact.ts';

/**
 * Integration test against a REAL Postgres (testcontainers). Proves the inline
 * `entity_names` constraint enforces global name uniqueness end-to-end: the
 * append rolls back on a duplicate, and the name frees on archive.
 *
 * Runs under Node (`node --test`) — testcontainers' container lifecycle is not
 * reliable under the Bun runtime. Requires Docker. See README → Testing.
 */
let container: StartedPostgreSqlContainer;
let eventStore: AppEventStore;

const define = (id: string, name: string, context = 'Budgeting') =>
  handleBusinessFact(eventStore, id, (state) =>
    decide({ type: 'DefineBusinessFact', data: { entityId: id, name, context } }, state),
  );

const archive = (id: string) =>
  handleBusinessFact(eventStore, id, (state) =>
    decide({ type: 'ArchiveBusinessFact', data: { entityId: id } }, state),
  );

describe('global name uniqueness (inline constraint)', () => {
  before(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    const connectionString = container.getConnectionUri();
    eventStore = createEventStore(connectionString);
    await eventStore.schema.migrate();
    await migrateConstraints(connectionString);
  });

  after(async () => {
    await eventStore?.close();
    await container?.stop();
  });

  it('accepts the first fact to claim a name', async () => {
    const result = await define('f1', 'BudgetYearDefined');
    assert.equal(result.newEvents.length, 1);
  });

  it('rejects a different entity reusing the same normalized name', async () => {
    // Same name, different case — must collide on the normalized key.
    await assert.rejects(() => define('f2', 'budgetyeardefined'));
  });

  it('allows an unrelated distinct name', async () => {
    const result = await define('f2', 'BudgetLineRecorded');
    assert.equal(result.newEvents.length, 1);
  });

  it('frees the name on archive, allowing reuse by another entity', async () => {
    await archive('f1');
    const result = await define('f3', 'BudgetYearDefined');
    assert.equal(result.newEvents.length, 1);
  });
});
