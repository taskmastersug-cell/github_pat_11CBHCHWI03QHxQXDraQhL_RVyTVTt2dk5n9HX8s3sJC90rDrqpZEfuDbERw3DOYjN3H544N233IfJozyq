import { useEffect, useState } from 'react';
import {
  collection, collectionGroup, doc, onSnapshot, query, where, orderBy,
} from 'firebase/firestore';
import { firebase } from '../firebase/init';
import type { Chama, Membership, Cycle, Contribution, Bid, Claim } from '@roundpay/shared';

export function useMyChamas(uid: string | null) {
  const [chamas, setChamas] = useState<Chama[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setChamas([]); setLoading(false); return; }
    const { db } = firebase();
    const q = query(
      collectionGroup(db, 'memberships'),
      where('uid', '==', uid),
      where('status', '==', 'active'),
    );
    const unsub = onSnapshot(q, async (snap) => {
      const ids = snap.docs.map((d) => (d.data() as Membership).chamaId);
      if (ids.length === 0) { setChamas([]); setLoading(false); return; }
      const chamaSnaps = await Promise.all(
        ids.map((id) => new Promise<Chama | null>((resolve) => {
          const off = onSnapshot(doc(db, 'chamas', id), (s) => {
            resolve(s.exists() ? (s.data() as Chama) : null);
            off();
          });
        })),
      );
      setChamas(chamaSnaps.filter((c): c is Chama => c != null));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [uid]);

  return { chamas, loading };
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

export function useCycles(chamaId: string | null) {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  useEffect(() => {
    if (!chamaId) return;
    const { db } = firebase();
    const q = query(
      collection(db, 'chamas', chamaId, 'cycles'),
      orderBy('index', 'asc'),
    );
    return onSnapshot(q, (snap) => {
      setCycles(snap.docs.map((d) => d.data() as Cycle));
    });
  }, [chamaId]);
  return cycles;
}

export function useCycle(chamaId: string | null, cycleId: string | null) {
  const [cycle, setCycle] = useState<Cycle | null>(null);
  useEffect(() => {
    if (!chamaId || !cycleId) return;
    const { db } = firebase();
    return onSnapshot(doc(db, 'chamas', chamaId, 'cycles', cycleId), (s) => {
      setCycle(s.exists() ? (s.data() as Cycle) : null);
    });
  }, [chamaId, cycleId]);
  return cycle;
}

export function useBids(chamaId: string | null, cycleId: string | null) {
  const [bids, setBids] = useState<Bid[]>([]);
  useEffect(() => {
    if (!chamaId || !cycleId) return;
    const { db } = firebase();
    const q = query(
      collection(db, 'chamas', chamaId, 'cycles', cycleId, 'bids'),
      orderBy('placedAt', 'asc'),
    );
    return onSnapshot(q, (snap) => {
      setBids(snap.docs.map((d) => d.data() as Bid));
    });
  }, [chamaId, cycleId]);
  return bids;
}

export function useMyMembership(chamaId: string | null, uid: string | null) {
  const [membership, setMembership] = useState<Membership | null>(null);
  useEffect(() => {
    if (!chamaId || !uid) return;
    const { db } = firebase();
    return onSnapshot(
      doc(db, 'chamas', chamaId, 'memberships', `${chamaId}_${uid}`),
      (s) => setMembership(s.exists() ? (s.data() as Membership) : null),
    );
  }, [chamaId, uid]);
  return membership;
}

export function useClaims(chamaId: string | null) {
  const [claims, setClaims] = useState<Claim[]>([]);
  useEffect(() => {
    if (!chamaId) return;
    const { db } = firebase();
    const q = query(
      collection(db, 'chamas', chamaId, 'claims'),
      orderBy('claimId', 'desc'),
    );
    return onSnapshot(q, (snap) => {
      setClaims(snap.docs.map((d) => d.data() as Claim));
    });
  }, [chamaId]);
  return claims;
}

export function useMyContribution(chamaId: string | null, cycleId: string | null, uid: string | null) {
  const [contribution, setContribution] = useState<Contribution | null>(null);
  useEffect(() => {
    if (!chamaId || !cycleId || !uid) return;
    const { db } = firebase();
    const q = query(
      collection(db, 'chamas', chamaId, 'contributions'),
      where('cycleId', '==', cycleId),
      where('uid', '==', uid),
    );
    return onSnapshot(q, (snap) => {
      setContribution(snap.docs[0]?.data() as Contribution ?? null);
    });
  }, [chamaId, cycleId, uid]);
  return contribution;
}
