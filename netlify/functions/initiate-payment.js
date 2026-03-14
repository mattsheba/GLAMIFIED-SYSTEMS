/**
 * initiate-payment.js
 * Netlify Function — endpoint: /api/initiate-payment
 *
 * Called by the frontend when a customer clicks "Proceed to payment".
 * Creates a Lenco payment link and returns it so the customer can pay.
 *
 * Required environment variables:
 *   LENCO_SECRET_KEY    Your Lenco secret/private API key
 *                       (Lenco Dashboard → Settings → API Keys)
 *   LENCO_API_URL       https://api.lenco.co/access/v1  (or sandbox URL for testing)
 *   SITE_URL            https://glamifiedsystems.com
 *
 * Lenco API docs: https://docs.lenco.co
 */

const PLAN_PRICES = {
  "Basic HR":     1200,
  "HR + Payroll": 2500,
  "Full Suite":   3500,
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const { name, email, phone, plan, paymentMethod } = body;

  // Validate inputs
  if (!name || !email || !phone || !plan) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing required fields: name, email, phone, plan" }),
    };
  }

  const amount = PLAN_PRICES[plan];
  if (!amount) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: `Unknown plan: ${plan}` }),
    };
  }

  const lencoKey = process.env.LENCO_SECRET_KEY;
  const lencoUrl = process.env.LENCO_API_URL || "https://api.lenco.co/access/v2";
  const siteUrl  = process.env.SITE_URL || "https://glamifiedsystems.com";

  if (!lencoKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Payment gateway not configured" }),
    };
  }

  // Build a unique transaction reference
  const reference = `GLAM-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  try {
    // Create a Lenco payment link
    // Adjust the endpoint and fields to match Lenco's actual API spec
    const response = await fetch(`${lencoUrl}/transactions/initialize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lencoKey}`,
      },
      body: JSON.stringify({
        amount: amount * 100,          // Lenco uses minor units (ngwe) — adjust if ZMW is in kwachas
        currency: "ZMW",
        reference,
        customer: {
          name,
          email,
          phone,
        },
        metadata: {
          plan,                        // Stored in metadata so webhook can read it
          product: "GlamifiedHR",
        },
        channels: paymentMethod ? [paymentMethod] : ["airtel", "mtn", "card"],
        callback_url: `${siteUrl}/payment-success`,
        narration: `GlamifiedHR — ${plan}`,
      }),
    });

    const result = await response.json();
    console.log("Lenco initiate response:", JSON.stringify(result));

    if (!response.ok || result?.status === false) {
      console.error("Lenco API error:", result);
      return {
        statusCode: 502,
        body: JSON.stringify({ error: result?.message || "Payment gateway error" }),
      };
    }

    // Return the payment URL to redirect the customer
    const paymentUrl = result?.data?.authorization_url
                    || result?.data?.paymentUrl
                    || result?.data?.url
                    || result?.authorization_url;

    if (!paymentUrl) {
      console.error("No payment URL in Lenco response:", result);
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "No payment URL returned from gateway" }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        success: true,
        paymentUrl,
        reference,
        plan,
        amount,
      }),
    };

  } catch (err) {
    console.error("Payment initiation error:", err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to initiate payment" }),
    };
  }
};
