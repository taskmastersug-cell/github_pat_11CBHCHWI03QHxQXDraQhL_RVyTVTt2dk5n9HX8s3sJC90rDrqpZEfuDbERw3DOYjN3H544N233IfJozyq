import { createHmac } from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { z } from 'zod';
import type { UserId } from '@roundpay/shared';
import { requireUser, setKycApprovedClaim } from './auth.js';

const SubmitKycReq = z.object({
  nin: z.string().regex(/^[A-Z0-9]{14,16}$/, 'nin_invalid'),
  selfieRef: z.string().min(1), // Storage path returned by mintKycUploadUrl
});

// User submits NIN + uploaded selfie ref. NIN is hashed; raw never persists.
export const submitKyc = onCall(async (req) => {
  const ctx = requireUser(req);
  const input = SubmitKycReq.parse(req.data);
  const pepper = process.env.KYC_NIN_PEPPER ?? 'dev-pepper';
  const ninHash = createHmac('sha256', pepper).update(input.nin).digest('hex');

  const db = getFirestore();
  const userRef = db.collection('users').doc(ctx.uid);
  await userRef.set({
    uid: ctx.uid,
    kyc: { status: 'pending', ninHash, selfieRef: input.selfieRef, verifiedAt: null, reviewerUid: null },
  }, { merge: true });

  await db.collection('audit_log').add({
    actorUid: ctx.uid, action: 'kyc.submitted',
    target: { kind: 'user', id: ctx.uid },
    ts: Date.now(),
  });

  return { ok: true };
});

// Mints a short-lived signed URL for the KYC selfie upload. Path is scoped to
// the caller; Storage rules deny direct writes so this is the only path in.
export const mintKycUploadUrl = onCall(async (req) => {
  const ctx = requireUser(req);
  const path = `kyc/${ctx.uid}/selfie-${Date.now()}.jpg`;
  const bucket = getStorage().bucket();
  const [url] = await bucket.file(path).getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + 5 * 60 * 1000,
    contentType: 'image/jpeg',
  });
  return { url, path };
});

const ApproveKycReq = z.object({
  uid: z.string().min(1),
  approve: z.boolean(),
});

// Admin-only. In Phase 2 there's no UI — exposed for the admin reviewer queue
// that lands in Phase 3.
export const approveKyc = onCall(async (req) => {
  const ctx = requireUser(req);
  if (req.auth?.token?.kycReviewer !== true) {
    throw new HttpsError('permission-denied', 'reviewer_only');
  }
  const input = ApproveKycReq.parse(req.data);
  const db = getFirestore();
  const userRef = db.collection('users').doc(input.uid);
  await userRef.set({
    kyc: {
      status: input.approve ? 'approved' : 'rejected',
      reviewerUid: ctx.uid,
      verifiedAt: Date.now(),
    },
  }, { merge: true });
  await setKycApprovedClaim(input.uid as UserId, input.approve);
  await db.collection('audit_log').add({
    actorUid: ctx.uid, action: input.approve ? 'kyc.approved' : 'kyc.rejected',
    target: { kind: 'user', id: input.uid },
    ts: Date.now(),
  });
  return { ok: true };
});
