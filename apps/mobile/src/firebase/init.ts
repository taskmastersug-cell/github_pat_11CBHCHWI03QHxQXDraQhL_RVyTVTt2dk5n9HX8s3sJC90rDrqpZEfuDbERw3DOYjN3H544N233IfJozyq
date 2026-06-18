import Constants from 'expo-constants';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, connectAuthEmulator, Auth } from 'firebase/auth';
import {
  getFirestore, connectFirestoreEmulator, Firestore,
} from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, Functions } from 'firebase/functions';
import { getStorage, connectStorageEmulator, FirebaseStorage } from 'firebase/storage';

type Extra = {
  firebaseApiKey: string;
  firebaseAuthDomain: string;
  firebaseProjectId: string;
  firebaseStorageBucket: string;
  firebaseAppId: string;
  useEmulators: boolean;
  emulatorHost: string;
};

function readExtra(): Extra {
  const e = (Constants.expoConfig?.extra ?? {}) as Partial<Extra>;
  return {
    firebaseApiKey: e.firebaseApiKey ?? 'demo-api-key',
    firebaseAuthDomain: e.firebaseAuthDomain ?? 'roundpay-dev.firebaseapp.com',
    firebaseProjectId: e.firebaseProjectId ?? 'roundpay-dev',
    firebaseStorageBucket: e.firebaseStorageBucket ?? 'roundpay-dev.appspot.com',
    firebaseAppId: e.firebaseAppId ?? '1:0:web:0',
    useEmulators: e.useEmulators ?? true,
    emulatorHost: e.emulatorHost ?? 'localhost',
  };
}

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _fns: Functions | null = null;
let _storage: FirebaseStorage | null = null;

export function firebase() {
  if (_app) return { app: _app, auth: _auth!, db: _db!, fns: _fns!, storage: _storage! };
  const cfg = readExtra();
  _app = getApps()[0] ?? initializeApp({
    apiKey: cfg.firebaseApiKey,
    authDomain: cfg.firebaseAuthDomain,
    projectId: cfg.firebaseProjectId,
    storageBucket: cfg.firebaseStorageBucket,
    appId: cfg.firebaseAppId,
  });
  try {
    _auth = initializeAuth(_app);
  } catch {
    _auth = getAuth(_app);
  }
  _db = getFirestore(_app);
  _fns = getFunctions(_app);
  _storage = getStorage(_app);

  if (cfg.useEmulators) {
    const host = cfg.emulatorHost;
    connectAuthEmulator(_auth, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(_db, host, 8080);
    connectFunctionsEmulator(_fns, host, 5001);
    connectStorageEmulator(_storage, host, 9199);
  }
  return { app: _app, auth: _auth, db: _db, fns: _fns, storage: _storage };
}
