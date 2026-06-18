import type { Money } from '../money.js';
import type {
  UserId, ChamaId, CycleId, ClaimId, BidId, ContributionId, TransactionId,
} from '../ids.js';

// Events are the only thing that drives state change. Cloud Functions translate
// real-world signals (provider webhooks, scheduled triggers, treasurer actions)
// into events; the engine turns events into postings + state updates.

export type RoundPayEvent =
  | {
      kind: 'contributionPaid';
      chamaId: ChamaId;
      cycleId: CycleId;
      contributionId: ContributionId;
      uid: UserId;
      amount: Money;
      transactionId: TransactionId;
      provider: 'mtnMomo' | 'airtelMoney';
      at: number;
    }
  | {
      kind: 'bidPlaced';
      chamaId: ChamaId;
      cycleId: CycleId;
      bidId: BidId;
      uid: UserId;
      discount: Money;
      at: number;
    }
  | {
      kind: 'cycleClosed';
      chamaId: ChamaId;
      cycleId: CycleId;
      at: number;
    }
  | {
      kind: 'maturityReached';
      chamaId: ChamaId;
      at: number;
    }
  | {
      kind: 'claimApproved';
      chamaId: ChamaId;
      claimId: ClaimId;
      recipientUid: UserId;
      amount: Money;
      approverUid: UserId;
      at: number;
    }
  | {
      kind: 'bidWindowClosed';
      chamaId: ChamaId;
      cycleId: CycleId;
      at: number;
    }
  | {
      kind: 'memberExit';
      chamaId: ChamaId;
      uid: UserId;
      at: number;
    };
