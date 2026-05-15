const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  const { name, email, company } = body;

  if (!name || !email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Name and email are required' }) };
  }

  // Check this email hasn't already claimed a trial key
  const { data: existing } = await supabase
    .from('license_keys')
    .select('id')
    .eq('customer_email', email.toLowerCase())
    .eq('type', 'trial')
    .maybeSingle();

  if (existing) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'A trial key has already been sent to this email address. Contact us on WhatsApp if you need help.' })
    };
  }

  // Claim an unused trial key
  const { data: keyRow, error: fetchErr } = await supabase
    .from('license_keys')
    .select('id, key')
    .eq('type', 'trial')
    .eq('used', false)
    .limit(1)
    .maybeSingle();

  if (fetchErr || !keyRow) {
    // Alert admin and tell user to contact us
    await alertAdmin('Trial key stock is empty — a user requested one but none are available.', email);
    return {
      statusCode: 503,
      body: JSON.stringify({ error: 'Trial keys are temporarily unavailable. Please WhatsApp us at +260 977 669 883 and we will send your key within 1 hour.' })
    };
  }

  // Mark key as used
  const { error: updateErr } = await supabase
    .from('license_keys')
    .update({
      used: true,
      customer_name: name,
      customer_email: email.toLowerCase(),
      payment_ref: 'TRIAL',
      activated_at: new Date().toISOString()
    })
    .eq('id', keyRow.id);

  if (updateErr) {
    console.error('Failed to mark trial key as used:', updateErr);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal error. Please try again or contact us.' }) };
  }

  // Send key by email
  try {
    await sendKeyEmail({ name, email, company, key: keyRow.key, type: 'trial' });
  } catch (err) {
    console.error('Email send failed:', err);
    // Key is marked used — alert admin to send manually
    await alertAdmin(`Failed to email trial key ${keyRow.key} to ${email}. Send manually.`, email);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true })
  };
};

async function sendKeyEmail({ name, email, company, key, type }) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  const firstName = name.split(' ')[0];
  const subject = type === 'trial'
    ? 'Your GlamifiedHR 10-Day Trial Key'
    : 'Your GlamifiedHR License Key';

  const validityNote = type === 'trial'
    ? 'Your trial key is valid for <strong>10 days</strong> from activation.'
    : 'Your license key is valid for <strong>12 months</strong> from activation.';

  await transporter.sendMail({
    from: `"Glamified Systems" <${process.env.SMTP_USER}>`,
    to: email,
    subject,
    html: `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1a2e;">
        <div style="background:#0F1E3C;padding:28px 32px;border-radius:12px 12px 0 0;">
          <img src="https://glamifiedsystems.com/assets/logo.png" height="44" alt="Glamified Systems" style="mix-blend-mode:lighten;"/>
        </div>
        <div style="background:#f9f7f3;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e8e2d9;border-top:none;">
          <p style="margin:0 0 8px;">Hi ${firstName},</p>
          <p style="color:#555;margin:0 0 24px;">Thank you for trying GlamifiedHR. Here is your license key:</p>
          <div style="background:#0F1E3C;border-radius:10px;padding:20px;text-align:center;margin-bottom:24px;">
            <div style="font-size:11px;color:#8A93A8;letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px;">Your License Key</div>
            <div style="font-size:22px;font-weight:700;color:#E6B84A;letter-spacing:2px;font-family:monospace;">${key}</div>
          </div>
          <p style="color:#555;margin:0 0 8px;"><strong>How to activate:</strong></p>
          <ol style="color:#555;padding-left:20px;margin:0 0 24px;line-height:1.9;">
            <li>Open GlamifiedHR on your Windows PC</li>
            <li>Click <strong>Activate License</strong> on the welcome screen</li>
            <li>Enter the key above and click <strong>Confirm</strong></li>
          </ol>
          <p style="color:#555;margin:0 0 8px;">${validityNote}</p>
          ${type === 'trial' ? `<p style="color:#555;margin:0 0 24px;">When your trial ends, you can purchase a full license at <a href="https://glamifiedsystems.com/glamifiedhr.html#download" style="color:#1A8C72;">glamifiedsystems.com</a> for K3,000.</p>` : ''}
          <hr style="border:none;border-top:1px solid #e8e2d9;margin:24px 0;"/>
          <p style="color:#888;font-size:13px;margin:0;">Questions? WhatsApp us: <a href="https://wa.me/260977669883" style="color:#1A8C72;">+260 977 669 883</a><br/>
          Or email: <a href="mailto:info.glamifiedsystems@gmail.com" style="color:#1A8C72;">info.glamifiedsystems@gmail.com</a></p>
        </div>
      </div>
    `
  });
}

async function alertAdmin(message, triggerEmail) {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    await transporter.sendMail({
      from: `"GlamifiedHR System" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      subject: `[ACTION REQUIRED] GlamifiedHR: ${message.slice(0, 60)}`,
      text: `${message}\n\nTriggered by: ${triggerEmail}`
    });
  } catch (err) {
    console.error('Admin alert failed:', err);
  }
}

module.exports.sendKeyEmail = sendKeyEmail;
