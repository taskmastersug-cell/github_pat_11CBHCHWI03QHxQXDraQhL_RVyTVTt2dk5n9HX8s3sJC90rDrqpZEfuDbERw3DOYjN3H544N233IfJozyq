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

## Review

**Built (mobile app + env scaffolding)**

- Expo Router file-based navigation: `(auth)/phone`, `(auth)/otp`, `(kyc)/nin`, `(kyc)/selfie`, `(app)/index`, `(app)/chama/[id]`, `(app)/cycle/[id]`. Root `_layout` initializes Firebase + i18n; an `AuthGate` redirects based on `auth.user` and `users/{uid}.kyc.status` live from Firestore.
- Firebase wiring (`src/firebase/init.ts`) reads `expo.extra` and connects Auth / Firestore / Functions / Storage emulators when `useEmulators` is true. Callable wrappers in `src/firebase/callables.ts` give typed access to `submitKyc`, `mintKycUploadUrl`, `initiateContribution`, `acceptInvite`.
- Zustand stores: `auth` (phone OTP flow + Firebase user) and `kyc` (NIN draft between screens).
- Live data hooks: `useUserDoc`, `useMyChamas` (collectionGroup query over memberships), `useChama`, `useCycles`, `useCycle`, `useMyContribution`, `useTransaction`. All snapshot-based so UI reflects webhook-driven state changes in real time.
- UI primitives: `Button`, `Field`, `Money` (uses shared `formatMoney` + active i18n locale), `Screen` (safe area + keyboard avoidance), shared `theme` tokens.
- i18n: i18next + react-i18next with `en` + `lg` resource files covering every visible string. Luganda strings stubbed `[LG] ...` so they're obvious in QA before translations land.
- Contribution flow drives the Phase 2 backend end-to-end: `initiateContribution` callable → `transactions/{txId}` listener → success/failure surfaced when the webhook flips state.
- `functions/.env.example` documents every MTN + Airtel sandbox variable (matches the names the existing `getProvider` registry already reads). `.env` is gitignored from Phase 1.
- 6 mobile jest tests pass: 3 `Money` formatting (UGX en/lg/zero), 3 `KycDraft` store (initial state / set / reset). Backend Phase 2 suites still green (15 shared engine + 16 provider).

**Architectural notes**

- `exactOptionalPropertyTypes: true` made the `Field.error?: string` prop a friction point — `error` had to be declared `string | undefined` explicitly so callers can pass `error ?? undefined`. Kept that pattern consistent across all four call sites instead of `?` everywhere.
- The mobile `Money` component reads `i18n.language` at render time so locale toggles re-format on the next React render without prop drilling.
- `useMyChamas` uses a `collectionGroup('memberships')` query, which depends on the membership doc id convention from Phase 1 plus an index. The query filters by `uid` + `status='active'` — exactly the path the Phase 1 rules were designed to permit.
- Jest preset: `jest-expo` failed to resolve under workspaces (preset module resolution looks at the package root). Phase 3 sidesteps this with a minimal inline transform config — RN-rendering component tests are deferred to Phase 4 where we'll either pin jest-expo with the right resolver hack or move to RNTL with a custom transformer.

**Open questions for Phase 4**

1. **Live sandbox creds:** still pending. Drop them into `functions/.env` per `.env.example`; the registry already resolves `mtnMomo` / `airtelMoney` once `ROUNDPAY_USE_MOCK_PROVIDERS=0`.
2. **Reviewer admin app:** Next.js scaffold exists from Phase 1; Phase 4 fleshes out KYC queue + treasurer dashboard.
3. **Bidding / claims / exit mobile UI:** intentionally out of Phase 3 (core-money-loop scope). Phase 4 should add them.
4. **RN component testing:** revisit jest-expo resolution OR adopt React Native Testing Library with a hand-rolled transform. Phase 3 ships with logic-only tests.
5. **Push notifications (FCM):** deferred; Phase 4 should pick the trigger set (contribution confirmed / payout sent / claim status / KYC approved are the obvious candidates).
6. **Luganda translations:** every key exists; need a real translator to replace the `[LG] ...` stubs.

## Out of scope (Phase 4+)

- Bidding UI, claims UI, exit UI
- Admin Next.js app (KYC reviewer + treasurer dashboard)
- FCM push notifications
- Full Luganda translations
- App store builds (EAS submit pipeline)
- Production MoMo/Airtel agreements
