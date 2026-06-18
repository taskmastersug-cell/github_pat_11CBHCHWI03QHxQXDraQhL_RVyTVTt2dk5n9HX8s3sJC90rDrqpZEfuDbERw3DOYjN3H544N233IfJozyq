import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import type { ChamaId, MemberRole, UserId } from '@roundpay/shared';
import { membershipDocId } from '@roundpay/shared';

export interface AuthedContext {
  uid: UserId;
  kycApproved: boolean;
}

export function requireUser(req: CallableRequest): AuthedContext {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'sign-in required');
  const kycApproved = req.auth?.token?.kycApproved === true;
  return { uid: uid as UserId, kycApproved };
}

export function requireKycApproved(ctx: AuthedContext): void {
  if (!ctx.kycApproved) {
    throw new HttpsError('failed-precondition', 'kyc_required');
  }
}

export async function requireMembership(
  chamaId: ChamaId,
  uid: UserId,
  allowedRoles: ReadonlyArray<MemberRole> = ['member', 'treasurer', 'admin'],
  db: Firestore = getFirestore(),
): Promise<{ role: MemberRole }> {
  const ref = db.collection('chamas').doc(chamaId)
    .collection('memberships').doc(membershipDocId(chamaId, uid));
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('permission-denied', 'not_a_member');
  const data = snap.data() as { status: string; role: MemberRole };
  if (data.status !== 'active') throw new HttpsError('permission-denied', 'membership_not_active');
  if (!allowedRoles.includes(data.role)) {
    throw new HttpsError('permission-denied', 'insufficient_role');
  }
  return { role: data.role };
}

// Mints the `kycApproved` custom claim. Called from approveKyc after a reviewer
// signs off.
export async function setKycApprovedClaim(uid: UserId, approved: boolean): Promise<void> {
  await getAuth().setCustomUserClaims(uid, { kycApproved: approved });
}
