# RoundPay — Phase 3 Plan

Mobile-first phase. The deliverable is a working Expo app that drives the
Phase 2 money pipeline end-to-end against the emulator (and against real
MTN/Airtel sandboxes when creds land), covering the **core money loop**.

---

## Decisions locked from Phase 3 kickoff

| Area | Decision |
|---|---|
| App focus | Mobile (Expo) first. Admin Next.js deferred to Phase 4 |
| Screen scope | Core money loop: phone OTP login → KYC submit → chama list → contribute → cycle view. No bidding/claims/exit UI yet |
| Provider creds | Both MTN MoMo + Airtel Money sandbox creds will be provided. End Phase 3 with both verified against real sandboxes |
| FCM pushes | Deferred to Phase 4. Phase 3 uses Firestore real-time listeners for in-app state |
| Languages | English + Luganda string scaffolding (i18n keys land; full translations Phase 4+) |
| State management | Zustand + Firestore listeners. No Redux. React Query only if a clear need surfaces |
| Auth | Firebase Auth phone OTP, native reCAPTCHA on Android, silent on iOS via APNs |

---

## 1. Mobile app architecture

```
apps/mobile/
├── app/                    # expo-router file-based routes
│   ├── (auth)/
│   │   ├── phone.tsx       # enter phone, request OTP
│   │   └── otp.tsx         # enter OTP, sign in
│   ├── (kyc)/
│   │   ├── nin.tsx         # NIN entry
│   │   └── selfie.tsx      # camera capture + upload
│   ├── (app)/
│   │   ├── _layout.tsx     # auth + KYC guard
│   │   ├── index.tsx       # chama list
│   │   ├── chama/[id].tsx  # chama detail + cycle list
│   │   └── cycle/[id].tsx  # cycle detail + contribute action
│   └── _layout.tsx         # root + theme + i18n provider
├── src/
│   ├── auth/               # auth state, phone OTP wrapper
│   ├── firebase/           # init, callable wrappers, listeners
│   ├── i18n/               # en + lg locales, hook
│   ├── stores/             # zustand stores (auth, user, chamas)
│   ├── ui/                 # primitives: Button, Field, Card, Money
│   └── screens/            # screen-level components (consumed by routes)
└── assets/
```

### Phase 3 tasks

- [ ] Add deps: `expo-router`, `firebase`, `@react-native-firebase/auth` (or web SDK + reCAPTCHA), `zustand`, `expo-camera`, `expo-image-picker`, `expo-secure-store`, `i18next`, `react-i18next`, `zod`
- [ ] Configure `expo-router` entry + tsconfig paths
- [ ] Firebase init with emulator detection via `EXPO_PUBLIC_USE_EMULATORS=1`
- [ ] Theme tokens (colors, spacing, type scale) — keep it boring, dark-on-light, no nav library beyond router

---

## 2. Auth flow

- [ ] Phone OTP via Firebase Auth (`signInWithPhoneNumber`)
- [ ] OTP verification screen with 60s resend timer
- [ ] On first sign-in, the `bootstrapUser` Phase 2 trigger creates `users/{uid}` with `kyc.status = 'unstarted'`
- [ ] `_layout.tsx` guard reads `users/{uid}` via listener:
  - `auth == null` → `/phone`
  - `kyc.status != 'approved'` → `/kyc/nin` (unless already there)
  - else → `/`

---

## 3. KYC flow (mobile side)

- [ ] NIN form (14-char Ugandan NIN, basic format validation)
- [ ] Selfie capture via `expo-camera`, fallback to image picker
- [ ] Call `mintKycUploadUrl` → upload to signed URL → call `submitKyc` with the storage ref
- [ ] Pending state screen: "Your KYC is under review" with listener auto-routing on approval
- [ ] No reviewer UI in mobile — that's Phase 4 admin

---

## 4. Chama list + detail

- [ ] Chama list: listener on `chamas` where `memberships` contains current uid (server-side via membership doc id convention). Render name, type, balance, next contribution due
- [ ] Chama detail: header, current cycle preview, cycle history list, member count
- [ ] Cycle detail: pool total, my contribution status, "Contribute" CTA when contribution pending

---

## 5. Contribution flow

The money path:

1. User taps "Contribute" on cycle screen
2. App calls `initiateContribution` callable with `{ chamaId, cycleId, provider }`
3. Backend writes `transactions/{txId}` pending, calls `providerAdapter.initiateDeposit`, returns `{ txId, providerInstructions }`
4. App shows provider-specific instructions (USSD prompt for MoMo / OTP for Airtel)
5. App listens to `transactions/{txId}.state` — flips to `confirmed` when webhook fires
6. UI shows success, cycle pool updates via Firestore listener

- [ ] Provider chooser (MTN vs Airtel) inferred from msisdn prefix, with manual override
- [ ] Polling fallback: if no listener update in 60s, call a `queryTransaction` callable

---

## 6. Provider sandbox swap

Backend already supports `ROUNDPAY_USE_MOCK_PROVIDERS=1`. To verify real sandboxes:

- [ ] Add `functions/.env.example` with all required vars:
  - `MTN_MOMO_SUBSCRIPTION_KEY`, `MTN_MOMO_API_USER`, `MTN_MOMO_API_KEY`, `MTN_MOMO_TARGET_ENV`, `MTN_MOMO_CALLBACK_HOST`
  - `AIRTEL_CLIENT_ID`, `AIRTEL_CLIENT_SECRET`, `AIRTEL_COUNTRY`, `AIRTEL_CURRENCY`, `AIRTEL_BASE_URL`
- [ ] Integration tests gated by `ROUNDPAY_SANDBOX_KEYS=1` that hit real sandbox URLs (skip in CI by default)
- [ ] Document creds onboarding in `functions/README.md`
- [ ] **User to provide creds** before I can run the live verification step

---

## 7. i18n scaffolding

- [ ] `i18n/locales/en.json` + `i18n/locales/lg.json`. Key namespacing: `auth.*`, `kyc.*`, `chama.*`, `cycle.*`, `contribute.*`, `errors.*`
- [ ] All strings on the 5 screens routed through `t('key')`. Luganda strings stubbed (`"[LG] ..."`) — translations land Phase 4
- [ ] Locale persisted to `expo-secure-store` + `users/{uid}.locale`

---

## 8. Test plan

- [ ] Component tests for `Money`, `Field`, `Button` primitives (jest + react-test-renderer)
- [ ] Auth store unit tests (sign-in transitions)
- [ ] Contribution store integration test against the Functions emulator + MockProvider
- [ ] Manual smoke test checklist documented in mobile README
- [ ] **Live sandbox verification** (gated on creds): one MTN contribution + one Airtel contribution against real sandbox, traced through to webhook callback

---

## 9. Order of execution

1. Expo Router + Firebase wiring + emulator detection
2. Auth flow (phone OTP) + auth guard
3. KYC flow (NIN + selfie + upload)
4. Chama list + detail screens (read-only)
5. Cycle detail + contribute action against MockProvider
6. i18n scaffolding (en + lg keys, en strings filled)
7. Sandbox credential intake + live MTN/Airtel verification
8. Review + Phase 4 open questions

---

## Out of scope (Phase 4+)

- Bidding UI, claims UI, exit UI
- Admin Next.js app (KYC reviewer + treasurer dashboard)
- FCM push notifications
- Full Luganda translations
- App store builds (EAS submit pipeline)
- Production MoMo/Airtel agreements
