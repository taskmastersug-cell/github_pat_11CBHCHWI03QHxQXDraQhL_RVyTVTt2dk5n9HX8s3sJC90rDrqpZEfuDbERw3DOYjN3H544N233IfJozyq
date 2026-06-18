import { money } from '../../money.js';
import type { Posting } from '../../ledger/types.js';
import type { RoundPayEvent } from '../events.js';
import type { EngineContext, StateUpdate } from '../context.js';

// memberExit — policy-driven exit. Refund amount = the member's current ledger
// stake. For merry-go-round chamas mid-rotation, the policy is: only allow
// exit between cycles (caller enforces this). For fixed-savings the exit is
// always allowed pre-maturity. For welfare, exit refunds zero (welfare
// contributions are non-refundable — they fund the standing reserve).
//
// The engine does NOT emit postings here; the actual cash-side ledger entries
// happen when the queued payout settles via the provider webhook.
export function handleMemberExit(
  event: Extract<RoundPayEvent, { kind: 'memberExit' }>,
  ctx: EngineContext,
): { postings: Posting[]; stateUpdate: StateUpdate } {
  const selection = ctx.chama.policies.selection.kind;

  // Welfare: no refund. Just transition status.
  if (selection === 'approvedClaim') {
    return { postings: [], stateUpdate: { payouts: [] } };
  }

  if (!ctx.memberStakes) {
    throw new Error('memberExit requires memberStakes in EngineContext');
  }
  const stake = ctx.memberStakes.get(event.uid) ?? money(0);
  if (stake <= 0) {
    return { postings: [], stateUpdate: { payouts: [] } };
  }

  // Merry-go-round: refuse exit while a cycle is mid-distribution. Caller
  // should normally guard, but engine asserts as a safety net.
  if (selection === 'discountBid' && ctx.cycle &&
      (ctx.cycle.state === 'distributing' || ctx.cycle.state === 'bidding')) {
    throw new Error('memberExit blocked: cycle is in flight');
  }

  return {
    postings: [],
    stateUpdate: {
      payouts: [{ recipientUid: event.uid, amount: stake }],
    },
  };
}
