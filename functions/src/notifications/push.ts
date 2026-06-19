import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import {
  buildNotification, type NotificationInput, type Locale, type UserDoc, type UserId,
} from '@roundpay/shared';

const messaging = () => getMessaging();
const db = () => getFirestore();

export async function sendPush(uid: UserId, input: NotificationInput): Promise<void> {
  const userSnap = await db().collection('users').doc(uid).get();
  if (!userSnap.exists) return;
  const user = userSnap.data() as UserDoc;
  const tokens = user.fcmTokens ?? [];
  if (tokens.length === 0) return;

  const locale: Locale = user.locale ?? 'en';
  const built = buildNotification(input, locale);

  const message: MulticastMessage = {
    tokens,
    notification: { title: built.title, body: built.body },
    data: built.data,
  };

  const res = await messaging().sendEachForMulticast(message);

  // Prune tokens the FCM service marked as unregistered. Anything else
  // (rate-limit, transient) we leave for the next attempt.
  const dead: string[] = [];
  res.responses.forEach((r, i) => {
    if (r.success) return;
    const code = r.error?.code ?? '';
    if (code === 'messaging/registration-token-not-registered'
        || code === 'messaging/invalid-registration-token') {
      const t = tokens[i];
      if (t) dead.push(t);
    }
  });
  if (dead.length > 0) {
    await db().collection('users').doc(uid).update({
      fcmTokens: FieldValue.arrayRemove(...dead),
    });
  }
}
