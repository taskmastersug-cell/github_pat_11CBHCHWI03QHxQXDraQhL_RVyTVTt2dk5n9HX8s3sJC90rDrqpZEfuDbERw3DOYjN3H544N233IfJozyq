import { createHmac } from 'node:crypto';
import type {
  ProviderAdapter, DepositRequest, PayoutRequest, InitiateResult,
  WebhookEvent, ProviderTxStatus,
} from './Provider.js';
import { ProviderSignatureError } from './Provider.js';
import type { Money, Provider as ProviderName } from '@roundpay/shared';
import { money } from '@roundpay/shared';

interface MockTx {
  providerRef: string;
  idempotencyKey: string;
  kind: 'deposit' | 'payout';
  amount: Money;
  state: 'pending' | 'confirmed' | 'failed';
  msisdn: string;
}

// In-process provider. Lets the rest of Phase 2 land without sandbox keys.
// Webhook bodies are signed with HMAC-SHA256 using `webhookSecret`. The same
// header convention is used by both the real MTN + Airtel adapters so the
// orchestrator code path is identical.
export class MockProvider implements ProviderAdapter {
  readonly name: ProviderName;
  private readonly webhookSecret: string;
  private readonly txs = new Map<string, MockTx>();
  private seq = 0;

  constructor(name: ProviderName, webhookSecret: string) {
    this.name = name;
    this.webhookSecret = webhookSecret;
  }

  async initiateDeposit(req: DepositRequest): Promise<InitiateResult> {
    const existing = this.findByIdempotencyKey(req.idempotencyKey);
    if (existing) return { status: 'accepted', providerRef: existing.providerRef };
    const providerRef = `mock-dep-${++this.seq}`;
    this.txs.set(providerRef, {
      providerRef, idempotencyKey: req.idempotencyKey, kind: 'deposit',
      amount: req.amount, state: 'pending', msisdn: req.msisdn,
    });
    return { status: 'accepted', providerRef };
  }

  async initiatePayout(req: PayoutRequest): Promise<InitiateResult> {
    const existing = this.findByIdempotencyKey(req.idempotencyKey);
    if (existing) return { status: 'accepted', providerRef: existing.providerRef };
    const providerRef = `mock-payout-${++this.seq}`;
    this.txs.set(providerRef, {
      providerRef, idempotencyKey: req.idempotencyKey, kind: 'payout',
      amount: req.amount, state: 'pending', msisdn: req.msisdn,
    });
    return { status: 'accepted', providerRef };
  }

  async queryTransaction(providerRef: string): Promise<ProviderTxStatus> {
    const t = this.txs.get(providerRef);
    if (!t) return { state: 'failed', code: 'NOT_FOUND', message: providerRef };
    if (t.state === 'pending') return { state: 'pending' };
    if (t.state === 'confirmed') return { state: 'confirmed', providerRef, settledAt: Date.now() };
    return { state: 'failed', code: 'PROVIDER_FAILED', message: providerRef };
  }

  parseWebhook(headers: Record<string, string | undefined>, rawBody: string): WebhookEvent {
    const sig = headers['x-roundpay-signature'];
    if (!sig) throw new ProviderSignatureError('missing x-roundpay-signature');
    const expected = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    if (sig !== expected) throw new ProviderSignatureError('bad signature');
    const body = JSON.parse(rawBody) as {
      kind: 'depositConfirmed' | 'depositFailed' | 'payoutConfirmed' | 'payoutFailed';
      providerRef: string;
      idempotencyKey: string;
      amount: number;
      settledAt?: number;
      code?: string;
      message?: string;
    };
    const baseAmount = money(body.amount);
    if (body.kind === 'depositConfirmed' || body.kind === 'payoutConfirmed') {
      return {
        kind: body.kind, providerRef: body.providerRef, idempotencyKey: body.idempotencyKey,
        amount: baseAmount, settledAt: body.settledAt ?? Date.now(),
      };
    }
    return {
      kind: body.kind, providerRef: body.providerRef, idempotencyKey: body.idempotencyKey,
      code: body.code ?? 'UNKNOWN', message: body.message ?? '',
    };
  }

  // Test-only helpers (not part of the interface)
  _confirm(providerRef: string): void {
    const t = this.txs.get(providerRef);
    if (t) t.state = 'confirmed';
  }
  _fail(providerRef: string): void {
    const t = this.txs.get(providerRef);
    if (t) t.state = 'failed';
  }
  _sign(rawBody: string): string {
    return createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
  }

  private findByIdempotencyKey(key: string): MockTx | undefined {
    for (const t of this.txs.values()) if (t.idempotencyKey === key) return t;
    return undefined;
  }
}
