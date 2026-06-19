'use client';

import { create } from 'zustand';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { firebase } from '../firebase/init';

type Claims = { kycReviewer?: boolean };

type State = {
  user: User | null;
  ready: boolean;
  claims: Claims;
};

type Actions = {
  init: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuth = create<State & Actions>((set) => ({
  user: null,
  ready: false,
  claims: {},
  init: () => {
    const { auth } = firebase();
    onAuthStateChanged(auth, async (u) => {
      let claims: Claims = {};
      if (u) {
        const tok = await u.getIdTokenResult(true);
        claims = { kycReviewer: tok.claims.kycReviewer === true };
      }
      set({ user: u, ready: true, claims });
    });
  },
  signIn: async (email, password) => {
    const { auth } = firebase();
    await signInWithEmailAndPassword(auth, email, password);
  },
  signOut: async () => {
    const { auth } = firebase();
    await signOut(auth);
    set({ claims: {} });
  },
}));
