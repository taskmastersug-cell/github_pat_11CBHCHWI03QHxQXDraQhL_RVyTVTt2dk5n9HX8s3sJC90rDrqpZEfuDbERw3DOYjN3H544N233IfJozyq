// RoundPay Cloud Functions entrypoint. One export per deployable function so
// `firebase deploy --only functions:<name>` works at granular scope.

import { initializeApp } from 'firebase-admin/app';
initializeApp();

// Callables
export { submitKyc, mintKycUploadUrl, approveKyc } from './api/kyc.js';
export { createChama, inviteMember, acceptInvite } from './api/chamas.js';
export { initiateContribution } from './api/contributions.js';
export { placeBid } from './api/bids.js';
export { fileClaim, approveClaim, mintEvidenceUploadUrl, readEvidence } from './api/claims.js';
export { requestExit } from './api/exit.js';
export { registerFcmToken, unregisterFcmToken } from './api/notifications.js';

// Firestore triggers (FCM push)
export {
  onTransactionWritten, onPayoutWritten, onClaimWritten, onUserKycWritten,
} from './notifications/triggers.js';

// Webhooks
export { mtnMomoWebhook, airtelMoneyWebhook } from './webhooks/http.js';

// Auth triggers
export { bootstrapUser } from './auth/onUserCreate.js';

// Scheduled
export {
  reconcilePendingTransactions,
  verifyChamaLedger,
  closeMaturedCycles,
} from './scheduled/reconcile.js';
