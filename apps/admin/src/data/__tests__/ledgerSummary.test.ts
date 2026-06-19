import { money, type LedgerEntry } from '@roundpay/shared';
import { summarizeLedger } from '../ledgerSummary';

const entry = (account: string, amount: number, currency = 'UGX'): LedgerEntry => ({
  entryId: ('e-' + Math.random()) as LedgerEntry['entryId'],
  txGroupId: 'tg' as LedgerEntry['txGroupId'],
  chamaId: 'c' as LedgerEntry['chamaId'],
  account: account as LedgerEntry['account'],
  amount: money(amount),
  currency: currency as LedgerEntry['currency'],
  ts: 0,
  sourceKind: 'contribution',
  sourceRef: 'r',
  postedBy: 'system',
});

describe('summarizeLedger', () => {
  it('returns empty totals for no entries', () => {
    const s = summarizeLedger([]);
    expect(s.totalsByAccount).toEqual({});
    expect(s.imbalanced).toBe(false);
  });

  it('aggregates per account', () => {
    const entries = [
      entry('chama:c:pool', 100),
      entry('chama:c:pool', 250),
      entry('member:u:c', -350),
    ];
    const s = summarizeLedger(entries);
    expect(s.totalsByAccount['chama:c:pool']).toBe(350);
    expect(s.totalsByAccount['member:u:c']).toBe(-350);
    expect(s.imbalanced).toBe(false);
  });

  it('flags imbalanced ledgers', () => {
    const entries = [entry('chama:c:pool', 500), entry('member:u:c', -300)];
    const s = summarizeLedger(entries);
    expect(s.imbalanced).toBe(true);
    expect(s.netByCurrency['UGX']).toBe(200);
  });
});
