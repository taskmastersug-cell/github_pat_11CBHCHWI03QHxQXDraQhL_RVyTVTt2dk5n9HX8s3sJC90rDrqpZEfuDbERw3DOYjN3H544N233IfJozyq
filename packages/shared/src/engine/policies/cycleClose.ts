import { money } from '../../money.js';
import {
  memberAccount, poolAccount, poolEquityAccount,
} from '../../ledger/types.js';
import type { Posting } from '../../ledger/types.js';
import type { RoundPayEvent } from '../events.js';
import type { EngineContext, StateUpdate } from '../context.js';

// cycleClosed — selectionPolicy + accrualPolicy fire together at cycle close.
//
// Phase 1 dispatch:
//   selection=discountBid + accrual=chitFundDiscountDividend  ->  bidCycleClose
//   selection=proRataByShare + trigger=onMaturity             ->  proRataDistribute
//                                                                 (welfare ignored here — fires on claimApproved)
//
// The function returns postings + a payouts queue. Functions layer materializes
// the payouts as Payout documents and the provider-out leg is posted there.
export function handleCycleClosed(
  event: Extract<RoundPayEvent, { kind: 'cycleClosed' }>,
  ctx: EngineContext,
): { postings: Posting[]; stateUpdate: StateUpdate } {
  const { chama } = ctx;
  const selection = chama.policies.selection.kind;

  if (selection === 'discountBid') return bidCycleClose(event, ctx);
  if (selection === 'proRataByShare') return proRataDistribute(event, ctx);

  // No-op for selection policies that don't fire on cycle close.
  return { postings: [], stateUpdate: {} };
}

function bidCycleClose(
  event: Extract<RoundPayEvent, { kind: 'cycleClosed' }>,
  ctx: EngineContext,
): { postings: Posting[]; stateUpdate: StateUpdate } {
  const { chama, cycle, cycleBids, currency, activeMemberships } = ctx;
  if (!cycle) throw new Error('cycleClosed event requires a cycle in context');
  if (!cycleBids) throw new Error('cycleClosed for discountBid requires cycleBids in context');

  const pool = cycle.pool;

  // No bids -> hold the pool for next cycle. Posts nothing; sets state to
  // settled so the cycle finalizes without distribution.
  const activeBids = cycleBids.filter(b => b.status === 'active');
  if (activeBids.length === 0) {
    return {
      postings: [],
      stateUpdate: { cyclePatch: { state: 'settled', settledAt: event.at } },
    };
  }

  // Winner = highest discount (chit-fund: bidding willingness to take less).
  // Tie-break: earliest placed.
  const winner = [...activeBids].sort((a, b) =>
    b.discount - a.discount || a.placedAt - b.placedAt,
  )[0]!;

  const discount = winner.discount;
  if (discount < 0 || discount > pool) {
    throw new Error(`Invalid winning discount ${discount} for pool ${pool}`);
  }

  const winnerTakes = money(pool - discount);
  const losers = activeMemberships.filter(m => m.uid !== winner.uid && m.status === 'active');

  // Distribute discount equally to non-winners. Integer split: floor share +
  // remainder allocated to first-N members deterministically (by uid sort).
  const sourceRef = `cycle:${cycle.cycleId}`;
  const postings: Posting[] = [];

  if (losers.length > 0 && discount > 0) {
    const sortedLosers = [...losers].sort((a, b) => a.uid.localeCompare(b.uid));
    const baseShare = Math.floor(discount / sortedLosers.length);
    let remainder = discount - baseShare * sortedLosers.length;

    for (const m of sortedLosers) {
      const share = baseShare + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
      if (share === 0) continue;
      // Dividend: pool cash leaves -> member's stake credited (we credit
      // their stake rather than cash because the dividend isn't paid out yet;
      // it stays in the chama's books against the member). For a true
      // cash dividend payout add a Payout entry.
      postings.push(
        { account: poolAccount(chama.chamaId),          amount: money(-share), currency, sourceKind: 'bid_dividend', sourceRef },
        { account: poolEquityAccount(chama.chamaId),    amount: money(+share), currency, sourceKind: 'bid_dividend', sourceRef },
        { account: poolEquityAccount(chama.chamaId),    amount: money(-share), currency, sourceKind: 'bid_dividend', sourceRef },
        { account: memberAccount(m.uid as never, chama.chamaId), amount: money(+share), currency, sourceKind: 'bid_dividend', sourceRef },
      );
      // (The two poolEquity legs cancel out — kept for audit-readability so
      // every dividend has a "cash leaves pool" + "stake to member" record.)
    }
  }

  const payouts = [{ recipientUid: winner.uid, amount: winnerTakes }];

  return {
    postings,
    stateUpdate: {
      cyclePatch: {
        state: 'distributing',
        winnerUid: winner.uid,
        winningBid: discount,
        distributedAt: event.at,
      },
      bidPatches: activeBids.map(b => ({
        bidId: b.bidId,
        status: b.bidId === winner.bidId ? ('won' as const) : ('lost' as const),
      })),
      winnerUid: winner.uid,
      payouts,
    },
  };
}

function proRataDistribute(
  event: Extract<RoundPayEvent, { kind: 'cycleClosed' }>,
  ctx: EngineContext,
): { postings: Posting[]; stateUpdate: StateUpdate } {
  const { cycle, activeMemberships } = ctx;
  if (!cycle) throw new Error('cycleClosed event requires a cycle in context');

  // proRata fires on maturity for fixed savings; for non-maturity cycles
  // it's a no-op (members keep accumulating).
  const trigger = ctx.chama.policies.trigger;
  if (trigger.kind !== 'onMaturity') {
    return { postings: [], stateUpdate: { cyclePatch: { state: 'settled', settledAt: event.at } } };
  }
  if (event.at < trigger.maturesAt) {
    return { postings: [], stateUpdate: { cyclePatch: { state: 'settled', settledAt: event.at } } };
  }

  const totalBps = activeMemberships.reduce((s, m) => s + m.share, 0);
  const pool = cycle.pool;
  let allocated = 0;
  const payouts: Array<{ recipientUid: ReturnType<typeof ctx.activeMemberships[number]['uid']>; amount: ReturnType<typeof money> }> = [];

  const sortedMembers = [...activeMemberships].sort((a, b) => a.uid.localeCompare(b.uid));
  for (let i = 0; i < sortedMembers.length; i++) {
    const m = sortedMembers[i]!;
    const isLast = i === sortedMembers.length - 1;
    const share = isLast
      ? money(pool - allocated)
      : money(Math.floor((pool * m.share) / totalBps));
    allocated += share;
    if (share > 0) payouts.push({ recipientUid: m.uid, amount: share });
  }

  return {
    postings: [],
    stateUpdate: {
      cyclePatch: { state: 'distributing', distributedAt: event.at },
      payouts,
    },
  };
}
