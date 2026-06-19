import type { NotificationKind } from './messages.js';

// Pure resolver: notification data payload → in-app path. Returns null when
// the payload is malformed (so the caller knows to fall back to "/").
export function routeForNotification(data: Record<string, unknown>): string | null {
  const kind = data['kind'] as NotificationKind | undefined;
  const chamaId = typeof data['chamaId'] === 'string' ? data['chamaId'] : null;
  const cycleId = typeof data['cycleId'] === 'string' ? data['cycleId'] : null;

  switch (kind) {
    case 'contributionConfirmed':
      if (!chamaId || !cycleId) return null;
      return `/(app)/cycle/${cycleId}?chamaId=${chamaId}`;
    case 'bidWindowOpen':
      if (!chamaId || !cycleId) return null;
      return `/(app)/cycle/${cycleId}/bid?chamaId=${chamaId}`;
    case 'payoutSent':
      if (!chamaId) return null;
      return `/(app)/chama/${chamaId}`;
    case 'claimApproved':
    case 'claimRejected':
      if (!chamaId) return null;
      return `/(app)/chama/${chamaId}/claims`;
    case 'kycApproved':
      return '/';
    default:
      return null;
  }
}
