import type { Bid } from '@roundpay/shared';

export function lowestActiveDiscount(bids: readonly Bid[]): number | null {
  let min: number | null = null;
  for (const b of bids) {
    if (b.status !== 'active') continue;
    if (min == null || b.discount < min) min = b.discount;
  }
  return min;
}
