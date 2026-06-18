import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import type { ChamaId } from '@roundpay/shared';
import { requireUser, requireMembership } from './auth.js';
import { dispatch } from '../engine/dispatch.js';

const RequestExitReq = z.object({ chamaId: z.string() });

export const requestExit = onCall(async (req) => {
  const ctx = requireUser(req);
  const input = RequestExitReq.parse(req.data);
  await requireMembership(input.chamaId as ChamaId, ctx.uid);
  try {
    const r = await dispatch({
      kind: 'memberExit',
      chamaId: input.chamaId as ChamaId,
      uid: ctx.uid,
      at: Date.now(),
    });
    return { ok: true, payoutsQueued: r.payoutsQueued };
  } catch (err) {
    throw new HttpsError('failed-precondition', (err as Error).message);
  }
});
