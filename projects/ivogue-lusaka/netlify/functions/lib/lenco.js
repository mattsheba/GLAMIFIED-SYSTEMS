/**
 * Lenco payments — mobile money collections and card checkout for Zambia.
 * Docs: https://docs.lenco.co
 *
 * Lenco has shipped more than one response shape over the years, so every
 * read here is defensive: we look for the field under each name it has used
 * rather than assuming one.
 */
const crypto = require('crypto');

const API = (process.env.LENCO_API_URL || 'https://api.lenco.co/access/v2').replace(/\/$/, '');

function configured() { return Boolean(process.env.LENCO_SECRET_KEY); }

async function call(path, options) {
  const res = await fetch(`${API}${path}`, {
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LENCO_SECRET_KEY}`,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let payload = null;
  try { payload = await res.json(); } catch { payload = null; }
  return { ok: res.ok && payload?.status !== false, status: res.status, payload };
}

/**
 * Push a mobile money prompt to the customer's handset.
 * @returns {{ok:boolean, gatewayReference?:string, message?:string, raw:any}}
 */
async function collectMobileMoney({ reference, amountNgwee, operator, msisdn, name, email, narration }) {
  const { ok, payload } = await call('/collections/mobile-money', {
    body: {
      reference,
      amount: amountNgwee / 100,          // Lenco collections take kwacha
      currency: 'ZMW',
      operator,                           // airtel | mtn | zamtel
      phone: `+${msisdn}`,
      country: 'zm',
      bearer: 'merchant',
      narration: (narration || 'iVogue Lusaka order').slice(0, 60),
      customer: { name, email: email || undefined, phone: `+${msisdn}` },
    },
  });

  const data = payload?.data || payload || {};
  return {
    ok,
    gatewayReference: data.id || data.reference || data.transactionReference || null,
    status: (data.status || '').toLowerCase() || null,
    message: payload?.message || null,
    raw: payload,
  };
}

/**
 * Create a hosted checkout link for a card payment.
 * @returns {{ok:boolean, paymentUrl?:string, gatewayReference?:string, raw:any}}
 */
async function createCardCheckout({ reference, amountNgwee, name, email, phone, callbackUrl }) {
  const { ok, payload } = await call('/transactions/initialize', {
    body: {
      reference,
      amount: amountNgwee,                // minor units for the hosted page
      currency: 'ZMW',
      customer: { name, email: email || undefined, phone: phone ? `+${phone}` : undefined },
      channels: ['card'],
      callback_url: callbackUrl,
      narration: 'iVogue Lusaka order',
    },
  });

  const data = payload?.data || payload || {};
  return {
    ok,
    paymentUrl: data.authorization_url || data.paymentUrl || data.url || data.link || null,
    gatewayReference: data.id || data.reference || null,
    raw: payload,
  };
}

/** Constant-time webhook signature check. */
function verifySignature(rawBody, signatureHeader) {
  const secret = process.env.LENCO_WEBHOOK_SECRET;
  if (!secret) return { ok: false, reason: 'no-secret' };
  if (!signatureHeader) return { ok: false, reason: 'no-signature' };

  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const given = String(signatureHeader).replace(/^sha256=/i, '').trim();
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(given, 'utf8');
  if (a.length !== b.length) return { ok: false, reason: 'length' };
  return { ok: crypto.timingSafeEqual(a, b), reason: 'compared' };
}

module.exports = { configured, collectMobileMoney, createCardCheckout, verifySignature };
