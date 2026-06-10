import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { createEventStore, type AppEventStore } from '../../src/eventStore.ts';
import { createSchema } from '../../src/schema.ts';
import { handleBusinessFact } from '../../src/domain/businessFact/commandHandler.ts';
import { decide } from '../../src/domain/businessFact/businessFact.ts';
import { handleCommand } from '../../src/domain/command/commandHandler.ts';
import { decide as decideCommand } from '../../src/domain/command/command.ts';

/**
 * Integration test against a REAL Postgres (testcontainers). Proves the inline
 * `entity_names` constraint enforces PER-MODEL name uniqueness across types (F1b)
 * end-to-end: a name collides within a model (fact vs fact AND fact vs command),
 * is free across different models, and frees on archive.
 *
 * Runs under Node (`node --test`) — testcontainers' lifecycle is unreliable under
 * Bun. Requires Docker. See README → Testing.
 */
let container: StartedPostgreSqlContainer;
let eventStore: AppEventStore;

const defineFact = (modelId: string, id: string, name: string) =>
  handleBusinessFact(eventStore, id, (state) =>
    decide(
      { type: 'DefineBusinessFact', data: { modelId, entityId: id, name, fields: [] } },
      state,
    ),
  );

const archiveFact = (id: string) =>
  handleBusinessFact(eventStore, id, (state) =>
    decide({ type: 'ArchiveBusinessFact', data: { entityId: id } }, state),
  );

const defineCommand = (modelId: string, id: string, name: string) =>
  handleCommand(eventStore, id, (state) =>
    decideCommand(
      { type: 'DefineCommand', data: { modelId, entityId: id, name, fields: [] } },
      state,
    ),
  );

describe('per-model name uniqueness across types (inline constraint, F1b)', () => {
  before(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    const connectionString = container.getConnectionUri();
    eventStore = createEventStore(connectionString);
    await eventStore.schema.migrate();
    await createSchema(connectionString);
  });

  after(async () => {
    await eventStore?.close();
    await container?.stop();
  });

  it('accepts the first fact to claim a name in a model', async () => {
    const result = await defineFact('m-A', 'f1', 'BudgetYearDefined');
    assert.equal(result.newEvents.length, 1);
  });

  it('rejects a different fact reusing the same normalized name in the SAME model', async () => {
    // Same name, different case — collides on the normalized key within m-A.
    await assert.rejects(() => defineFact('m-A', 'f2', 'budgetyeardefined'));
  });

  it('ALLOWS the same name in a DIFFERENT model (per-model namespace)', async () => {
    const result = await defineFact('m-B', 'f3', 'BudgetYearDefined');
    assert.equal(result.newEvents.length, 1);
  });

  it('rejects a COMMAND sharing a fact name in the SAME model (cross-type)', async () => {
    await assert.rejects(() => defineCommand('m-A', 'c1', 'BudgetYearDefined'));
  });

  it('allows that same name as a command in a different (empty) model', async () => {
    const result = await defineCommand('m-C', 'c2', 'BudgetYearDefined');
    assert.equal(result.newEvents.length, 1);
  });

  it('frees the name on archive, allowing reuse within the same model', async () => {
    await archiveFact('f1'); // frees (m-A, budgetyeardefined)
    const result = await defineFact('m-A', 'f4', 'BudgetYearDefined');
    assert.equal(result.newEvents.length, 1);
  });
});
