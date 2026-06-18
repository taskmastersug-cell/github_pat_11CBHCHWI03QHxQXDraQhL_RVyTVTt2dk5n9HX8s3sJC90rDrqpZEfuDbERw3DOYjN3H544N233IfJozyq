import { z } from 'zod';

// Zod schemas mirror Firestore document shapes. Functions use these to
// validate every write — rules deny financial writes from clients entirely,
// so these are the second line of defense (and the source of truth for
// admin-app form validation).

export const safeIntMoney = z.number().int().nonnegative().finite();
export const signedMoney = z.number().int().finite();
const currency = z.enum(['UGX', 'KES', 'TZS']);
const locale = z.enum(['en', 'lg']);

export const UserDocSchema = z.object({
  uid: z.string().min(1),
  msisdn: z.string().regex(/^\+?\d{9,15}$/),
  displayName: z.string().min(1).max(80),
  locale,
  kyc: z.object({
    status: z.enum(['unstarted', 'pending', 'approved', 'rejected']),
    ninHash: z.string().optional(),
    selfieRef: z.string().optional(),
    verifiedAt: z.number().optional(),
    reviewerUid: z.string().optional(),
  }),
  createdAt: z.number(),
  disabled: z.boolean(),
});

const ContributionPolicy = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('periodicFixed'), amount: safeIntMoney, cycleCount: z.number().int().nonnegative() }),
  z.object({ kind: z.literal('periodicRolling'), amount: safeIntMoney }),
]);
const SelectionPolicy = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('discountBid'), minDiscount: safeIntMoney, maxDiscount: safeIntMoney }),
  z.object({ kind: z.literal('proRataByShare') }),
  z.object({ kind: z.literal('approvedClaim') }),
  z.object({ kind: z.literal('fixedOrder'), order: z.array(z.string()).min(1) }),
]);
const TriggerPolicy = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('onCycleClose') }),
  z.object({ kind: z.literal('onMaturity'), maturesAt: z.number() }),
  z.object({ kind: z.literal('onClaimApproval') }),
]);
const AccrualPolicy = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({ kind: z.literal('chitFundDiscountDividend') }),
  z.object({ kind: z.literal('flatInterest'), bps: z.number().int().nonnegative() }),
]);

export const ChamaSchema = z.object({
  chamaId: z.string(),
  name: z.string().min(1).max(80),
  type: z.enum(['merryGoRound', 'fixedSavings', 'welfare']),
  policies: z.object({
    contribution: ContributionPolicy,
    selection: SelectionPolicy,
    trigger: TriggerPolicy,
    accrual: AccrualPolicy,
  }),
  currency,
  status: z.enum(['forming', 'active', 'paused', 'closed']),
  createdBy: z.string(),
  createdAt: z.number(),
  memberCount: z.number().int().nonnegative(),
  cycleLength: z.object({
    unit: z.enum(['day', 'week', 'month']),
    n: z.number().int().positive(),
  }),
  contributionAmount: safeIntMoney,
});

export const MembershipSchema = z.object({
  membershipId: z.string(),
  chamaId: z.string(),
  uid: z.string(),
  role: z.enum(['member', 'treasurer', 'admin']),
  status: z.enum(['invited', 'active', 'suspended', 'exited']),
  joinedAt: z.number(),
  share: z.number().int().min(0).max(10_000),
});

export const CycleSchema = z.object({
  cycleId: z.string(),
  chamaId: z.string(),
  index: z.number().int().nonnegative(),
  opensAt: z.number(),
  closesAt: z.number(),
  biddingClosesAt: z.number().optional(),
  state: z.enum(['open', 'contributing', 'bidding', 'closing', 'distributing', 'settled', 'voided']),
  expectedAmount: safeIntMoney,
  pool: safeIntMoney,
  currency,
  winnerUid: z.string().optional(),
  winningBid: safeIntMoney.optional(),
  distributedAt: z.number().optional(),
  settledAt: z.number().optional(),
});

export const BidSchema = z.object({
  bidId: z.string(),
  cycleId: z.string(),
  chamaId: z.string(),
  uid: z.string(),
  discount: safeIntMoney,
  placedAt: z.number(),
  status: z.enum(['active', 'withdrawn', 'won', 'lost']),
});

export const ContributionSchema = z.object({
  contributionId: z.string(),
  chamaId: z.string(),
  cycleId: z.string(),
  uid: z.string(),
  amount: safeIntMoney,
  currency,
  state: z.enum(['pending', 'paid', 'late', 'waived']),
  paidAt: z.number().optional(),
  transactionId: z.string().optional(),
});

export const ClaimSchema = z.object({
  claimId: z.string(),
  chamaId: z.string(),
  uid: z.string(),
  reason: z.string().min(1).max(500),
  amountRequested: safeIntMoney,
  currency,
  evidenceRef: z.string().min(1),
  state: z.enum(['submitted', 'approved', 'rejected', 'paid']),
  reviewerUid: z.string().optional(),
  reviewedAt: z.number().optional(),
  payoutId: z.string().optional(),
});

export const PayoutSchema = z.object({
  payoutId: z.string(),
  chamaId: z.string(),
  cycleId: z.string().optional(),
  claimId: z.string().optional(),
  recipientUid: z.string(),
  amount: safeIntMoney,
  currency,
  state: z.enum(['queued', 'requested', 'sent', 'failed', 'reversed']),
  provider: z.enum(['mtnMomo', 'airtelMoney']),
  providerRef: z.string().optional(),
  attempts: z.number().int().nonnegative(),
  createdAt: z.number(),
  settledAt: z.number().optional(),
});

export const TransactionSchema = z.object({
  txId: z.string(),
  kind: z.enum(['deposit', 'payout']),
  uid: z.string(),
  chamaId: z.string(),
  contributionId: z.string().optional(),
  payoutId: z.string().optional(),
  msisdn: z.string(),
  amount: safeIntMoney,
  currency,
  provider: z.enum(['mtnMomo', 'airtelMoney']),
  providerRef: z.string().optional(),
  idempotencyKey: z.string().min(1),
  state: z.enum(['pending', 'confirmed', 'failed', 'reconciled']),
  initiatedAt: z.number(),
  confirmedAt: z.number().optional(),
  raw: z.record(z.unknown()).optional(),
});

export const LedgerEntrySchema = z.object({
  entryId: z.string(),
  chamaId: z.string(),
  txGroupId: z.string(),
  account: z.string(),
  amount: signedMoney,
  currency,
  ts: z.number(),
  sourceKind: z.enum(['contribution', 'payout', 'bid_dividend', 'fee', 'adjustment']),
  sourceRef: z.string(),
  postedBy: z.string(),
});

export const AuditLogSchema = z.object({
  logId: z.string(),
  actorUid: z.string(),
  action: z.string(),
  target: z.object({ kind: z.string(), id: z.string() }),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  ts: z.number(),
  ip: z.string().optional(),
  ua: z.string().optional(),
});
