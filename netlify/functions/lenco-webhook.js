/**
 * lenco-webhook.js
 * Netlify Function — endpoint: /.netlify/functions/lenco-webhook
 * (also accessible as /api/lenco-webhook via the redirect in netlify.toml)
 *
 * This function is called by Lenco whenever a payment is completed.
 * It:
 *   1. Verifies the request signature using your LENCO_WEBHOOK_SECRET
 *   2. Checks the payment status is "successful"
 *   3. Reads the plan from the payment metadata
 *   4. Generates a license key
 *   5. Emails the key to the customer
 *   6. Sends you an admin notification
 *
 * ─── ENVIRONMENT VARIABLES TO SET IN NETLIFY ───────────────────────────────
 *
 *   LENCO_WEBHOOK_SECRET     Your Lenco webhook signing secret
 *                            (Lenco Dashboard → Developers → Webhooks)
 *
 *   GLAMIFIED_KEYGEN_SECRET  Any long random string — used to sign license keys
 *                            Generate one at: https://generate-secret.vercel.app/64
 *
 *   DOWNLOAD_URL_BASIC       Direct download link for Basic HR .exe
 *   DOWNLOAD_URL_PAYROLL     Direct download link for HR + Payroll .exe
 *   DOWNLOAD_URL_SUITE       Direct download link for Full Suite .exe
 *                            (Host the .exe files on Cloudflare R2 or any storage)
 *
 *   SMTP_HOST                smtp.gmail.com  (or your mail provider)
 *   SMTP_PORT                587
 *   SMTP_USER                info.glamifiedsystems@gmail.com
 *   SMTP_PASS                Your Gmail App Password
 *                            (Google Account → Security → App Passwords)
 *   FROM_EMAIL               info.glamifiedsystems@gmail.com
 *   ADMIN_EMAIL              your personal email for sale notifications
 *
 * ────────────────────────────────────────────────────────────────────────────
 */

const crypto = require("crypto");
const { generateLicenseKey } = require("./keygen");
const { sendLicenseEmail, sendAdminNotification } = require("./mailer");

// Map Lenco product/plan names to our internal plan names
// Adjust these to match exactly what you set in Lenco's product descriptions
const PLAN_MAP = {
  "basic-hr":      "Basic HR",
  "hr-payroll":    "HR + Payroll",
  "full-suite":    "Full Suite",
  // Also match by amount as fallback
  "1200":  "Basic HR",
  "2500":  "HR + Payroll",
  "3500":  "Full Suite",
};

const DOWNLOAD_URLS = {
  "Basic HR":      process.env.DOWNLOAD_URL_BASIC,
  "HR + Payroll":  process.env.DOWNLOAD_URL_PAYROLL,
  "Full Suite":    process.env.DOWNLOAD_URL_SUITE,
};

/**
 * Verify Lenco webhook signature.
 * Lenco sends an X-Lenco-Signature header with HMAC-SHA256 of the raw body.
 */
function verifyLencoSignature(rawBody, signature) {
  const secret = process.env.LENCO_WEBHOOK_SECRET;
  if (!secret) {
    console.error("LENCO_WEBHOOK_SECRET is not set — rejecting webhook for security");
    return false;
  }
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  let sigBuf;
  try {
    sigBuf = Buffer.from(signature, "hex");
  } catch {
    return false;
  }
  if (expectedBuf.length !== sigBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, sigBuf);
}

exports.handler = async (event) => {
  // Only accept POST
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const rawBody = event.body;
  const signature = event.headers["x-lenco-signature"] || "";

  // 1. Verify signature
  if (!verifyLencoSignature(rawBody, signature)) {
    console.error("Invalid Lenco webhook signature");
    return { statusCode: 401, body: "Unauthorized" };
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  console.log("Lenco webhook received:", JSON.stringify(payload, null, 2));

  // 2. Check payment status
  // Lenco webhook payload structure (adjust field names if Lenco uses different ones)
  const status = payload?.data?.status || payload?.status;
  if (status !== "successful" && status !== "success" && status !== "completed") {
    console.log(`Payment status is "${status}" — ignoring`);
    // Return 200 so Lenco doesn't retry
    return { statusCode: 200, body: JSON.stringify({ received: true, action: "ignored", status }) };
  }

  // 3. Extract buyer details from Lenco payload
  // Adjust these field paths to match Lenco's actual webhook structure
  const data = payload?.data || payload;
  const buyerEmail    = data?.customer?.email || data?.email || "";
  const buyerName     = data?.customer?.name  || data?.name  || data?.customer?.firstName + " " + data?.customer?.lastName || "Customer";
  const buyerPhone    = data?.customer?.phone || data?.phone || "";
  const amountPaid    = parseFloat(data?.amount || data?.amountPaid || 0);
  const paymentMethod = data?.paymentMethod   || data?.channel || "Lenco";
  const transactionRef = data?.reference      || data?.transactionRef || data?.id || "";

  // Determine plan from metadata or amount
  const metaPlan   = data?.metadata?.plan || data?.narration || data?.description || "";
  const planKey    = metaPlan.toLowerCase().replace(/\s+/g, "-");
  const amountKey  = String(Math.round(amountPaid));

  let plan = PLAN_MAP[planKey] || PLAN_MAP[amountKey];

  if (!plan) {
    console.error(`Could not determine plan from payload. planKey="${planKey}", amountKey="${amountKey}"`);
    // Fallback: try to determine by amount range
    if (amountPaid >= 3000) plan = "Full Suite";
    else if (amountPaid >= 2000) plan = "HR + Payroll";
    else plan = "Basic HR";
  }

  if (!buyerEmail) {
    console.error("No buyer email in payload — cannot send license key");
    return { statusCode: 200, body: JSON.stringify({ received: true, error: "no_email" }) };
  }

  // 4. Generate license key
  let licenseKey;
  try {
    licenseKey = generateLicenseKey(plan, buyerEmail);
    console.log(`Generated key for ${buyerEmail}: ${licenseKey}`);
  } catch (err) {
    console.error("Key generation failed:", err.message);
    return { statusCode: 500, body: "Key generation failed" };
  }

  // 5. Get download URL for this plan
  const downloadUrl = DOWNLOAD_URLS[plan] || "https://glamifiedsystems.com/#download";

  // 6. Send license email to customer
  try {
    await sendLicenseEmail({
      toEmail:     buyerEmail,
      toName:      buyerName,
      plan,
      licenseKey,
      downloadUrl,
      amountPaid,
    });
    console.log(`License email sent to ${buyerEmail}`);
  } catch (err) {
    console.error("Failed to send license email:", err.message);
    // Don't fail the webhook — log and continue
  }

  // 7. Send admin notification
  try {
    await sendAdminNotification({
      buyerName,
      buyerEmail,
      buyerPhone,
      plan,
      licenseKey,
      amountPaid,
      paymentMethod,
      transactionRef,
    });
  } catch (err) {
    console.error("Failed to send admin notification:", err.message);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      received: true,
      plan,
      keyIssued: true,
      reference: transactionRef,
    }),
  };
};
