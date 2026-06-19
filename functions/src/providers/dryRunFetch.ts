// Dry-run fetch: exercises the real MTN MoMo + Airtel Money adapters end-to-end
// (URL construction, header math, body shape, response parsing, signature
// verification) without making any network calls. URL patterns are matched and
// returned canned but realistically-shaped responses.
//
// Use case: prove that our wiring is correct before real sandbox credentials
// arrive. Set ROUNDPAY_DRY_RUN_PROVIDERS=1 (and leave the real env vars empty
// or set to placeholders) and exercise the contribution flow against the
// emulator — every call returns a successful sandbox-shaped response.
//
// Anything that isn't matched returns a 501 so unhandled calls fail loudly.

type FetchFn = typeof fetch;

const json = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

const text = (status: number, body: string): Response =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain' } });

const accepted = (): Response => new Response(null, { status: 202 });

export const dryRunFetch: FetchFn = async (input, init) => {
  const url = typeof input === 'string' ? input : (input as URL | Request).toString();
  const method = (init?.method ?? 'GET').toUpperCase();

  // ----- MTN MoMo OAuth: returns a bearer token -----
  if (/\/(collection|disbursement)\/token\/?$/.test(url) && method === 'POST') {
    return json(200, {
      access_token: 'dry-run-token-' + Math.random().toString(36).slice(2, 10),
      token_type: 'Bearer',
      expires_in: 3600,
    });
  }

  // ----- MTN MoMo Collection requesttopay -----
  if (/\/collection\/v1_0\/requesttopay$/.test(url) && method === 'POST') {
    return accepted();
  }

  // ----- MTN MoMo Disbursement transfer -----
  if (/\/disbursement\/v1_0\/transfer$/.test(url) && method === 'POST') {
    return accepted();
  }

  // ----- MTN MoMo: poll status -----
  if (/\/collection\/v1_0\/requesttopay\/[^/]+$/.test(url) && method === 'GET') {
    return json(200, {
      financialTransactionId: 'dry-run-fin-' + Math.random().toString(36).slice(2, 10),
      externalId: 'dry-run-ext',
      amount: '50000',
      currency: 'UGX',
      payer: { partyIdType: 'MSISDN', partyId: '256700000000' },
      status: 'SUCCESSFUL',
    });
  }

  // ----- Airtel OAuth -----
  if (/\/auth\/oauth2\/token$/.test(url) && method === 'POST') {
    return json(200, {
      access_token: 'dry-run-airtel-' + Math.random().toString(36).slice(2, 10),
      token_type: 'bearer',
      expires_in: 3600,
    });
  }

  // ----- Airtel Collection / Disbursement -----
  if (/\/merchant\/v1\/payments\/?$/.test(url) && method === 'POST') {
    return json(200, {
      data: { transaction: { id: 'dry-run-airtel-tx-' + Math.random().toString(36).slice(2, 10) } },
      status: { code: '200', message: 'SUCCESS', success: true },
    });
  }
  if (/\/standard\/v1\/disbursements\/?$/.test(url) && method === 'POST') {
    return json(200, {
      data: { transaction: { id: 'dry-run-airtel-payout-' + Math.random().toString(36).slice(2, 10) } },
      status: { code: '200', message: 'SUCCESS', success: true },
    });
  }

  // ----- Airtel: poll status -----
  if (/\/standard\/v1\/payments\/[^/]+$/.test(url) && method === 'GET') {
    return json(200, {
      data: {
        transaction: {
          id: 'dry-run-airtel-tx',
          status: 'TS',
          message: 'Transaction Successful',
        },
      },
      status: { code: '200', message: 'SUCCESS', success: true },
    });
  }

  return text(501, `dry-run: unhandled ${method} ${url}`);
};
