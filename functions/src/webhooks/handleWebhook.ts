import { getFirestore, Firestore } from 'firebase-admin/firestore';
import type {
  ChamaId, CycleId, ContributionId, TransactionId, UserId,
} from '@roundpay/shared';
import { money } from '@roundpay/shared';
import { dispatch } from '../engine/dispatch.js';
import { getProvider } from '../providers/registry.js';
import type { WebhookEvent } from '../providers/Provider.js';
import { ProviderSignatureError } from '../providers/Provider.js';
import type { Provider } from '@roundpay/shared';

export interface WebhookHandlerResult {
  status: 200 | 400 | 401 | 409 | 422 | 500;
  body: { ok: boolean; reason?: string };
}

// One handler shared by both /webhooks/mtn-momo and /webhooks/airtel-money.
// Provider-specific logic lives in the adapter's parseWebhook.
export async function handleProviderWebhook(
  providerName: Provider,
  headers: Record<string, string | undefined>,
  rawBody: string,
  db: Firestore = getFirestore(),
): Promise<WebhookHandlerResult> {
  const provider = getProvider(providerName);
  let event: WebhookEvent;
  try {
    event = provider.parseWebhook(headers, rawBody);
  } catch (err) {
    if (err instanceof ProviderSignatureError) {
      return { status: 401, body: { ok: false, reason: 'bad_signature' } };
    }
    return { status: 400, body: { ok: false, reason: 'parse_failed' } };
  }

  // Idempotency check — by (provider, idempotencyKey) unique on transactions.
  const existing = await db.collection('transactions')
    .where('provider', '==', providerName)
    .where('idempotencyKey', '==', event.idempotencyKey)
    .limit(1)
    .get();

  if (existing.empty) {
    // Webhook arrived for an unknown transaction. Should not happen in normal
    // flow because we always pre-write a `transactions/{id}` doc when we
    // initiate. Log + 422 (semantically: we can't process this).
    return { status: 422, body: { ok: false, reason: 'unknown_transaction' } };
  }

  const txDoc = existing.docs[0]!;
  const tx = txDoc.data() as {
    txId: TransactionId;
    chamaId: ChamaId;
    uid: UserId;
    kind: 'deposit' | 'payout';
    contributionId?: ContributionId;
    payoutId?: string;
    state: 'pending' | 'confirmed' | 'failed' | 'reconciled';
    amount: number;
  };

  // Already settled — replay; return 200 idempotently.
  if (tx.state !== 'pending') {
    return { status: 200, body: { ok: true } };
  }

  if (event.kind === 'depositConfirmed' && tx.kind === 'deposit') {
    await db.runTransaction(async (t) => {
      t.update(txDoc.ref, { state: 'confirmed', confirmedAt: event.settledAt, providerRef: event.providerRef });
    });
    // Engine event outside the txn — dispatch opens its own.
    if (tx.contributionId) {
      await dispatch({
        kind: 'contributionPaid',
        chamaId: tx.chamaId,
        cycleId: await lookupCycleForContribution(db, tx.chamaId, tx.contributionId),
        contributionId: tx.contributionId,
        uid: tx.uid,
        amount: money(tx.amount),
        transactionId: tx.txId,
        provider: providerName,
        at: event.settledAt,
      }, db);
    }
    return { status: 200, body: { ok: true } };
  }

  if (event.kind === 'depositFailed' || event.kind === 'payoutFailed') {
    await txDoc.ref.update({
      state: 'failed', confirmedAt: Date.now(), providerRef: event.providerRef,
      raw: { code: event.code, message: event.message },
    });
    return { status: 200, body: { ok: true } };
  }

  if (event.kind === 'payoutConfirmed' && tx.kind === 'payout' && tx.payoutId) {
    await db.runTransaction(async (t) => {
      t.update(txDoc.ref, { state: 'confirmed', confirmedAt: event.settledAt, providerRef: event.providerRef });
      const payoutRef = db.collection('chamas').doc(tx.chamaId).collection('payouts').doc(tx.payoutId!);
      t.update(payoutRef, { state: 'sent', settledAt: event.settledAt, providerRef: event.providerRef });
    });
    return { status: 200, body: { ok: true } };
  }

  return { status: 200, body: { ok: true } };
}

async function lookupCycleForContribution(
  db: Firestore,
  chamaId: ChamaId,
  contributionId: ContributionId,
): Promise<CycleId> {
  const snap = await db.collection('chamas').doc(chamaId).collection('contributions').doc(contributionId).get();
  if (!snap.exists) throw new Error(`contribution ${contributionId} not found`);
  return (snap.data() as { cycleId: CycleId }).cycleId;
}
