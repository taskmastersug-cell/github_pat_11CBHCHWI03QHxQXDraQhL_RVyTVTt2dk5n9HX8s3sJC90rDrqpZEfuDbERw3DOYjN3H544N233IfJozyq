import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { ChamaId, ChamaType, CurrencyCode, UserId } from '@roundpay/shared';
import { PHASE1_PRESETS, money, membershipDocId } from '@roundpay/shared';
import { requireUser, requireMembership, requireKycApproved } from './auth.js';

const CreateChamaReq = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(['merryGoRound', 'fixedSavings', 'welfare']),
  contributionAmount: z.number().int().positive(),
  cycleLength: z.object({ unit: z.enum(['day', 'week', 'month']), n: z.number().int().positive() }),
  cycleCount: z.number().int().positive(),
  // discountBid-only
  minDiscount: z.number().int().nonnegative().optional(),
  maxDiscount: z.number().int().positive().optional(),
  // fixedSavings-only
  maturesAt: z.number().optional(),
});

export const createChama = onCall(async (req) => {
  const ctx = requireUser(req);
  requireKycApproved(ctx);
  const input = CreateChamaReq.parse(req.data);
  const db = getFirestore();
  const ref = db.collection('chamas').doc();
  const chamaId = ref.id as ChamaId;
  const policies = buildPolicies(input);
  const currency: CurrencyCode = 'UGX';
  const createdAt = Date.now();

  await db.runTransaction(async (tx) => {
    tx.set(ref, {
      chamaId, name: input.name, type: input.type,
      policies,
      currency,
      status: 'active',
      createdBy: ctx.uid,
      createdAt,
      memberCount: 1,
      cycleLength: input.cycleLength,
      contributionAmount: money(input.contributionAmount),
    });
    const mid = membershipDocId(chamaId, ctx.uid);
    tx.set(ref.collection('memberships').doc(mid), {
      membershipId: mid, chamaId, uid: ctx.uid,
      role: 'admin', status: 'active',
      joinedAt: createdAt, share: 10_000,
    });
    // Materialize cycles upfront (Phase 1 decision).
    materializeCycles(ref, chamaId, input, currency, tx, createdAt);
  });

  return { chamaId };
});

const InviteMemberReq = z.object({
  chamaId: z.string(),
  uid: z.string(),
  role: z.enum(['member', 'treasurer']).default('member'),
});

export const inviteMember = onCall(async (req) => {
  const ctx = requireUser(req);
  const input = InviteMemberReq.parse(req.data);
  await requireMembership(input.chamaId as ChamaId, ctx.uid, ['admin', 'treasurer']);
  const db = getFirestore();
  const mid = membershipDocId(input.chamaId as ChamaId, input.uid as UserId);
  await db.collection('chamas').doc(input.chamaId).collection('memberships').doc(mid).set({
    membershipId: mid, chamaId: input.chamaId, uid: input.uid,
    role: input.role, status: 'invited',
    joinedAt: Date.now(), share: 0,
  });
  return { ok: true };
});

const AcceptInviteReq = z.object({ chamaId: z.string() });

export const acceptInvite = onCall(async (req) => {
  const ctx = requireUser(req);
  requireKycApproved(ctx);
  const input = AcceptInviteReq.parse(req.data);
  const db = getFirestore();
  const ref = db.collection('chamas').doc(input.chamaId);
  await db.runTransaction(async (tx) => {
    const mid = membershipDocId(input.chamaId as ChamaId, ctx.uid);
    const mRef = ref.collection('memberships').doc(mid);
    const mSnap = await tx.get(mRef);
    if (!mSnap.exists) throw new HttpsError('not-found', 'no_invitation');
    const m = mSnap.data() as { status: string };
    if (m.status !== 'invited') throw new HttpsError('failed-precondition', 'not_invited');
    tx.update(mRef, { status: 'active' });
    const cSnap = await tx.get(ref);
    const c = cSnap.data() as { memberCount: number };
    tx.update(ref, { memberCount: c.memberCount + 1 });
  });
  return { ok: true };
});

function buildPolicies(input: z.infer<typeof CreateChamaReq>) {
  switch (input.type) {
    case 'merryGoRound':
      if (input.minDiscount === undefined || input.maxDiscount === undefined) {
        throw new HttpsError('invalid-argument', 'discount_range_required');
      }
      return PHASE1_PRESETS.merryGoRound(
        money(input.contributionAmount),
        input.cycleCount,
        money(input.minDiscount),
        money(input.maxDiscount),
      );
    case 'fixedSavings':
      if (input.maturesAt === undefined) {
        throw new HttpsError('invalid-argument', 'maturesAt_required');
      }
      return PHASE1_PRESETS.fixedSavings(
        money(input.contributionAmount),
        input.cycleCount,
        input.maturesAt,
      );
    case 'welfare':
      return PHASE1_PRESETS.welfare(money(input.contributionAmount));
  }
}

function materializeCycles(
  chamaRef: FirebaseFirestore.DocumentReference,
  chamaId: ChamaId,
  input: z.infer<typeof CreateChamaReq>,
  currency: CurrencyCode,
  tx: FirebaseFirestore.Transaction,
  createdAt: number,
) {
  const dayMs = 86_400_000;
  const unitMs = input.cycleLength.unit === 'day' ? dayMs
    : input.cycleLength.unit === 'week' ? dayMs * 7
    : dayMs * 30;
  const cycleSpan = unitMs * input.cycleLength.n;
  for (let i = 0; i < input.cycleCount; i++) {
    const opensAt = createdAt + cycleSpan * i;
    const closesAt = opensAt + cycleSpan;
    const cycleRef = chamaRef.collection('cycles').doc();
    const isBidding = input.type === 'merryGoRound';
    tx.set(cycleRef, {
      cycleId: cycleRef.id,
      chamaId, index: i, opensAt, closesAt,
      ...(isBidding ? { biddingClosesAt: closesAt - dayMs } : {}),
      state: i === 0 ? 'contributing' : 'open',
      expectedAmount: money(input.contributionAmount),
      pool: money(0),
      currency,
    });
  }
}
