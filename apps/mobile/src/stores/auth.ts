import { create } from 'zustand';
import {
  onAuthStateChanged, signOut as fbSignOut, User,
  signInWithPhoneNumber, ConfirmationResult, RecaptchaVerifier,
} from 'firebase/auth';
import { firebase } from '../firebase/init';

type State = {
  user: User | null;
  ready: boolean;
  confirmation: ConfirmationResult | null;
  pendingPhone: string | null;
};

type Actions = {
  init: () => void;
  startPhoneSignIn: (phone: string, verifier: RecaptchaVerifier) => Promise<void>;
  confirmCode: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuth = create<State & Actions>((set, get) => ({
  user: null,
  ready: false,
  confirmation: null,
  pendingPhone: null,

  init: () => {
    const { auth } = firebase();
    onAuthStateChanged(auth, (u) => set({ user: u, ready: true }));
  },

  startPhoneSignIn: async (phone, verifier) => {
    const { auth } = firebase();
    const confirmation = await signInWithPhoneNumber(auth, phone, verifier);
    set({ confirmation, pendingPhone: phone });
  },

  confirmCode: async (code) => {
    const confirmation = get().confirmation;
    if (!confirmation) throw new Error('no_pending_confirmation');
    await confirmation.confirm(code);
    set({ confirmation: null, pendingPhone: null });
  },

  signOut: async () => {
    const { auth } = firebase();
    await fbSignOut(auth);
    set({ confirmation: null, pendingPhone: null });
  },
}));
