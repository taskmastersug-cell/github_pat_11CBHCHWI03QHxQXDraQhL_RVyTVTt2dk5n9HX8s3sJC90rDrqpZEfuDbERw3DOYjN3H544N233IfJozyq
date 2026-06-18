import type { Posting } from './types.js';

// Every posting group must sum to zero per currency. Engine and Functions
// both call this before persisting.
export function assertBalanced(postings: readonly Posting[]): void {
  if (postings.length < 2) {
    throw new Error('Posting group must have at least 2 entries');
  }
  const byCurrency = new Map<string, number>();
  for (const p of postings) {
    byCurrency.set(p.currency, (byCurrency.get(p.currency) ?? 0) + p.amount);
  }
  for (const [currency, sum] of byCurrency) {
    if (sum !== 0) {
      throw new Error(`Unbalanced posting in ${currency}: net ${sum}`);
    }
  }
}
