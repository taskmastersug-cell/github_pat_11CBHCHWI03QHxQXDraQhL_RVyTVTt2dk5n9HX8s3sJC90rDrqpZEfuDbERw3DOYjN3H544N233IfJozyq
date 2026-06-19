import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildNotification } from './messages.js';

describe('buildNotification', () => {
  it('formats contributionConfirmed with money and chama name (en)', () => {
    const n = buildNotification(
      { kind: 'contributionConfirmed', chamaName: 'Boda Boys', amount: 50_000, chamaId: 'c1', cycleId: 'cy1' },
      'en',
    );
    assert.equal(n.title, 'Contribution received');
    assert.match(n.body, /UGX 50,000/);
    assert.match(n.body, /Boda Boys/);
    assert.deepEqual(n.data, { kind: 'contributionConfirmed', chamaId: 'c1', cycleId: 'cy1' });
  });

  it('uses Luganda copy when locale is lg', () => {
    const n = buildNotification(
      { kind: 'payoutSent', chamaName: 'Boda Boys', amount: 200_000, chamaId: 'c1' },
      'lg',
    );
    assert.match(n.title, /^\[LG\]/);
    assert.match(n.body, /USh 200,000/);
  });

  it('passes chamaId + claimId in claimApproved data', () => {
    const n = buildNotification(
      { kind: 'claimApproved', chamaName: 'Welfare', amount: 100_000, chamaId: 'c2', claimId: 'cl9' },
      'en',
    );
    assert.equal(n.data['claimId'], 'cl9');
    assert.equal(n.data['chamaId'], 'c2');
  });

  it('omits chamaId for kycApproved', () => {
    const n = buildNotification({ kind: 'kycApproved' }, 'en');
    assert.equal(n.title, 'You’re verified');
    assert.deepEqual(n.data, { kind: 'kycApproved' });
  });

  it('builds bidWindowOpen with cycleId', () => {
    const n = buildNotification(
      { kind: 'bidWindowOpen', chamaName: 'Rotation A', chamaId: 'c3', cycleId: 'cy3' },
      'en',
    );
    assert.match(n.body, /Rotation A/);
    assert.equal(n.data['cycleId'], 'cy3');
  });
});
