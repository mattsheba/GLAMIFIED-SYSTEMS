/**
 * POST /api/lenco-webhook
 *
 * Lenco calls this when a collection succeeds or fails. It is the only
 * place an order becomes "paid" — the browser is never trusted for that.
 *
 * Guards: HMAC signature, replay-safe (an order already paid is skipped),
 * and the amount is checked against what we charged before anything moves.
 */
const { json, ok, preflight } = require('./lib/respond');
const { db } = require('./lib/db');
const { invalidate } = require('./lib/catalog');
const lenco = require('./lib/lenco');
const mail = require('./lib/mail');

const SUCCESS = ['success', 'successful', 'completed', 'complete', 'paid', 'settled'];
const FAILURE = ['failed', 'failure', 'declined', 'cancelled', 'canceled', 'reversed', 'expired'];

function pick(obj, names) {
  for (const n of names) {
    const v = n.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const signature = event.headers['x-lenco-signature'] || event.headers['x-webhook-signature'] || event.headers['x-signature'];
  const check = lenco.verifySignature(event.body || '', signature);
  if (!check.ok) {
    console.warn('[ivogue] webhook rejected:', check.reason);
    return json(401, { error: 'Invalid signature' });
  }

  let payload;
  try { payload = JSON.parse(event.body); } catch { return json(400, { error: 'Invalid JSON' }); }

  const data = payload.data || payload.transaction || payload;
  const eventName = String(payload.event || payload.type || '').toLowerCase();
  const statusRaw = String(pick(data, ['status', 'transactionStatus']) || eventName).toLowerCase();

  /* Our own reference is what we sent to Lenco at collection time. */
  const reference = String(pick(data, ['reference', 'merchantReference', 'transactionReference', 'metadata.reference']) || '').toUpperCase();
  if (!/^IVG-\d{6}-[A-Z0-9]{4}$/.test(reference)) {
    console.log('[ivogue] webhook for a reference that is not ours:', reference || '(none)');
    return ok({ received: true });
  }

  const supabase = db();
  if (!supabase) { console.error('[ivogue] webhook with no database configured'); return ok({ received: true }); }

  const { data: order, error } = await supabase
    .from('shop_orders').select('*').eq('reference', reference).maybeSingle();

  if (error) { console.error('[ivogue] webhook lookup failed:', error.message); return json(500, { error: 'lookup failed' }); }
  if (!order) { console.warn('[ivogue] webhook for unknown order:', reference); return ok({ received: true }); }

  /* Replay protection — a repeated success notice must not re-run stock or email. */
  if (['paid', 'preparing', 'dispatched', 'completed'].includes(order.status)) {
    return ok({ received: true, note: 'already settled' });
  }

  const isSuccess = SUCCESS.some((s) => statusRaw.includes(s)) || SUCCESS.some((s) => eventName.includes(s));
  const isFailure = FAILURE.some((s) => statusRaw.includes(s)) || FAILURE.some((s) => eventName.includes(s));

  if (isFailure && !isSuccess) {
    await supabase.from('shop_orders')
      .update({ status: 'failed', payment_raw: payload }).eq('reference', reference);
    console.log('[ivogue] payment failed for', reference, statusRaw);
    return ok({ received: true, status: 'failed' });
  }

  if (!isSuccess) {
    await supabase.from('shop_orders').update({ payment_raw: payload }).eq('reference', reference);
    return ok({ received: true, note: 'no state change' });
  }

  /* Amount check — Lenco has used both kwacha and minor units, so accept
     either reading of the number, but nothing else. */
  const rawAmount = Number(pick(data, ['amount', 'transactionAmount', 'amountPaid']) || 0);
  const asNgwee = Math.round(rawAmount * 100);
  const matches = Math.abs(rawAmount - order.total) <= 100 || Math.abs(asNgwee - order.total) <= 100;
  if (!matches) {
    console.error(`[ivogue] AMOUNT MISMATCH on ${reference}: charged ${order.total} ngwee, webhook says ${rawAmount}`);
    await supabase.from('shop_orders')
      .update({ status: 'pending', payment_raw: payload, notes: `${order.notes || ''} [amount mismatch: ${rawAmount}]`.trim() })
      .eq('reference', reference);
    try {
      await mail.send(process.env.ADMIN_EMAIL, `[iVogue] AMOUNT MISMATCH ${reference}`,
        mail.layout('Amount mismatch', `<p style="font-size:14px">Order ${reference} expects ${mail.money(order.total)} but the gateway reported ${rawAmount}. Check it before releasing stock.</p>`));
    } catch {}
    return ok({ received: true, note: 'amount mismatch' });
  }

  const paidAt = new Date().toISOString();
  const { error: updateError } = await supabase.from('shop_orders').update({
    status: 'paid',
    paid_at: paidAt,
    payment_reference: pick(data, ['id', 'transactionReference', 'reference']) || order.payment_reference,
    payment_raw: payload,
  }).eq('reference', reference);

  if (updateError) { console.error('[ivogue] mark-paid failed:', updateError.message); return json(500, { error: 'update failed' }); }

  /* Take the stock down. Untracked SKUs simply return -1 and are skipped. */
  for (const item of order.items || []) {
    try {
      await supabase.rpc('shop_decrement_stock', {
        p_sku: `${item.productId}::${item.optionId}`,
        p_qty: item.qty,
      });
    } catch (err) {
      console.error('[ivogue] stock decrement failed for', item.productId, err.message);
    }
  }
  invalidate();

  try { await mail.sendPaymentConfirmed({ ...order, status: 'paid', paid_at: paidAt }); }
  catch (err) { console.error('[ivogue] receipt mail failed:', err.message); }

  console.log('[ivogue] paid:', reference, order.total);
  return ok({ received: true, status: 'paid' });
};
