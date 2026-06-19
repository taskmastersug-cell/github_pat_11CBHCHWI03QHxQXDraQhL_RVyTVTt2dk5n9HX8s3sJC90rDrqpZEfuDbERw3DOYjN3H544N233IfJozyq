import type { Provider } from '@roundpay/shared';
import type { ProviderAdapter } from './Provider.js';
import { ProviderConfigError } from './Provider.js';
import { MockProvider } from './mockProvider.js';
import { MtnMomoProvider } from './mtnMomo/MtnMomoProvider.js';
import { AirtelMoneyProvider } from './airtelMoney/AirtelMoneyProvider.js';
import { dryRunFetch } from './dryRunFetch.js';

// Registry resolves a Provider enum to a concrete adapter. Behavior:
// - ROUNDPAY_USE_MOCK_PROVIDERS=1 → MockProvider (in-process simulator)
// - ROUNDPAY_DRY_RUN_PROVIDERS=1 → real adapter classes with dryRunFetch
//   injected, so URL construction / signature math / response parsing all
//   exercise the real code paths without making a network call.
// - Otherwise → real adapters with real fetch (requires sandbox credentials).

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
  if (process.env.ROUNDPAY_USE_MOCK_PROVIDERS === '1') {
    const secret = process.env.MOCK_PROVIDER_WEBHOOK_SECRET ?? 'dev-secret';
    return new MockProvider(name, secret);
  }
  const dryRun = process.env.ROUNDPAY_DRY_RUN_PROVIDERS === '1';
  const env = dryRun ? envOrPlaceholder : requireEnv;
  const fetchImpl = dryRun ? dryRunFetch : fetch;

  if (name === 'mtnMomo') {
    return new MtnMomoProvider(
      {
        baseUrl: env('MTN_MOMO_BASE_URL', 'https://sandbox.momodeveloper.mtn.com'),
        subscriptionKey: env('MTN_MOMO_SUBSCRIPTION_KEY', 'dry-run-subscription-key'),
        apiUserId: env('MTN_MOMO_API_USER_ID', '00000000-0000-0000-0000-000000000000'),
        apiKey: env('MTN_MOMO_API_KEY', 'dry-run-api-key'),
        callbackUrl: env('MTN_MOMO_CALLBACK_URL', 'https://dry-run.example/webhook'),
        webhookSecret: env('MTN_MOMO_WEBHOOK_SECRET', 'dry-run-webhook-secret'),
        targetEnvironment: (process.env.MTN_MOMO_ENV ?? 'sandbox') as 'sandbox' | 'production',
      },
      fetchImpl,
    );
  }
  return new AirtelMoneyProvider(
    {
      baseUrl: env('AIRTEL_MONEY_BASE_URL', 'https://openapiuat.airtel.africa'),
      clientId: env('AIRTEL_MONEY_CLIENT_ID', 'dry-run-client-id'),
      clientSecret: env('AIRTEL_MONEY_CLIENT_SECRET', 'dry-run-client-secret'),
      country: process.env.AIRTEL_MONEY_COUNTRY ?? 'UG',
      currency: process.env.AIRTEL_MONEY_CURRENCY ?? 'UGX',
      webhookSecret: env('AIRTEL_MONEY_WEBHOOK_SECRET', 'dry-run-webhook-secret'),
    },
    fetchImpl,
  );
}

type EnvResolver = (name: string, placeholder: string) => string;

const requireEnv: EnvResolver = (name) => {
  const v = process.env[name];
  if (!v) throw new ProviderConfigError(`Missing required env: ${name}`);
  return v;
};

const envOrPlaceholder: EnvResolver = (name, placeholder) =>
  process.env[name] ?? placeholder;
