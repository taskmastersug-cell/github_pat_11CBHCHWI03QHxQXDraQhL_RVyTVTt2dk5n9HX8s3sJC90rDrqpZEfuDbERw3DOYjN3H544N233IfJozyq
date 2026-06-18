# @roundpay/mobile

Expo (React Native) app. Phase 3 deliverable: core money loop —
phone OTP sign in → KYC submit → chama list → cycle view → contribute.

## Run locally

```
cd ../..              # workspace root
npm install
cd functions && npm run build && cd ..
firebase emulators:start   # auth, firestore, functions, storage
```

In another terminal:

```
cd apps/mobile
npm run start
```

The app reads `app.json -> expo.extra.useEmulators` (`true` by default) and
connects to emulators on `localhost`. Set `useEmulators: false` to point at
a real Firebase project — fill the matching keys in `extra`.

## Folder shape

- `app/` — file-based routes (expo-router). Groups: `(auth)`, `(kyc)`, `(app)`.
- `src/firebase/` — init + callable wrappers.
- `src/data/` — Firestore subscription hooks (chamas, cycles, contributions, txns).
- `src/stores/` — zustand stores (auth, KYC draft).
- `src/ui/` — primitives: `Button`, `Field`, `Money`, `Screen`, `theme`.
- `src/i18n/` — i18next setup, `en` + `lg` resource files.

## Smoke test checklist

1. Cold start → lands on `/(auth)/phone`.
2. Enter `+256700000000`, get OTP, enter `123456` (emulator default) → signed in.
3. New user → routed to `/(kyc)/nin`. Enter 14-char NIN, take/pick selfie, submit.
4. Admin (or seeded fixture) approves KYC → routed to chama list.
5. Tap a chama → see cycles.
6. Tap an open cycle → enter msisdn → "Send request" → MockProvider webhook
   confirms in ~1s → success state shows; cycle pool reflects new contribution.

## Out of scope (Phase 4+)

Bidding UI, claims UI, exit UI, push notifications, full Luganda translations,
production builds.
