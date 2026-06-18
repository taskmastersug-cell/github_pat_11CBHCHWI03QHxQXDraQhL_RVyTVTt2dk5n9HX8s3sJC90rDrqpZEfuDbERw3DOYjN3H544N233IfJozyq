# Lessons

Log corrections from the user and gotchas I had to work around. Updated whenever
something contradicts an earlier assumption.

## Phase 1

- The user chose full KYC (NIN + selfie) over the "phone + name" Phase 1 default I suggested. This expanded Phase 1 scope to include signed-URL upload plumbing, encrypted PII handling, and Storage rules. Recorded under "Decisions locked" in `tasks/todo.md`.
- `@firebase/rules-unit-testing` v3 has two non-obvious behaviors that broke initial tests:
  1. Calling `withSecurityRulesDisabled` multiple times across tests in the same suite can throw "Firestore has already been started and its settings can no longer be changed." Workaround: use `firebase-admin` SDK pointed at the emulator (`FIRESTORE_EMULATOR_HOST`) for seeding instead.
  2. Within one test, repeated `ctx.firestore()` calls on the same authenticated context can hit the same error. Workaround: cache `const fs = ctx.firestore()` once per test.
- Default Firebase emulator startup downloads the Firestore JAR on first run. In sandboxed environments this can fail silently. Pre-populating `~/.cache/firebase/emulators/cloud-firestore-emulator-v1.19.8.jar` makes startup deterministic.
