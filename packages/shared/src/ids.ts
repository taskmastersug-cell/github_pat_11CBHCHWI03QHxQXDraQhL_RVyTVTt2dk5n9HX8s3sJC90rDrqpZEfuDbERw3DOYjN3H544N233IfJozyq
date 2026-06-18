// Branded ID types so we can't accidentally pass a ChamaId where a UserId is
// expected. At runtime they're just strings.

export type UserId = string & { readonly __brand: 'UserId' };
export type ChamaId = string & { readonly __brand: 'ChamaId' };
export type MembershipId = string & { readonly __brand: 'MembershipId' };
export type CycleId = string & { readonly __brand: 'CycleId' };
export type BidId = string & { readonly __brand: 'BidId' };
export type ContributionId = string & { readonly __brand: 'ContributionId' };
export type ClaimId = string & { readonly __brand: 'ClaimId' };
export type PayoutId = string & { readonly __brand: 'PayoutId' };
export type TransactionId = string & { readonly __brand: 'TransactionId' };
export type LedgerEntryId = string & { readonly __brand: 'LedgerEntryId' };
export type TxGroupId = string & { readonly __brand: 'TxGroupId' };

// Deterministic membership doc ID — rules use this for O(1) membership lookup.
export function membershipDocId(chamaId: ChamaId, uid: UserId): MembershipId {
  return `${chamaId}_${uid}` as MembershipId;
}
