# RoundPay — Phase 1 Plan

Source of truth for this session. Each `[ ]` is a checkable unit. Do not mark
done without proof (compile + test where applicable). If anything contradicts
an answer captured below, stop and re-plan.

---

## Decisions captured from the user (frozen for Phase 1)

| Area | Decision |
|---|---|
| Chama types in scope | merry-go-round (bid), fixed savings, welfare fund |
| Merry-go-round rotation | Bid-based each cycle |
| Bid mechanic | Discount bid (chit-fund style): winner takes a reduced pot; the discount is distributed as a dividend to non-winning members of that cycle |
| Welfare trigger | Member-filed claim + treasurer approval |
| Money representation | Integer UGX (no subunits). Stored as `number` in Firestore but constrained to safe-integer range; all math in shared helpers |
| Payment confirmation | Webhook (primary) + scheduled polling reconciliation (safety net) |
| Roles | Per-chama membership (role lives on membership doc, not user) |
| KYC | Full: phone OTP + NIN + selfie. PII handled with care (see §6) |
| Late contributions | Marked `late`, no automatic penalty. Treasurer dashboard surfaces it |
| Languages | English + Luganda (strings only in Phase 1; structure must support it) |

---

## 1. Architectural thesis — why this design

The instruction "a single payout engine must serve all three chama types without
forking logic" is the load-bearing constraint. The naive shape is a switch on
`chama.type`. That is the wrong altitude. The right altitude is:

> Every monetary movement in RoundPay is a **double-entry ledger posting**.
> A chama is a **bundle of policies** that, given an event, decide which
> postings to produce. The engine has no knowledge of chama type — only of
> events and policies.

This gives us four orthogonal policy slots on a chama, each with a small
enum value and a typed config:

1. **`contributionPolicy`** — schedule + amount + which member account it credits
2. **`selectionPolicy`** — given a cycle ready to distribute, who receives
   - `fixedOrder` (legacy ROSCA, not in Phase 1 but slot reserved)
   - `discountBid` (Phase 1 — merry-go-round)
   - `proRataByShare` (Phase 1 — fixed savings on maturity / exit)
   - `approvedClaim` (Phase 1 — welfare)
3. **`triggerPolicy`** — when does a distribution fire
   - `onCycleClose` (merry-go-round)
   - `onMaturity` / `onMemberExit` (fixed savings)
   - `onClaimApproval` (welfare)
4. **`accrualPolicy`** — how the pool earns/redistributes between contributions
   and the distribution event (e.g. the chit-fund dividend split)

Adding a fourth chama type later = adding a policy value, not editing the
engine. This is the elegance test the user asked for.

### Double-entry ledger

Every transaction writes ≥2 `ledger_entry` documents that sum to zero across a
defined set of accounts:

- `member:<uid>:<chamaId>` — member's stake/balance in this chama
- `chama:<chamaId>:pool` — current cycle pool
- `chama:<chamaId>:reserve` — welfare standing reserve
- `chama:<chamaId>:fees` — fees collected
- `provider:<momo|airtel>:clearing` — funds in flight with MoMo/Airtel
- `external:<msisdn>` — counterparty (member's phone wallet, before they're
  matched to a member doc; reconciliation lives here)

Invariant enforced in Cloud Functions and verified by a nightly job:
**sum of all ledger_entries per chama == 0**. If this ever breaks, halt
distributions for that chama and alert.

### The engine

```
applyEvent(chama, event, ctx) -> { postings: LedgerEntry[], stateUpdates: ... }
```

Pure function. Policies are looked up by enum, each implemented as a small
module exporting `(chama, event, ctx) => Posting[]`. No `if chama.type ===`
anywhere outside the policy registry.

---

## 2. Monorepo scaffold

- [ ] Root `package.json` with workspaces: `apps/*`, `packages/*`, `functions`
- [ ] Root `tsconfig.base.json` with strict mode, `noUncheckedIndexedAccess`,
      `exactOptionalPropertyTypes`
- [ ] `.editorconfig`, `.gitignore`, `.nvmrc` (Node 20)
- [ ] `packages/shared/` — TS library, no runtime deps beyond `zod`
- [ ] `apps/mobile/` — Expo SDK 51, TS, references `packages/shared`
- [ ] `apps/admin/` — Next.js 14 (App Router), TS, references `packages/shared`
- [ ] `functions/` — Firebase Functions v2, Node 20, references `packages/shared`
- [ ] `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `.firebaserc`
      placeholder
- [ ] Root `README.md` explaining the workspace layout (one screen, not a novel)

Acceptance: `npm install` at root succeeds; `tsc -b` builds all workspaces;
shared package is importable from mobile/admin/functions via path mapping.

---

## 3. Firestore data model

Top-level collections. IDs use `nanoid` (URL-safe, 21 chars) unless noted.

### `users/{uid}`
Auth identity + global profile. **No money, no role.** Roles live on memberships.
```
{ uid, msisdn, displayName, locale: 'en'|'lg', kyc: { status, ninHash, selfieRef, verifiedAt, reviewerUid }, createdAt, disabled }
```
`ninHash` = HMAC(NIN, server-side pepper). Raw NIN never stored. Selfie in
Cloud Storage under a path only Cloud Functions and admin reviewers can read.

### `chamas/{chamaId}`
```
{ chamaId, name, type: 'merryGoRound'|'fixedSavings'|'welfare',
  policies: { contribution, selection, trigger, accrual }, // each = { kind, config }
  currency: 'UGX',
  status: 'forming'|'active'|'paused'|'closed',
  createdBy, createdAt,
  memberCount, // denormalized counter, maintained by trigger
  cycleLength?: { unit: 'day'|'week'|'month', n: number },
  contributionAmount: number // integer UGX
}
```

### `chamas/{chamaId}/memberships/{membershipId}`
The join table. Role lives here.
```
{ membershipId, chamaId, uid, role: 'member'|'treasurer'|'admin',
  status: 'invited'|'active'|'suspended'|'exited',
  joinedAt, share: number /* basis points, for proRata */ }
```
Composite index: `(uid, status)` for "my chamas" queries.

### `chamas/{chamaId}/cycles/{cycleId}`
A unit of contribution + distribution.
```
{ cycleId, chamaId, index, opensAt, closesAt,
  state: 'open'|'contributing'|'bidding'|'closing'|'distributing'|'settled'|'voided',
  expectedAmount: number, // per-member contribution this cycle
  pool: number, // running sum, denormalized from ledger
  winnerUid?: string, winningBid?: number /* discount in UGX */,
  distributedAt?, settledAt? }
```

### `chamas/{chamaId}/cycles/{cycleId}/bids/{bidId}` (merry-go-round only)
```
{ bidId, cycleId, uid, discount: number, placedAt, status: 'active'|'withdrawn'|'won'|'lost' }
```

### `chamas/{chamaId}/contributions/{contributionId}`
A scheduled/recorded expectation for one member in one cycle.
```
{ contributionId, chamaId, cycleId, uid, amount,
  state: 'pending'|'paid'|'late'|'waived',
  paidAt?, transactionId? }
```

### `chamas/{chamaId}/claims/{claimId}` (welfare only)
```
{ claimId, chamaId, uid, reason: string, amountRequested, evidenceRef?,
  state: 'submitted'|'approved'|'rejected'|'paid',
  reviewerUid?, reviewedAt?, payoutId? }
```

### `chamas/{chamaId}/payouts/{payoutId}`
Result of `triggerPolicy` firing. One per disbursement.
```
{ payoutId, chamaId, cycleId?, claimId?, recipientUid, amount,
  state: 'queued'|'requested'|'sent'|'failed'|'reversed',
  provider: 'mtnMomo'|'airtelMoney', providerRef?, attempts, createdAt, settledAt? }
```

### `transactions/{txId}` (top-level for cross-chama reconciliation)
Money in/out of the platform — one row per MoMo/Airtel call.
```
{ txId, kind: 'deposit'|'payout', uid, chamaId, contributionId?|payoutId?,
  msisdn, amount, provider, providerRef, idempotencyKey,
  state: 'pending'|'confirmed'|'failed'|'reconciled',
  initiatedAt, confirmedAt?, raw: { ... } /* provider payload */ }
```
Unique index on `(provider, idempotencyKey)`.

### `ledger_entries/{entryId}` (top-level, append-only)
Double-entry postings. **Never updated, never deleted.**
```
{ entryId, chamaId, txGroupId, account, amount /* signed integer */,
  currency, ts, sourceKind: 'contribution'|'payout'|'bid_dividend'|'fee'|'adjustment',
  sourceRef, postedBy: 'system'|uid }
```
A `txGroupId` is shared by all entries of a single posting; they must sum to 0.

### `audit_log/{logId}` (top-level, append-only)
Every privileged action: role change, claim approval, manual adjustment,
reconciliation override, chama config change.
```
{ logId, actorUid, action, target: { kind, id }, before?, after?, ts, ip?, ua? }
```

---

## 4. Firestore security rules — design

Principles, in order of importance:

1. **No client writes to money.** `ledger_entries`, `transactions`, `payouts`,
   `audit_log` are deny-all for clients. Reads filtered by membership.
2. **Member doc isolation.** A user can read `users/{uid}` only if `uid == request.auth.uid`. Display names of co-members are surfaced via a thin
   `chamas/{id}/memberships/{mid}` read, not by reading `users/*`.
3. **Chama scoping.** All reads under `chamas/{chamaId}/**` require an
   `active` membership in that chama. Implemented via a `get()` on the
   membership doc keyed by `{chamaId}_{uid}` (deterministic ID so the rule
   doesn't need a query).
4. **Role gating.** Treasurer-only writes (approving a claim, opening a cycle)
   check the membership's `role` field.
5. **Bid integrity.** A member can create their own bid (`uid == auth.uid`)
   during cycle state `bidding`, and only update `status: 'withdrawn'`.
   Winner selection is Cloud-Function-only.
6. **Claim filing.** A member can create a claim for themselves. Only
   treasurer/admin can transition its state.
7. **Immutability.** `ledger_entries` and `audit_log` — `allow update, delete: if false`. Belt + braces with rules even though clients never get write at all.

### Membership doc ID convention

Use `${chamaId}_${uid}` as the membership document ID. This lets rules do
`get(/databases/$(database)/documents/chamas/$(chamaId)/memberships/$(chamaId + '_' + request.auth.uid))`
in O(1) without a query.

### Rule modules

- [ ] `firestore.rules` with `match /databases/{db}/documents { ... }`
- [ ] Helper functions: `isSignedIn()`, `isMember(chamaId)`,
      `roleIn(chamaId)`, `isSelf(uid)`, `isImmutable()`
- [ ] Per-collection match blocks above

---

## 5. Shared types (`packages/shared`)

- [ ] `src/money.ts` — `Money = number` brand, `addMoney`, `sumMoney`,
      `assertSafeInteger`, format helpers (en/lg locale)
- [ ] `src/ids.ts` — branded IDs (`UserId`, `ChamaId`, `CycleId`, ...) using TS template literal brand
- [ ] `src/chama/policies.ts` — discriminated unions for each policy slot
- [ ] `src/chama/types.ts` — `Chama`, `Membership`, `Cycle`, `Bid`,
      `Contribution`, `Claim`, `Payout`
- [ ] `src/ledger/types.ts` — `LedgerEntry`, `Account`, `Posting`
- [ ] `src/ledger/invariants.ts` — `assertBalanced(postings: Posting[])`
- [ ] `src/engine/events.ts` — `RoundPayEvent` union
- [ ] `src/engine/apply.ts` — `applyEvent(chama, event, ctx)` signature + registry
- [ ] `src/engine/policies/*.ts` — one file per concrete policy (Phase 1: 4 files)
- [ ] `src/schemas/*.ts` — `zod` schemas mirroring Firestore docs; functions
      use these to validate every write
- [ ] `src/index.ts` — explicit re-exports (no `export *`)

Acceptance: unit tests in shared verify
- `applyEvent` produces balanced postings for: contribution paid, bid-cycle close (with discount dividend split), welfare claim approval → payout, fixed-savings maturity distribution
- `assertBalanced` rejects unbalanced postings

---

## 6. KYC & PII handling

User chose full KYC. Concretely for Phase 1:

- [ ] `users/{uid}.kyc.ninHash` — HMAC-SHA256 with a server-side pepper from
      Functions runtime config; raw NIN never persists to Firestore
- [ ] Selfie uploaded directly to Cloud Storage at `kyc/{uid}/selfie-{ts}.jpg`
      via a signed URL minted by a Cloud Function (client never writes to
      Storage directly for KYC)
- [ ] Storage rules: only Functions service account + users with `kycReviewer`
      custom claim can read; nobody can update/delete
- [ ] Review is manual queue in the (later) admin app — Phase 1 just lands the
      data correctly; the admin UI is Phase 2/3
- [ ] Audit-log every kyc state transition

**Flag for the user:** this is the part of Phase 1 that's most likely to slip
into Phase 2. If the admin review UI is out of scope, we either (a) stub
auto-approve in dev with a clearly-tagged dev flag, or (b) leave new users in
`pending` and let them join chamas in a `restricted` mode. I lean (b). Will
confirm before implementing.

---

## 7. Security-rules tests (the "prove it works" deliverable)

Use the Firebase rules emulator + `@firebase/rules-unit-testing`.

- [ ] Test: anonymous user can't read any collection
- [ ] Test: signed-in non-member can't read `chamas/{id}` they don't belong to
- [ ] Test: member can read their chama, can read their own membership, can read
      sibling memberships in same chama
- [ ] Test: member can NOT write to `ledger_entries`, `transactions`, `payouts`,
      `audit_log` — any path, any shape
- [ ] Test: member can create a bid for self in `bidding` state; cannot create
      for another uid; cannot bid in `open` state
- [ ] Test: member can file a claim for self; cannot approve own claim
- [ ] Test: treasurer can approve a claim; member role cannot
- [ ] Test: nobody can update or delete a `ledger_entry` or `audit_log` entry
- [ ] Test: user can read `users/{self}` but not `users/{other}`

Acceptance: `npm test` in `functions/` (or a `tests/rules/` workspace) runs
the emulator and all assertions pass. Failures here block "done."

---

## 8. Order of execution

1. Scaffold monorepo (§2) — pure plumbing
2. Shared types + policies + engine + unit tests (§5) — pure, no Firebase
3. Firestore data model documented in code (zod schemas) (§5)
4. `firestore.rules` (§4)
5. Rules emulator tests (§7) — gating check
6. README updates explaining the engine + policies (§1) so Phase 2 has a map
7. Review section + lessons capture

---

## Decisions locked (post-approval)

1. **KYC fallback:** Users land in `pending` + restricted mode. Restricted = can read chamas they're invited to, cannot contribute, cannot receive payouts, cannot file claims. Enforced in Cloud Functions (not rules — rules can't reasonably do KYC checks without extra lookups; keep them simple).
2. **Cycle scheduling:** Materialized upfront at chama creation. For chamas with no fixed end (welfare), materialize a rolling 12-cycle window and have a scheduled function extend it.
3. **Reconciliation:** Scheduled poll every 5 minutes for any `transactions.state == 'pending'`; write to `audit_log` + alert (via a `kycReviewer`/`opsAlerts` channel — concrete delivery is Phase 2) when a row exceeds 24h pending.
4. **Currency field:** Kept on every money-bearing doc (`chama`, `cycle`, `contribution`, `payout`, `transaction`, `ledger_entry`). Engine treats it as opaque; Phase 1 only ever populates `'UGX'`.
5. **KYC scope:** Full plumbing now — signed-URL upload function, storage rules, audit, restricted-mode middleware in Cloud Functions.
6. **Permissions granted by user:** install npm deps as needed, run Firebase emulator in-session to execute rules tests.

---

## Review

**Built and verified**

- Monorepo scaffolded: `apps/mobile` (Expo stub), `apps/admin` (Next.js stub), `packages/shared` (engine + types), `functions` (skeleton + rules tests). Root `package.json` workspaces, `tsconfig.base.json` with strict mode (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- `packages/shared` is pure TS, no Firebase deps:
  - Branded `Money` type (safe-integer UGX), branded ID types
  - `ChamaPolicies` discriminated unions (contribution/selection/trigger/accrual)
  - `PHASE1_PRESETS` for merry-go-round, fixed-savings, welfare
  - Account taxonomy + helpers (`memberAccount`, `poolAccount`, `poolEquityAccount`, `reserveAccount`, `feesAccount`, `providerClearingAccount`, `externalAccount`)
  - `assertBalanced` — invariant verifier
  - `applyEvent(event, ctx)` — single engine entry point. Dispatches on event kind; consults policy registry. No branching on chama type.
  - zod schemas for every Firestore doc shape
- 9 engine unit tests pass: contribution (pool + reserve), discount-bid cycle close with dividend split + remainder allocation, no-bid settle, welfare claim approval, fixed-savings maturity proRata, pre-maturity no-op, and `assertBalanced` failure case
- `firestore.rules` written:
  - All financial collections (`ledger_entries`, `transactions`, `payouts`, `audit_log`) are deny-all on writes
  - Chama reads gated on active membership via deterministic membership doc id (`${chamaId}_${uid}`)
  - Users can only read own profile; KYC self-approval blocked
  - Bid creation/withdraw allowed only for self in `bidding` cycle state
  - Claim filing in `submitted` state allowed; approval is Functions-only
- `storage.rules` — KYC selfie reads gated by `kycReviewer` custom claim; no client writes
- 21 rules emulator tests pass — proves unauthorized writes are blocked, scope is enforced, role gating works

**Architectural notes**

- The double-entry ledger uses two account categories (CASH and EQUITY) plus a per-chama `poolEquity` offset account. Every event group sums to zero per currency. This invariant is verified per-event in the engine.
- Membership doc id convention (`${chamaId}_${uid}`) gives rules O(1) membership lookup with a single `get()`. No `query` calls in rules — they don't permit them anyway, and this dodges the issue cleanly.
- The engine and Firestore are completely decoupled. Functions read Firestore, build an `EngineContext`, call `applyEvent`, write the resulting postings + state updates back transactionally. This is what makes the engine pure-unit-testable.

**Out of scope (deferred to Phase 2+)**

- Real MoMo / Airtel adapters — only the abstract `Provider` enum + `Transaction` schema land in Phase 1
- Cloud Functions concrete implementations (callable endpoints, webhook handlers, scheduled reconciliation, KYC signed-URL minting). The Functions workspace is wired up and ready; only the `_engineImported` shape stub ships in Phase 1
- Mobile + admin UIs — both apps are scaffolded with valid package.json/tsconfig but no screens
- FCM, multi-currency support beyond the field reservation
- Admin KYC review queue UI (KYC data plumbing IS landed; admin UI is Phase 2/3)

**Open questions for Phase 2**

1. **MoMo/Airtel sandbox creds:** which environment do we target first (MTN Sandbox? Mobile Money Open API?). Do we need a sponsor relationship for production?
2. **Idempotency strategy specifics:** the schema reserves `idempotencyKey` on `transactions`. Should the client mint it (UUID per user action) or Functions (deterministic hash)? Lean Functions-side deterministic to make webhook retries safe.
3. **Restricted-mode enforcement location:** chose Functions-only for Phase 1. Should we ALSO surface a `kycRestricted` claim so the rules can deny financial-action writes? Rules currently deny those anyway — the question is whether to surface "you can't do this" UX hints earlier.
4. **Bid window mechanics:** how long does the `bidding` state stay open relative to `closesAt`? Suggest a separate `biddingClosesAt` field on `Cycle`. Not in the schema yet.
5. **Welfare claim evidence:** should we require evidence (photo, doc) on submission? If yes, same signed-URL storage path as KYC selfies, or separate?
6. **Member exit handling:** schema supports `status: 'exited'` but no policy for refunding their stake. Probably a dedicated `memberExit` event with policy-driven settlement.

## Lessons (separate file)

_Corrections from the user logged to `tasks/lessons.md`._
