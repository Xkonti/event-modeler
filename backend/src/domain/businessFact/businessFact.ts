import { IllegalStateError, type Command } from '@event-driven-io/emmett';
import type { BusinessFactEvent } from './events.ts';

/**
 * Decider for a single business-fact stream. It enforces ONLY within-stream
 * invariants (a fact can't be defined twice, can't be edited once archived).
 *
 * Cross-aggregate invariants — global name uniqueness — are NOT decided here;
 * a decider sees one stream only. Those are enforced by the inline constraint
 * projection (notes/constraint-inline-projection-pattern.md).
 */

// --- State ---------------------------------------------------------------

export type BusinessFact =
  | { status: 'empty' }
  | { status: 'active'; factId: string; name: string; context: string }
  | { status: 'archived'; factId: string };

export const initialState = (): BusinessFact => ({ status: 'empty' });

// --- Commands ------------------------------------------------------------

export type DefineBusinessFact = Command<
  'DefineBusinessFact',
  { factId: string; name: string; context: string }
>;
export type RenameBusinessFact = Command<
  'RenameBusinessFact',
  { factId: string; name: string }
>;
export type ArchiveBusinessFact = Command<
  'ArchiveBusinessFact',
  { factId: string }
>;

export type BusinessFactCommand =
  | DefineBusinessFact
  | RenameBusinessFact
  | ArchiveBusinessFact;

// --- Decide --------------------------------------------------------------

export const decide = (
  command: BusinessFactCommand,
  state: BusinessFact,
): BusinessFactEvent => {
  switch (command.type) {
    case 'DefineBusinessFact': {
      if (state.status !== 'empty')
        throw new IllegalStateError('Business fact already defined');
      const { factId, name, context } = command.data;
      return { type: 'BusinessFactDefined', data: { factId, name, context } };
    }
    case 'RenameBusinessFact': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only rename an active business fact');
      return {
        type: 'BusinessFactRenamed',
        data: { factId: command.data.factId, name: command.data.name },
      };
    }
    case 'ArchiveBusinessFact': {
      if (state.status !== 'active')
        throw new IllegalStateError('Can only archive an active business fact');
      return {
        type: 'BusinessFactArchived',
        data: { factId: command.data.factId },
      };
    }
  }
};

// --- Evolve --------------------------------------------------------------

export const evolve = (
  state: BusinessFact,
  event: BusinessFactEvent,
): BusinessFact => {
  switch (event.type) {
    case 'BusinessFactDefined': {
      const { factId, name, context } = event.data;
      return { status: 'active', factId, name, context };
    }
    case 'BusinessFactRenamed':
      return state.status === 'active'
        ? { ...state, name: event.data.name }
        : state;
    case 'BusinessFactArchived':
      return { status: 'archived', factId: event.data.factId };
  }
};
