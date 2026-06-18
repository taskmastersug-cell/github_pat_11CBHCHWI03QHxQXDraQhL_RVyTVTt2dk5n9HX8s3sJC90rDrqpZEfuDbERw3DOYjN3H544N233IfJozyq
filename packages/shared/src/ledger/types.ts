import type { Money, CurrencyCode } from '../money.js';
import type { ChamaId, LedgerEntryId, TxGroupId, UserId } from '../ids.js';

// Account categories
// ------------------
// CASH accounts hold real money (clearing buckets, chama pool/reserve).
// EQUITY accounts represent claims (a member's stake, the pool's outstanding
// liability to members).
// Invariant: per chama, per currency, sum of ALL ledger entries == 0.
//
// We don't enforce category at the type level — a string prefix is enough
// for grep-ability and the engine only cares about signed amounts.

export type Account =
  | `member:${string}:${string}`        // EQUITY  member:<uid>:<chamaId> — member's stake in chama
  | `chama:${string}:pool`              // CASH    cycle/working pool
  | `chama:${string}:poolEquity`        // EQUITY  pool's outstanding claim ledger (offsets member stakes)
  | `chama:${string}:reserve`           // CASH    welfare standing reserve
  | `chama:${string}:fees`              // CASH    fees collected
  | `provider:mtnMomo:clearing`         // CASH    MTN MoMo clearing bucket
  | `provider:airtelMoney:clearing`     // CASH    Airtel Money clearing bucket
  | `external:${string}`;               // CASH    counterparty (msisdn-keyed)

export function memberAccount(uid: UserId, chamaId: ChamaId): Account {
  return `member:${uid}:${chamaId}` as Account;
}
export function poolAccount(chamaId: ChamaId): Account {
  return `chama:${chamaId}:pool` as Account;
}
export function poolEquityAccount(chamaId: ChamaId): Account {
  return `chama:${chamaId}:poolEquity` as Account;
}
export function reserveAccount(chamaId: ChamaId): Account {
  return `chama:${chamaId}:reserve` as Account;
}
export function feesAccount(chamaId: ChamaId): Account {
  return `chama:${chamaId}:fees` as Account;
}
export function providerClearingAccount(provider: 'mtnMomo' | 'airtelMoney'): Account {
  return `provider:${provider}:clearing` as Account;
}
export function externalAccount(msisdn: string): Account {
  return `external:${msisdn}` as Account;
}

export type LedgerSourceKind =
  | 'contribution'
  | 'payout'
  | 'bid_dividend'
  | 'fee'
  | 'adjustment';

export interface Posting {
  account: Account;
  amount: Money;
  currency: CurrencyCode;
  sourceKind: LedgerSourceKind;
  sourceRef: string;
}

export interface LedgerEntry extends Posting {
  entryId: LedgerEntryId;
  chamaId: ChamaId;
  txGroupId: TxGroupId;
  ts: number;
  postedBy: 'system' | UserId;
}
