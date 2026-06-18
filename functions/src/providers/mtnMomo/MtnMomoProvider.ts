import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type {
  ProviderAdapter, DepositRequest, PayoutRequest, InitiateResult,
  WebhookEvent, ProviderTxStatus,
} from '../Provider.js';
import { ProviderSignatureError } from '../Provider.js';
import { money } from '@roundpay/shared';
import type { Provider as ProviderName } from '@roundpay/shared';

// MTN MoMo Open API adapter. Phase 2 status: wired against documented endpoints
// with fixture-based contract tests. Live sandbox round-trips happen once
// `MTN_MOMO_SUBSCRIPTION_KEY`, `MTN_MOMO_API_USER_ID`, `MTN_MOMO_API_KEY`,
// `MTN_MOMO_WEBHOOK_SECRET` are set via `firebase functions:secrets`.

export interface MtnMomoConfig {
  readonly baseUrl: string;            // e.g. https://sandbox.momodeveloper.mtn.com
  readonly subscriptionKey: string;
  readonly apiUserId: string;
  readonly apiKey: string;
  readonly callbackUrl: string;        // our public webhook URL
  readonly webhookSecret: string;      // HMAC secret for webhook signature verification
  readonly targetEnvironment: 'sandbox' | 'production';
}

type FetchFn = typeof fetch;

export class MtnMomoProvider implements ProviderAdapter {
  readonly name: ProviderName = 'mtnMomo';
  constructor(
    private readonly cfg: MtnMomoConfig,
    private readonly fetchImpl: FetchFn = fetch,
  ) {}

  async initiateDeposit(req: DepositRequest): Promise<InitiateResult> {
    const referenceId = randomUUID();
    const token = await this.getAccessToken('collection');
    const res = await this.fetchImpl(`${this.cfg.baseUrl}/collection/v1_0/requesttopay`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Reference-Id': referenceId,
        'X-Target-Environment': this.cfg.targetEnvironment,
        'X-Callback-Url': this.cfg.callbackUrl,
        'Ocp-Apim-Subscription-Key': this.cfg.subscriptionKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: String(req.amount),
        currency: req.currency,
        externalId: req.idempotencyKey,
        payer: { partyIdType: 'MSISDN', partyId: req.msisdn.replace(/^\+/, '') },
        payerMessage: req.note ?? req.reference,
        payeeNote: req.reference,
      }),
    });
    if (res.status === 202) return { status: 'accepted', providerRef: referenceId };
    return { status: 'rejected', code: String(res.status), message: await safeText(res) };
  }

  async initiatePayout(req: PayoutRequest): Promise<InitiateResult> {
    const referenceId = randomUUID();
    const token = await this.getAccessToken('disbursement');
    const res = await this.fetchImpl(`${this.cfg.baseUrl}/disbursement/v1_0/transfer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Reference-Id': referenceId,
        'X-Target-Environment': this.cfg.targetEnvironment,
        'X-Callback-Url': this.cfg.callbackUrl,
        'Ocp-Apim-Subscription-Key': this.cfg.subscriptionKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: String(req.amount),
        currency: req.currency,
        externalId: req.idempotencyKey,
        payee: { partyIdType: 'MSISDN', partyId: req.msisdn.replace(/^\+/, '') },
        payerMessage: req.note ?? req.reference,
        payeeNote: req.reference,
      }),
    });
    if (res.status === 202) return { status: 'accepted', providerRef: referenceId };
    return { status: 'rejected', code: String(res.status), message: await safeText(res) };
  }

  async queryTransaction(providerRef: string): Promise<ProviderTxStatus> {
    const token = await this.getAccessToken('collection');
    const res = await this.fetchImpl(
      `${this.cfg.baseUrl}/collection/v1_0/requesttopay/${encodeURIComponent(providerRef)}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Target-Environment': this.cfg.targetEnvironment,
          'Ocp-Apim-Subscription-Key': this.cfg.subscriptionKey,
        },
      },
    );
    if (!res.ok) return { state: 'failed', code: String(res.status), message: await safeText(res) };
    const body = await res.json() as { status?: string; reason?: string };
    switch (body.status) {
      case 'SUCCESSFUL': return { state: 'confirmed', providerRef, settledAt: Date.now() };
      case 'PENDING':    return { state: 'pending' };
      case 'FAILED':     return { state: 'failed', code: 'PROVIDER_FAILED', message: body.reason ?? '' };
      default:           return { state: 'pending' };
    }
  }

  parseWebhook(headers: Record<string, string | undefined>, rawBody: string): WebhookEvent {
    const sig = headers['x-mtn-signature'];
    if (!sig) throw new ProviderSignatureError('missing x-mtn-signature');
    const expected = createHmac('sha256', this.cfg.webhookSecret).update(rawBody).digest('hex');
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ProviderSignatureError('bad signature');
    }
    const body = JSON.parse(rawBody) as {
      referenceId: string;
      externalId: string;
      status: 'SUCCESSFUL' | 'FAILED';
      reason?: string;
      amount: string;
      financialTransactionId?: string;
      txType?: 'COLLECTION' | 'DISBURSEMENT';
    };
    const amount = money(parseInt(body.amount, 10));
    const isDeposit = (body.txType ?? 'COLLECTION') === 'COLLECTION';
    if (body.status === 'SUCCESSFUL') {
      return {
        kind: isDeposit ? 'depositConfirmed' : 'payoutConfirmed',
        providerRef: body.referenceId,
        idempotencyKey: body.externalId,
        amount,
        settledAt: Date.now(),
      };
    }
    return {
      kind: isDeposit ? 'depositFailed' : 'payoutFailed',
      providerRef: body.referenceId,
      idempotencyKey: body.externalId,
      code: 'PROVIDER_FAILED',
      message: body.reason ?? '',
    };
  }

  // OAuth client-credentials token. Cached in-process; cheap to acquire.
  private tokenCache = new Map<string, { token: string; expiresAt: number }>();
  private async getAccessToken(scope: 'collection' | 'disbursement'): Promise<string> {
    const cached = this.tokenCache.get(scope);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    const auth = Buffer.from(`${this.cfg.apiUserId}:${this.cfg.apiKey}`).toString('base64');
    const res = await this.fetchImpl(`${this.cfg.baseUrl}/${scope}/token/`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Ocp-Apim-Subscription-Key': this.cfg.subscriptionKey,
      },
    });
    if (!res.ok) throw new Error(`MTN token failed: ${res.status}`);
    const body = await res.json() as { access_token: string; expires_in: number };
    this.tokenCache.set(scope, {
      token: body.access_token,
      expiresAt: Date.now() + body.expires_in * 1000,
    });
    return body.access_token;
  }
}

async function safeText(res: Response): Promise<string> {
  try { return await res.text(); } catch { return ''; }
}
