/**
 * POST /api/create-order
 *
 * Takes a basket, prices it again on the server from data/catalog.json
 * (so a tampered browser cannot change the price), stores the order, and
 * starts the payment: a mobile money prompt, a hosted card page, or a
 * 24-hour hold for collection.
 */
const P  = require('../../assets/pricing.js');
const ZM = require('../../assets/zm.js');
const shop = require('../../data/shop.json');
const { ok, bad, preflight, json, serverError, unavailable, parseBody, throttled } = require('./lib/respond');
const { getCatalog } = require('./lib/catalog');
const { db } = require('./lib/db');
const lenco = require('./lib/lenco');
const mail = require('./lib/mail');

const WHATSAPP_FALLBACK = ` You can also send your basket to ${shop.contact.phoneDisplay} on WhatsApp and we will finish the order by hand.`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (throttled(event, 8, 60000)) return json(429, { error: 'Too many attempts. Give it a minute.' });

  const parsed = parseBody(event, 30000);
  if (parsed.error) return bad(parsed.error);
  const body = parsed.data || {};

  /* ── customer ─────────────────────────────────────────── */
  const c = body.customer || {};
  const name = ZM.cleanLine(c.name, 80);
  const phone = ZM.normalizeMsisdn(c.phone);
  const email = c.email && ZM.isEmail(String(c.email).trim()) ? String(c.email).trim().toLowerCase() : null;
  if (name.length < 3) return bad('Please give the name for the order.');
  if (!phone) return bad('That mobile number is not a Zambian number we can call.');
  if (c.email && !email) return bad('That email address does not look right.');

  /* ── basket, priced on the server ─────────────────────── */
  let catalog;
  try { catalog = await getCatalog(); }
  catch (err) { console.error('[ivogue] catalog failed:', err.message); return serverError('We cannot read the shelf right now.' + WHATSAPP_FALLBACK); }

  const priced = P.priceCart(catalog, {
    items: Array.isArray(body.items) ? body.items : [],
    zoneId: body.zoneId,
    promoCode: body.promoCode,
  });

  if (!priced.lines.length) return bad('Your basket is empty or those items have just sold out.');
  if (!priced.zone) return bad('Choose where the order is going.');
  if (priced.total <= 0) return bad('That order total does not look right.');

  const collecting = priced.zone.id === 'collect';
  const address = collecting ? null : ZM.cleanLine(c.address, 160);
  if (!collecting && address.length < 6) return bad('We need a street address to deliver to.');

  /* ── payment choice ───────────────────────────────────── */
  const pay = body.payment || {};
  const method = ['momo', 'card', 'cash'].includes(pay.method) ? pay.method : null;
  if (!method) return bad('Choose how you would like to pay.');
  if (method === 'cash' && !collecting) return bad('Paying on collection only works when you collect in store.');

  let momoNumber = null;
  let operator = null;
  if (method === 'momo') {
    momoNumber = ZM.normalizeMsisdn(pay.momoNumber || c.phone);
    if (!momoNumber) return bad('Give the mobile money number that should get the prompt.');
    const detected = ZM.detectOperator(momoNumber);
    if (!detected) return bad('We could not tell which wallet that number belongs to.');
    operator = detected.id;
  }

  const tpin = c.tpin ? ZM.normalizeTpin(c.tpin) : null;
  if (c.tpin && !tpin) return bad('A TPIN is exactly 10 digits.');

  const reference = ZM.orderReference();

  const record = {
    reference,
    status: 'pending',
    customer_name: name,
    customer_phone: phone,
    customer_email: email,
    address,
    landmark: ZM.cleanLine(c.landmark, 120) || null,
    notes: ZM.cleanLine(c.notes, 400) || null,
    company: ZM.cleanLine(c.company, 120) || null,
    tpin,
    zone_id: priced.zone.id,
    zone_name: priced.zone.name,
    delivery_fee: priced.delivery,
    subtotal: priced.subtotal,
    discount: priced.discount,
    total: priced.total,
    promo_code: priced.promo ? priced.promo.code : null,
    pay_method: method,
    pay_operator: operator,
    pay_number: momoNumber,
    items: priced.lines.map((l) => ({
      productId: l.productId, name: l.name,
      optionId: l.optionId, optionLabel: l.optionLabel,
      colorId: l.colorId, colorName: l.colorName,
      qty: l.qty, unit: l.unit, lineTotal: l.lineTotal, art: l.art,
    })),
  };

  /* ── store it ─────────────────────────────────────────── */
  const supabase = db();
  if (!supabase) {
    console.error('[ivogue] order attempted with no database configured:', reference);
    return unavailable('Online orders are not switched on yet.' + WHATSAPP_FALLBACK);
  }

  const { error: insertError } = await supabase.from('shop_orders').insert(record);
  if (insertError) {
    console.error('[ivogue] order insert failed:', insertError.message);
    return serverError('We could not save that order.' + WHATSAPP_FALLBACK);
  }

  /* ── start the payment ────────────────────────────────── */
  let paymentUrl = null;
  let message = null;

  try {
    if (method === 'momo') {
      if (!lenco.configured()) {
        message = 'Your order is reserved. We will send mobile money details on WhatsApp shortly.';
      } else {
        const result = await lenco.collectMobileMoney({
          reference,
          amountNgwee: priced.total,
          operator,
          msisdn: momoNumber,
          name,
          email,
          narration: `iVogue ${reference}`,
        });
        await supabase.from('shop_orders')
          .update({ payment_reference: result.gatewayReference, payment_raw: result.raw })
          .eq('reference', reference);
        if (!result.ok) {
          console.error('[ivogue] momo collection refused:', result.message);
          message = 'We saved your order but the payment prompt did not go out. Try again from the order page, or finish on WhatsApp.';
        } else {
          message = `Approve the ${ZM.detectOperator(momoNumber).name} prompt on ${ZM.formatMsisdn(momoNumber)}.`;
        }
      }
    } else if (method === 'card') {
      if (!lenco.configured()) {
        message = 'Your order is reserved. We will send a card payment link shortly.';
      } else {
        const site = process.env.SITE_URL || shop.brand.siteUrl;
        const result = await lenco.createCardCheckout({
          reference,
          amountNgwee: priced.total,
          name, email, phone,
          callbackUrl: `${site}/order.html?ref=${encodeURIComponent(reference)}`,
        });
        await supabase.from('shop_orders')
          .update({ payment_reference: result.gatewayReference, payment_raw: result.raw })
          .eq('reference', reference);
        if (result.ok && result.paymentUrl) paymentUrl = result.paymentUrl;
        else message = 'We saved your order but could not open the card page. Try the payment again from the order page.';
      }
    } else {
      message = 'Reserved for collection. We hold it at the counter for 24 hours.';
    }
  } catch (err) {
    console.error('[ivogue] payment start failed:', err.message);
    message = 'Your order is saved, but the payment did not start. Open the order page to try again.';
  }

  /* Emails must never hold up the response. */
  try { await mail.sendOrderPlaced(record); } catch (err) { console.error('[ivogue] order mail failed:', err.message); }

  return ok({ reference, status: 'pending', total: priced.total, paymentUrl, message });
};
