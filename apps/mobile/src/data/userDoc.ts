import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { firebase } from '../firebase/init';
import type { UserDoc } from '@roundpay/shared';

export function useUserDoc(uid: string | null) {
  const [user, setUser] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!uid) { setUser(null); setLoading(false); return; }
    const { db } = firebase();
    const unsub = onSnapshot(doc(db, 'users', uid), (snap) => {
      setUser(snap.exists() ? (snap.data() as UserDoc) : null);
      setLoading(false);
    }, () => { setLoading(false); });
    return unsub;
  }, [uid]);
  return { user, loading };
}
