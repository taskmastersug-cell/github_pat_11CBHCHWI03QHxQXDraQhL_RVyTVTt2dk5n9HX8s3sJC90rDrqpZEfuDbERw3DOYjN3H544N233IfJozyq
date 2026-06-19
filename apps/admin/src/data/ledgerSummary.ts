import type { LedgerEntry } from '@roundpay/shared';

export type LedgerSummary = {
  totalsByAccount: Record<string, number>;
  netByCurrency: Record<string, number>;
  imbalanced: boolean;
};

export function summarizeLedger(entries: readonly LedgerEntry[]): LedgerSummary {
  const totalsByAccount: Record<string, number> = {};
  const netByCurrency: Record<string, number> = {};
  for (const e of entries) {
    totalsByAccount[e.account] = (totalsByAccount[e.account] ?? 0) + e.amount;
    netByCurrency[e.currency] = (netByCurrency[e.currency] ?? 0) + e.amount;
  }
  const imbalanced = Object.values(netByCurrency).some((n) => n !== 0);
  return { totalsByAccount, netByCurrency, imbalanced };
}
