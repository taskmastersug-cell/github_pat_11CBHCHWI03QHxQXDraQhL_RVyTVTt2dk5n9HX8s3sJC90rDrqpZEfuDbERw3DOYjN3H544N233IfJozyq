import { money } from '../../money.js';
import { memberAccount, poolEquityAccount } from '../../ledger/types.js';
import type { Posting } from '../../ledger/types.js';
import type { RoundPayEvent } from '../events.js';
import type { EngineContext, StateUpdate } from '../context.js';

// claimApproved — welfare flow. The claim has been approved by the treasurer
// (Functions enforced the role check). Queue a payout from reserve to member.
// The cash-side postings happen at payout settlement.
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

// bidPlaced — validates bid and that the cycle is still in its bid window.
// Engine has no postings to emit; persistence happens in Functions.
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
  if (!ctx.cycle) throw new Error('bidPlaced requires cycle in context');
  if (ctx.cycle.state !== 'bidding') {
    throw new Error(`bidPlaced rejected: cycle state is ${ctx.cycle.state}, not 'bidding'`);
  }
  if (ctx.cycle.biddingClosesAt !== undefined && event.at > ctx.cycle.biddingClosesAt) {
    throw new Error('bidPlaced rejected: bid window has closed');
  }
  return { postings: [], stateUpdate: {} };
}

// bidWindowClosed — the bid window has elapsed; cycle moves from 'bidding'
// to 'closing'. Distribution still fires only on the subsequent cycleClosed
// event (which is what posts the actual ledger).
export function handleBidWindowClosed(
  event: Extract<RoundPayEvent, { kind: 'bidWindowClosed' }>,
  ctx: EngineContext,
): { postings: Posting[]; stateUpdate: StateUpdate } {
  if (!ctx.cycle) throw new Error('bidWindowClosed requires cycle in context');
  if (ctx.cycle.state !== 'bidding') {
    return { postings: [], stateUpdate: {} };
  }
  void event;
  return {
    postings: [],
    stateUpdate: { cyclePatch: { state: 'closing' } },
  };
}

// maturityReached — closes the final cycle; the proRata distribution then
// fires via the standard cycleClosed handler.
export function handleMaturityReached(
  _event: Extract<RoundPayEvent, { kind: 'maturityReached' }>,
  _ctx: EngineContext,
): { postings: Posting[]; stateUpdate: StateUpdate } {
  return { postings: [], stateUpdate: {} };
}
