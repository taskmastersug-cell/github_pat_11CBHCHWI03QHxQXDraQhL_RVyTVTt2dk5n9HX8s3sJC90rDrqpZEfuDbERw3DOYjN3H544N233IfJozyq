import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { AirtelMoneyProvider, AirtelMoneyConfig } from '../../src/providers/airtelMoney/AirtelMoneyProvider';
import { ProviderSignatureError } from '../../src/providers/Provider';
import { money } from '@roundpay/shared';

const cfg: AirtelMoneyConfig = {
  baseUrl: 'https://airtel.example',
  clientId: 'c',
  clientSecret: 's',
  country: 'UG',
  currency: 'UGX',
  webhookSecret: 'wh-secret',
};

function mockFetch(handler: (url: string) => Response | Promise<Response>): typeof fetch {
  return (async (url: RequestInfo | URL) => {
    return handler(typeof url === 'string' ? url : url.toString());
  }) as unknown as typeof fetch;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('AirtelMoneyProvider', () => {
  it('initiateDeposit returns accepted on 200 OK', async () => {
    const f = mockFetch((url) => {
      if (url.endsWith('/auth/oauth2/token')) return jsonResponse(200, { access_token: 't', expires_in: 3600 });
      return jsonResponse(200, { ok: true });
    });
    const p = new AirtelMoneyProvider(cfg, f);
    const r = await p.initiateDeposit({
      idempotencyKey: 'k1', msisdn: '+256700000001',
      amount: money(1000), currency: 'UGX', reference: 'contrib1',
    });
    assert.equal(r.status, 'accepted');
  });

  it('queryTransaction maps TS -> confirmed', async () => {
    const f = mockFetch((url) => {
      if (url.endsWith('/auth/oauth2/token')) return jsonResponse(200, { access_token: 't', expires_in: 3600 });
      return jsonResponse(200, { data: { transaction: { status: 'TS' } } });
    });
    const p = new AirtelMoneyProvider(cfg, f);
    const s = await p.queryTransaction('ref');
    assert.equal(s.state, 'confirmed');
  });

  it('parseWebhook verifies HMAC signature', () => {
    const p = new AirtelMoneyProvider(cfg);
    const body = JSON.stringify({
      transaction: { id: 'tx1', status_code: 'TS', amount: 1000 },
      reference: 'idem1',
      kind: 'deposit',
    });
    const sig = createHmac('sha256', cfg.webhookSecret).update(body).digest('hex');
    const ev = p.parseWebhook({ 'x-airtel-signature': sig }, body);
    assert.equal(ev.kind, 'depositConfirmed');
    if (ev.kind === 'depositConfirmed') assert.equal(ev.amount, 1000);
  });

  it('parseWebhook rejects bad signature', () => {
    const p = new AirtelMoneyProvider(cfg);
    const body = JSON.stringify({ transaction: { id: 'x', status_code: 'TS', amount: 1 } });
    assert.throws(() => p.parseWebhook({ 'x-airtel-signature': 'beef' }, body), ProviderSignatureError);
  });

  it('parseWebhook TF maps to depositFailed', () => {
    const p = new AirtelMoneyProvider(cfg);
    const body = JSON.stringify({
      transaction: { id: 'tx1', status_code: 'TF', amount: 1000, message: 'oops' },
      reference: 'idem1',
      kind: 'deposit',
    });
    const sig = createHmac('sha256', cfg.webhookSecret).update(body).digest('hex');
    const ev = p.parseWebhook({ 'x-airtel-signature': sig }, body);
    assert.equal(ev.kind, 'depositFailed');
  });
});
