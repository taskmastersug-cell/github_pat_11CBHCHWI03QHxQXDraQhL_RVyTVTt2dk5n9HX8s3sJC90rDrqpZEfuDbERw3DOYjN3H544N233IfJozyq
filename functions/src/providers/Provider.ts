// Provider adapter interface — shared shape for MTN MoMo, Airtel Money, and
// the in-memory MockProvider. The engine and Cloud Functions never reference
// a concrete provider; they go through this interface.

import type { Money, CurrencyCode, Provider as ProviderName } from '@roundpay/shared';

export interface DepositRequest {
  readonly idempotencyKey: string;
  readonly msisdn: string;
  readonly amount: Money;
  readonly currency: CurrencyCode;
  readonly reference: string; // e.g. contributionId, surfaced to user as "what is this for"
  readonly note?: string;
}

export interface PayoutRequest {
  readonly idempotencyKey: string;
  readonly msisdn: string;
  readonly amount: Money;
  readonly currency: CurrencyCode;
  readonly reference: string; // e.g. payoutId
  readonly note?: string;
}

export type InitiateResult =
  | { status: 'accepted'; providerRef: string }
  | { status: 'rejected'; code: string; message: string };

export type ProviderTxStatus =
  | { state: 'pending' }
  | { state: 'confirmed'; providerRef: string; settledAt: number }
  | { state: 'failed'; code: string; message: string };

// What we hand back to the orchestrator after a webhook arrives. Side effects
// (DB writes, engine dispatch) happen outside the adapter.
export type WebhookEvent =
  | { kind: 'depositConfirmed'; providerRef: string; idempotencyKey: string; amount: Money; settledAt: number }
  | { kind: 'depositFailed'; providerRef: string; idempotencyKey: string; code: string; message: string }
  | { kind: 'payoutConfirmed'; providerRef: string; idempotencyKey: string; amount: Money; settledAt: number }
  | { kind: 'payoutFailed'; providerRef: string; idempotencyKey: string; code: string; message: string };

export interface ProviderAdapter {
  readonly name: ProviderName;
  initiateDeposit(req: DepositRequest): Promise<InitiateResult>;
  initiatePayout(req: PayoutRequest): Promise<InitiateResult>;
  // Throws if signature verification fails. Returns the normalized event.
  parseWebhook(headers: Record<string, string | undefined>, rawBody: string): WebhookEvent;
  queryTransaction(providerRef: string): Promise<ProviderTxStatus>;
}

export class ProviderSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderSignatureError';
  }
}

export class ProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderConfigError';
  }
}
