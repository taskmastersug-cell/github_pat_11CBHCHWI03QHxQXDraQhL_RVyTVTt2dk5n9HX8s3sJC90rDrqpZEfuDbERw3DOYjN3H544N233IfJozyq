// Policies are the seams that let one engine serve all chama types.
// Adding a new chama type means adding policy values + a registry entry — never
// editing applyEvent.

import type { Money } from '../money.js';

// ---------- contributionPolicy: schedule + amount ----------
export type ContributionPolicy =
  | { kind: 'periodicFixed'; amount: Money; cycleCount: number /* 0 = rolling */ }
  | { kind: 'periodicRolling'; amount: Money /* welfare standing contribution */ };

// ---------- selectionPolicy: who receives a distribution ----------
export type SelectionPolicy =
  | { kind: 'discountBid'; minDiscount: Money; maxDiscount: Money }
  | { kind: 'proRataByShare' }
  | { kind: 'approvedClaim' }
  // Reserved slot — Phase 2+
  | { kind: 'fixedOrder'; order: ReadonlyArray<string> };

// ---------- triggerPolicy: when a distribution fires ----------
export type TriggerPolicy =
  | { kind: 'onCycleClose' }
  | { kind: 'onMaturity'; maturesAt: number /* epoch ms */ }
  | { kind: 'onClaimApproval' };

// ---------- accrualPolicy: how the pool earns/redistributes between events ----------
export type AccrualPolicy =
  | { kind: 'none' }
  | { kind: 'chitFundDiscountDividend' /* discount split equally to non-winners */ }
  | { kind: 'flatInterest'; bps: number /* basis points per cycle */ };

export interface ChamaPolicies {
  readonly contribution: ContributionPolicy;
  readonly selection: SelectionPolicy;
  readonly trigger: TriggerPolicy;
  readonly accrual: AccrualPolicy;
}

// Convenience presets — one per Phase 1 chama type. The engine itself does NOT
// branch on type; type is a label for humans and a UI hint.
export const PHASE1_PRESETS = {
  merryGoRound: (amount: Money, cycleCount: number, minDiscount: Money, maxDiscount: Money): ChamaPolicies => ({
    contribution: { kind: 'periodicFixed', amount, cycleCount },
    selection: { kind: 'discountBid', minDiscount, maxDiscount },
    trigger: { kind: 'onCycleClose' },
    accrual: { kind: 'chitFundDiscountDividend' },
  }),
  fixedSavings: (amount: Money, cycleCount: number, maturesAt: number): ChamaPolicies => ({
    contribution: { kind: 'periodicFixed', amount, cycleCount },
    selection: { kind: 'proRataByShare' },
    trigger: { kind: 'onMaturity', maturesAt },
    accrual: { kind: 'none' },
  }),
  welfare: (amount: Money): ChamaPolicies => ({
    contribution: { kind: 'periodicRolling', amount },
    selection: { kind: 'approvedClaim' },
    trigger: { kind: 'onClaimApproval' },
    accrual: { kind: 'none' },
  }),
} as const;
