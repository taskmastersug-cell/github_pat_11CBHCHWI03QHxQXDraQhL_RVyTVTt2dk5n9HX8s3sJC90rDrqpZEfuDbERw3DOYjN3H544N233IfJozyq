# RoundPay

Group savings (chama) app for Uganda. Members contribute on a schedule; funds
rotate or accumulate depending on chama type (merry-go-round, fixed savings,
welfare fund). Integrates MTN MoMo and Airtel Money. English + Luganda.

## Architecture (Phase 1)

```
apps/
  mobile/      Expo (React Native, TS)         — member app
  admin/       Next.js (App Router, TS)        — treasurer + KYC reviewer UI
packages/
  shared/      Pure TS — types, engine, policy registry, zod schemas
functions/     Firebase Cloud Functions v2     — only path that writes money
firestore.rules                                — deny-all on financial collections
storage.rules                                  — KYC selfie access control
firebase.json, .firebaserc, firestore.indexes.json
```

### One engine, many chama types

The architectural thesis is in `tasks/todo.md` §1 and the implementation lives
in `packages/shared/src/engine/`. A chama is a bundle of four orthogonal
policies (contribution, selection, trigger, accrual); `applyEvent(event, ctx)`
dispatches on event kind, not chama type, and consults the policy registry.
Adding a new chama type = adding a policy value, not editing the engine.

Every monetary movement produces a group of double-entry postings that sum to
zero per currency (`assertBalanced`). Invariant verified per-event in the
engine and per-chama nightly in Functions.

### Phase 1 deliverables

- [x] Monorepo scaffold (npm workspaces, TS project refs)
- [x] Shared types, engine, policy registry, zod schemas
- [x] Engine unit tests (contribution, bid cycle close, claim approval, fixed-savings maturity)
- [x] `firestore.rules` — financial collections deny-all to clients
- [x] `storage.rules` — KYC selfie access control
- [x] Rules emulator tests proving unauthorized writes are blocked

### Phase 2 deliverables

- [x] Provider adapters (MTN MoMo, Airtel Money, Mock) behind a single interface
- [x] Cloud Function callables (KYC, chama creation, contribute, bid, claim, exit)
- [x] Webhooks (MTN + Airtel), idempotency, dispatch glue
- [x] Scheduled jobs (reconciliation, ledger verifier, cycle close)
- [x] 60/60 tests green: engine, providers, rules, end-to-end pipeline

### Phase 4 deliverables (in progress)

- [x] Mobile: place bid, claims (list + file with evidence), exit
- [x] Admin (Next.js): sign-in, KYC reviewer queue, chamas list, chama detail with ledger health + claim approvals + evidence viewer
- [ ] Live MTN + Airtel sandbox verification (gated on credentials)
- [ ] FCM push notifications
- [ ] Real Luganda translations

### Phase 3 deliverables

- [x] Expo mobile app: expo-router groups, theme, primitives, i18n
- [x] Phone OTP sign-in flow
- [x] KYC flow (NIN entry + selfie capture/pick + signed-URL upload + submit)
- [x] Chama list + detail (Firestore listeners)
- [x] Cycle detail + contribute against MockProvider with live tx state
- [x] `functions/.env.example` documenting MTN + Airtel sandbox vars
- [ ] Live MTN + Airtel sandbox verification (gated on credentials)

### Setup

```sh
nvm use            # Node 20
npm install
npm run typecheck
npm run test:shared
# Rules tests need the Firestore emulator running:
npm run emulator    # in one terminal
npm run test:rules  # in another
```

### Out of scope for Phase 1

Real MoMo/Airtel adapters, mobile screens, admin UI, FCM, scheduled
reconciliation function, signed-URL KYC upload endpoint. All planned for
Phase 2+; data model and policy seams reserve room for them.
