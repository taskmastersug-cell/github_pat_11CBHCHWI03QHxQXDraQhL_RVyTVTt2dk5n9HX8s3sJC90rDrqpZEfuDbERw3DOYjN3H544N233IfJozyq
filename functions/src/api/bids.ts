import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { BidId, ChamaId, CycleId } from '@roundpay/shared';
import { money } from '@roundpay/shared';
import { requireUser, requireMembership, requireKycApproved } from './auth.js';
import { dispatch } from '../engine/dispatch.js';

const PlaceBidReq = z.object({
  chamaId: z.string(),
  cycleId: z.string(),
  discount: z.number().int().nonnegative(),
});

export const placeBid = onCall(async (req) => {
  const ctx = requireUser(req);
  requireKycApproved(ctx);
  const input = PlaceBidReq.parse(req.data);
  await requireMembership(input.chamaId as ChamaId, ctx.uid);

  const db = getFirestore();
  const bidsRef = db.collection('chamas').doc(input.chamaId)
    .collection('cycles').doc(input.cycleId).collection('bids');
  const bidRef = bidsRef.doc();
  const at = Date.now();

  // Engine validates (cycle state, bid window, discount range). It throws if
  // invalid; we map to HttpsError.
  try {
    await dispatch({
      kind: 'bidPlaced',
      chamaId: input.chamaId as ChamaId,
      cycleId: input.cycleId as CycleId,
      bidId: bidRef.id as BidId,
      uid: ctx.uid,
      discount: money(input.discount),
      at,
    });
  } catch (err) {
    throw new HttpsError('failed-precondition', (err as Error).message);
  }

  await bidRef.set({
    bidId: bidRef.id,
    chamaId: input.chamaId,
    cycleId: input.cycleId,
    uid: ctx.uid,
    discount: input.discount,
    placedAt: at,
    status: 'active',
  });
  return { bidId: bidRef.id };
});
