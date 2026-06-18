import { onRequest } from 'firebase-functions/v2/https';
import { handleProviderWebhook } from './handleWebhook.js';

// MTN MoMo webhook entrypoint.
export const mtnMomoWebhook = onRequest({ cors: false }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('method_not_allowed'); return; }
  const raw = typeof req.rawBody === 'object' ? req.rawBody.toString('utf8') : String(req.body);
  const headers = Object.fromEntries(
    Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v[0] : v]),
  ) as Record<string, string | undefined>;
  const r = await handleProviderWebhook('mtnMomo', headers, raw);
  res.status(r.status).json(r.body);
});

// Airtel Money webhook entrypoint.
export const airtelMoneyWebhook = onRequest({ cors: false }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('method_not_allowed'); return; }
  const raw = typeof req.rawBody === 'object' ? req.rawBody.toString('utf8') : String(req.body);
  const headers = Object.fromEntries(
    Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v[0] : v]),
  ) as Record<string, string | undefined>;
  const r = await handleProviderWebhook('airtelMoney', headers, raw);
  res.status(r.status).json(r.body);
});
