'use client';

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, connectAuthEmulator, Auth, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, Firestore } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, Functions } from 'firebase/functions';
import { getStorage, connectStorageEmulator, FirebaseStorage } from 'firebase/storage';

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _fns: Functions | null = null;
let _storage: FirebaseStorage | null = null;

export function firebase() {
  if (_app) return { app: _app, auth: _auth!, db: _db!, fns: _fns!, storage: _storage! };

  _app = getApps()[0] ?? initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  });

  try {
    _auth = initializeAuth(_app, { persistence: browserLocalPersistence });
  } catch {
    _auth = getAuth(_app);
  }
  _db = getFirestore(_app);
  _fns = getFunctions(_app);
  _storage = getStorage(_app);

  if (process.env.NEXT_PUBLIC_USE_EMULATORS === '1') {
    const host = process.env.NEXT_PUBLIC_EMULATOR_HOST ?? 'localhost';
    connectAuthEmulator(_auth, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(_db, host, 8080);
    connectFunctionsEmulator(_fns, host, 5001);
    connectStorageEmulator(_storage, host, 9199);
  }
  return { app: _app, auth: _auth, db: _db, fns: _fns, storage: _storage };
}
