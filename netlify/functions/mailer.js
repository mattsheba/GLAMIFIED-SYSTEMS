/**
 * mailer.js
 * Sends the license key email to the customer after successful payment.
 * Uses nodemailer with Gmail SMTP (free) or any SMTP provider.
 * 
 * Required environment variables:
 *   SMTP_HOST      - e.g. smtp.gmail.com
 *   SMTP_PORT      - e.g. 587
 *   SMTP_USER      - your Gmail address e.g. info.glamifiedsystems@gmail.com
 *   SMTP_PASS      - Gmail App Password (NOT your regular password)
 *   FROM_EMAIL     - display from address e.g. info.glamifiedsystems@gmail.com
 */

const nodemailer = require("nodemailer");

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false, // TLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Send the license key email to the customer.
 * @param {object} params
 * @param {string} params.toEmail     - Customer email
 * @param {string} params.toName      - Customer name
 * @param {string} params.plan        - Plan name e.g. "HR + Payroll"
 * @param {string} params.licenseKey  - The generated key e.g. GLAM-HRP-A3F2-...
 * @param {string} params.downloadUrl - Direct link to the .exe download
 * @param {number} params.amountPaid  - Amount in ZMW
 */
async function sendLicenseEmail({ toEmail, toName, plan, licenseKey, downloadUrl, amountPaid }) {
  const transporter = createTransporter();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#F0EEE9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0EEE9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#08122A;border-radius:16px;overflow:hidden;max-width:560px;width:100%;">
        
        <!-- Header -->
        <tr>
          <td style="background:#0F1E3C;padding:32px 40px;text-align:center;border-bottom:1px solid rgba(201,153,42,0.2);">
            <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#F7F3EC;letter-spacing:-0.01em;">
              Glamified<span style="color:#E6B84A;">Systems</span>
            </div>
            <div style="font-size:11px;color:#8A93A8;letter-spacing:0.1em;text-transform:uppercase;margin-top:4px;">
              License Delivery
            </div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="color:#F7F3EC;font-size:16px;margin:0 0 8px;">Hi ${toName},</p>
            <p style="color:#8A93A8;font-size:14px;line-height:1.7;margin:0 0 32px;">
              Thank you for purchasing <strong style="color:#E6B84A;">${plan}</strong>. 
              Your payment of <strong style="color:#F7F3EC;">K${amountPaid.toLocaleString()}</strong> has been confirmed.
              Here is everything you need to get started.
            </p>

            <!-- Key box -->
            <div style="background:#0F1E3C;border:1px solid rgba(201,153,42,0.35);border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
              <div style="font-size:11px;color:#8A93A8;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:12px;">Your license key</div>
              <div style="font-family:'Courier New',monospace;font-size:20px;font-weight:700;color:#E6B84A;letter-spacing:0.08em;word-break:break-all;">
                ${licenseKey}
              </div>
              <div style="font-size:11px;color:#8A93A8;margin-top:12px;">Valid for up to 2 machines · ${plan}</div>
            </div>

            <!-- Download button -->
            <div style="text-align:center;margin-bottom:32px;">
              <a href="${downloadUrl}" 
                 style="display:inline-block;padding:14px 36px;background:#C9992A;color:#08122A;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;">
                Download GlamifiedHR →
              </a>
            </div>

            <!-- Steps -->
            <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:28px;">
              <div style="font-size:12px;color:#8A93A8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:16px;">Installation steps</div>
              ${["Download and run the installer from the button above",
                 "Launch GlamifiedHR — the activation screen will appear",
                 "Enter your license key exactly as shown above",
                 "Complete the company setup wizard",
                 "You're ready to go!"].map((step, i) => `
              <div style="display:flex;gap:12px;margin-bottom:12px;align-items:flex-start;">
                <div style="width:22px;height:22px;border-radius:50%;background:#1A8C72;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;line-height:22px;text-align:center;">${i + 1}</div>
                <div style="color:#8A93A8;font-size:13px;line-height:1.6;padding-top:2px;">${step}</div>
              </div>`).join("")}
            </div>
          </td>
        </tr>

        <!-- Support footer -->
        <tr>
          <td style="background:#0A1628;padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);">
            <p style="color:#8A93A8;font-size:12px;line-height:1.7;margin:0;text-align:center;">
              Need help? WhatsApp us at <a href="https://wa.me/260977669883" style="color:#E6B84A;text-decoration:none;">+260 977 669 883</a> 
              or email <a href="mailto:info.glamifiedsystems@gmail.com" style="color:#E6B84A;text-decoration:none;">info.glamifiedsystems@gmail.com</a><br />
              © 2026 Glamified Systems · Lusaka, Zambia
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();

  const info = await transporter.sendMail({
    from: `"Glamified Systems" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
    to: `"${toName}" <${toEmail}>`,
    subject: `Your GlamifiedHR License Key — ${plan}`,
    html,
    text: `
Hi ${toName},

Your GlamifiedHR license key for ${plan}:

${licenseKey}

Download the installer: ${downloadUrl}

Steps:
1. Download and run the installer
2. Launch GlamifiedHR — activation screen appears
3. Enter your license key
4. Complete the company setup wizard

Support: +260 977 669 883 | info.glamifiedsystems@gmail.com

© 2026 Glamified Systems, Lusaka, Zambia
    `.trim(),
  });

  return info;
}

/**
 * Send a notification email to you (the admin) whenever a purchase is made.
 */
async function sendAdminNotification({ buyerName, buyerEmail, buyerPhone, plan, licenseKey, amountPaid, paymentMethod, transactionRef }) {
  const transporter = createTransporter();

  const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;

  await transporter.sendMail({
    from: `"GlamifiedHR Sales" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
    to: adminEmail,
    subject: `[NEW SALE] ${plan} — K${amountPaid.toLocaleString()} from ${buyerName}`,
    text: `
NEW GLAMIFIEDHR SALE

Plan:       ${plan}
Amount:     K${amountPaid.toLocaleString()}
Payment:    ${paymentMethod}
Ref:        ${transactionRef || "N/A"}

Buyer:      ${buyerName}
Email:      ${buyerEmail}
Phone:      ${buyerPhone}

License:    ${licenseKey}

---
Glamified Systems Automated Sales Alert
    `.trim(),
  });
}

// ── security: input validation & sanitization ──
function cleanLine(v, max) {
  if (typeof v !== "string") return "";
  let out = "";
  for (let i = 0; i < v.length; i++) { const c = v.charCodeAt(i); out += (c < 32 || c === 127) ? " " : v[i]; }
  return out.trim().slice(0, max);
}
function cleanText(v, max) {
  if (typeof v !== "string") return "";
  const s = v.replace(/\r\n?/g, "\n");
  let out = "";
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); out += (c === 9 || c === 10 || (c >= 32 && c !== 127)) ? s[i] : ""; }
  return out.trim().slice(0, max);
}
function validEmail(v) { return typeof v === "string" && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

const CORS = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };

/**
 * Contact form handler — endpoint: /api/mailer
 * Validates and sanitizes submissions, then emails the admin.
 */
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed" }) };
  if (!event.body || event.body.length > 20000) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid request" }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid request body" }) }; }

  const name     = cleanLine(body.name, 100);
  const email    = cleanLine(body.email, 254);
  const phone    = cleanLine(body.phone, 30);
  const company  = cleanLine(body.company, 150);
  const interest = cleanLine(body.interest, 80);
  const message  = cleanText(body.message, 5000);

  if (!name || !email || !message) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Name, email, and message are required." }) };
  }
  if (!validEmail(email)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Please enter a valid email address." }) };
  }

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"Glamified Systems Website" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      to: process.env.ADMIN_EMAIL || process.env.SMTP_USER,
      replyTo: email,
      subject: `[Website Contact] ${name}${interest ? " — " + interest : ""}`,
      html: `<h2>New contact form submission</h2>
        <ul>
          <li><b>Name:</b> ${esc(name)}</li>
          <li><b>Email:</b> ${esc(email)}</li>
          <li><b>Phone:</b> ${esc(phone) || "&mdash;"}</li>
          <li><b>Company:</b> ${esc(company) || "&mdash;"}</li>
          <li><b>Interest:</b> ${esc(interest) || "&mdash;"}</li>
        </ul>
        <p><b>Message:</b></p>
        <p style="white-space:pre-wrap;">${esc(message)}</p>`,
      text: `New contact form submission\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone || "-"}\nCompany: ${company || "-"}\nInterest: ${interest || "-"}\n\nMessage:\n${message}`,
    });
  } catch (err) {
    console.error("Contact email failed:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Could not send your message. Please WhatsApp us at +260 977 669 883." }) };
  }

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true }) };
};

module.exports = { sendLicenseEmail, sendAdminNotification };
