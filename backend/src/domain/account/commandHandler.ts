import { CommandHandler } from '@event-driven-io/emmett';
import { accountStreamId } from '../../shared/streams.ts';
import { evolve, initialState } from './account.ts';

/**
 * Wires the account decider to its stream (`account-{accountId}`). Re-reads +
 * folds on each call with optimistic-concurrency retry. Called by the adapter
 * from account create/update/erase after encrypting secrets under the owner DEK.
 */
export const handleAccount = CommandHandler({
  evolve,
  initialState,
  mapToStreamId: accountStreamId,
});
