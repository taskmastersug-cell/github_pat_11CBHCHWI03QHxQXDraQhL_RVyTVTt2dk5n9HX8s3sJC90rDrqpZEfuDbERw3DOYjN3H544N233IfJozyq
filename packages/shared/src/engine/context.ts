import type { Money, CurrencyCode } from '../money.js';
import type { UserId, ChamaId } from '../ids.js';
import type { Chama, Cycle, Bid, Membership } from '../chama/types.js';

// EngineContext is a read-only view of the data the engine needs. The Functions
// layer assembles it from Firestore reads before calling applyEvent — the
// engine never reads Firestore directly. That's what makes it pure-testable.

export interface EngineContext {
  readonly chama: Chama;
  readonly activeMemberships: ReadonlyArray<Membership>;
  readonly cycle?: Cycle;
  readonly cycleBids?: ReadonlyArray<Bid>;
  readonly cycleContributedAmount?: Money;
  readonly currency: CurrencyCode;
  readonly now: number;
  // Caller supplies per-member ledger balance (sum of all entries on
  // `member:<uid>:<chamaId>` to date). Only required for memberExit.
  readonly memberStakes?: ReadonlyMap<UserId, Money>;
}

export interface StateUpdate {
  // Targeted Firestore patches, applied transactionally by the caller.
  cyclePatch?: Partial<Cycle>;
  bidPatches?: ReadonlyArray<{ bidId: string; status: Bid['status'] }>;
  winnerUid?: UserId;
  // Distribution payload — recipient(s) + amount(s) the Functions layer will
  // queue as Payout documents.
  payouts?: ReadonlyArray<{ recipientUid: UserId; amount: Money }>;
}
