import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

import { getEnv, cleanup, shutdown, seedChama, CHAMA_ID } from './setup';

before(async () => {
  await getEnv();
});
after(async () => {
  await shutdown();
});
beforeEach(async () => {
  await cleanup();
});

describe('rules — anonymous access', () => {
  it('cannot read users', async () => {
    const env = await getEnv();
    const anon = env.unauthenticatedContext();
    await assertFails(anon.firestore().collection('users').doc('alice').get());
  });

  it('cannot read chamas', async () => {
    const env = await getEnv();
    await seedChama(env, CHAMA_ID, [{ uid: 'alice', role: 'member' }]);
    const anon = env.unauthenticatedContext();
    await assertFails(anon.firestore().collection('chamas').doc(CHAMA_ID).get());
  });
});

describe('rules — user docs', () => {
  it('user can read own user doc', async () => {
    const env = await getEnv();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('users').doc('alice').set({
        uid: 'alice', msisdn: '+256700000001', displayName: 'A',
        locale: 'en', kyc: { status: 'pending' }, createdAt: 0, disabled: false,
      });
    });
    const alice = env.authenticatedContext('alice');
    await assertSucceeds(alice.firestore().collection('users').doc('alice').get());
  });

  it('user cannot read another user doc', async () => {
    const env = await getEnv();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('users').doc('bob').set({
        uid: 'bob', msisdn: '+256700000002', displayName: 'B',
        locale: 'en', kyc: { status: 'pending' }, createdAt: 0, disabled: false,
      });
    });
    const alice = env.authenticatedContext('alice');
    await assertFails(alice.firestore().collection('users').doc('bob').get());
  });

  it('user cannot self-approve KYC', async () => {
    const env = await getEnv();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('users').doc('alice').set({
        uid: 'alice', msisdn: '+256700000001', displayName: 'A',
        locale: 'en', kyc: { status: 'pending' }, createdAt: 0, disabled: false,
      });
    });
    const alice = env.authenticatedContext('alice');
    await assertFails(alice.firestore().collection('users').doc('alice').update({
      'kyc.status': 'approved',
    }));
  });
});

describe('rules — chama scoping', () => {
  it('non-member cannot read chama', async () => {
    const env = await getEnv();
    await seedChama(env, CHAMA_ID, [{ uid: 'alice', role: 'member' }]);
    const bob = env.authenticatedContext('bob');
    await assertFails(bob.firestore().collection('chamas').doc(CHAMA_ID).get());
  });

  it('active member can read chama and memberships', async () => {
    const env = await getEnv();
    await seedChama(env, CHAMA_ID, [
      { uid: 'alice', role: 'member' },
      { uid: 'bob', role: 'treasurer' },
    ]);
    const alice = env.authenticatedContext('alice');
    await assertSucceeds(alice.firestore().collection('chamas').doc(CHAMA_ID).get());
    await assertSucceeds(alice.firestore().collection('chamas').doc(CHAMA_ID)
      .collection('memberships').get());
  });

  it('invited (non-active) member cannot read chama', async () => {
    const env = await getEnv();
    await seedChama(env, CHAMA_ID, [{ uid: 'alice', role: 'member', status: 'invited' }]);
    const alice = env.authenticatedContext('alice');
    await assertFails(alice.firestore().collection('chamas').doc(CHAMA_ID).get());
  });

  it('client cannot write a chama or membership doc', async () => {
    const env = await getEnv();
    await seedChama(env, CHAMA_ID, [{ uid: 'alice', role: 'admin' }]);
    const alice = env.authenticatedContext('alice');
    await assertFails(alice.firestore().collection('chamas').doc(CHAMA_ID).update({ name: 'hacked' }));
    await assertFails(alice.firestore().collection('chamas').doc(CHAMA_ID)
      .collection('memberships').doc(`${CHAMA_ID}_alice`).update({ role: 'admin' }));
  });
});

describe('rules — financial collections deny-all', () => {
  it('client cannot write to ledger_entries', async () => {
    const env = await getEnv();
    await seedChama(env, CHAMA_ID, [{ uid: 'alice', role: 'treasurer' }]);
    const alice = env.authenticatedContext('alice');
    await assertFails(alice.firestore().collection('ledger_entries').doc('e1').set({
      entryId: 'e1', chamaId: CHAMA_ID, txGroupId: 'g1',
      account: `chama:${CHAMA_ID}:pool`, amount: 100, currency: 'UGX',
      ts: 0, sourceKind: 'adjustment', sourceRef: 'x', postedBy: 'alice',
    }));
  });

  it('client cannot write to transactions', async () => {
    const env = await getEnv();
    const alice = env.authenticatedContext('alice');
    await assertFails(alice.firestore().collection('transactions').doc('t1').set({ amount: 1 }));
  });

  it('client cannot write to payouts', async () => {
    const env = await getEnv();
    await seedChama(env, CHAMA_ID, [{ uid: 'alice', role: 'admin' }]);
    const alice = env.authenticatedContext('alice');
    await assertFails(alice.firestore().collection('chamas').doc(CHAMA_ID)
      .collection('payouts').doc('p1').set({ recipientUid: 'alice', amount: 1 }));
  });

  it('client cannot write to audit_log', async () => {
    const env = await getEnv();
    const alice = env.authenticatedContext('alice');
    await assertFails(alice.firestore().collection('audit_log').doc('l1').set({
      logId: 'l1', actorUid: 'alice', action: 'tamper',
      target: { kind: 'chama', id: CHAMA_ID }, ts: 0,
    }));
  });
});

describe('rules — bids', () => {
  it('member can create a bid for self during bidding state', async () => {
    const env = await getEnv();
    await seedChama(env, CHAMA_ID, [{ uid: 'alice', role: 'member' }], { cycleState: 'bidding' });
    const alice = env.authenticatedContext('alice');
    await assertSucceeds(alice.firestore().collection('chamas').doc(CHAMA_ID)
      .collection('cycles').doc('cyc1').collection('bids').doc('b1').set({
        bidId: 'b1', cycleId: 'cyc1', chamaId: CHAMA_ID,
        uid: 'alice', discount: 10_000, placedAt: 0, status: 'active',
      }));
  });

  it('member cannot bid as someone else', async () => {
    const env = await getEnv();
    await seedChama(env, CHAMA_ID, [
      { uid: 'alice', role: 'member' }, { uid: 'bob', role: 'member' },
    ], { cycleState: 'bidding' });
    const alice = env.authenticatedContext('alice');
    await assertFails(alice.firestore().collection('chamas').doc(CHAMA_ID)
      .collection('cycles').doc('cyc1').collection('bids').doc('b1').set({
        bidId: 'b1', cycleId: 'cyc1', chamaId: CHAMA_ID,
        uid: 'bob', discount: 10_000, placedAt: 0, status: 'active',
      }));
  });

  it('member cannot bid when cycle is not in bidding state', async () => {
    const env = await getEnv();
    await seedChama(env, CHAMA_ID, [{ uid: 'alice', role: 'member' }], { cycleState: 'open' });
    const alice = env.authenticatedContext('alice');
    await assertFails(alice.firestore().collection('chamas').doc(CHAMA_ID)
      .collection('cycles').doc('cyc1').collection('bids').doc('b1').set({
        bidId: 'b1', cycleId: 'cyc1', chamaId: CHAMA_ID,
        uid: 'alice', discount: 10_000, placedAt: 0, status: 'active',
      }));
  });

  it('member can withdraw own bid but cannot mark it won', async () => {
    const env = await getEnv();
    await seedChama(env, CHAMA_ID, [{ uid: 'alice', role: 'member' }], { cycleState: 'bidding' });
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('chamas').doc(CHAMA_ID)
        .collection('cycles').doc('cyc1').collection('bids').doc('b1').set({
          bidId: 'b1', cycleId: 'cyc1', chamaId: CHAMA_ID,
          uid: 'alice', discount: 10_000, placedAt: 0, status: 'active',
        });
    });
    const alice = env.authenticatedContext('alice');
    await assertSucceeds(alice.firestore().collection('chamas').doc(CHAMA_ID)
      .collection('cycles').doc('cyc1').collection('bids').doc('b1').update({ status: 'withdrawn' }));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('chamas').doc(CHAMA_ID)
        .collection('cycles').doc('cyc1').collection('bids').doc('b1').update({ status: 'active' });
    });
    await assertFails(alice.firestore().collection('chamas').doc(CHAMA_ID)
      .collection('cycles').doc('cyc1').collection('bids').doc('b1').update({ status: 'won' }));
  });
});

describe('rules — claims', () => {
  it('member can file a claim for self in submitted state', async () => {
    const env = await getEnv();
    await seedChama(env, CHAMA_ID, [{ uid: 'alice', role: 'member' }]);
    const alice = env.authenticatedContext('alice');
    await assertSucceeds(alice.firestore().collection('chamas').doc(CHAMA_ID)
      .collection('claims').doc('cl1').set({
        claimId: 'cl1', chamaId: CHAMA_ID, uid: 'alice',
        reason: 'Sick', amountRequested: 100_000, currency: 'UGX', state: 'submitted',
      }));
  });

  it('member cannot file a claim and pre-approve it', async () => {
    const env = await getEnv();
    await seedChama(env, CHAMA_ID, [{ uid: 'alice', role: 'member' }]);
    const alice = env.authenticatedContext('alice');
    await assertFails(alice.firestore().collection('chamas').doc(CHAMA_ID)
      .collection('claims').doc('cl1').set({
        claimId: 'cl1', chamaId: CHAMA_ID, uid: 'alice',
        reason: 'Sick', amountRequested: 100_000, currency: 'UGX', state: 'approved',
      }));
  });

  it('treasurer cannot approve a claim via client write', async () => {
    const env = await getEnv();
    await seedChama(env, CHAMA_ID, [
      { uid: 'alice', role: 'member' }, { uid: 'tina', role: 'treasurer' },
    ]);
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('chamas').doc(CHAMA_ID).collection('claims').doc('cl1').set({
        claimId: 'cl1', chamaId: CHAMA_ID, uid: 'alice',
        reason: 'Sick', amountRequested: 100_000, currency: 'UGX', state: 'submitted',
      });
    });
    const tina = env.authenticatedContext('tina');
    // Approval requires Functions (Admin SDK). Client write must fail.
    await assertFails(tina.firestore().collection('chamas').doc(CHAMA_ID)
      .collection('claims').doc('cl1').update({ state: 'approved' }));
  });
});
