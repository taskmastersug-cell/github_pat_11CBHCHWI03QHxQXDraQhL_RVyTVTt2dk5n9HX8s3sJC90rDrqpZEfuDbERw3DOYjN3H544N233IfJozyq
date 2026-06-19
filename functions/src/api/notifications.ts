import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { requireUser } from './auth.js';

const RegisterReq = z.object({ token: z.string().min(8).max(4096) });
const UnregisterReq = z.object({ token: z.string().min(8).max(4096) });

export const registerFcmToken = onCall(async (req) => {
  const ctx = requireUser(req);
  const { token } = RegisterReq.parse(req.data);
  const db = getFirestore();
  try {
    await db.collection('users').doc(ctx.uid).update({
      fcmTokens: FieldValue.arrayUnion(token),
    });
  } catch (e) {
    throw new HttpsError('not-found', 'user_doc_missing');
  }
  return { ok: true } as const;
});

export const unregisterFcmToken = onCall(async (req) => {
  const ctx = requireUser(req);
  const { token } = UnregisterReq.parse(req.data);
  const db = getFirestore();
  await db.collection('users').doc(ctx.uid).update({
    fcmTokens: FieldValue.arrayRemove(token),
  });
  return { ok: true } as const;
});
