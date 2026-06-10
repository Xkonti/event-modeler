import { IllegalStateError, type Command } from '@event-driven-io/emmett';
import type { RelationEvent, RelationMeta } from './events.ts';
import { isBlank } from '../../shared/fields.ts';

/**
 * Decider for a single relation stream. Within-stream invariants: drawn once,
 * edited/removed only while drawn, kind non-blank. Endpoint type-pair VALIDITY
 * (allow-list, endpoint existence, same-model — G-C8) is the API edge's catalog
 * pre-check; the cross-stream duplicate-(from,to,kind) rule (E3) is the inline
 * `relation_pairs` constraint.
 *
 * `modelId`/`fromId`/`toId` are set at Draw and immutable; UpdateRelationInfo
 * changes only `kind`/`meta` and the decider stamps the rest from state.
 */

// --- State ---------------------------------------------------------------

export type Relation =
  | { status: 'empty' }
  | {
      status: 'drawn';
      modelId: string;
      relationId: string;
      fromId: string;
      toId: string;
      kind: string;
      meta?: RelationMeta;
    }
  | { status: 'removed'; relationId: string };

export const initialState = (): Relation => ({ status: 'empty' });

// --- Commands ------------------------------------------------------------

export type DrawRelation = Command<
  'DrawRelation',
  {
    modelId: string;
    relationId: string;
    fromId: string;
    toId: string;
    kind: string;
    meta?: RelationMeta;
  }
>;
export type UpdateRelationInfo = Command<
  'UpdateRelationInfo',
  { relationId: string; kind?: string; meta?: RelationMeta }
>;
export type RemoveRelation = Command<'RemoveRelation', { relationId: string }>;

export type RelationCommand = DrawRelation | UpdateRelationInfo | RemoveRelation;

// --- Decide --------------------------------------------------------------

export const decide = (
  command: RelationCommand,
  state: Relation,
): RelationEvent => {
  switch (command.type) {
    case 'DrawRelation': {
      if (state.status !== 'empty')
        throw new IllegalStateError('Relation already drawn');
      const { modelId, relationId, fromId, toId, kind, meta } = command.data;
      if (isBlank(kind))
        throw new IllegalStateError('Relation kind must not be blank');
      return {
        type: 'RelationDrawn',
        data: { modelId, relationId, fromId, toId, kind, meta },
      };
    }
    case 'UpdateRelationInfo': {
      if (state.status !== 'drawn')
        throw new IllegalStateError('Can only update a drawn relation');
      const kind = command.data.kind ?? state.kind;
      if (isBlank(kind))
        throw new IllegalStateError('Relation kind must not be blank');
      // meta is full-replace when given; untouched otherwise.
      const meta = 'meta' in command.data ? command.data.meta : state.meta;
      return {
        type: 'RelationInfoUpdated',
        data: {
          modelId: state.modelId,
          relationId: state.relationId,
          fromId: state.fromId,
          toId: state.toId,
          kind,
          meta,
        },
      };
    }
    case 'RemoveRelation': {
      if (state.status !== 'drawn')
        throw new IllegalStateError('Can only remove a drawn relation');
      return {
        type: 'RelationRemoved',
        data: { modelId: state.modelId, relationId: state.relationId },
      };
    }
  }
};

// --- Evolve --------------------------------------------------------------

export const evolve = (state: Relation, event: RelationEvent): Relation => {
  switch (event.type) {
    case 'RelationDrawn': {
      const { modelId, relationId, fromId, toId, kind, meta } = event.data;
      return { status: 'drawn', modelId, relationId, fromId, toId, kind, meta };
    }
    case 'RelationInfoUpdated':
      return state.status === 'drawn'
        ? { ...state, kind: event.data.kind, meta: event.data.meta }
        : state;
    case 'RelationRemoved':
      return { status: 'removed', relationId: event.data.relationId };
  }
};
