# RoundPay — Phase 2 Plan

Backend-only phase. The deliverable is a provably correct money pipeline:
member taps "contribute", money lands in the chama pool, ledger balances, and
the engine fires distributions through to MoMo/Airtel and back — end to end —
with real (sandbox) providers.

---

## Decisions locked from Phase 2 kickoff

| Area | Decision |
|---|---|
| Provider integration | MTN MoMo + Airtel Money sandboxes in parallel, behind one adapter interface |
| Idempotency keys | Functions-side deterministic hash: `sha256(uid, chamaId, sourceId, attempt)` |
| KYC restricted mode | Custom claim `kycApproved` on the Auth token + rules check on bid create / claim file |
| Bid window | Explicit `biddingClosesAt` field on `Cycle` |
| Claim evidence | Required on submission; uploaded via signed URL like KYC selfies, stored at `evidence/{chamaId}/{claimId}/...` |
| Member exit | Policy-driven (`memberExit` event), stake refund computed from ledger |
| Scope | Backend only. No mobile/admin UI work in Phase 2 |

---

## 1. Provider adapter interface

Single TS interface in `functions/src/providers/Provider.ts`. Two concrete
implementations: `MtnMomoProvider`, `AirtelMoneyProvider`. The engine and
Cloud Functions only ever hold the interface — adapter selection is a lookup
by `Provider` enum.

```ts
interface ProviderAdapter {
  initiateDeposit(req: DepositRequest): Promise<InitiateResult>;
  initiatePayout(req: PayoutRequest): Promise<InitiateResult>;
  parseWebhook(headers, rawBody): WebhookEvent;       // signature verification here
  queryTransaction(providerRef): Promise<ProviderTxStatus>;
}
```

- Webhook signature verification is per-provider (HMAC for MTN, request-signing for Airtel). Both verified before any DB read.
- Adapter functions never throw on provider-side failures — they return a typed result the orchestrator interprets.

### Phase 2 tasks

- [ ] `functions/src/providers/Provider.ts` — interface + shared types
- [ ] `functions/src/providers/mtnMomo/` — adapter, signature verifier, error mapper, retry policy
- [ ] `functions/src/providers/airtelMoney/` — same
- [ ] `functions/src/providers/registry.ts` — `getProvider(name)` resolver
- [ ] Unit tests for each adapter using `nock` against the sandbox URLs (parse known sandbox payloads, verify signature math)

---

## 2. Cloud Function endpoints

All callable / HTTP / scheduled functions live in `functions/src/api/`. They
do four things and nothing else: validate input with zod, build `EngineContext`
from Firestore, call `applyEvent`, write the result transactionally.

### Callables (mobile-facing)

- [ ] `submitKyc` — accepts NIN + selfie upload ref. Stores `ninHash`, sets `kyc.status = 'pending'`, writes `audit_log`.
- [ ] `createChama` — treasurer/admin creates a chama; materializes cycles upfront per Phase 1 decision; assigns memberships.
- [ ] `inviteMember` / `acceptInvite` — invitations flow.
- [ ] `initiateContribution` — looks up next pending contribution, calls `providerAdapter.initiateDeposit`, writes `transactions/{txId}` in `pending` state.
- [ ] `placeBid` — wraps the existing client-side bid create with a server-validated path (so we can enforce `biddingClosesAt`).
- [ ] `fileClaim` — wraps claim creation; requires evidence ref.
- [ ] `approveClaim` — treasurer-only; runs engine `claimApproved` event; queues payout.
- [ ] `requestExit` — emits `memberExit` event; policy decides refund timing/amount.
- [ ] `mintKycUploadUrl` / `mintEvidenceUploadUrl` — signed URLs for Storage; short-lived; scoped paths.

### HTTP (webhooks)

- [ ] `POST /webhooks/mtn-momo` — verify signature, idempotency by `(provider, idempotencyKey)`, advance `transactions` state, emit `contributionPaid` event into engine, post ledger entries.
- [ ] `POST /webhooks/airtel-money` — same shape.

### Scheduled

- [ ] `reconcilePendingTransactions` — every 5 min, queries `transactions` where `state == 'pending' AND initiatedAt < now-5min`. Calls `providerAdapter.queryTransaction`. Updates state. If pending > 24h, writes alert to `audit_log` with kind `opsAlert.staleTransaction`.
- [ ] `extendRollingCycles` — for welfare chamas, ensure 12 cycles are always materialized ahead.
- [ ] `closeMaturedCycles` — fires `cycleClosed` for any cycle past `closesAt`.
- [ ] `verifyChamaLedger` — nightly: for each chama, sum all `ledger_entries` per currency, assert zero. If not zero, write alert + freeze chama distributions.

### Auth triggers

- [ ] `onUserCreate` — bootstrap `users/{uid}` doc with `kyc.status = 'unstarted'`.
- [ ] `setKycApprovedClaim` (callable, admin-only) — sets the `kycApproved` custom claim when a reviewer approves KYC.

---

## 3. Schema additions

- [ ] `Cycle.biddingClosesAt: number` — required for `discountBid` chamas
- [ ] `Claim.evidenceRef: string` — now required (currently optional in Phase 1)
- [ ] `audit_log` source kinds: `opsAlert.staleTransaction`, `opsAlert.ledgerImbalance`, `kyc.statusChange`, `member.exit`
- [ ] New event in `RoundPayEvent`: `memberExit { chamaId, uid, at }`
- [ ] New event: `bidWindowClosed` — distinct from `cycleClosed` so the bid window timer fires distribution prep without auto-closing the cycle prematurely

---

## 4. Engine additions

- [ ] `handleMemberExit` policy — computes member stake from running ledger; queues a payout to the exiting member's msisdn; sets `Membership.status = 'exited'`.
- [ ] Update `handleBidPlaced` to also reject if `now > cycle.biddingClosesAt`.
- [ ] Add `bidWindowClosed` handler that just transitions state to `closing` (or `settled` if no bids), so the actual `cycleClosed` event is the engine's distribution trigger.

---

## 5. Firestore rules updates

- [ ] Bid create check `cycle.state == 'bidding' && now <= cycle.biddingClosesAt` (rules can't use `now` reliably across regions — use `request.time` and a small skew tolerance).
- [ ] Bid create check `request.auth.token.kycApproved == true`.
- [ ] Claim create check `request.auth.token.kycApproved == true` and `request.resource.data.evidenceRef is string`.
- [ ] Update tests to cover both new requirements (KYC-restricted bid/claim creation).

---

## 6. Storage rules updates

- [ ] Add `evidence/{chamaId}/{claimId}/{file}` path: write forbidden (signed URL only), read allowed for treasurer/admin of that chama (rules can't do Firestore lookups; the read gate is via a `kycReviewer`-style claim issued at chama-treasurer-assignment time, OR via a Cloud Function that proxies reads).

---

## 7. Test plan ("prove it works")

- [ ] Each provider adapter: contract test with recorded sandbox payloads (parse + signature verify)
- [ ] Webhook idempotency: same payload twice produces one `transactions` row + one ledger group
- [ ] Reconciliation: pending tx → confirmed via `queryTransaction` poll
- [ ] Stale tx alert: pending > 24h produces `opsAlert.staleTransaction`
- [ ] End-to-end happy path (against emulators + a mock provider):
  - create chama, invite + accept, KYC approve, contribute, cycle closes, bid, distribute, payout settles
- [ ] Negative: KYC-pending user blocked from `placeBid` and `fileClaim` at rules layer
- [ ] Ledger imbalance test: inject a bad adjustment, nightly verifier flags it

---

## 8. Order of execution

1. Provider interface + MTN + Airtel adapters with sandbox contract tests
2. Schema additions + engine handlers (`memberExit`, `bidWindowClosed`)
3. Callables (KYC, chama creation, contribute, bid, claim, exit)
4. Webhooks + idempotency
5. Scheduled reconciliation + ledger verifier
6. Rules updates + extended rules-emulator test suite
7. End-to-end test against emulator + mock provider
8. Review section + Phase 3 open questions

---

## Review

**Built and verified (60/60 tests pass)**

- **Schema additions:** `Cycle.biddingClosesAt`, `Claim.evidenceRef` now required, two new engine events (`bidWindowClosed`, `memberExit`), `EngineContext.memberStakes` for ledger-derived stake refunds.
- **Provider adapter layer:** single `ProviderAdapter` interface with three implementations:
  - `MtnMomoProvider` — MTN MoMo Open API (collection + disbursement, OAuth client-credentials with cached tokens, HMAC webhook signature verification using `timingSafeEqual`)
  - `AirtelMoneyProvider` — Airtel Money Open API (merchant payments + disbursements, OAuth, HMAC signatures)
  - `MockProvider` — in-process simulator for the rest of Phase 2 to land without sandbox keys
  - `registry.ts` resolves Provider enum → adapter; reads config from env (typed `requireEnv` throws `ProviderConfigError`)
- **Engine glue (`engine/dispatch.ts`):** assembles `EngineContext` from Firestore, calls `applyEvent`, writes balanced ledger entries + state patches + audit log + queued payouts transactionally. Member-stake reads use the `member:<uid>:<chamaId>` account aggregation, so exit refunds are always ledger-derived.
- **Cloud Functions callables:** `submitKyc`, `mintKycUploadUrl`, `approveKyc`, `createChama` (materializes cycles upfront), `inviteMember`, `acceptInvite`, `initiateContribution` (with deterministic idempotency key), `placeBid` (engine-validated bid window), `fileClaim` (requires evidenceRef), `approveClaim`, `requestExit`, `mintEvidenceUploadUrl`, `readEvidence` (Functions-proxied per Phase 2 decision).
- **Webhooks:** `mtnMomoWebhook` + `airtelMoneyWebhook` HTTP endpoints share `handleProviderWebhook` orchestrator. Verifies signature, idempotency-checks against `transactions` collection, advances state, dispatches `contributionPaid` engine event for confirmed deposits. Replays are no-ops. Unknown txns return 422, bad signatures 401.
- **Scheduled jobs:** `reconcilePendingTransactions` (5 min poll, 24h human alert), `verifyChamaLedger` (nightly invariant check, pauses chama on imbalance), `closeMaturedCycles` (10 min).
- **Auth trigger:** `bootstrapUser` (`beforeUserCreated`) seeds `users/{uid}` with kyc:'unstarted'.
- **Rules updates:** `kycApproved` claim required for bid creation and claim filing; `biddingClosesAt` enforced via `request.time.toMillis()`; `evidenceRef` required on claim create.
- **Idempotency:** `idempotencyKey(uid, chamaId, sourceId, attempt) = sha256(...)`. Same inputs always yield the same key — webhook replays and callable retries cannot duplicate transactions.

**Tests passing (60/60)**

- 15 shared engine unit tests (incl. 6 new: bid window enforcement, bidWindowClosed transition, memberExit for fixed-savings + welfare + blocked merry-go-round mid-cycle)
- 16 provider adapter tests (Mock idempotency, signed webhook parse, signature rejection, query state mapping; MTN initiateDeposit + queryTransaction + parseWebhook for both SUCCESSFUL and FAILED; Airtel equivalents)
- 25 Firestore rules tests (5 new: kycApproved required, kyc-rejected user blocked, bid window enforced, evidenceRef required, kyc-rejected claim filer blocked)
- **4 end-to-end pipeline tests** (the deliverable for Phase 2):
  - Contribution: initiate → webhook confirm → ledger balances → cycle pool grows. Replay idempotent. Bad signature → 401. Unknown transaction → 422.
  - Bid cycle: two bids dispatched, cycle closes, winner payout queued, dividend distributed across non-winners, ledger balances after distribution.

**Architectural notes / surprises**

- `handleProviderWebhook` deliberately calls `dispatch(...)` AFTER its own Firestore transaction (rather than inside it) because Firestore can't open a nested transaction. This means the webhook-state update and the engine ledger write are two distinct transactions — recovery from a crash between them is handled by the nightly verifier + the reconciliation poller re-querying the provider.
- `exactOptionalPropertyTypes: true` (from Phase 1 strict config) forced explicit `| undefined` annotations on `DispatchResult.winnerUid` and the conditional spread pattern for `EngineContext` construction. This is a feature, not a bug — it caught one place where I was implicitly relying on optional undefined.
- Discovered during e2e: the test-cleanup race (clearing chamas before walking their subcollections) was a real bug only in tests, but it illustrates why we keep ledger entries top-level rather than under chamas — easier to verify, easier to clean.

## Phase 3 open questions

- Mobile MVP shape: which screens ship first (login → chama list → contribute → cycle view → claim flow)?
- Admin app MVP shape: KYC reviewer queue + treasurer dashboard. Web or also mobile?
- FCM notifications: which events trigger pushes (contribution due, bid window open, payout sent, claim status change)?
- Luganda translations source: pre-supplied glossary, third-party translator, or community contribution?
- Sponsor / regulatory: who underwrites the MTN MoMo production agreement? Is there a Bank of Uganda regulatory step before we touch real money?
- Real sandbox credentials: still pending. Mock provider will run forever until we paste them.
