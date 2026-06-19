import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getProvider, resetRegistry } from '../../src/providers/registry';
import { money } from '@roundpay/shared';

const ENV_KEYS = [
  'ROUNDPAY_USE_MOCK_PROVIDERS', 'ROUNDPAY_DRY_RUN_PROVIDERS',
  'MTN_MOMO_BASE_URL', 'MTN_MOMO_SUBSCRIPTION_KEY', 'MTN_MOMO_API_USER_ID',
  'MTN_MOMO_API_KEY', 'MTN_MOMO_CALLBACK_URL', 'MTN_MOMO_WEBHOOK_SECRET',
  'AIRTEL_MONEY_BASE_URL', 'AIRTEL_MONEY_CLIENT_ID', 'AIRTEL_MONEY_CLIENT_SECRET',
  'AIRTEL_MONEY_WEBHOOK_SECRET',
];

describe('dry-run provider mode', () => {
  const original: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of ENV_KEYS) { original[k] = process.env[k]; delete process.env[k]; }
    process.env.ROUNDPAY_DRY_RUN_PROVIDERS = '1';
    resetRegistry();
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
    resetRegistry();
  });

  it('builds real MtnMomoProvider with placeholder config and dryRunFetch', async () => {
    const p = getProvider('mtnMomo');
    assert.equal(p.name, 'mtnMomo');
    const result = await p.initiateDeposit({
      idempotencyKey: 'k1', msisdn: '+256700000001',
      amount: money(50_000), currency: 'UGX', reference: 'contrib1',
    });
    assert.equal(result.status, 'accepted');
    if (result.status !== 'accepted') return;
    assert.match(result.providerRef, /^[0-9a-f-]{36}$/);
  });

  it('parses the dry-run query response as confirmed', async () => {
    const p = getProvider('mtnMomo');
    const status = await p.queryTransaction('any-ref');
    assert.equal(status.state, 'confirmed');
  });

  it('builds AirtelMoneyProvider and accepts a deposit call', async () => {
    const p = getProvider('airtelMoney');
    assert.equal(p.name, 'airtelMoney');
    const result = await p.initiateDeposit({
      idempotencyKey: 'k2', msisdn: '+256700000002',
      amount: money(75_000), currency: 'UGX', reference: 'contrib2',
    });
    assert.equal(result.status, 'accepted');
    if (result.status !== 'accepted') return;
    // Airtel uses a client-side UUID as the providerRef; dryRunFetch only
    // proves the request was accepted.
    assert.match(result.providerRef, /^[0-9a-f-]{36}$/);
  });

  it('reads env vars when they exist (not just placeholders)', async () => {
    process.env.MTN_MOMO_BASE_URL = 'https://overridden.example';
    process.env.MTN_MOMO_SUBSCRIPTION_KEY = 'real-key';
    const p = getProvider('mtnMomo');
    // can still complete a request because dryRunFetch matches on path, not host
    const result = await p.initiateDeposit({
      idempotencyKey: 'k3', msisdn: '+256700000003',
      amount: money(1_000), currency: 'UGX', reference: 'c',
    });
    assert.equal(result.status, 'accepted');
  });
});
