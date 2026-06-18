import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import type { Provider } from '@roundpay/shared';
import { getProvider } from '../providers/registry.js';

const FIVE_MIN = 5 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

// Runs every 5 min. Walks pending transactions older than 5 min and asks the
// provider for the current status. Updates state when the provider confirms /
// fails. After 24h of pending we write an opsAlert to audit_log.
export const reconcilePendingTransactions = onSchedule('every 5 minutes', async () => {
  const db = getFirestore();
  const cutoff = Date.now() - FIVE_MIN;
  const snap = await db.collection('transactions')
    .where('state', '==', 'pending')
    .where('initiatedAt', '<', cutoff)
    .limit(500)
    .get();

  for (const doc of snap.docs) {
    const tx = doc.data() as {
      provider: Provider;
      providerRef?: string;
      initiatedAt: number;
      chamaId: string;
    };
    if (!tx.providerRef) continue;
    let status;
    try {
      status = await getProvider(tx.provider).queryTransaction(tx.providerRef);
    } catch (err) {
      // Provider unavailable; skip this round.
      continue;
    }
    if (status.state === 'confirmed') {
      await doc.ref.update({ state: 'confirmed', confirmedAt: status.settledAt });
    } else if (status.state === 'failed') {
      await doc.ref.update({ state: 'failed', confirmedAt: Date.now(), raw: { code: status.code, message: status.message } });
    } else if (Date.now() - tx.initiatedAt > DAY) {
      await db.collection('audit_log').add({
        actorUid: 'system',
        action: 'opsAlert.staleTransaction',
        target: { kind: 'transaction', id: doc.id },
        after: { providerRef: tx.providerRef, ageMs: Date.now() - tx.initiatedAt },
        ts: Date.now(),
      });
    }
  }
});

// Nightly invariant check: sum of all ledger_entries per chama per currency
// must be zero. If non-zero, log an alert and freeze chama distributions.
export const verifyChamaLedger = onSchedule('every day 02:00', async () => {
  const db = getFirestore();
  const chamas = await db.collection('chamas').get();
  for (const c of chamas.docs) {
    const chamaId = c.id;
    const entries = await db.collection('ledger_entries').where('chamaId', '==', chamaId).get();
    const byCurrency = new Map<string, number>();
    for (const e of entries.docs) {
      const d = e.data() as { amount: number; currency: string };
      byCurrency.set(d.currency, (byCurrency.get(d.currency) ?? 0) + d.amount);
    }
    for (const [currency, sum] of byCurrency) {
      if (sum !== 0) {
        await db.collection('audit_log').add({
          actorUid: 'system',
          action: 'opsAlert.ledgerImbalance',
          target: { kind: 'chama', id: chamaId },
          after: { currency, net: sum },
          ts: Date.now(),
        });
        await c.ref.update({ status: 'paused' });
      }
    }
  }
});

// Closes any cycle whose closesAt has passed. Emits cycleClosed into engine.
export const closeMaturedCycles = onSchedule('every 10 minutes', async () => {
  const db = getFirestore();
  const now = Date.now();
  const chamas = await db.collection('chamas').where('status', '==', 'active').get();
  for (const chamaDoc of chamas.docs) {
    const closing = await chamaDoc.ref.collection('cycles')
      .where('state', 'in', ['contributing', 'bidding', 'closing'])
      .where('closesAt', '<', now)
      .get();
    for (const cd of closing.docs) {
      // The orchestrator imports lazily so the scheduled file stays cheap to load.
      const { dispatch } = await import('../engine/dispatch.js');
      await dispatch({
        kind: 'cycleClosed',
        chamaId: chamaDoc.id as never,
        cycleId: cd.id as never,
        at: now,
      });
    }
  }
});
