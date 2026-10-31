/** Shared HTTP helpers for every iVogue function. */
const CORS = {
  'Access-Control-Allow-Origin': process.env.SITE_URL || '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(statusCode, body, extraHeaders) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...CORS, ...(extraHeaders || {}) },
    body: JSON.stringify(body),
  };
}

const ok = (body, headers) => json(200, body, headers);
const bad = (message) => json(400, { error: message });
const notFound = (message) => json(404, { error: message || 'Not found' });
const unavailable = (message) => json(503, { error: message });
const serverError = (message) => json(500, { error: message || 'Something went wrong on our side.' });

function preflight() {
  return { statusCode: 204, headers: CORS, body: '' };
}

/** Parse a JSON body with a hard size limit. */
function parseBody(event, maxBytes) {
  if (!event.body) return { error: 'Empty request.' };
  if (event.body.length > (maxBytes || 30000)) return { error: 'That request is too large.' };
  try { return { data: JSON.parse(event.body) }; }
  catch { return { error: 'Malformed request.' }; }
}

/** Crude per-IP throttle. Netlify keeps a warm container for a while, which is
 *  long enough to blunt a burst of scripted submissions. */
const hits = new Map();
function throttled(event, limit, windowMs) {
  const headers = event.headers || {};
  const ip = headers['x-nf-client-connection-ip'] || headers['client-ip'] || 'unknown';
  const key = `${ip}|${event.path || event.rawUrl || 'fn'}`;   // one bucket per endpoint
  const now = Date.now();
  const win = windowMs || 60000;
  const list = (hits.get(key) || []).filter((t) => now - t < win);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 500) hits.clear();
  return list.length > (limit || 10);
}

module.exports = { CORS, json, ok, bad, notFound, unavailable, serverError, preflight, parseBody, throttled };
