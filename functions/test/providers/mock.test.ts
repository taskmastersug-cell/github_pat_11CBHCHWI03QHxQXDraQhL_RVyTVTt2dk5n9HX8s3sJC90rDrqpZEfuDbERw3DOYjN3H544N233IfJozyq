import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MockProvider } from '../../src/providers/mockProvider';
import { ProviderSignatureError } from '../../src/providers/Provider';
import { money } from '@roundpay/shared';

describe('MockProvider', () => {
  it('returns the same providerRef for a repeated idempotency key', async () => {
    const p = new MockProvider('mtnMomo', 'secret');
    const r1 = await p.initiateDeposit({
      idempotencyKey: 'k1', msisdn: '+256700000001',
      amount: money(1000), currency: 'UGX', reference: 'contrib1',
    });
    const r2 = await p.initiateDeposit({
      idempotencyKey: 'k1', msisdn: '+256700000001',
      amount: money(1000), currency: 'UGX', reference: 'contrib1',
    });
    assert.equal(r1.status, 'accepted');
    assert.equal(r2.status, 'accepted');
    if (r1.status === 'accepted' && r2.status === 'accepted') {
      assert.equal(r1.providerRef, r2.providerRef);
    }
  });

  it('parses a signed webhook into a depositConfirmed event', () => {
    const p = new MockProvider('mtnMomo', 'secret');
    const body = JSON.stringify({
      kind: 'depositConfirmed', providerRef: 'mock-dep-1',
      idempotencyKey: 'k1', amount: 1000, settledAt: 1234,
    });
    const sig = p._sign(body);
    const ev = p.parseWebhook({ 'x-roundpay-signature': sig }, body);
    assert.equal(ev.kind, 'depositConfirmed');
    if (ev.kind === 'depositConfirmed') {
      assert.equal(ev.amount, 1000);
      assert.equal(ev.providerRef, 'mock-dep-1');
    }
  });

  it('rejects a webhook with bad signature', () => {
    const p = new MockProvider('mtnMomo', 'secret');
    const body = JSON.stringify({ kind: 'depositConfirmed' });
    assert.throws(() => p.parseWebhook({ 'x-roundpay-signature': 'badsig' }, body),
      ProviderSignatureError);
  });

  it('queryTransaction reports pending then confirmed', async () => {
    const p = new MockProvider('mtnMomo', 'secret');
    const r = await p.initiateDeposit({
      idempotencyKey: 'k2', msisdn: '+256700000002',
      amount: money(1000), currency: 'UGX', reference: 'contrib2',
    });
    if (r.status !== 'accepted') throw new Error('init failed');
    const a = await p.queryTransaction(r.providerRef);
    assert.equal(a.state, 'pending');
    p._confirm(r.providerRef);
    const b = await p.queryTransaction(r.providerRef);
    assert.equal(b.state, 'confirmed');
  });
});
