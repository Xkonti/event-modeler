import { documents } from '../../db.ts';
import type { ContextDoc } from '../../read/contexts.ts';
import type { CatalogEntry } from '../../read/entityCatalog.ts';

/**
 * Cross-stream pre-check for lane assignment, shared by the businessFact and
 * externalBusinessFact APIs (O5: both use the same path). A decider sees one
 * stream only, so "does the target context exist, is it active, and does it
 * belong to the fact's model (G-C8)?" is checked here against the async read
 * models — eventually consistent, acceptable single-user (same pattern as
 * relation endpoint checks).
 */
export type LaneCheck =
  | { ok: true }
  | { ok: false; status: number; error: string };

export const checkLaneAssignable = async (
  factId: string,
  contextId: string,
): Promise<LaneCheck> => {
  const [fact, context] = await Promise.all([
    documents.collection<CatalogEntry>('entity_catalog').findOne({ _id: factId }),
    documents.collection<ContextDoc>('contexts').findOne({ _id: contextId }),
  ]);
  if (!fact || fact.archived)
    return { ok: false, status: 422, error: 'fact not found' };
  if (!context || context.archived)
    return { ok: false, status: 422, error: 'context not found' };
  if (fact.modelId !== context.modelId)
    return { ok: false, status: 422, error: 'context belongs to a different model' };
  return { ok: true };
};
