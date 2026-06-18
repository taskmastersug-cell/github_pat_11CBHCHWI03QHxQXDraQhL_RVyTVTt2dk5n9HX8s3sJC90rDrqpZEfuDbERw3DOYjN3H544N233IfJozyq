import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { ChamaId, ContributionId, Provider } from '@roundpay/shared';
import { requireUser, requireMembership, requireKycApproved } from './auth.js';
import { getProvider } from '../providers/registry.js';
import { idempotencyKey } from '../idempotency.js';

const InitiateContributionReq = z.object({
  chamaId: z.string(),
  contributionId: z.string(),
  provider: z.enum(['mtnMomo', 'airtelMoney']),
  msisdn: z.string().regex(/^\+?\d{9,15}$/),
  attempt: z.number().int().nonnegative().default(0),
});

export const initiateContribution = onCall(async (req) => {
  const ctx = requireUser(req);
  requireKycApproved(ctx);
  const input = InitiateContributionReq.parse(req.data);
  const chamaId = input.chamaId as ChamaId;
  await requireMembership(chamaId, ctx.uid);

  const db = getFirestore();
  const cRef = db.collection('chamas').doc(chamaId).collection('contributions').doc(input.contributionId);
  const cSnap = await cRef.get();
  if (!cSnap.exists) throw new HttpsError('not-found', 'contribution_not_found');
  const c = cSnap.data() as { uid: string; amount: number; state: string; currency: 'UGX' };
  if (c.uid !== ctx.uid) throw new HttpsError('permission-denied', 'wrong_member');
  if (c.state !== 'pending' && c.state !== 'late') {
    throw new HttpsError('failed-precondition', `contribution_state_${c.state}`);
  }

  const key = idempotencyKey(ctx.uid, chamaId, input.contributionId, input.attempt);
  const provider = getProvider(input.provider as Provider);

  // Pre-write transaction row so the webhook always has somewhere to land.
  const txRef = db.collection('transactions').doc();
  await txRef.set({
    txId: txRef.id,
    kind: 'deposit',
    uid: ctx.uid, chamaId,
    contributionId: input.contributionId,
    msisdn: input.msisdn, amount: c.amount, currency: c.currency,
    provider: input.provider, idempotencyKey: key,
    state: 'pending', initiatedAt: Date.now(),
  });

  const result = await provider.initiateDeposit({
    idempotencyKey: key,
    msisdn: input.msisdn,
    amount: c.amount as never,
    currency: c.currency,
    reference: input.contributionId,
  });

  if (result.status === 'rejected') {
    await txRef.update({ state: 'failed', raw: { code: result.code, message: result.message } });
    throw new HttpsError('failed-precondition', `provider_${result.code}`);
  }

  await txRef.update({ providerRef: result.providerRef });
  return { txId: txRef.id };
});
