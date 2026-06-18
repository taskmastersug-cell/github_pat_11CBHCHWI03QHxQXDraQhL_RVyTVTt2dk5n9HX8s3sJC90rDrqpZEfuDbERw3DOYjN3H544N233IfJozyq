import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { money } from '../money.js';
import { applyEvent } from './apply.js';
import { assertBalanced } from '../ledger/invariants.js';
import { PHASE1_PRESETS } from '../chama/policies.js';
import type { Chama, Membership, Cycle, Bid } from '../chama/types.js';
import type { EngineContext } from './context.js';
import type { ChamaId, UserId, CycleId, BidId } from '../ids.js';

const C = 'c1' as ChamaId;
const U = (s: string) => s as UserId;

function chama(overrides: Partial<Chama> = {}): Chama {
  return {
    chamaId: C,
    name: 'Test chama',
    type: 'merryGoRound',
    policies: PHASE1_PRESETS.merryGoRound(money(50_000), 10, money(0), money(50_000)),
    currency: 'UGX',
    status: 'active',
    createdBy: U('admin'),
    createdAt: 0,
    memberCount: 4,
    cycleLength: { unit: 'week', n: 1 },
    contributionAmount: money(50_000),
    ...overrides,
  };
}

function membership(uid: string, share = 2500): Membership {
  return {
    membershipId: `${C}_${uid}`,
    chamaId: C, uid: U(uid), role: 'member', status: 'active',
    joinedAt: 0, share,
  } as unknown as Membership;
}

function cycle(overrides: Partial<Cycle> = {}): Cycle {
  return {
    cycleId: 'cyc1' as CycleId,
    chamaId: C, index: 0, opensAt: 0, closesAt: 1000,
    state: 'bidding', expectedAmount: money(50_000), pool: money(200_000),
    currency: 'UGX',
    ...overrides,
  };
}

function bid(uid: string, discount: number, placedAt = 0): Bid {
  return {
    bidId: `b_${uid}` as BidId, cycleId: 'cyc1' as CycleId, chamaId: C,
    uid: U(uid), discount: money(discount), placedAt, status: 'active',
  };
}

describe('engine — contribution', () => {
  it('produces a balanced 4-leg posting for a paid contribution', () => {
    const ctx: EngineContext = {
      chama: chama(),
      activeMemberships: [membership('alice'), membership('bob'), membership('cara'), membership('dan')],
      cycle: cycle({ pool: money(0) }),
      cycleContributedAmount: money(0),
      currency: 'UGX',
      now: 1,
    };
    const res = applyEvent({
      kind: 'contributionPaid',
      chamaId: C,
      cycleId: 'cyc1' as CycleId,
      contributionId: 'k1' as never,
      uid: U('alice'),
      amount: money(50_000),
      transactionId: 't1' as never,
      provider: 'mtnMomo',
      at: 1,
    }, ctx);
    assert.equal(res.postings.length, 4);
    assertBalanced(res.postings);
    assert.equal(res.stateUpdate.cyclePatch?.pool, 50_000);
  });

  it('rolling (welfare) contribution routes cash to reserve, not pool', () => {
    const c = chama({
      type: 'welfare',
      policies: PHASE1_PRESETS.welfare(money(10_000)),
    });
    const ctx: EngineContext = {
      chama: c,
      activeMemberships: [membership('alice')],
      currency: 'UGX',
      now: 1,
    };
    const res = applyEvent({
      kind: 'contributionPaid',
      chamaId: C, cycleId: 'cyc1' as CycleId, contributionId: 'k1' as never,
      uid: U('alice'), amount: money(10_000),
      transactionId: 't1' as never, provider: 'mtnMomo', at: 1,
    }, ctx);
    assertBalanced(res.postings);
    const reserveLeg = res.postings.find(p => p.account === `chama:${C}:reserve`);
    assert.ok(reserveLeg, 'reserve account should be credited for rolling contribution');
    assert.equal(reserveLeg.amount, 10_000);
  });
});

describe('engine — discount-bid cycle close', () => {
  it('selects highest bidder, distributes discount dividend, queues winner payout', () => {
    const ctx: EngineContext = {
      chama: chama(),
      activeMemberships: [
        membership('alice'), membership('bob'), membership('cara'), membership('dan'),
      ],
      cycle: cycle({ pool: money(200_000) }),
      cycleBids: [
        bid('alice', 10_000, 5),
        bid('bob', 20_000, 10),     // winner: highest discount
        bid('cara', 20_000, 20),    // same discount, later — loses on tiebreak
      ],
      currency: 'UGX',
      now: 100,
    };
    const res = applyEvent({
      kind: 'cycleClosed',
      chamaId: C, cycleId: 'cyc1' as CycleId, at: 100,
    }, ctx);

    assertBalanced(res.postings);
    assert.equal(res.stateUpdate.winnerUid, 'bob');
    assert.equal(res.stateUpdate.cyclePatch?.winningBid, 20_000);
    assert.equal(res.stateUpdate.payouts?.length, 1);
    assert.equal(res.stateUpdate.payouts?.[0]?.recipientUid, 'bob');
    assert.equal(res.stateUpdate.payouts?.[0]?.amount, 200_000 - 20_000);

    // Dividend: 20,000 split across 3 non-winners (alice, cara, dan).
    // 20000 / 3 = 6666 remainder 2 -> 6667, 6667, 6666.
    const stakeDeltas = new Map<string, number>();
    for (const p of res.postings) {
      if (p.account.startsWith(`member:`) && p.sourceKind === 'bid_dividend') {
        stakeDeltas.set(p.account, (stakeDeltas.get(p.account) ?? 0) + p.amount);
      }
    }
    const total = [...stakeDeltas.values()].reduce((a, b) => a + b, 0);
    assert.equal(total, 20_000, 'discount must be fully distributed');
    assert.equal(stakeDeltas.size, 3, 'three non-winners get a dividend');
  });

  it('no bids -> cycle settles, no payouts', () => {
    const ctx: EngineContext = {
      chama: chama(),
      activeMemberships: [membership('alice'), membership('bob')],
      cycle: cycle({ pool: money(100_000) }),
      cycleBids: [],
      currency: 'UGX',
      now: 100,
    };
    const res = applyEvent({
      kind: 'cycleClosed', chamaId: C, cycleId: 'cyc1' as CycleId, at: 100,
    }, ctx);
    assert.equal(res.postings.length, 0);
    assert.equal(res.stateUpdate.cyclePatch?.state, 'settled');
    assert.equal(res.stateUpdate.payouts, undefined);
  });
});

describe('engine — claim approval (welfare)', () => {
  it('queues a payout to the claimant', () => {
    const c = chama({
      type: 'welfare',
      policies: PHASE1_PRESETS.welfare(money(10_000)),
    });
    const ctx: EngineContext = {
      chama: c,
      activeMemberships: [membership('alice'), membership('bob')],
      currency: 'UGX',
      now: 100,
    };
    const res = applyEvent({
      kind: 'claimApproved',
      chamaId: C, claimId: 'cl1' as never,
      recipientUid: U('alice'), amount: money(150_000),
      approverUid: U('treasurer'), at: 100,
    }, ctx);
    assert.equal(res.postings.length, 0);
    assert.deepEqual(res.stateUpdate.payouts, [{ recipientUid: 'alice', amount: 150_000 }]);
  });

  it('rejects claim approval on wrong chama type', () => {
    const ctx: EngineContext = {
      chama: chama(), // merryGoRound
      activeMemberships: [membership('alice')],
      currency: 'UGX', now: 1,
    };
    assert.throws(() => applyEvent({
      kind: 'claimApproved', chamaId: C, claimId: 'cl1' as never,
      recipientUid: U('alice'), amount: money(10_000),
      approverUid: U('t'), at: 1,
    }, ctx));
  });
});

describe('engine — fixed savings maturity', () => {
  it('distributes pool proRata at maturity, remainder to last member', () => {
    const matures = 500;
    const c = chama({
      type: 'fixedSavings',
      policies: PHASE1_PRESETS.fixedSavings(money(50_000), 10, matures),
    });
    const ctx: EngineContext = {
      chama: c,
      activeMemberships: [
        // shares that don't divide evenly into 100k to force a remainder
        { ...membership('alice', 3333) },
        { ...membership('bob', 3333) },
        { ...membership('cara', 3334) },
      ],
      cycle: cycle({ pool: money(100_000), state: 'closing' }),
      cycleBids: [],
      currency: 'UGX',
      now: 600,
    };
    const res = applyEvent({
      kind: 'cycleClosed', chamaId: C, cycleId: 'cyc1' as CycleId, at: 600,
    }, ctx);
    const totalOut = res.stateUpdate.payouts?.reduce((s, p) => s + p.amount, 0) ?? 0;
    assert.equal(totalOut, 100_000, 'pool must be fully distributed');
    assert.equal(res.stateUpdate.cyclePatch?.state, 'distributing');
  });

  it('settles without distribution before maturity', () => {
    const matures = 999_999;
    const c = chama({
      type: 'fixedSavings',
      policies: PHASE1_PRESETS.fixedSavings(money(50_000), 10, matures),
    });
    const ctx: EngineContext = {
      chama: c,
      activeMemberships: [membership('alice'), membership('bob')],
      cycle: cycle({ pool: money(100_000) }),
      cycleBids: [],
      currency: 'UGX', now: 100,
    };
    const res = applyEvent({
      kind: 'cycleClosed', chamaId: C, cycleId: 'cyc1' as CycleId, at: 100,
    }, ctx);
    assert.equal(res.stateUpdate.payouts, undefined);
    assert.equal(res.stateUpdate.cyclePatch?.state, 'settled');
  });
});

describe('ledger invariants', () => {
  it('assertBalanced rejects unbalanced postings', () => {
    assert.throws(() => assertBalanced([
      { account: `member:a:${C}` as never, amount: money(100), currency: 'UGX', sourceKind: 'contribution', sourceRef: 'x' },
      { account: `chama:${C}:pool` as never, amount: money(-50), currency: 'UGX', sourceKind: 'contribution', sourceRef: 'x' },
    ]));
  });
});
