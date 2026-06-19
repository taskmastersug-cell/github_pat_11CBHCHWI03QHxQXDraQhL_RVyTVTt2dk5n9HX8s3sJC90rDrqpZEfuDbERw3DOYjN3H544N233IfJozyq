import type { Money, CurrencyCode } from '../money.js';
import type {
  UserId, ChamaId, MembershipId, CycleId, BidId,
  ContributionId, ClaimId, PayoutId, TransactionId,
} from '../ids.js';
import type { ChamaPolicies } from './policies.js';

export type ChamaType = 'merryGoRound' | 'fixedSavings' | 'welfare';
export type ChamaStatus = 'forming' | 'active' | 'paused' | 'closed';
export type MemberRole = 'member' | 'treasurer' | 'admin';
export type MembershipStatus = 'invited' | 'active' | 'suspended' | 'exited';

export type CycleState =
  | 'open'
  | 'contributing'
  | 'bidding'
  | 'closing'
  | 'distributing'
  | 'settled'
  | 'voided';

export type ContributionState = 'pending' | 'paid' | 'late' | 'waived';
export type ClaimState = 'submitted' | 'approved' | 'rejected' | 'paid';
export type PayoutState = 'queued' | 'requested' | 'sent' | 'failed' | 'reversed';
export type TransactionState = 'pending' | 'confirmed' | 'failed' | 'reconciled';
export type Provider = 'mtnMomo' | 'airtelMoney';

export type KycStatus = 'unstarted' | 'pending' | 'approved' | 'rejected';
export type Locale = 'en' | 'lg';

export interface UserDoc {
  uid: UserId;
  msisdn: string;
  displayName: string;
  locale: Locale;
  kyc: {
    status: KycStatus;
    ninHash?: string;
    selfieRef?: string;
    verifiedAt?: number;
    reviewerUid?: UserId;
  };
  createdAt: number;
  disabled: boolean;
  fcmTokens?: string[];
}

export interface Chama {
  chamaId: ChamaId;
  name: string;
  type: ChamaType;
  policies: ChamaPolicies;
  currency: CurrencyCode;
  status: ChamaStatus;
  createdBy: UserId;
  createdAt: number;
  memberCount: number;
  cycleLength: { unit: 'day' | 'week' | 'month'; n: number };
  contributionAmount: Money;
}

export interface Membership {
  membershipId: MembershipId;
  chamaId: ChamaId;
  uid: UserId;
  role: MemberRole;
  status: MembershipStatus;
  joinedAt: number;
  share: number; // basis points (sum across active memberships should equal 10_000)
}

export interface Cycle {
  cycleId: CycleId;
  chamaId: ChamaId;
  index: number;
  opensAt: number;
  closesAt: number;
  biddingClosesAt?: number; // required for discountBid chamas
  state: CycleState;
  expectedAmount: Money;
  pool: Money;
  currency: CurrencyCode;
  winnerUid?: UserId;
  winningBid?: Money;
  distributedAt?: number;
  settledAt?: number;
}

export interface Bid {
  bidId: BidId;
  cycleId: CycleId;
  chamaId: ChamaId;
  uid: UserId;
  discount: Money;
  placedAt: number;
  status: 'active' | 'withdrawn' | 'won' | 'lost';
}

export interface Contribution {
  contributionId: ContributionId;
  chamaId: ChamaId;
  cycleId: CycleId;
  uid: UserId;
  amount: Money;
  currency: CurrencyCode;
  state: ContributionState;
  paidAt?: number;
  transactionId?: TransactionId;
}

export interface Claim {
  claimId: ClaimId;
  chamaId: ChamaId;
  uid: UserId;
  reason: string;
  amountRequested: Money;
  currency: CurrencyCode;
  evidenceRef: string; // required as of Phase 2
  state: ClaimState;
  reviewerUid?: UserId;
  reviewedAt?: number;
  payoutId?: PayoutId;
}

export interface Payout {
  payoutId: PayoutId;
  chamaId: ChamaId;
  cycleId?: CycleId;
  claimId?: ClaimId;
  recipientUid: UserId;
  amount: Money;
  currency: CurrencyCode;
  state: PayoutState;
  provider: Provider;
  providerRef?: string;
  attempts: number;
  createdAt: number;
  settledAt?: number;
}

export interface Transaction {
  txId: TransactionId;
  kind: 'deposit' | 'payout';
  uid: UserId;
  chamaId: ChamaId;
  contributionId?: ContributionId;
  payoutId?: PayoutId;
  msisdn: string;
  amount: Money;
  currency: CurrencyCode;
  provider: Provider;
  providerRef?: string;
  idempotencyKey: string;
  state: TransactionState;
  initiatedAt: number;
  confirmedAt?: number;
  raw?: Record<string, unknown>;
}
