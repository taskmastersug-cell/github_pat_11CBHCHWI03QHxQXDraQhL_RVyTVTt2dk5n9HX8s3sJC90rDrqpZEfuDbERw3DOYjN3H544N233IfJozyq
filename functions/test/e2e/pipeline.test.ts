import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

import { dispatch } from '../../src/engine/dispatch';
import { handleProviderWebhook } from '../../src/webhooks/handleWebhook';
import { registerForTest, resetRegistry } from '../../src/providers/registry';
import { MockProvider } from '../../src/providers/mockProvider';
import { idempotencyKey } from '../../src/idempotency';
import {
  money, PHASE1_PRESETS, membershipDocId,
  type ChamaId, type UserId, type CycleId, type ContributionId,
} from '@roundpay/shared';

const PROJECT_ID = 'roundpay-e2e';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';

let app: App;
let db: Firestore;
let mockMtn: MockProvider;

before(() => {
  app = initializeApp({ projectId: PROJECT_ID }, 'e2e');
  db = getFirestore(app);
});

after(async () => {
  resetRegistry();
  await deleteApp(app);
});

beforeEach(async () => {
  resetRegistry();
  mockMtn = new MockProvider('mtnMomo', 'wh-secret');
  registerForTest('mtnMomo', mockMtn);
  // Clear chama subcollections BEFORE deleting chamas, then top-level.
  const chamas = await db.collection('chamas').get();
  for (const cd of chamas.docs) {
    for (const sub of ['memberships', 'cycles', 'contributions', 'payouts', 'claims']) {
      const subSnap = await cd.ref.collection(sub).get();
      const bb = db.batch();
      for (const dd of subSnap.docs) bb.delete(dd.ref);
      if (subSnap.size > 0) await bb.commit();
      // Some subs (cycles) have their own subcollections — bids under cycles
      if (sub === 'cycles') {
        for (const cycDoc of subSnap.docs) {
          const bidsSnap = await cycDoc.ref.collection('bids').get();
          const bb2 = db.batch();
          for (const bd of bidsSnap.docs) bb2.delete(bd.ref);
          if (bidsSnap.size > 0) await bb2.commit();
        }
      }
    }
  }
  for (const c of ['chamas', 'transactions', 'ledger_entries', 'audit_log']) {
    const snap = await db.collection(c).get();
    const b = db.batch();
    for (const d of snap.docs) b.delete(d.ref);
    if (snap.size > 0) await b.commit();
  }
});

async function seedChamaAndCycle(): Promise<{
  chamaId: ChamaId; cycleId: CycleId; contributionId: ContributionId; aliceUid: UserId;
}> {
  const chamaId = 'chama_e2e' as ChamaId;
  const aliceUid = 'alice' as UserId;
  const bobUid = 'bob' as UserId;
  await db.collection('chamas').doc(chamaId).set({
    chamaId, name: 'E2E', type: 'merryGoRound',
    currency: 'UGX', status: 'active',
    createdBy: 'admin', createdAt: 0, memberCount: 2,
    cycleLength: { unit: 'week', n: 1 }, contributionAmount: 50_000,
    policies: PHASE1_PRESETS.merryGoRound(money(50_000), 10, money(0), money(50_000)),
  });
  for (const uid of [aliceUid, bobUid]) {
    const mid = membershipDocId(chamaId, uid);
    await db.collection('chamas').doc(chamaId).collection('memberships').doc(mid).set({
      membershipId: mid, chamaId, uid, role: 'member', status: 'active',
      joinedAt: 0, share: 5_000,
    });
  }
  const cycleId = 'cyc_e2e' as CycleId;
  await db.collection('chamas').doc(chamaId).collection('cycles').doc(cycleId).set({
    cycleId, chamaId, index: 0, opensAt: 0, closesAt: 9_999_999_999,
    biddingClosesAt: 9_999_999_999,
    state: 'contributing', expectedAmount: 50_000, pool: 0, currency: 'UGX',
  });
  const contributionId = 'ct_e2e' as ContributionId;
  await db.collection('chamas').doc(chamaId).collection('contributions').doc(contributionId).set({
    contributionId, chamaId, cycleId, uid: aliceUid,
    amount: 50_000, currency: 'UGX', state: 'pending',
  });
  return { chamaId, cycleId, contributionId, aliceUid };
}

describe('e2e — contribution to confirmed deposit', () => {
  it('initiate -> webhook confirm -> ledger balances + cycle pool grows', async () => {
    const { chamaId, cycleId, contributionId, aliceUid } = await seedChamaAndCycle();
    const key = idempotencyKey(aliceUid, chamaId, contributionId, 0);

    // 1) Pre-write the transaction row (simulating what initiateContribution does)
    const txRef = db.collection('transactions').doc();
    await txRef.set({
      txId: txRef.id, kind: 'deposit', uid: aliceUid, chamaId,
      contributionId, msisdn: '+256700000001', amount: 50_000, currency: 'UGX',
      provider: 'mtnMomo', idempotencyKey: key,
      state: 'pending', initiatedAt: Date.now(),
    });

    // 2) Initiate against the mock provider
    const init = await mockMtn.initiateDeposit({
      idempotencyKey: key, msisdn: '+256700000001',
      amount: money(50_000), currency: 'UGX', reference: contributionId,
    });
    assert.equal(init.status, 'accepted');
    if (init.status !== 'accepted') return;
    await txRef.update({ providerRef: init.providerRef });

    // 3) Provider confirms (simulating sandbox callback)
    mockMtn._confirm(init.providerRef);
    const body = JSON.stringify({
      kind: 'depositConfirmed',
      providerRef: init.providerRef,
      idempotencyKey: key,
      amount: 50_000,
      settledAt: Date.now(),
    });
    const sig = mockMtn._sign(body);
    const res = await handleProviderWebhook('mtnMomo', { 'x-roundpay-signature': sig }, body, db);
    assert.equal(res.status, 200);

    // 4) Replay the same webhook — must be idempotent
    const res2 = await handleProviderWebhook('mtnMomo', { 'x-roundpay-signature': sig }, body, db);
    assert.equal(res2.status, 200);

    // 5) Ledger balances per currency
    const ledger = await db.collection('ledger_entries').where('chamaId', '==', chamaId).get();
    const byCurrency = new Map<string, number>();
    for (const d of ledger.docs) {
      const e = d.data() as { amount: number; currency: string };
      byCurrency.set(e.currency, (byCurrency.get(e.currency) ?? 0) + e.amount);
    }
    for (const [, sum] of byCurrency) assert.equal(sum, 0, 'ledger must balance');

    // 6) Exactly one ledger group (4 entries) — replay didn't double-post
    assert.equal(ledger.size, 4, 'expected 4 ledger entries from one contribution');

    // 7) Cycle pool reflects the contribution
    const cycle = await db.collection('chamas').doc(chamaId).collection('cycles').doc(cycleId).get();
    assert.equal((cycle.data() as { pool: number }).pool, 50_000);

    // 8) Transaction is confirmed
    const tx = await txRef.get();
    assert.equal((tx.data() as { state: string }).state, 'confirmed');
  });

  it('webhook with bad signature returns 401', async () => {
    const res = await handleProviderWebhook('mtnMomo',
      { 'x-roundpay-signature': 'deadbeef' },
      JSON.stringify({}),
      db);
    assert.equal(res.status, 401);
  });

  it('webhook for unknown transaction returns 422', async () => {
    const body = JSON.stringify({
      kind: 'depositConfirmed',
      providerRef: 'unknown',
      idempotencyKey: 'never-seen',
      amount: 1,
    });
    const sig = mockMtn._sign(body);
    const res = await handleProviderWebhook('mtnMomo', { 'x-roundpay-signature': sig }, body, db);
    assert.equal(res.status, 422);
  });
});

describe('e2e — bid + cycle close + winner payout queued', () => {
  it('two bids posted, cycle closes, winner payout is queued and dividend distributed', async () => {
    const { chamaId, cycleId } = await seedChamaAndCycle();
    // Move cycle to bidding state and seed pool
    await db.collection('chamas').doc(chamaId).collection('cycles').doc(cycleId).update({
      state: 'bidding', pool: 100_000,
    });

    // Two bids via dispatch (which validates against the engine)
    await dispatch({
      kind: 'bidPlaced', chamaId, cycleId,
      bidId: 'b_alice' as never, uid: 'alice' as UserId,
      discount: money(10_000), at: 100,
    }, db);
    // Persist bid docs (dispatch doesn't currently write them — the callable does)
    await db.collection('chamas').doc(chamaId).collection('cycles').doc(cycleId)
      .collection('bids').doc('b_alice').set({
        bidId: 'b_alice', cycleId, chamaId, uid: 'alice',
        discount: 10_000, placedAt: 100, status: 'active',
      });
    await dispatch({
      kind: 'bidPlaced', chamaId, cycleId,
      bidId: 'b_bob' as never, uid: 'bob' as UserId,
      discount: money(20_000), at: 110,
    }, db);
    await db.collection('chamas').doc(chamaId).collection('cycles').doc(cycleId)
      .collection('bids').doc('b_bob').set({
        bidId: 'b_bob', cycleId, chamaId, uid: 'bob',
        discount: 20_000, placedAt: 110, status: 'active',
      });

    // Close cycle
    const result = await dispatch({
      kind: 'cycleClosed', chamaId, cycleId, at: 200,
    }, db);

    assert.equal(result.winnerUid, 'bob');
    assert.equal(result.payoutsQueued, 1);

    // Ledger balances
    const ledger = await db.collection('ledger_entries').where('chamaId', '==', chamaId).get();
    const byCurrency = new Map<string, number>();
    for (const d of ledger.docs) {
      const e = d.data() as { amount: number; currency: string };
      byCurrency.set(e.currency, (byCurrency.get(e.currency) ?? 0) + e.amount);
    }
    for (const [, sum] of byCurrency) assert.equal(sum, 0, 'ledger must balance after distribution');

    // Payout queued for bob
    const payouts = await db.collection('chamas').doc(chamaId).collection('payouts').get();
    assert.equal(payouts.size, 1);
    const payout = payouts.docs[0]!.data() as { recipientUid: string; amount: number; state: string };
    assert.equal(payout.recipientUid, 'bob');
    assert.equal(payout.amount, 80_000);
    assert.equal(payout.state, 'queued');
  });
});
