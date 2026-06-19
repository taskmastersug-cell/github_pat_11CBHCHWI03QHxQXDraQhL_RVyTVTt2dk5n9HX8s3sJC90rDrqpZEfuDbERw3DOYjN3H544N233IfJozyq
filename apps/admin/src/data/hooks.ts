'use client';

import { useEffect, useState } from 'react';
import {
  collection, collectionGroup, doc, onSnapshot, query, where, orderBy, limit,
} from 'firebase/firestore';
import { firebase } from '../firebase/init';
import type { UserDoc, Chama, Claim, Membership, LedgerEntry } from '@roundpay/shared';

export function usePendingKyc() {
  const [users, setUsers] = useState<UserDoc[]>([]);
  useEffect(() => {
    const { db } = firebase();
    const q = query(collection(db, 'users'), where('kyc.status', '==', 'pending'));
    return onSnapshot(q, (snap) => {
      setUsers(snap.docs.map((d) => d.data() as UserDoc));
    });
  }, []);
  return users;
}

export function useChamas() {
  const [chamas, setChamas] = useState<Chama[]>([]);
  useEffect(() => {
    const { db } = firebase();
    const q = query(collection(db, 'chamas'), orderBy('createdAt', 'desc'), limit(100));
    return onSnapshot(q, (snap) => {
      setChamas(snap.docs.map((d) => d.data() as Chama));
    });
  }, []);
  return chamas;
}

export function useChama(chamaId: string | null) {
  const [chama, setChama] = useState<Chama | null>(null);
  useEffect(() => {
    if (!chamaId) return;
    const { db } = firebase();
    return onSnapshot(doc(db, 'chamas', chamaId), (s) => {
      setChama(s.exists() ? (s.data() as Chama) : null);
    });
  }, [chamaId]);
  return chama;
}

export function useChamaClaims(chamaId: string | null) {
  const [claims, setClaims] = useState<Claim[]>([]);
  useEffect(() => {
    if (!chamaId) return;
    const { db } = firebase();
    const q = query(collection(db, 'chamas', chamaId, 'claims'), orderBy('claimId', 'desc'));
    return onSnapshot(q, (snap) => {
      setClaims(snap.docs.map((d) => d.data() as Claim));
    });
  }, [chamaId]);
  return claims;
}

export function useChamaMemberships(chamaId: string | null) {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  useEffect(() => {
    if (!chamaId) return;
    const { db } = firebase();
    const q = query(collection(db, 'chamas', chamaId, 'memberships'));
    return onSnapshot(q, (snap) => {
      setMemberships(snap.docs.map((d) => d.data() as Membership));
    });
  }, [chamaId]);
  return memberships;
}

export function useChamaLedger(chamaId: string | null) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  useEffect(() => {
    if (!chamaId) return;
    const { db } = firebase();
    const q = query(
      collectionGroup(db, 'ledger_entries'),
      where('chamaId', '==', chamaId),
    );
    return onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => d.data() as LedgerEntry));
    });
  }, [chamaId]);
  return entries;
}
