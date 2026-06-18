import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type {
  ProviderAdapter, DepositRequest, PayoutRequest, InitiateResult,
  WebhookEvent, ProviderTxStatus,
} from '../Provider.js';
import { ProviderSignatureError } from '../Provider.js';
import { money } from '@roundpay/shared';
import type { Provider as ProviderName } from '@roundpay/shared';

// Airtel Money Open API adapter. Same Phase 2 status as MTN: documented endpoints,
// fixture-based contract tests, live sandbox flips on with secrets.

export interface AirtelMoneyConfig {
  readonly baseUrl: string;            // e.g. https://openapiuat.airtel.africa
  readonly clientId: string;
  readonly clientSecret: string;
  readonly country: string;            // 'UG'
  readonly currency: string;            // 'UGX'
  readonly webhookSecret: string;
}

type FetchFn = typeof fetch;

export class AirtelMoneyProvider implements ProviderAdapter {
  readonly name: ProviderName = 'airtelMoney';
  constructor(
    private readonly cfg: AirtelMoneyConfig,
    private readonly fetchImpl: FetchFn = fetch,
  ) {}

  async initiateDeposit(req: DepositRequest): Promise<InitiateResult> {
    const transactionId = randomUUID();
    const token = await this.getAccessToken();
    const res = await this.fetchImpl(`${this.cfg.baseUrl}/merchant/v1/payments/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Country': this.cfg.country,
        'X-Currency': this.cfg.currency,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reference: req.reference,
        subscriber: { country: this.cfg.country, currency: this.cfg.currency, msisdn: req.msisdn.replace(/^\+/, '') },
        transaction: { amount: req.amount, country: this.cfg.country, currency: this.cfg.currency, id: transactionId },
      }),
    });
    if (res.ok) return { status: 'accepted', providerRef: transactionId };
    return { status: 'rejected', code: String(res.status), message: await safeText(res) };
  }

  async initiatePayout(req: PayoutRequest): Promise<InitiateResult> {
    const transactionId = randomUUID();
    const token = await this.getAccessToken();
    const res = await this.fetchImpl(`${this.cfg.baseUrl}/standard/v1/disbursements/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Country': this.cfg.country,
        'X-Currency': this.cfg.currency,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payee: { msisdn: req.msisdn.replace(/^\+/, '') },
        reference: req.reference,
        pin: '', // Production: encrypted PIN per Airtel docs. Sandbox accepts empty.
        transaction: { amount: req.amount, id: transactionId },
      }),
    });
    if (res.ok) return { status: 'accepted', providerRef: transactionId };
    return { status: 'rejected', code: String(res.status), message: await safeText(res) };
  }

  async queryTransaction(providerRef: string): Promise<ProviderTxStatus> {
    const token = await this.getAccessToken();
    const res = await this.fetchImpl(
      `${this.cfg.baseUrl}/standard/v1/payments/${encodeURIComponent(providerRef)}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Country': this.cfg.country,
          'X-Currency': this.cfg.currency,
        },
      },
    );
    if (!res.ok) return { state: 'failed', code: String(res.status), message: await safeText(res) };
    const body = await res.json() as { data?: { transaction?: { status?: string; message?: string } } };
    const status = body.data?.transaction?.status;
    switch (status) {
      case 'TS': return { state: 'confirmed', providerRef, settledAt: Date.now() };
      case 'TIP': return { state: 'pending' };
      case 'TF': return { state: 'failed', code: 'PROVIDER_FAILED', message: body.data?.transaction?.message ?? '' };
      default:   return { state: 'pending' };
    }
  }

  parseWebhook(headers: Record<string, string | undefined>, rawBody: string): WebhookEvent {
    const sig = headers['x-airtel-signature'];
    if (!sig) throw new ProviderSignatureError('missing x-airtel-signature');
    const expected = createHmac('sha256', this.cfg.webhookSecret).update(rawBody).digest('hex');
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ProviderSignatureError('bad signature');
    }
    const body = JSON.parse(rawBody) as {
      transaction: { id: string; status_code: string; message?: string; amount: number; airtel_money_id?: string };
      reference?: string;
      kind?: 'deposit' | 'payout';
    };
    const isDeposit = (body.kind ?? 'deposit') === 'deposit';
    const amount = money(body.transaction.amount);
    if (body.transaction.status_code === 'TS') {
      return {
        kind: isDeposit ? 'depositConfirmed' : 'payoutConfirmed',
        providerRef: body.transaction.id,
        idempotencyKey: body.reference ?? body.transaction.id,
        amount,
        settledAt: Date.now(),
      };
    }
    return {
      kind: isDeposit ? 'depositFailed' : 'payoutFailed',
      providerRef: body.transaction.id,
      idempotencyKey: body.reference ?? body.transaction.id,
      code: body.transaction.status_code,
      message: body.transaction.message ?? '',
    };
  }

  private tokenCache?: { token: string; expiresAt: number };
  private async getAccessToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 60_000) return this.tokenCache.token;
    const res = await this.fetchImpl(`${this.cfg.baseUrl}/auth/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.cfg.clientId,
        client_secret: this.cfg.clientSecret,
        grant_type: 'client_credentials',
      }),
    });
    if (!res.ok) throw new Error(`Airtel token failed: ${res.status}`);
    const body = await res.json() as { access_token: string; expires_in: number };
    this.tokenCache = {
      token: body.access_token,
      expiresAt: Date.now() + body.expires_in * 1000,
    };
    return body.access_token;
  }
}

async function safeText(res: Response): Promise<string> {
  try { return await res.text(); } catch { return ''; }
}
