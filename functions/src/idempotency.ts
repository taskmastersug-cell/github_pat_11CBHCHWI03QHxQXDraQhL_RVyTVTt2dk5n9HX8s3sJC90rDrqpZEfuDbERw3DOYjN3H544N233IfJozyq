import { createHash } from 'node:crypto';

// Deterministic idempotency key. Same inputs always yield the same key, so
// webhook replays or callable retries cannot create duplicate transactions.
// `attempt` lets us deliberately re-issue (e.g. after a hard failure when the
// user retries from the UI).
export function idempotencyKey(
  uid: string,
  chamaId: string,
  sourceId: string,
  attempt: number,
): string {
  const h = createHash('sha256');
  h.update(uid); h.update('\0');
  h.update(chamaId); h.update('\0');
  h.update(sourceId); h.update('\0');
  h.update(String(attempt));
  return h.digest('hex');
}
