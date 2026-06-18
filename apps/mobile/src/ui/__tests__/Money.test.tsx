import { formatMoney, money } from '@roundpay/shared';

describe('Money formatting (shared helper used by <Money/>)', () => {
  it('formats integer UGX with grouping for en locale', () => {
    expect(formatMoney(money(250_000), 'UGX', 'en')).toBe('UGX 250,000');
  });

  it('uses USh prefix in Luganda locale', () => {
    expect(formatMoney(money(1_500), 'UGX', 'lg')).toBe('USh 1,500');
  });

  it('formats zero', () => {
    expect(formatMoney(money(0), 'UGX', 'en')).toBe('UGX 0');
  });
});
