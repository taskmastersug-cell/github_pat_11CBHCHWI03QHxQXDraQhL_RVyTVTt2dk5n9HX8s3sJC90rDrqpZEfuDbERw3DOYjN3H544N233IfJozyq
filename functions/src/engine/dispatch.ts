import { getFirestore, FieldValue, Firestore, Transaction } from 'firebase-admin/firestore';
import {
  applyEvent, assertBalanced, money,
  membershipDocId,
  type Chama, type Cycle, type Bid, type Membership,
  type EngineContext, type Money, type RoundPayEvent, type UserId, type ChamaId,
} from '@roundpay/shared';

// Bridge between Firestore and the pure engine. Reads what the engine needs,
// runs applyEvent, writes ledger entries + state patches transactionally.
// Caller is responsible for any provider-side side effects (queueing payouts,
// etc.) — those live in the orchestrator above.

export interface DispatchResult {
  postingsWritten: number;
  payoutsQueued: number;
  winnerUid?: UserId | undefined;
}

export async function dispatch(event: RoundPayEvent, db: Firestore = getFirestore()): Promise<DispatchResult> {
  return db.runTransaction(async (tx) => dispatchInTx(event, db, tx));
}

export async function dispatchInTx(
  event: RoundPayEvent,
  db: Firestore,
  tx: Transaction,
): Promise<DispatchResult> {
  const chamaRef = db.collection('chamas').doc(event.chamaId);
  const chamaSnap = await tx.get(chamaRef);
  if (!chamaSnap.exists) throw new Error(`chama ${event.chamaId} not found`);
  const chama = chamaSnap.data() as Chama;

  const membershipsSnap = await tx.get(chamaRef.collection('memberships').where('status', '==', 'active'));
  const activeMemberships = membershipsSnap.docs.map(d => d.data() as Membership);

  let cycle: Cycle | undefined;
  let cycleBids: Bid[] | undefined;
  let cycleContributedAmount: Money | undefined;
  if ('cycleId' in event && event.cycleId) {
    const cycleRef = chamaRef.collection('cycles').doc(event.cycleId);
    const cycleSnap = await tx.get(cycleRef);
    if (!cycleSnap.exists) throw new Error(`cycle ${event.cycleId} not found`);
    cycle = cycleSnap.data() as Cycle;
    const bidsSnap = await tx.get(cycleRef.collection('bids'));
    cycleBids = bidsSnap.docs.map(d => d.data() as Bid);
    cycleContributedAmount = cycle.pool;
  }

  let memberStakes: Map<UserId, Money> | undefined;
  if (event.kind === 'memberExit') {
    memberStakes = await readMemberStakes(db, event.chamaId, [event.uid]);
  }

  const ctx: EngineContext = {
    chama,
    activeMemberships,
    currency: chama.currency,
    now: 'at' in event ? event.at : Date.now(),
    ...(cycle ? { cycle } : {}),
    ...(cycleBids ? { cycleBids } : {}),
    ...(cycleContributedAmount !== undefined ? { cycleContributedAmount } : {}),
    ...(memberStakes ? { memberStakes } : {}),
  };

  const result = applyEvent(event, ctx);
  if (result.postings.length > 0) assertBalanced(result.postings);

  // Write postings as ledger entries (immutable).
  const txGroupId = db.collection('ledger_entries').doc().id;
  const ts = ctx.now;
  for (const p of result.postings) {
    const entryRef = db.collection('ledger_entries').doc();
    tx.set(entryRef, {
      entryId: entryRef.id,
      chamaId: event.chamaId,
      txGroupId,
      account: p.account,
      amount: p.amount,
      currency: p.currency,
      ts,
      sourceKind: p.sourceKind,
      sourceRef: p.sourceRef,
      postedBy: 'system',
    });
  }

  // Apply state updates.
  const update = result.stateUpdate;
  if (cycle && update.cyclePatch) {
    const cycleRef = chamaRef.collection('cycles').doc(cycle.cycleId);
    tx.update(cycleRef, update.cyclePatch as Record<string, unknown>);
  }
  if (cycle && update.bidPatches) {
    for (const bp of update.bidPatches) {
      const bidRef = chamaRef.collection('cycles').doc(cycle.cycleId).collection('bids').doc(bp.bidId);
      tx.update(bidRef, { status: bp.status });
    }
  }

  // Queue payouts.
  let queued = 0;
  if (update.payouts) {
    for (const p of update.payouts) {
      const payoutRef = chamaRef.collection('payouts').doc();
      tx.set(payoutRef, {
        payoutId: payoutRef.id,
        chamaId: event.chamaId,
        cycleId: cycle?.cycleId,
        recipientUid: p.recipientUid,
        amount: p.amount,
        currency: chama.currency,
        state: 'queued',
        provider: 'mtnMomo', // resolved at dispatch time by callers who know the recipient's wallet
        attempts: 0,
        createdAt: ts,
      });
      queued++;
    }
  }

  // memberExit also flips the membership status.
  if (event.kind === 'memberExit') {
    const mRef = chamaRef.collection('memberships').doc(membershipDocId(event.chamaId, event.uid));
    tx.update(mRef, { status: 'exited' });
  }

  // Audit log
  const auditRef = db.collection('audit_log').doc();
  tx.set(auditRef, {
    logId: auditRef.id,
    actorUid: 'system',
    action: `engine.${event.kind}`,
    target: { kind: 'chama', id: event.chamaId },
    after: { txGroupId, postingsWritten: result.postings.length, payoutsQueued: queued },
    ts,
  });

  return {
    postingsWritten: result.postings.length,
    payoutsQueued: queued,
    winnerUid: update.winnerUid,
  };
}

async function readMemberStakes(
  db: Firestore,
  chamaId: ChamaId,
  uids: ReadonlyArray<UserId>,
): Promise<Map<UserId, Money>> {
  const out = new Map<UserId, Money>();
  for (const uid of uids) {
    const account = `member:${uid}:${chamaId}`;
    const snap = await db.collection('ledger_entries')
      .where('chamaId', '==', chamaId)
      .where('account', '==', account)
      .get();
    let sum = 0;
    for (const d of snap.docs) sum += (d.data() as { amount: number }).amount;
    out.set(uid, money(sum));
  }
  return out;
}
