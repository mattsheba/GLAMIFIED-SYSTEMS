# iVogue Lusaka — iPhone boutique storefront

A complete, production-ready e-commerce storefront for a fashion-led iPhone shop in Lusaka:
new and certified pre-owned iPhone, AirPods, Apple Watch, accessories and styled bundles,
with kwacha pricing, live stock, mobile money checkout, trade-in valuation and same-day
Lusaka delivery.

Built on the same stack already proven on glamifiedsystems.com — static pages, Netlify
Functions, Supabase and Lenco — so it deploys the same way and needs no new vendors.

```
Static HTML/CSS/JS  →  Netlify Functions (/api/*)  →  Supabase (orders, leads, stock)
                                    └──────────────→  Lenco (Airtel, MTN, Zamtel, cards)
                                    └──────────────→  SMTP (receipts, counter alerts)
```

---

## What is in it

| Page | What it does |
|---|---|
| `index.html` | Hero, live featured shelf, collections, trust, trade-in teaser, store block, `Store` JSON-LD |
| `shop.html` | Whole catalogue with category chips, search, sort, URL-synced filters |
| `product.html` | Storage and colour selection, live stock, delivery promise, specs, `Product` JSON-LD |
| `cart.html` | Basket, quantities, promo codes, delivery zone, WhatsApp order fallback |
| `checkout.html` | Customer details, Lusaka delivery zones, mobile money / card / pay-on-collection, TPIN for company invoices |
| `order.html` | Order tracking by reference + phone, auto-polling while a payment is pending |
| `trade-in.html` | Instant valuation calculator and quote booking |
| `visit.html` | Hours (live open/closed in Africa/Lusaka), map, what to bring |
| `warranty.html` `privacy.html` `terms.html` `404.html` | Policies written for Zambian law and Zambian buying habits |

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/catalog` | GET | Catalogue with live stock, cached 60s |
| `/api/create-order` | POST | Re-prices the basket server-side, stores the order, starts the payment |
| `/api/order-status` | GET | Order lookup, gated on reference **and** the phone number on the order |
| `/api/lenco-webhook` | POST | The only place an order becomes *paid*: HMAC-verified, replay-safe, amount-checked |
| `/api/trade-in` | POST | Values a device and saves the lead |

---

## Money, numbers and Zambian rules

- **Every price is an integer number of ngwee** (1 ZMW = 100 ngwee). No floats touch money.
- **The server re-prices every basket** from `data/catalog.json` through `assets/pricing.js`.
  A tampered basket cannot change what is charged — there is a test for exactly that.
- **Phone numbers** normalise through `assets/zm.js`: `0977…`, `+260977…`, `260977…` and
  `977…` all become `260977669883`. Wallet detection: 097/077 Airtel, 096/076 MTN,
  095/075 Zamtel.
- **NRC** `123456/78/1` and **TPIN** (10 digits) are validated before storage.
- **Opening hours and cut-offs** are evaluated in `Africa/Lusaka` regardless of the
  shopper's device timezone.
- Delivery zones, fees and ETAs are Lusaka-specific and live in `data/catalog.json`.

---

## Running it locally

```bash
cd projects/ivogue-lusaka
npm install
npm run build        # generates assets/config.js and the 63 product renders
npm test             # 44 checks: catalogue, pricing, Zambian rules, endpoints
npm run dev          # netlify dev → http://localhost:8888 with /api/* live
```

Without Netlify, any static server works — the storefront falls back from `/api/catalog`
to `data/catalog.json`, so the whole shop browses and the basket works offline from the API:

```bash
python3 -m http.server 8899
```

---

## Deploying

Deploy this folder as **its own Netlify site** (not as part of the marketing site):

| Setting | Value |
|---|---|
| Base directory | `projects/ivogue-lusaka` |
| Build command | `npm run build` |
| Publish directory | `projects/ivogue-lusaka` |
| Functions directory | `projects/ivogue-lusaka/netlify/functions` |

Then:

1. **Supabase** — run `supabase/schema.sql` in the SQL editor. It creates `shop_orders`,
   `shop_tradein_quotes`, `shop_stock`, the atomic `shop_decrement_stock` function and RLS
   (nothing is readable with the anon key; the functions use the service role key).
2. **Environment variables** — copy `.env.example` into Netlify → Site settings →
   Environment variables. The shop degrades honestly when a piece is missing: no SMTP means
   no emails but orders still save; no Supabase means `/api/create-order` returns a clear
   503 pointing the customer at WhatsApp rather than silently losing the sale.
3. **Lenco webhook** — point it at `https://<your-domain>/api/lenco-webhook` and put the
   signing secret in `LENCO_WEBHOOK_SECRET`. **An unsigned webhook is rejected**, so without
   this secret orders will never flip to paid.
4. **DNS** — point the domain at the Netlify site, then update `data/shop.json`
   (`brand.domain`, `brand.siteUrl`) and re-run `npm run build:config`.

---

## Day-to-day running of the shop

**Changing prices or stock** — edit `data/catalog.json`, commit, push. Netlify rebuilds.
Once `shop_stock` has rows, those numbers override the JSON, so the counter can update stock
from Supabase without a deploy.

**Adding a product** — add an object to `products` in `data/catalog.json` (copy an existing
one), then `npm run build:art` to generate its renders, then `npm test`. The art generator
knows the iPhone families in `tools/generate-art.mjs`; a new model needs one line in its
`FAMILY` table.

**Real photography** — when you have studio shots, drop them in `assets/devices/` using the
same filenames (`<product-id>--<colour-id>.svg` → `.jpg` works too if you update
`art()` in `assets/app.js`). Nothing else changes.

**Brand, address, hours, WhatsApp number** — all in `data/shop.json`; run
`npm run build:config` after editing. Never edit `assets/config.js` directly, it is generated.

**Watching orders** — Supabase table editor on `shop_orders`. Statuses move
`pending → paid → preparing → dispatched → completed`; `order.html` shows the customer
whichever one it is on.

---

## Before this goes live — replace these

The code is finished; these values are placeholders for a real business to fill in:

- `data/shop.json`: trading address, WhatsApp/phone, email, Instagram/Facebook handles,
  legal name and TPIN, and `payments.lencoPublicKey`.
- `data/catalog.json`: prices (set from the day's landed cost and the kwacha rate — the seeds
  reflect the Lusaka market as at October 2026 and move with the exchange rate), stock counts,
  and the trade-in matrix.
- `index.html`: the customer quote in the trade-in section is illustrative — swap it for a
  real review before launch.
- Domain: `ivoguelusaka.com` appears in canonical tags, `robots.txt` and `sitemap.xml`.

---

## Security notes

- Service role keys, SMTP passwords and Lenco secrets exist only as Netlify environment
  variables. Nothing secret reaches the browser; a test fails the build if it does.
- The webhook verifies an HMAC-SHA256 signature in constant time, skips orders that are
  already settled (replay), and refuses to mark an order paid if the amount does not match
  what was charged — it emails the counter instead.
- Every function validates and clamps its input, limits the body size, and throttles per IP
  per endpoint.
- CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy`
  are set in `netlify.toml`.
- Card details are never seen by this code — cards go through Lenco's hosted page.

---

## Project layout

```
projects/ivogue-lusaka/
├── index.html shop.html product.html cart.html checkout.html order.html
├── trade-in.html visit.html warranty.html privacy.html terms.html 404.html
├── assets/
│   ├── style.css          design system (editorial light theme)
│   ├── app.js             nav, footer, basket, catalogue loading, toasts
│   ├── pricing.js         pricing engine — shared by browser and server
│   ├── zm.js              Zambian phone / NRC / TPIN rules — shared
│   ├── config.js          GENERATED from data/shop.json
│   └── devices/           63 generated product renders
├── data/catalog.json      products, prices (ngwee), stock, zones, promos, trade-in matrix
├── data/shop.json         brand, contact, store, payment and policy configuration
├── netlify/functions/     catalog · create-order · order-status · lenco-webhook · trade-in
│   └── lib/               respond · db · catalog · lenco · mail
├── supabase/schema.sql    tables, indexes, RLS, stock function, seed stock
├── tools/                 build-config · generate-art · test
└── netlify.toml           build, redirects, headers, CSP
```

---

Built by [Glamified Systems](https://glamifiedsystems.com) — Lusaka, Zambia.
