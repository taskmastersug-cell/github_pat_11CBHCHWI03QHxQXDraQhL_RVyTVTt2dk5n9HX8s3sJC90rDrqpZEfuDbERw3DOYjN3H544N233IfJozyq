import type { Provider } from '@roundpay/shared';
import type { ProviderAdapter } from './Provider.js';
import { ProviderConfigError } from './Provider.js';
import { MockProvider } from './mockProvider.js';
import { MtnMomoProvider } from './mtnMomo/MtnMomoProvider.js';
import { AirtelMoneyProvider } from './airtelMoney/AirtelMoneyProvider.js';

// Registry resolves a Provider enum to a concrete adapter. In Phase 2 the
// default behavior in non-prod / test is the MockProvider; production reads
// real adapter config from `firebase functions:secrets`.

let cached: Map<Provider, ProviderAdapter> | null = null;

export function resetRegistry(): void {
  cached = null;
}

export function registerForTest(name: Provider, adapter: ProviderAdapter): void {
  if (!cached) cached = new Map();
  cached.set(name, adapter);
}

export function getProvider(name: Provider): ProviderAdapter {
  if (cached?.has(name)) return cached.get(name)!;
  const fromEnv = buildFromEnv(name);
  if (!cached) cached = new Map();
  cached.set(name, fromEnv);
  return fromEnv;
}

function buildFromEnv(name: Provider): ProviderAdapter {
  const useMock = process.env.ROUNDPAY_USE_MOCK_PROVIDERS === '1';
  if (useMock) {
    const secret = process.env.MOCK_PROVIDER_WEBHOOK_SECRET ?? 'dev-secret';
    return new MockProvider(name, secret);
  }
  if (name === 'mtnMomo') {
    return new MtnMomoProvider({
      baseUrl: requireEnv('MTN_MOMO_BASE_URL'),
      subscriptionKey: requireEnv('MTN_MOMO_SUBSCRIPTION_KEY'),
      apiUserId: requireEnv('MTN_MOMO_API_USER_ID'),
      apiKey: requireEnv('MTN_MOMO_API_KEY'),
      callbackUrl: requireEnv('MTN_MOMO_CALLBACK_URL'),
      webhookSecret: requireEnv('MTN_MOMO_WEBHOOK_SECRET'),
      targetEnvironment: (process.env.MTN_MOMO_ENV ?? 'sandbox') as 'sandbox' | 'production',
    });
  }
  return new AirtelMoneyProvider({
    baseUrl: requireEnv('AIRTEL_MONEY_BASE_URL'),
    clientId: requireEnv('AIRTEL_MONEY_CLIENT_ID'),
    clientSecret: requireEnv('AIRTEL_MONEY_CLIENT_SECRET'),
    country: process.env.AIRTEL_MONEY_COUNTRY ?? 'UG',
    currency: process.env.AIRTEL_MONEY_CURRENCY ?? 'UGX',
    webhookSecret: requireEnv('AIRTEL_MONEY_WEBHOOK_SECRET'),
  });
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new ProviderConfigError(`Missing required env: ${name}`);
  return v;
}
