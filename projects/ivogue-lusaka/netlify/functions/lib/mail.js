/** Transactional email. Silently no-ops when SMTP is not configured yet,
 *  so a missing mail server never costs the shop an order. */
const shop = require('../../../data/shop.json');

function transport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  const nodemailer = require('nodemailer');
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

const money = (n) => 'K' + (n / 100).toLocaleString('en-ZM', { minimumFractionDigits: n % 100 ? 2 : 0, maximumFractionDigits: n % 100 ? 2 : 0 });
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function layout(title, bodyHtml) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#FAF7F2;font-family:Helvetica,Arial,sans-serif;color:#141316">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px">
    <div style="font-family:Georgia,serif;font-size:22px;letter-spacing:-.3px">iVogue <span style="color:#A8563C">Lusaka</span></div>
    <div style="background:#fff;border:1px solid rgba(20,19,22,.08);border-radius:10px;padding:24px;margin-top:16px">
      <h1 style="font-family:Georgia,serif;font-size:21px;margin:0 0 14px">${esc(title)}</h1>
      ${bodyHtml}
    </div>
    <p style="font-size:12px;color:#726D78;margin-top:18px;line-height:1.6">
      ${esc(shop.store.addressLines.join(', '))}<br>
      ${esc(shop.contact.phoneDisplay)} · ${esc(shop.contact.email)}
    </p>
  </div></body></html>`;
}

function itemsTable(order) {
  return `<table style="width:100%;border-collapse:collapse;font-size:14px">
    ${order.items.map((i) => `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #eee">
        <b>${esc(i.name)}</b><br><span style="color:#726D78">${esc(i.optionLabel)} · ${esc(i.colorName)} · ×${i.qty}</span>
      </td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${money(i.lineTotal)}</td>
    </tr>`).join('')}
    <tr><td style="padding:8px 0">Subtotal</td><td style="padding:8px 0;text-align:right">${money(order.subtotal)}</td></tr>
    ${order.discount ? `<tr><td style="padding:4px 0;color:#2E7D4F">Discount ${esc(order.promo_code || '')}</td><td style="padding:4px 0;text-align:right;color:#2E7D4F">−${money(order.discount)}</td></tr>` : ''}
    <tr><td style="padding:4px 0">${esc(order.zone_name)}</td><td style="padding:4px 0;text-align:right">${order.delivery_fee ? money(order.delivery_fee) : 'Free'}</td></tr>
    <tr><td style="padding:10px 0;border-top:2px solid #141316"><b>Total</b></td>
        <td style="padding:10px 0;border-top:2px solid #141316;text-align:right"><b>${money(order.total)}</b></td></tr>
  </table>`;
}

async function send(to, subject, html) {
  const t = transport();
  if (!t || !to) { console.log('[ivogue] mail skipped:', subject, '→', to || 'no recipient'); return false; }
  try {
    await t.sendMail({
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to, subject, html,
    });
    return true;
  } catch (err) {
    console.error('[ivogue] mail failed:', err.message);
    return false;
  }
}

async function sendOrderPlaced(order) {
  const site = process.env.SITE_URL || shop.brand.siteUrl;
  const customerHtml = layout(`Order ${order.reference} received`, `
    <p style="font-size:14px;line-height:1.7">Thank you, ${esc(order.customer_name.split(' ')[0])}. We have your order and
    ${order.pay_method === 'cash'
      ? 'are holding the items at the counter for 24 hours.'
      : order.status === 'paid' ? 'your payment is confirmed.' : 'are waiting for the payment to clear.'}</p>
    ${itemsTable(order)}
    <p style="font-size:14px;margin-top:18px"><a href="${site}/order.html?ref=${encodeURIComponent(order.reference)}"
      style="background:#141316;color:#FAF7F2;padding:11px 20px;border-radius:100px;text-decoration:none;display:inline-block">Track this order</a></p>
    <p style="font-size:13px;color:#726D78;margin-top:16px">Questions? Reply here or WhatsApp ${esc(shop.contact.phoneDisplay)}.</p>`);

  const adminHtml = layout(`New order ${order.reference} — ${money(order.total)}`, `
    <p style="font-size:14px;line-height:1.7">
      <b>${esc(order.customer_name)}</b><br>${esc(order.customer_phone)}${order.customer_email ? ' · ' + esc(order.customer_email) : ''}<br>
      ${esc(order.zone_name)}<br>${esc(order.address || 'Collection')}${order.landmark ? ' — near ' + esc(order.landmark) : ''}<br>
      Payment: ${esc(order.pay_method)}${order.pay_operator ? ' / ' + esc(order.pay_operator) : ''} — status <b>${esc(order.status)}</b>
      ${order.notes ? `<br>Note: ${esc(order.notes)}` : ''}
      ${order.tpin ? `<br>TPIN: ${esc(order.tpin)} (${esc(order.company || '')})` : ''}
    </p>
    ${itemsTable(order)}`);

  await Promise.all([
    send(order.customer_email, `iVogue Lusaka — order ${order.reference}`, customerHtml),
    send(process.env.ADMIN_EMAIL, `[iVogue] New order ${order.reference} — ${money(order.total)}`, adminHtml),
  ]);
}

async function sendPaymentConfirmed(order) {
  const html = layout(`Payment received — ${order.reference}`, `
    <p style="font-size:14px;line-height:1.7">${money(order.total)} received. We are preparing your order now, and
    ${order.zone_id === 'collect' ? 'it will be waiting at the counter at ' + esc(shop.store.addressLines[0]) + '.' : 'the rider will call before arriving.'}</p>
    ${itemsTable(order)}
    <p style="font-size:13px;color:#726D78;margin-top:16px">Keep this email — it carries your order reference for the warranty.</p>`);
  await Promise.all([
    send(order.customer_email, `iVogue Lusaka — payment received for ${order.reference}`, html),
    send(process.env.ADMIN_EMAIL, `[iVogue] PAID ${order.reference} — ${money(order.total)}`, html),
  ]);
}

async function sendTradeInQuote(quote) {
  const html = layout(`Trade-in quote ${quote.quote_ref}`, `
    <p style="font-size:14px;line-height:1.7">
      ${esc(quote.model_name)} · ${esc(quote.grade_name)}<br>
      Estimated value: <b style="font-size:18px">${money(quote.value)}</b><br>
      Held for 7 days. Bring the phone, its Apple ID password and your NRC to ${esc(shop.store.addressLines[0])}.
    </p>
    <p style="font-size:13px;color:#726D78">The final figure is confirmed after a free 10-minute test at the counter.</p>`);
  await Promise.all([
    send(quote.email, `iVogue Lusaka — your trade-in quote ${quote.quote_ref}`, html),
    send(process.env.ADMIN_EMAIL,
      `[iVogue] Trade-in ${quote.quote_ref} — ${esc(quote.model_name)} ${money(quote.value)}`,
      layout('New trade-in lead', `<p style="font-size:14px;line-height:1.7">
        ${esc(quote.name)} · ${esc(quote.phone)}<br>${esc(quote.model_name)} ${esc(quote.storage_id || '')} · ${esc(quote.grade_name)}
        · battery ${esc(quote.battery_health || 'n/a')}<br>Value ${money(quote.value)} · coming in: ${esc(quote.visit_when || 'not said')}
        ${quote.notes ? '<br>Note: ' + esc(quote.notes) : ''}</p>`)),
  ]);
}

module.exports = { send, sendOrderPlaced, sendPaymentConfirmed, sendTradeInQuote, money, layout };
