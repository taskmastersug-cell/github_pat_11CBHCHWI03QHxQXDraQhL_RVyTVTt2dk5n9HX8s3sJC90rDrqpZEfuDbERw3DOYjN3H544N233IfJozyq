import { money } from '../../money.js';
import type { Posting } from '../../ledger/types.js';
import type { RoundPayEvent } from '../events.js';
import type { EngineContext, StateUpdate } from '../context.js';

// claimApproved — welfare flow. The claim has been approved by the treasurer
// (Functions enforced the role check). Queue a payout from reserve to member.
// The actual cash-side postings happen at payout settlement (when the provider
// confirms the disbursement).
export function handleClaimApproved(
  event: Extract<RoundPayEvent, { kind: 'claimApproved' }>,
  ctx: EngineContext,
): { postings: Posting[]; stateUpdate: StateUpdate } {
  if (ctx.chama.policies.selection.kind !== 'approvedClaim') {
    throw new Error('claimApproved on a chama whose selection is not approvedClaim');
  }
  return {
    postings: [],
    stateUpdate: {
      payouts: [{ recipientUid: event.recipientUid, amount: money(event.amount) }],
    },
  };
}

// bidPlaced — no postings; just validates and persists. Cycle state moves to
// 'bidding' the first time. Functions handles persistence; engine only checks
// invariants here.
export function handleBidPlaced(
  event: Extract<RoundPayEvent, { kind: 'bidPlaced' }>,
  ctx: EngineContext,
): { postings: Posting[]; stateUpdate: StateUpdate } {
  if (ctx.chama.policies.selection.kind !== 'discountBid') {
    throw new Error('bidPlaced on a chama whose selection is not discountBid');
  }
  const cfg = ctx.chama.policies.selection;
  if (event.discount < cfg.minDiscount || event.discount > cfg.maxDiscount) {
    throw new Error(`Bid ${event.discount} out of allowed range [${cfg.minDiscount}, ${cfg.maxDiscount}]`);
  }
  return { postings: [], stateUpdate: {} };
}

// maturityReached — scheduled. Closes the final cycle; the proRata distribution
// then happens via the standard cycleClosed handler.
export function handleMaturityReached(
  _event: Extract<RoundPayEvent, { kind: 'maturityReached' }>,
  _ctx: EngineContext,
): { postings: Posting[]; stateUpdate: StateUpdate } {
  return { postings: [], stateUpdate: {} };
}
