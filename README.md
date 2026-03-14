# Glamified Systems — Deployment Guide

## File structure

```
glamified-site/
├── index.html                          ← Main website
├── payment-success.html                ← Shown after payment
├── netlify.toml                        ← Netlify config
├── package.json                        ← Node dependencies
├── .env.example                        ← Environment variable template
└── netlify/
    └── functions/
        ├── keygen.js                   ← License key generator
        ├── mailer.js                   ← Email sender
        ├── initiate-payment.js         ← Creates Lenco payment link
        └── lenco-webhook.js            ← Receives payment confirmation
```

---

## Step 1 — Deploy to Netlify (5 minutes)

### Option A: Drag and drop (easiest)
1. Zip the entire `glamified-site/` folder
2. Go to [netlify.com](https://netlify.com) → Log in → **Add new site → Deploy manually**
3. Drag the zip onto the upload area
4. Done — you get a live URL like `https://glamified-systems.netlify.app`

### Option B: GitHub (recommended for ongoing updates)
1. Push this folder to a private GitHub repo
2. Netlify → **Add new site → Import from Git → GitHub**
3. Select the repo → Deploy
4. Every time you push to GitHub, the site updates automatically

---

## Step 2 — Connect your domain

1. Netlify → **Site Configuration → Domain management → Add domain**
2. Enter: `glamifiedsystems.com`
3. Update your domain's DNS nameservers to point to Netlify
   (Netlify shows you exactly which nameservers to use)
4. HTTPS is enabled automatically — free SSL certificate

---

## Step 3 — Set environment variables (most important step)

1. Netlify → Your Site → **Site Configuration → Environment Variables**
2. Add each variable from `.env.example` with your real values
3. **Never** put real secrets in code files — only in environment variables

Key variables to set first:
- `LENCO_SECRET_KEY` — your Lenco API key
- `LENCO_WEBHOOK_SECRET` — your Lenco webhook secret
- `GLAMIFIED_KEYGEN_SECRET` — generate a random 64-char string
- `SMTP_USER` + `SMTP_PASS` — Gmail address + App Password
- `DOWNLOAD_URL_BASIC/PAYROLL/SUITE` — your .exe download links

---

## Step 4 — Upload your .exe files

Host the GlamifiedHR installer files somewhere private.
**Best free option: Cloudflare R2**

1. Go to [cloudflare.com](https://cloudflare.com) → R2 Object Storage → Create bucket
2. Upload `GlamifiedHR-Setup.exe` (one per plan, or one shared installer)
3. Make the files **unlisted** (not public) — access only via signed URL or direct link
4. Copy the URLs → paste into Netlify env vars as `DOWNLOAD_URL_*`

---

## Step 5 — Configure Lenco webhook

1. Log into your Lenco Dashboard
2. Go to **Developers → Webhooks → Add webhook**
3. Endpoint URL: `https://glamifiedsystems.com/api/lenco-webhook`
4. Events to subscribe: `transaction.successful` (or equivalent in Lenco)
5. Copy the **Signing Secret** → paste as `LENCO_WEBHOOK_SECRET` in Netlify

---

## Step 6 — Test the payment flow

1. Use Lenco's **sandbox mode** first:
   - Set `LENCO_API_URL=https://api.lenco.co/sandbox/v1` in Netlify
   - Use test card numbers from Lenco docs
2. Click "Buy for K2,500" on your site → complete sandbox payment
3. Check your email for the license key
4. Check Netlify → Functions → Logs to see what happened
5. Once working, switch to live: `LENCO_API_URL=https://api.lenco.co/access/v1`

---

## How the payment flow works

```
Customer clicks "Buy"
       ↓
Frontend sends name/email/phone/plan to /api/initiate-payment
       ↓
Netlify Function calls Lenco API → gets payment URL
       ↓
Customer redirected to Lenco payment page
       ↓
Customer pays (Airtel / MTN / Card)
       ↓
Lenco calls your webhook: /api/lenco-webhook
       ↓
Netlify Function verifies signature
       ↓
Generates license key (keygen.js)
       ↓
Sends license email to customer (mailer.js)
Sends sale notification to you
       ↓
Customer lands on /payment-success.html
```

---

## Monthly costs

| Service          | Cost       |
|------------------|------------|
| Netlify hosting  | Free       |
| Netlify Functions| Free (125k calls/month) |
| Custom domain    | ~$12/year  |
| Cloudflare R2    | Free (10GB storage) |
| Gmail SMTP       | Free       |
| Lenco            | Transaction fees only |

**Total: ~$1/month (just domain renewal amortised)**

---

## Troubleshooting

**Webhook not firing?**
- Check Netlify → Functions → lenco-webhook → Logs
- Make sure the webhook URL in Lenco dashboard is exactly: `https://glamifiedsystems.com/api/lenco-webhook`

**Email not sending?**
- Gmail blocks regular passwords — you must use an App Password
- Check that 2-Step Verification is enabled on your Google account
- Look at Netlify function logs for SMTP errors

**License key not generating?**
- Make sure `GLAMIFIED_KEYGEN_SECRET` is set in Netlify env vars
- Never leave it blank

**Lenco payload fields don't match?**
- Check Netlify function logs to see the raw payload
- Update the field paths in `lenco-webhook.js` to match Lenco's actual structure
