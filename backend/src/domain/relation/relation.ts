import { IllegalStateError, type Command } from '@event-driven-io/emmett';
import type { RelationEvent } from './events.ts';

/**
 * Decider for a single relation stream. Enforces ONLY within-stream invariants:
 * a relation can be drawn once and removed only while drawn.
 *
 * Endpoint type-pair VALIDITY (is `from → to` an allowed, existing pair?) is NOT
 * decided here — a decider sees one stream only. It is checked in the api layer
 * against the catalog (eventually consistent; acceptable single-user). The future
 * "both endpoints free" claim is a separate inline `entity_claims` constraint.
 */

// --- State ---------------------------------------------------------------

export type Relation =
  | { status: 'empty' }
  | { status: 'drawn'; entityId: string; fromId: string; toId: string }
  | { status: 'removed'; entityId: string };

export const initialState = (): Relation => ({ status: 'empty' });

// --- Commands ------------------------------------------------------------

export type DrawRelation = Command<
  'DrawRelation',
  { entityId: string; fromId: string; toId: string }
>;
export type RemoveRelation = Command<'RemoveRelation', { entityId: string }>;

export type RelationCommand = DrawRelation | RemoveRelation;

// --- Decide --------------------------------------------------------------

export const decide = (
  command: RelationCommand,
  state: Relation,
): RelationEvent => {
  switch (command.type) {
    case 'DrawRelation': {
      if (state.status !== 'empty')
        throw new IllegalStateError('Relation already drawn');
      const { entityId, fromId, toId } = command.data;
      return { type: 'RelationDrawn', data: { entityId, fromId, toId } };
    }
    case 'RemoveRelation': {
      if (state.status !== 'drawn')
        throw new IllegalStateError('Can only remove a drawn relation');
      return {
        type: 'RelationRemoved',
        data: { entityId: command.data.entityId },
      };
    }
  }
};

// --- Evolve --------------------------------------------------------------

export const evolve = (state: Relation, event: RelationEvent): Relation => {
  switch (event.type) {
    case 'RelationDrawn':
      return {
        status: 'drawn',
        entityId: event.data.entityId,
        fromId: event.data.fromId,
        toId: event.data.toId,
      };
    case 'RelationRemoved':
      return { status: 'removed', entityId: event.data.entityId };
  }
};
