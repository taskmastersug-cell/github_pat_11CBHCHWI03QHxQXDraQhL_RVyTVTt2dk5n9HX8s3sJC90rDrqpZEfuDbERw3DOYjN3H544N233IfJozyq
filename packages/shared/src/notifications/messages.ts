import type { Locale } from '../chama/types.js';
import { formatMoney, money } from '../money.js';

export type NotificationKind =
  | 'contributionConfirmed'
  | 'payoutSent'
  | 'claimApproved'
  | 'claimRejected'
  | 'kycApproved'
  | 'bidWindowOpen';

export type NotificationInput =
  | { kind: 'contributionConfirmed'; chamaName: string; amount: number; chamaId: string; cycleId: string }
  | { kind: 'payoutSent'; chamaName: string; amount: number; chamaId: string }
  | { kind: 'claimApproved'; chamaName: string; amount: number; chamaId: string; claimId: string }
  | { kind: 'claimRejected'; chamaName: string; chamaId: string; claimId: string }
  | { kind: 'kycApproved' }
  | { kind: 'bidWindowOpen'; chamaName: string; chamaId: string; cycleId: string };

export type BuiltNotification = {
  title: string;
  body: string;
  data: Record<string, string>;
};

const COPY: Record<Locale, Record<NotificationKind, { title: string; body: (input: NotificationInput) => string }>> = {
  en: {
    contributionConfirmed: {
      title: 'Contribution received',
      body: (i) => i.kind === 'contributionConfirmed'
        ? `Your ${formatMoney(money(i.amount), 'UGX', 'en')} to ${i.chamaName} was received.`
        : '',
    },
    payoutSent: {
      title: 'Payout sent',
      body: (i) => i.kind === 'payoutSent'
        ? `${formatMoney(money(i.amount), 'UGX', 'en')} from ${i.chamaName} is on its way to your mobile money.`
        : '',
    },
    claimApproved: {
      title: 'Claim approved',
      body: (i) => i.kind === 'claimApproved'
        ? `Your claim from ${i.chamaName} was approved for ${formatMoney(money(i.amount), 'UGX', 'en')}.`
        : '',
    },
    claimRejected: {
      title: 'Claim rejected',
      body: (i) => i.kind === 'claimRejected' ? `Your claim from ${i.chamaName} was rejected.` : '',
    },
    kycApproved: {
      title: 'You’re verified',
      body: () => 'KYC was approved. You can now contribute and place bids.',
    },
    bidWindowOpen: {
      title: 'Bidding is open',
      body: (i) => i.kind === 'bidWindowOpen' ? `Place a bid for ${i.chamaName}.` : '',
    },
  },
  lg: {
    contributionConfirmed: {
      title: '[LG] Contribution received',
      body: (i) => i.kind === 'contributionConfirmed'
        ? `[LG] Your ${formatMoney(money(i.amount), 'UGX', 'lg')} to ${i.chamaName} was received.`
        : '',
    },
    payoutSent: {
      title: '[LG] Payout sent',
      body: (i) => i.kind === 'payoutSent'
        ? `[LG] ${formatMoney(money(i.amount), 'UGX', 'lg')} from ${i.chamaName} is on its way.`
        : '',
    },
    claimApproved: {
      title: '[LG] Claim approved',
      body: (i) => i.kind === 'claimApproved'
        ? `[LG] Your claim from ${i.chamaName} was approved for ${formatMoney(money(i.amount), 'UGX', 'lg')}.`
        : '',
    },
    claimRejected: {
      title: '[LG] Claim rejected',
      body: (i) => i.kind === 'claimRejected' ? `[LG] Your claim from ${i.chamaName} was rejected.` : '',
    },
    kycApproved: {
      title: '[LG] You are verified',
      body: () => '[LG] KYC was approved.',
    },
    bidWindowOpen: {
      title: '[LG] Bidding is open',
      body: (i) => i.kind === 'bidWindowOpen' ? `[LG] Place a bid for ${i.chamaName}.` : '',
    },
  },
};

function dataFor(input: NotificationInput): Record<string, string> {
  switch (input.kind) {
    case 'contributionConfirmed':
      return { kind: input.kind, chamaId: input.chamaId, cycleId: input.cycleId };
    case 'payoutSent':
      return { kind: input.kind, chamaId: input.chamaId };
    case 'claimApproved':
    case 'claimRejected':
      return { kind: input.kind, chamaId: input.chamaId, claimId: input.claimId };
    case 'kycApproved':
      return { kind: input.kind };
    case 'bidWindowOpen':
      return { kind: input.kind, chamaId: input.chamaId, cycleId: input.cycleId };
  }
}

export function buildNotification(input: NotificationInput, locale: Locale): BuiltNotification {
  const copy = COPY[locale][input.kind];
  return {
    title: copy.title,
    body: copy.body(input),
    data: dataFor(input),
  };
}
