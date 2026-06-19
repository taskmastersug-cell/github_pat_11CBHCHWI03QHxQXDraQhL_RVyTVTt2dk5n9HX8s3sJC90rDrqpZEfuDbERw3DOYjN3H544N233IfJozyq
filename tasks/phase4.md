# RoundPay — Phase 4 Plan (in progress)

Picking up while sandbox creds are pending. Phase 4 fleshes out the member
flows the core money loop didn't cover, then turns to the admin app and
production-grade tests.

---

## Decisions (kickoff)

| Area | Decision |
|---|---|
| Order | Member-side polish first (bid / claim / exit screens), admin next, FCM later |
| Mobile coverage | Add place-bid, claim list + file claim with evidence, exit |
| Routes | Restructure `cycle/[id]` and `chama/[id]` into folder routes to host sub-screens |

---

## 1. Mobile screens (in this commit)

- [x] `app/(app)/cycle/[id]/index.tsx` — existing cycle detail moved into folder
- [x] `app/(app)/cycle/[id]/bid.tsx` — place bid, see current bids, live winner indicator
- [x] `app/(app)/chama/[id]/index.tsx` — existing chama detail moved; adds Claims + Leave buttons (Claims only for welfare chamas)
- [x] `app/(app)/chama/[id]/claims.tsx` — claim list, "File new claim" CTA
- [x] `app/(app)/chama/[id]/claim-new.tsx` — reason + amount + evidence upload via signed URL
- [x] `app/(app)/chama/[id]/exit.tsx` — confirmation, calls `requestExit`
- [x] Cycle screen adds a "Place bid" button when state is `bidding`
- [x] i18n keys: `bid.*`, `claim.*`, `exit.*` (en filled, lg stubbed)
- [x] Callable wrappers: `placeBid`, `fileClaim`, `mintEvidenceUploadUrl`, `requestExit`
- [x] Data hooks: `useBids`, `useClaims`, `useMyMembership`
- [x] Pure helper `lowestActiveDiscount` with 4 unit tests covering empty / pick-min / ignore-inactive / all-inactive
- [x] 10 mobile jest tests pass; typecheck clean

## 2. Admin (Next.js) MVP

- [x] App Router shell with sidebar nav and email/password sign-in (treasurer / reviewer accounts)
- [x] Firebase init (Auth + Firestore + Functions + Storage) with emulator detection via `NEXT_PUBLIC_USE_EMULATORS`
- [x] Auth store reads the `kycReviewer` custom claim from the ID token; UI gates KYC actions on it
- [x] `/` dashboard: KYC backlog count + chama count, links into each queue
- [x] `/kyc` queue: lists `users` where `kyc.status == 'pending'`, approve/reject via `approveKyc` callable
- [x] `/chamas` list with status tags
- [x] `/chamas/[id]`: chama summary + active member count + per-account ledger totals + **balance invariant tag** (green = sum-to-zero, red = imbalanced). For welfare chamas, also shows submitted claims with "Load evidence" (calls `readEvidence` for a 5-min signed URL) and approve/reject (calls `approveClaim`)
- [x] Pure `summarizeLedger` helper with 3 unit tests (empty / per-account aggregation / imbalance detection)
- [x] Admin typecheck clean; 3 jest tests pass

## 3. FCM push notifications

- [x] `users/{uid}.fcmTokens?: string[]` field added to schema + zod
- [x] Pure `buildNotification(input, locale)` in shared — en + lg copy, deep-link data payload. 5 unit tests cover all event kinds + locale switching
- [x] Backend `sendPush(uid, input)` helper: reads user doc, fans out via `sendEachForMulticast`, prunes dead tokens (`registration-token-not-registered`)
- [x] Callables `registerFcmToken` + `unregisterFcmToken`
- [x] Firestore triggers: `onTransactionWritten` (deposit→confirmed), `onPayoutWritten` (→sent), `onClaimWritten` (→approved/rejected), `onUserKycWritten` (→approved)
- [x] Mobile registers tokens via `expo-notifications` once KYC is approved; foreground handler shows the alert
- [x] Backend builds clean; shared 20/20 + provider 16/16 + mobile 10/10 + admin 3/3 tests pass

## 4. Notification deep linking

- [x] Pure `routeForNotification(data)` in shared maps every notification kind to an expo-router path (or null if malformed). 7 unit tests cover all kinds + missing-field + unknown-kind paths.
- [x] `useNotificationDeepLinks(enabled)` hook in mobile handles both cold-start taps (`getLastNotificationResponseAsync`) and runtime taps (`addNotificationResponseReceivedListener`).
- [x] Wired into `AuthGate` and gated on `kyc.status === 'approved'` so we don't bounce off the auth guard when an unverified user taps a notification.

## 5. Remaining for Phase 4

- [ ] Live MTN + Airtel sandbox verification once creds land
- [ ] Real Luganda translations (every key is keyed; just needs a translator)
- [ ] RN component tests via jest-expo (preset module resolution under workspaces still flaky)

---

## Notes

- Route restructure (`[id].tsx` → `[id]/index.tsx`) was driven by Expo Router's rule that a path segment must be either a file or a folder, not both. Sub-screens like `cycle/[id]/bid` require the folder form. URLs from outside the segment (`/(app)/cycle/abc?chamaId=xyz`) still resolve to the index file unchanged.
- The "Claims" entry point is gated on `chama.type === 'welfare'` because the engine's `approvedClaim` selection policy is only active there. Showing the button on a merry-go-round chama would lead to a callable error.
- The exit flow doesn't preview the refund amount client-side — that's intentional: the engine derives it from the ledger at execution time, and showing a number that could disagree is worse than not showing one.
