import { beforeUserCreated } from 'firebase-functions/v2/identity';
import { getFirestore } from 'firebase-admin/firestore';

// Bootstraps users/{uid} with kyc: 'unstarted' the first time a user
// completes phone-OTP. Runs before the Auth user is created so the doc
// exists by the time the client gets its first token.
export const bootstrapUser = beforeUserCreated(async (event) => {
  const uid = event.data?.uid;
  if (!uid) return;
  const db = getFirestore();
  await db.collection('users').doc(uid).set({
    uid,
    msisdn: event.data?.phoneNumber ?? '',
    displayName: event.data?.displayName ?? '',
    locale: 'en',
    kyc: { status: 'unstarted' },
    createdAt: Date.now(),
    disabled: false,
  }, { merge: true });
  return;
});
