#!/usr/bin/env node
/**
 * iVogue Lusaka — test suite.   npm test
 *
 * Covers the things that cost money when they break: catalogue integrity,
 * the pricing engine (including basket tampering), Zambian phone/NRC/TPIN
 * rules, and every function endpoint's guard rails.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const P = require(path.join(root, 'assets/pricing.js'));
const ZM = require(path.join(root, 'assets/zm.js'));
const catalog = require(path.join(root, 'data/catalog.json'));
const shop = require(path.join(root, 'data/shop.json'));

let passed = 0, failed = 0;
const results = [];
async function test(name, fn) {
  try { await fn(); passed++; results.push(`  ✓ ${name}`); }
  catch (err) { failed++; results.push(`  ✗ ${name}\n      ${err.message.split('\n')[0]}`); }
}
function group(name) { results.push(`\n${name}`); }

let caller = 0;
/* Each call gets its own client IP and path so one test's rate limit never
   leaks into the next — in production each function is its own bundle. */
const call = (handler, event) => handler({
  path: `/api/test-${++caller}`,
  headers: { 'x-nf-client-connection-ip': `10.0.0.${caller % 250}` },
  queryStringParameters: {},
  ...event,
});

(async function run() {

group('Catalogue integrity');

await test('every product has an id, name, options and colours', () => {
  const ids = new Set();
  for (const p of catalog.products) {
    assert.ok(p.id && !ids.has(p.id), `duplicate or missing id: ${p.id}`);
    ids.add(p.id);
    assert.ok(p.name && p.category && p.condition, `${p.id} missing basics`);
    assert.ok(p.options.length > 0 && p.colors.length > 0, `${p.id} has no options or colours`);
    assert.ok(catalog.categories.some((c) => c.id === p.category), `${p.id} has an unknown category`);
  }
});

await test('prices are positive whole ngwee and compareAt is always higher', () => {
  for (const p of catalog.products) {
    const optionIds = new Set();
    for (const o of p.options) {
      assert.ok(Number.isInteger(o.price) && o.price > 0, `${p.id}/${o.id} price must be a positive integer`);
      assert.ok(!optionIds.has(o.id), `${p.id} repeats option ${o.id}`);
      optionIds.add(o.id);
      assert.ok(Number.isInteger(o.stock) && o.stock >= 0, `${p.id}/${o.id} stock must be >= 0`);
      if (o.compareAt != null) assert.ok(o.compareAt > o.price, `${p.id}/${o.id} compareAt must beat the price`);
    }
  }
});

await test('every product/colour pair has artwork on disk', () => {
  for (const p of catalog.products) {
    for (const c of p.colors) {
      const file = path.join(root, 'assets', 'devices', `${p.id}--${c.id}.svg`);
      assert.ok(fs.existsSync(file), `missing art: ${p.id}--${c.id}.svg`);
      assert.match(c.hex, /^#[0-9a-f]{6}$/i, `${p.id}/${c.id} needs a 6-digit hex colour`);
    }
  }
});

await test('a "Save K…" badge matches the real saving', () => {
  for (const p of catalog.products) {
    for (const badge of p.badges || []) {
      const m = /^Save K([\d,]+)$/.exec(badge);
      if (!m) continue;
      const claimed = Number(m[1].replace(/,/g, '')) * 100;
      const cheapest = p.options.reduce((a, b) => (a.price <= b.price ? a : b));
      assert.ok(cheapest.compareAt, `${p.id} claims a saving with no compareAt`);
      assert.equal(cheapest.compareAt - cheapest.price, claimed, `${p.id} badge says ${badge}`);
    }
  }
});

await test('collections only point at products that exist', () => {
  for (const col of catalog.collections) {
    for (const id of col.productIds) {
      assert.ok(catalog.products.some((p) => p.id === id), `collection ${col.id} references missing ${id}`);
    }
  }
});

await test('delivery zones include a free collection option', () => {
  const collect = catalog.deliveryZones.find((z) => z.id === 'collect');
  assert.ok(collect && collect.fee === 0, 'there must be a free in-store collection zone');
  for (const z of catalog.deliveryZones) assert.ok(Number.isInteger(z.fee) && z.fee >= 0, `${z.id} fee`);
});

group('Pricing engine');

const basket = (over) => ({ items: [{ productId: 'iphone-17', optionId: '256', colorId: 'lavender', qty: 1 }], zoneId: 'collect', ...over });

await test('a single phone prices at its catalogue price', () => {
  const r = P.priceCart(catalog, basket());
  assert.equal(r.subtotal, 2190000);
  assert.equal(r.delivery, 0);
  assert.equal(r.total, 2190000);
});

await test('delivery fee is added from the chosen zone', () => {
  const r = P.priceCart(catalog, basket({ zoneId: 'lsk-outer' }));
  assert.equal(r.delivery, 12000);
  assert.equal(r.total, 2190000 + 12000);
});

await test('a price sent by the browser is ignored', () => {
  const r = P.priceCart(catalog, {
    items: [{ productId: 'iphone-17', optionId: '256', colorId: 'lavender', qty: 1, price: 1, unit: 1, lineTotal: 1 }],
    zoneId: 'collect',
  });
  assert.equal(r.total, 2190000, 'server pricing must ignore client-supplied money');
});

await test('quantity is clamped to stock and to the per-order limit', () => {
  const r = P.priceCart(catalog, { items: [{ productId: 'iphone-air', optionId: '512', colorId: 'sky-blue', qty: 99 }], zoneId: 'collect' });
  assert.equal(r.lines[0].qty, 1, 'only one 512GB Air is in stock');
  const r2 = P.priceCart(catalog, { items: [{ productId: 'braided-cable', optionId: '2m', colorId: 'ink', qty: 99 }], zoneId: 'collect' });
  assert.equal(r2.lines[0].qty, P.MAX_QTY);
});

await test('unknown products, options and colours are dropped', () => {
  const r = P.priceCart(catalog, { items: [
    { productId: 'nokia-3310', optionId: '256', colorId: 'blue', qty: 1 },
    { productId: 'iphone-17', optionId: '2tb', colorId: 'lavender', qty: 1 },
    { productId: 'iphone-17', optionId: '256', colorId: 'neon', qty: 1 },
  ], zoneId: 'collect' });
  assert.equal(r.lines.length, 0);
  assert.equal(r.errors.length, 3);
});

await test('duplicate lines are merged instead of stacking', () => {
  const r = P.priceCart(catalog, { items: [
    { productId: 'iphone-17', optionId: '256', colorId: 'lavender', qty: 1 },
    { productId: 'iphone-17', optionId: '256', colorId: 'lavender', qty: 2 },
  ], zoneId: 'collect' });
  assert.equal(r.lines.length, 1);
  assert.equal(r.lines[0].qty, 3);
  assert.equal(r.subtotal, 2190000 * 3);
});

await test('LUSAKA10 discounts accessories only', () => {
  const r = P.priceCart(catalog, { items: [
    { productId: 'iphone-17', optionId: '256', colorId: 'lavender', qty: 1 },
    { productId: 'magsafe-case', optionId: '17', colorId: 'lilac', qty: 2 },
  ], zoneId: 'collect', promoCode: 'LUSAKA10', now: '2026-10-31' });
  assert.equal(r.discount, Math.round(45000 * 2 * 0.1));
  assert.equal(r.promo.code, 'LUSAKA10');
});

await test('FREEDROP clears the delivery fee above its threshold', () => {
  const r = P.priceCart(catalog, basket({ zoneId: 'lsk-central', promoCode: 'FREEDROP', now: '2026-10-31' }));
  assert.equal(r.delivery, 0);
  const small = P.priceCart(catalog, {
    items: [{ productId: 'braided-cable', optionId: '1m', colorId: 'ink', qty: 1 }],
    zoneId: 'lsk-central', promoCode: 'FREEDROP', now: '2026-10-31',
  });
  assert.equal(small.delivery, 8000, 'below the threshold the fee stands');
  assert.ok(small.promoError);
});

await test('an unknown or expired code is refused, not silently applied', () => {
  const bad = P.priceCart(catalog, basket({ promoCode: 'FREESTUFF' }));
  assert.equal(bad.discount, 0);
  assert.ok(bad.promoError);
  const expired = P.priceCart(catalog, basket({ promoCode: 'LUSAKA10', now: '2027-06-01' }));
  assert.ok(expired.promoError, 'a code past its expiry must fail');
});

await test('a discount can never exceed the subtotal', () => {
  const r = P.priceCart(catalog, {
    items: [{ productId: 'iphone-13', optionId: '128', colorId: 'pink', qty: 1 }],
    zoneId: 'collect', promoCode: 'STUDENT5', now: '2026-10-31',
  });
  assert.ok(r.discount <= r.subtotal && r.total >= 0);
});

await test('kwacha formatting matches how Zambians read prices', () => {
  assert.equal(P.formatZMW(2190000), 'K21,900');
  assert.equal(P.formatZMW(45000), 'K450');
  assert.equal(P.formatZMW(45050), 'K450.50');
  assert.equal(P.formatZMW(0), 'K0');
});

group('Trade-in valuation');

await test('grade multiplies and storage adds', () => {
  const a = P.valueTradeIn(catalog, { modelId: 'iphone-15', gradeId: 'a', storageId: '256' });
  assert.equal(a.value, Math.round((720000 + 40000) * 1));
  const b = P.valueTradeIn(catalog, { modelId: 'iphone-15', gradeId: 'b', storageId: '256' });
  assert.ok(b.value < a.value, 'a lower grade must pay less');
});

await test('an iCloud lock wipes out the value rather than going negative', () => {
  const r = P.valueTradeIn(catalog, { modelId: 'iphone-11', gradeId: 'd', storageId: '64', deductions: ['icloud'] });
  assert.equal(r.value, 0);
});

await test('an unknown model returns nothing at all', () => {
  assert.equal(P.valueTradeIn(catalog, { modelId: 'tecno-spark', gradeId: 'a' }), null);
});

group('Zambian input rules');

await test('every way a Zambian number gets typed normalises the same', () => {
  const forms = ['0977669883', '+260977669883', '260977669883', '977669883', '0977 669 883', '097-766-9883', '00260977669883'];
  for (const f of forms) assert.equal(ZM.normalizeMsisdn(f), '260977669883', `failed on ${f}`);
});

await test('non-Zambian and non-mobile numbers are rejected', () => {
  for (const f of ['0211123456', '0912345456', '+27821234567', '12345', '', null, 'abc']) {
    assert.equal(ZM.normalizeMsisdn(f), null, `should reject ${f}`);
  }
});

await test('wallets are detected from the prefix', () => {
  assert.equal(ZM.detectOperator('0977669883').id, 'airtel');
  assert.equal(ZM.detectOperator('0966123456').id, 'mtn');
  assert.equal(ZM.detectOperator('0955123456').id, 'zamtel');
  assert.equal(ZM.detectOperator('0761234567').id, 'mtn');
});

await test('NRC and TPIN formats are enforced', () => {
  assert.equal(ZM.normalizeNrc('123456/78/1'), '123456/78/1');
  assert.equal(ZM.normalizeNrc('123456781'), '123456/78/1');
  assert.equal(ZM.normalizeNrc('12345'), null);
  assert.equal(ZM.normalizeTpin('1000000000'), '1000000000');
  assert.equal(ZM.normalizeTpin('100'), null);
});

await test('control characters are stripped before anything is stored', () => {
  assert.equal(ZM.cleanLine('Chanda\u0000 \nMwanza', 80), 'Chanda Mwanza');
  assert.equal(ZM.cleanLine('x'.repeat(500), 10).length, 10);
});

await test('order references are unique and readable over the phone', () => {
  const seen = new Set();
  for (let i = 0; i < 500; i++) {
    const ref = ZM.orderReference();
    assert.match(ref, /^IVG-\d{6}-[A-HJ-NP-Z2-9]{4}$/);
    seen.add(ref);
  }
  assert.ok(seen.size > 480, 'references collide too often');
});

group('API endpoints');

const catalogFn = require(path.join(root, 'netlify/functions/catalog.js'));
const orderFn = require(path.join(root, 'netlify/functions/create-order.js'));
const statusFn = require(path.join(root, 'netlify/functions/order-status.js'));
const webhookFn = require(path.join(root, 'netlify/functions/lenco-webhook.js'));
const tradeFn = require(path.join(root, 'netlify/functions/trade-in.js'));

await test('GET /api/catalog returns the shelf', async () => {
  const res = await call(catalogFn.handler, { httpMethod: 'GET' });
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.products.length, catalog.products.length);
  assert.match(res.headers['Cache-Control'], /max-age/);
});

await test('the wrong HTTP verb is refused everywhere', async () => {
  for (const fn of [catalogFn, orderFn, statusFn, webhookFn, tradeFn]) {
    const res = await call(fn.handler, { httpMethod: 'PUT' });
    assert.equal(res.statusCode, 405);
  }
});

await test('CORS preflight is answered', async () => {
  const res = await call(orderFn.handler, { httpMethod: 'OPTIONS' });
  assert.equal(res.statusCode, 204);
});

await test('create-order rejects a bad phone number', async () => {
  const res = await call(orderFn.handler, {
    httpMethod: 'POST',
    body: JSON.stringify({ customer: { name: 'Chanda Mwanza', phone: '12345' }, items: [], zoneId: 'collect', payment: { method: 'cash' } }),
  });
  assert.equal(res.statusCode, 400);
  assert.match(JSON.parse(res.body).error, /Zambian/);
});

await test('create-order rejects an empty basket', async () => {
  const res = await call(orderFn.handler, {
    httpMethod: 'POST',
    body: JSON.stringify({ customer: { name: 'Chanda Mwanza', phone: '0977669883' }, items: [], zoneId: 'collect', payment: { method: 'cash' } }),
  });
  assert.equal(res.statusCode, 400);
  assert.match(JSON.parse(res.body).error, /empty|sold out/i);
});

await test('create-order refuses pay-on-collection for a delivery', async () => {
  const res = await call(orderFn.handler, {
    httpMethod: 'POST',
    body: JSON.stringify({
      customer: { name: 'Chanda Mwanza', phone: '0977669883', address: 'Plot 24, Leopards Hill Road' },
      items: [{ productId: 'iphone-17', optionId: '256', colorId: 'lavender', qty: 1 }],
      zoneId: 'lsk-central', payment: { method: 'cash' },
    }),
  });
  assert.equal(res.statusCode, 400);
  assert.match(JSON.parse(res.body).error, /collect/i);
});

await test('create-order demands an address for a delivery', async () => {
  const res = await call(orderFn.handler, {
    httpMethod: 'POST',
    body: JSON.stringify({
      customer: { name: 'Chanda Mwanza', phone: '0977669883' },
      items: [{ productId: 'iphone-17', optionId: '256', colorId: 'lavender', qty: 1 }],
      zoneId: 'lsk-central', payment: { method: 'momo', momoNumber: '0977669883' },
    }),
  });
  assert.equal(res.statusCode, 400);
  assert.match(JSON.parse(res.body).error, /address/i);
});

await test('create-order says so plainly when no database is configured', async () => {
  const res = await call(orderFn.handler, {
    httpMethod: 'POST',
    body: JSON.stringify({
      customer: { name: 'Chanda Mwanza', phone: '0977669883' },
      items: [{ productId: 'iphone-17', optionId: '256', colorId: 'lavender', qty: 1 }],
      zoneId: 'collect', payment: { method: 'cash' },
    }),
  });
  assert.equal(res.statusCode, 503, 'without SUPABASE_* the shop must fail loudly, not pretend');
  assert.match(JSON.parse(res.body).error, /WhatsApp/);
});

await test('create-order refuses an oversized body', async () => {
  const res = await call(orderFn.handler, { httpMethod: 'POST', body: 'x'.repeat(40000) });
  assert.equal(res.statusCode, 400);
});

await test('order-status demands a well-formed reference and number', async () => {
  const bad1 = await call(statusFn.handler, { httpMethod: 'GET', queryStringParameters: { ref: 'nope', phone: '0977669883' } });
  assert.equal(bad1.statusCode, 400);
  const bad2 = await call(statusFn.handler, { httpMethod: 'GET', queryStringParameters: { ref: 'IVG-261031-AB7K', phone: '123' } });
  assert.equal(bad2.statusCode, 400);
});

await test('the webhook refuses anything it cannot verify', async () => {
  const res = await call(webhookFn.handler, { httpMethod: 'POST', body: JSON.stringify({ event: 'collection.successful' }) });
  assert.equal(res.statusCode, 401, 'an unsigned webhook must never be trusted');
});

await test('the webhook verifies a correct signature and rejects a tampered body', async () => {
  const crypto = require('node:crypto');
  process.env.LENCO_WEBHOOK_SECRET = 'test-secret';
  const lenco = require(path.join(root, 'netlify/functions/lib/lenco.js'));
  const body = JSON.stringify({ event: 'collection.successful', data: { reference: 'IVG-261031-AB7K', amount: 21900 } });
  const sig = crypto.createHmac('sha256', 'test-secret').update(body).digest('hex');
  assert.equal(lenco.verifySignature(body, sig).ok, true);
  assert.equal(lenco.verifySignature(body, 'sha256=' + sig).ok, true);
  assert.equal(lenco.verifySignature(body + ' ', sig).ok, false);
  assert.equal(lenco.verifySignature(body, sig.replace(/.$/, '0')).ok, false);
  delete process.env.LENCO_WEBHOOK_SECRET;
});

await test('trade-in values a phone and returns a held quote', async () => {
  const res = await call(tradeFn.handler, {
    httpMethod: 'POST',
    body: JSON.stringify({ name: 'Chanda Mwanza', phone: '0977669883', modelId: 'iphone-13', gradeId: 'b', storageId: '128' }),
  });
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.match(body.quoteRef, /^TQ-\d{6}-[A-Z0-9]{4}$/);
  assert.equal(body.value, P.valueTradeIn(catalog, { modelId: 'iphone-13', gradeId: 'b', storageId: '128' }).value);
});

await test('a burst of order attempts from one address is throttled', async () => {
  const flood = { httpMethod: 'POST', path: '/api/create-order', headers: { 'x-nf-client-connection-ip': '41.60.1.1' },
    body: JSON.stringify({ customer: { name: 'Flood Bot', phone: '0977669883' }, items: [], zoneId: 'collect', payment: { method: 'cash' } }) };
  let got429 = false;
  for (let i = 0; i < 12; i++) {
    const res = await orderFn.handler({ queryStringParameters: {}, ...flood });
    if (res.statusCode === 429) { got429 = true; break; }
  }
  assert.ok(got429, 'repeated submissions from one IP must start being refused');
});

await test('trade-in refuses junk input', async () => {
  const res = await call(tradeFn.handler, { httpMethod: 'POST', body: JSON.stringify({ name: 'x', phone: '0977669883' }) });
  assert.equal(res.statusCode, 400);
});

group('Site wiring');

await test('every page loads the shell scripts in the right order', () => {
  for (const file of fs.readdirSync(root).filter((f) => f.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    assert.ok(html.includes('assets/config.js'), `${file} is missing config.js`);
    assert.ok(html.includes('assets/app.js'), `${file} is missing app.js`);
    assert.ok(html.indexOf('assets/config.js') < html.indexOf('assets/app.js'), `${file} loads app.js before config.js`);
    assert.ok(html.includes('id="nav-root"') && html.includes('id="footer-root"'), `${file} has no nav or footer mount`);
    assert.ok(html.includes('<meta name="viewport"'), `${file} is not mobile-ready`);
  }
});

await test('generated config matches data/shop.json', () => {
  const generated = fs.readFileSync(path.join(root, 'assets/config.js'), 'utf8');
  const parsed = JSON.parse(generated.slice(generated.indexOf('{'), generated.lastIndexOf('}') + 1));
  assert.deepEqual(parsed, shop, 'run npm run build:config after editing data/shop.json');
});

await test('no live secret is committed in the config or the catalogue', () => {
  const generated = fs.readFileSync(path.join(root, 'assets/config.js'), 'utf8');
  assert.ok(!/pub-[0-9a-f]{20,}/.test(generated), 'a real Lenco public key is in the committed config');
  assert.ok(!/service_role|eyJ[A-Za-z0-9_-]{20,}/.test(generated), 'a key that must stay server-side is in a browser file');
});

  console.log(results.join('\n'));
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
})();
