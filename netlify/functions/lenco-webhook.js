const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { sendKeyEmail } = require('./trial-key');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const signature = event.headers['x-lenco-signature'] || event.headers['x-webhook-signature'];
  if (process.env.LENCO_WEBHOOK_SECRET && signature) {
    const expected = crypto
      .createHmac('sha256', process.env.LENCO_WEBHOOK_SECRET)
      .update(event.body)
      .digest('hex');
    if (signature !== expected && signature !== ('sha256=' + expected)) {
      console.warn('Webhook signature mismatch');
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid signature' }) };
    }
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const eventType = payload.event || payload.type || '';
  if (!eventType.includes('success') && !eventType.includes('completed')) {
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  }

  const txn = payload.data || payload.transaction || payload;
  const reference = txn.reference || txn.transactionReference || txn.id || '';
  const amountRaw = txn.amount != null ? txn.amount : (txn.transactionAmount || 0);
  const amountZMW = amountRaw > 10000 ? Math.round(amountRaw / 100) : amountRaw;

  const customer = txn.customer || txn.customerData || {};
  const email = (customer.email || txn.email || '').toLowerCase();
  const name = customer.name || txn.customerName || txn.name || '';

  if (!email || !reference) {
    console.error('Webhook missing email or reference:', { email, reference });
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  }

  if (amountZMW < 2900) {
    console.log('Skipping low-value transaction: K' + amountZMW + ' ref ' + reference);
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  }

  const { data: alreadyProcessed } = await supabase
    .from('license_keys')
    .select('id')
    .eq('payment_ref', reference)
    .maybeSingle();

  if (alreadyProcessed) {
    console.log('Reference ' + reference + ' already processed');
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  }

  const { data: keyRow, error: fetchErr } = await supabase
    .from('license_keys')
    .select('id, key')
    .eq('type', 'annual')
    .eq('used', false)
    .limit(1)
    .maybeSingle();

  if (fetchErr || !keyRow) {
    console.error('No annual keys available for reference:', reference, fetchErr);
    await alertAdmin(
      'URGENT: Annual key stock empty. Payment from ' + email + ' (ref: ' + reference + ', K' + amountZMW + '). Send manually.',
      email
    );
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  }

  const { error: updateErr } = await supabase
    .from('license_keys')
    .update({
      used: true,
      customer_name: name,
      customer_email: email,
      payment_ref: reference,
      activated_at: new Date().toISOString()
    })
    .eq('id', keyRow.id);

  if (updateErr) {
    console.error('Failed to mark annual key as used:', updateErr);
    await alertAdmin(
      'Failed to mark key ' + keyRow.key + ' as used for ' + email + ' (ref: ' + reference + '). Update Supabase manually.',
      email
    );
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  }

  try {
    await sendKeyEmail({ name, email, key: keyRow.key, type: 'annual' });
    console.log('Annual key ' + keyRow.key + ' delivered to ' + email);
  } catch (err) {
    console.error('Email delivery failed:', err);
    await alertAdmin(
      'Failed to email annual key ' + keyRow.key + ' to ' + email + ' (ref: ' + reference + '). Send manually.',
      email
    );
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};

async function alertAdmin(message, triggerEmail) {
  const nodemailer = require('nodemailer');
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    await transporter.sendMail({
      from: '"GlamifiedHR System" <' + process.env.SMTP_USER + '>',
      to: process.env.SMTP_USER,
      subject: '[ACTION REQUIRED] GlamifiedHR: ' + message.slice(0, 60),
      text: message + '\n\nTriggered by: ' + triggerEmail
    });
  } catch (err) {
    console.error('Admin alert failed:', err);
  }
}