import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { z } from 'zod';
import type { ChamaId, ClaimId, UserId } from '@roundpay/shared';
import { money } from '@roundpay/shared';
import { requireUser, requireMembership, requireKycApproved } from './auth.js';
import { dispatch } from '../engine/dispatch.js';

const FileClaimReq = z.object({
  chamaId: z.string(),
  reason: z.string().min(1).max(500),
  amountRequested: z.number().int().positive(),
  evidenceRef: z.string().min(1),
});

export const fileClaim = onCall(async (req) => {
  const ctx = requireUser(req);
  requireKycApproved(ctx);
  const input = FileClaimReq.parse(req.data);
  await requireMembership(input.chamaId as ChamaId, ctx.uid);
  const db = getFirestore();
  const ref = db.collection('chamas').doc(input.chamaId).collection('claims').doc();
  await ref.set({
    claimId: ref.id,
    chamaId: input.chamaId,
    uid: ctx.uid,
    reason: input.reason,
    amountRequested: money(input.amountRequested),
    currency: 'UGX',
    evidenceRef: input.evidenceRef,
    state: 'submitted',
  });
  return { claimId: ref.id };
});

const ApproveClaimReq = z.object({
  chamaId: z.string(),
  claimId: z.string(),
  approve: z.boolean(),
});

export const approveClaim = onCall(async (req) => {
  const ctx = requireUser(req);
  const input = ApproveClaimReq.parse(req.data);
  await requireMembership(input.chamaId as ChamaId, ctx.uid, ['treasurer', 'admin']);

  const db = getFirestore();
  const claimRef = db.collection('chamas').doc(input.chamaId).collection('claims').doc(input.claimId);
  const snap = await claimRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'claim_not_found');
  const claim = snap.data() as { uid: UserId; amountRequested: number; state: string };
  if (claim.state !== 'submitted') throw new HttpsError('failed-precondition', 'not_submittable');

  await claimRef.update({
    state: input.approve ? 'approved' : 'rejected',
    reviewerUid: ctx.uid,
    reviewedAt: Date.now(),
  });

  if (input.approve) {
    await dispatch({
      kind: 'claimApproved',
      chamaId: input.chamaId as ChamaId,
      claimId: input.claimId as ClaimId,
      recipientUid: claim.uid,
      amount: money(claim.amountRequested),
      approverUid: ctx.uid,
      at: Date.now(),
    });
  }
  return { ok: true };
});

const MintEvidenceUrlReq = z.object({
  chamaId: z.string(),
});

export const mintEvidenceUploadUrl = onCall(async (req) => {
  const ctx = requireUser(req);
  const input = MintEvidenceUrlReq.parse(req.data);
  await requireMembership(input.chamaId as ChamaId, ctx.uid);
  const path = `evidence/${input.chamaId}/${ctx.uid}-${Date.now()}.bin`;
  const [url] = await getStorage().bucket().file(path).getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + 5 * 60 * 1000,
  });
  return { url, path };
});

const ReadEvidenceReq = z.object({
  chamaId: z.string(),
  path: z.string().min(1),
});

// Functions-proxied read of claim evidence (per Phase 2 decision). Caller must
// be treasurer/admin of the chama.
export const readEvidence = onCall(async (req) => {
  const ctx = requireUser(req);
  const input = ReadEvidenceReq.parse(req.data);
  await requireMembership(input.chamaId as ChamaId, ctx.uid, ['treasurer', 'admin']);
  if (!input.path.startsWith(`evidence/${input.chamaId}/`)) {
    throw new HttpsError('permission-denied', 'wrong_scope');
  }
  const [url] = await getStorage().bucket().file(input.path).getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 5 * 60 * 1000,
  });
  return { url };
});
