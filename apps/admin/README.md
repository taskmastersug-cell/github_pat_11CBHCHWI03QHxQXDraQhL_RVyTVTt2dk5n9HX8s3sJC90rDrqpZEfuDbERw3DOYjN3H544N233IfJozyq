# @roundpay/admin

Next.js 14 (App Router) admin dashboard. Phase 4 deliverable: KYC reviewer
queue + treasurer dashboard with claim approvals and ledger health.

## Run locally

```
cd ../..
npm install
cd functions && npm run build && cd ..
firebase emulators:start
```

In another terminal:

```
cd apps/admin
npm run dev
```

Open http://localhost:3000.

## Pages

- `/` — dashboard with KYC backlog + chama count
- `/kyc` — review queue; approve/reject calls the `approveKyc` callable (requires `kycReviewer` custom claim)
- `/chamas` — list of chamas with status
- `/chamas/[id]` — per-chama view: type, contribution, member count, **ledger health** (per-account totals + balance invariant), submitted welfare claims with evidence view + approve/reject

## Reviewer setup

To grant a reviewer claim during dev, run a one-off Admin SDK script:

```ts
import { getAuth } from 'firebase-admin/auth';
await getAuth().setCustomUserClaims(uid, { kycReviewer: true });
```

## Tests

```
npm test       # ledger summary helper
npm run typecheck
```

## Out of scope (Phase 5+)

- Reviewer-grant UI
- Audit-log browser
- Ops alerts feed
- Manual ledger adjustment screen
