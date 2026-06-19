import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import type { Chama, Claim, Payout, Transaction, UserDoc, UserId } from '@roundpay/shared';
import { sendPush } from './push.js';

async function chamaName(chamaId: string): Promise<string> {
  const snap = await getFirestore().collection('chamas').doc(chamaId).get();
  return ((snap.data() as Chama | undefined)?.name) ?? '';
}

// Transactions: pending → confirmed for deposit kind → notify contributor.
export const onTransactionWritten = onDocumentWritten('transactions/{txId}', async (event) => {
  const before = event.data?.before.data() as Transaction | undefined;
  const after = event.data?.after.data() as Transaction | undefined;
  if (!after) return;
  if (after.kind !== 'deposit') return;
  if (after.state !== 'confirmed') return;
  if (before?.state === 'confirmed') return;
  if (!after.contributionId) return;

  const cRef = getFirestore().collection('chamas').doc(after.chamaId)
    .collection('contributions').doc(after.contributionId);
  const cSnap = await cRef.get();
  const cycleId = (cSnap.data() as { cycleId?: string } | undefined)?.cycleId ?? '';

  await sendPush(after.uid as UserId, {
    kind: 'contributionConfirmed',
    chamaName: await chamaName(after.chamaId),
    amount: after.amount,
    chamaId: after.chamaId,
    cycleId,
  });
});

// Payouts: any state → sent → notify recipient.
export const onPayoutWritten = onDocumentWritten('chamas/{chamaId}/payouts/{payoutId}', async (event) => {
  const before = event.data?.before.data() as Payout | undefined;
  const after = event.data?.after.data() as Payout | undefined;
  if (!after) return;
  if (after.state !== 'sent') return;
  if (before?.state === 'sent') return;
  await sendPush(after.recipientUid as UserId, {
    kind: 'payoutSent',
    chamaName: await chamaName(after.chamaId),
    amount: after.amount,
    chamaId: after.chamaId,
  });
});

// Claims: submitted → approved/rejected → notify filer.
export const onClaimWritten = onDocumentWritten('chamas/{chamaId}/claims/{claimId}', async (event) => {
  const before = event.data?.before.data() as Claim | undefined;
  const after = event.data?.after.data() as Claim | undefined;
  if (!after) return;
  if (before?.state === after.state) return;
  const name = await chamaName(after.chamaId);
  if (after.state === 'approved') {
    await sendPush(after.uid as UserId, {
      kind: 'claimApproved',
      chamaName: name,
      amount: after.amountRequested,
      chamaId: after.chamaId,
      claimId: after.claimId,
    });
  } else if (after.state === 'rejected') {
    await sendPush(after.uid as UserId, {
      kind: 'claimRejected',
      chamaName: name,
      chamaId: after.chamaId,
      claimId: after.claimId,
    });
  }
});

// Users: kyc.status transitions to approved → notify.
export const onUserKycWritten = onDocumentWritten('users/{uid}', async (event) => {
  const before = event.data?.before.data() as UserDoc | undefined;
  const after = event.data?.after.data() as UserDoc | undefined;
  if (!after) return;
  if (after.kyc?.status !== 'approved') return;
  if (before?.kyc?.status === 'approved') return;
  await sendPush(after.uid, { kind: 'kycApproved' });
});
