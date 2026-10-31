/**
 * GET /api/order-status?ref=IVG-261031-AB7K&phone=260977123456
 * Reference plus the number on the order — enough to look up your own order,
 * not enough to walk the table.
 */
const ZM = require('../../assets/zm.js');
const { ok, bad, notFound, preflight, json, serverError, unavailable, throttled } = require('./lib/respond');
const { getCatalog } = require('./lib/catalog');
const { db } = require('./lib/db');

const LABELS = {
  pending: 'Awaiting payment',
  paid: 'Paid',
  preparing: 'Being prepared',
  dispatched: 'On the way',
  completed: 'Delivered',
  failed: 'Payment failed',
  cancelled: 'Cancelled',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  if (throttled(event, 40, 60000)) return json(429, { error: 'Too many lookups. Give it a minute.' });

  const params = event.queryStringParameters || {};
  const reference = String(params.ref || '').trim().toUpperCase();
  const phone = ZM.normalizeMsisdn(params.phone);

  if (!/^IVG-\d{6}-[A-Z0-9]{4}$/.test(reference)) return bad('That is not an order reference.');
  if (!phone) return bad('Give the mobile number on the order.');

  const supabase = db();
  if (!supabase) return unavailable('Order tracking is not switched on yet.');

  try {
    const { data, error } = await supabase
      .from('shop_orders')
      .select('reference, status, customer_name, customer_phone, address, landmark, zone_id, zone_name, delivery_fee, subtotal, discount, total, promo_code, pay_method, pay_operator, pay_number, items, created_at, paid_at')
      .eq('reference', reference)
      .eq('customer_phone', phone)
      .maybeSingle();

    if (error) throw error;
    if (!data) return notFound('No order matches that reference and number.');

    const catalog = await getCatalog();
    const zone = catalog.deliveryZones.find((z) => z.id === data.zone_id) || null;
    const operatorName = (ZM.OPERATORS.find((o) => o.id === data.pay_operator) || {}).name || null;

    return ok({
      reference: data.reference,
      status: data.status,
      statusLabel: LABELS[data.status] || data.status,
      placedAt: data.created_at,
      paidAt: data.paid_at,
      customer: {
        name: data.customer_name,
        phone: data.customer_phone,
        address: data.address,
        landmark: data.landmark,
      },
      zone: zone ? { id: zone.id, name: zone.name, eta: zone.eta } : { id: data.zone_id, name: data.zone_name, eta: '' },
      payment: { method: data.pay_method, operator: data.pay_operator, operatorName, momoNumber: data.pay_number },
      items: data.items,
      subtotal: data.subtotal,
      discount: data.discount,
      delivery: data.delivery_fee,
      total: data.total,
      promoCode: data.promo_code,
    }, { 'Cache-Control': 'no-store' });
  } catch (err) {
    console.error('[ivogue] order lookup failed:', err.message);
    return serverError('We could not read that order just now.');
  }
};
