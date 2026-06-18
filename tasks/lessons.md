# Lessons

Log corrections from the user and gotchas I had to work around. Updated whenever
something contradicts an earlier assumption.

## Phase 2

- `exactOptionalPropertyTypes: true` requires explicit `| undefined` on optional fields when you build objects conditionally. The clean pattern is conditional spreads: `...(x ? { x } : {})` instead of `x: x` for `T | undefined` fields. Hit this in `EngineContext` construction inside `dispatch.ts`.
- Firestore can't open nested transactions. The webhook orchestrator updates the transaction state in one transaction, then dispatches the engine event in a separate one — the gap is recovered by the nightly ledger verifier + reconciliation poller, not by trying to wedge everything into one atomic write.
- E2E test cleanup ordering matters: deleting parent docs before walking subcollections leaves orphans (Firestore lets subcollection docs survive parent deletion). Walk subcollections first, then delete top-level.
- Tests using a NAMED firebase-admin app (e.g. `initializeApp({...}, 'e2e')`) must explicitly pass the `db` argument down through every layer that calls `getFirestore()` — there's no default app to fall back to.
- `@firebase/rules-unit-testing` `authenticatedContext(uid, customClaims)` accepts custom claims as the second arg. Use this to test `kycApproved` and other claim-gated rules.

## Phase 1

- The user chose full KYC (NIN + selfie) over the "phone + name" Phase 1 default I suggested. This expanded Phase 1 scope to include signed-URL upload plumbing, encrypted PII handling, and Storage rules. Recorded under "Decisions locked" in `tasks/todo.md`.
- `@firebase/rules-unit-testing` v3 has two non-obvious behaviors that broke initial tests:
  1. Calling `withSecurityRulesDisabled` multiple times across tests in the same suite can throw "Firestore has already been started and its settings can no longer be changed." Workaround: use `firebase-admin` SDK pointed at the emulator (`FIRESTORE_EMULATOR_HOST`) for seeding instead.
  2. Within one test, repeated `ctx.firestore()` calls on the same authenticated context can hit the same error. Workaround: cache `const fs = ctx.firestore()` once per test.
- Default Firebase emulator startup downloads the Firestore JAR on first run. In sandboxed environments this can fail silently. Pre-populating `~/.cache/firebase/emulators/cloud-firestore-emulator-v1.19.8.jar` makes startup deterministic.
