import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { routeForNotification } from './routing.js';

describe('routeForNotification', () => {
  it('routes contributionConfirmed to cycle detail', () => {
    assert.equal(
      routeForNotification({ kind: 'contributionConfirmed', chamaId: 'c1', cycleId: 'cy1' }),
      '/(app)/cycle/cy1?chamaId=c1',
    );
  });

  it('routes bidWindowOpen to bid screen', () => {
    assert.equal(
      routeForNotification({ kind: 'bidWindowOpen', chamaId: 'c1', cycleId: 'cy2' }),
      '/(app)/cycle/cy2/bid?chamaId=c1',
    );
  });

  it('routes payoutSent to chama detail', () => {
    assert.equal(routeForNotification({ kind: 'payoutSent', chamaId: 'c1' }), '/(app)/chama/c1');
  });

  it('routes claimApproved and claimRejected to chama claims list', () => {
    assert.equal(
      routeForNotification({ kind: 'claimApproved', chamaId: 'c1', claimId: 'cl1' }),
      '/(app)/chama/c1/claims',
    );
    assert.equal(
      routeForNotification({ kind: 'claimRejected', chamaId: 'c1', claimId: 'cl1' }),
      '/(app)/chama/c1/claims',
    );
  });

  it('routes kycApproved home', () => {
    assert.equal(routeForNotification({ kind: 'kycApproved' }), '/');
  });

  it('returns null on missing chamaId / cycleId', () => {
    assert.equal(routeForNotification({ kind: 'contributionConfirmed', chamaId: 'c1' }), null);
    assert.equal(routeForNotification({ kind: 'bidWindowOpen' }), null);
    assert.equal(routeForNotification({ kind: 'payoutSent' }), null);
  });

  it('returns null on unknown kind', () => {
    assert.equal(routeForNotification({ kind: 'somethingElse', chamaId: 'c1' }), null);
    assert.equal(routeForNotification({}), null);
  });
});
