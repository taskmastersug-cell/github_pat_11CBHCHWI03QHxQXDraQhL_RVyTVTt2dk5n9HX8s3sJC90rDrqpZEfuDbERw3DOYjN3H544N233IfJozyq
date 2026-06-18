import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { firebase } from '../firebase/init';
import type { Transaction } from '@roundpay/shared';

export function useTransaction(txId: string | null) {
  const [tx, setTx] = useState<Transaction | null>(null);
  useEffect(() => {
    if (!txId) return;
    const { db } = firebase();
    return onSnapshot(doc(db, 'transactions', txId), (s) => {
      setTx(s.exists() ? (s.data() as Transaction) : null);
    });
  }, [txId]);
  return tx;
}
