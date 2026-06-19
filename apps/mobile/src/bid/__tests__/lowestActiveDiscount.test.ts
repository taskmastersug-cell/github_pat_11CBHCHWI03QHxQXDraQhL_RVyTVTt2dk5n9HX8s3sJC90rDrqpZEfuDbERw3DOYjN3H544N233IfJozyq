import { money, type Bid } from '@roundpay/shared';
import { lowestActiveDiscount } from '../lowestActiveDiscount';

const bid = (overrides: { discount: number; status?: Bid['status'] }): Bid => ({
  bidId: 'b' as Bid['bidId'],
  cycleId: 'c' as Bid['cycleId'],
  chamaId: 'cm' as Bid['chamaId'],
  uid: 'u' as Bid['uid'],
  discount: money(overrides.discount),
  placedAt: 0,
  status: overrides.status ?? 'active',
});

describe('lowestActiveDiscount', () => {
  it('returns null when there are no bids', () => {
    expect(lowestActiveDiscount([])).toBeNull();
  });

  it('returns the smallest active discount', () => {
    const bids = [bid({ discount: 5000 }), bid({ discount: 3000 }), bid({ discount: 8000 })];
    expect(lowestActiveDiscount(bids)).toBe(3000);
  });

  it('ignores withdrawn / lost / won bids', () => {
    const bids = [
      bid({ discount: 1000, status: 'withdrawn' }),
      bid({ discount: 4000, status: 'active' }),
      bid({ discount: 500, status: 'lost' }),
    ];
    expect(lowestActiveDiscount(bids)).toBe(4000);
  });

  it('returns null when every bid is non-active', () => {
    const bids = [bid({ discount: 1000, status: 'withdrawn' }), bid({ discount: 2000, status: 'lost' })];
    expect(lowestActiveDiscount(bids)).toBeNull();
  });
});
