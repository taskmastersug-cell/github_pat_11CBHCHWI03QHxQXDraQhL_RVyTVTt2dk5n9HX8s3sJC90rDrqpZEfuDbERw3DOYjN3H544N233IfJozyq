import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { MtnMomoProvider, MtnMomoConfig } from '../../src/providers/mtnMomo/MtnMomoProvider';
import { ProviderSignatureError } from '../../src/providers/Provider';
import { money } from '@roundpay/shared';

const cfg: MtnMomoConfig = {
  baseUrl: 'https://sandbox.example',
  subscriptionKey: 'sub',
  apiUserId: 'u',
  apiKey: 'k',
  callbackUrl: 'https://cb',
  webhookSecret: 'wh-secret',
  targetEnvironment: 'sandbox',
};

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>): typeof fetch {
  return (async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = typeof url === 'string' ? url : url.toString();
    return handler(u, init);
  }) as unknown as typeof fetch;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('MtnMomoProvider', () => {
  it('initiateDeposit returns accepted on 202', async () => {
    const calls: string[] = [];
    const f = mockFetch((url) => {
      calls.push(url);
      if (url.endsWith('/collection/token/')) {
        return jsonResponse(200, { access_token: 't', expires_in: 3600 });
      }
      if (url.endsWith('/collection/v1_0/requesttopay')) {
        return new Response('', { status: 202 });
      }
      return new Response('', { status: 500 });
    });
    const p = new MtnMomoProvider(cfg, f);
    const r = await p.initiateDeposit({
      idempotencyKey: 'k1', msisdn: '+256700000001',
      amount: money(1000), currency: 'UGX', reference: 'contrib1',
    });
    assert.equal(r.status, 'accepted');
    assert.ok(calls.some(u => u.includes('/collection/token/')));
    assert.ok(calls.some(u => u.includes('/requesttopay')));
  });

  it('initiateDeposit rejects on non-202', async () => {
    const f = mockFetch((url) => {
      if (url.endsWith('/collection/token/')) return jsonResponse(200, { access_token: 't', expires_in: 3600 });
      return new Response('bad', { status: 400 });
    });
    const p = new MtnMomoProvider(cfg, f);
    const r = await p.initiateDeposit({
      idempotencyKey: 'k1', msisdn: '+256700000001',
      amount: money(1000), currency: 'UGX', reference: 'contrib1',
    });
    assert.equal(r.status, 'rejected');
  });

  it('queryTransaction maps SUCCESSFUL -> confirmed', async () => {
    const f = mockFetch((url) => {
      if (url.endsWith('/collection/token/')) return jsonResponse(200, { access_token: 't', expires_in: 3600 });
      return jsonResponse(200, { status: 'SUCCESSFUL' });
    });
    const p = new MtnMomoProvider(cfg, f);
    const s = await p.queryTransaction('ref');
    assert.equal(s.state, 'confirmed');
  });

  it('queryTransaction maps PENDING -> pending', async () => {
    const f = mockFetch((url) => {
      if (url.endsWith('/collection/token/')) return jsonResponse(200, { access_token: 't', expires_in: 3600 });
      return jsonResponse(200, { status: 'PENDING' });
    });
    const p = new MtnMomoProvider(cfg, f);
    const s = await p.queryTransaction('ref');
    assert.equal(s.state, 'pending');
  });

  it('parseWebhook verifies HMAC signature', () => {
    const p = new MtnMomoProvider(cfg);
    const body = JSON.stringify({
      referenceId: 'ref1', externalId: 'idem1',
      status: 'SUCCESSFUL', amount: '1000', txType: 'COLLECTION',
    });
    const sig = createHmac('sha256', cfg.webhookSecret).update(body).digest('hex');
    const ev = p.parseWebhook({ 'x-mtn-signature': sig }, body);
    assert.equal(ev.kind, 'depositConfirmed');
    if (ev.kind === 'depositConfirmed') assert.equal(ev.amount, 1000);
  });

  it('parseWebhook rejects bad signature', () => {
    const p = new MtnMomoProvider(cfg);
    const body = JSON.stringify({
      referenceId: 'ref1', externalId: 'idem1',
      status: 'SUCCESSFUL', amount: '1000', txType: 'COLLECTION',
    });
    assert.throws(() => p.parseWebhook({ 'x-mtn-signature': 'deadbeef' }, body), ProviderSignatureError);
  });

  it('parseWebhook FAILED maps to depositFailed', () => {
    const p = new MtnMomoProvider(cfg);
    const body = JSON.stringify({
      referenceId: 'ref1', externalId: 'idem1',
      status: 'FAILED', reason: 'insufficient funds', amount: '1000', txType: 'COLLECTION',
    });
    const sig = createHmac('sha256', cfg.webhookSecret).update(body).digest('hex');
    const ev = p.parseWebhook({ 'x-mtn-signature': sig }, body);
    assert.equal(ev.kind, 'depositFailed');
  });
});
