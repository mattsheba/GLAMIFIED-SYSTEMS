-- ============================================================
-- iVOGUE LUSAKA — database schema (Supabase / PostgreSQL)
-- Run once in the Supabase SQL editor.
-- All money columns are integer ngwee (1 ZMW = 100 ngwee).
-- Timestamps are timestamptz; the shop reads them as Africa/Lusaka.
-- ============================================================

create extension if not exists "pgcrypto";

-- ── orders ──────────────────────────────────────────────────
create table if not exists shop_orders (
  id                uuid primary key default gen_random_uuid(),
  reference         text        not null unique,
  status            text        not null default 'pending'
                    check (status in ('pending','paid','preparing','dispatched','completed','failed','cancelled')),

  customer_name     text        not null,
  customer_phone    text        not null,          -- normalised MSISDN, e.g. 260977123456
  customer_email    text,
  address           text,
  landmark          text,
  notes             text,
  company           text,
  tpin              text,

  zone_id           text        not null,
  zone_name         text        not null,
  delivery_fee      integer     not null default 0,

  subtotal          integer     not null,
  discount          integer     not null default 0,
  total             integer     not null,
  promo_code        text,

  pay_method        text        not null check (pay_method in ('momo','card','cash')),
  pay_operator      text,                           -- airtel | mtn | zamtel
  pay_number        text,                           -- wallet that was charged
  payment_reference text,                           -- gateway reference
  payment_raw       jsonb,

  items             jsonb       not null,           -- [{productId, name, optionId, optionLabel, colorId, colorName, qty, unit, lineTotal}]

  created_at        timestamptz not null default now(),
  paid_at           timestamptz,
  updated_at        timestamptz not null default now()
);

create index if not exists shop_orders_phone_idx      on shop_orders (customer_phone);
create index if not exists shop_orders_status_idx     on shop_orders (status);
create index if not exists shop_orders_created_idx    on shop_orders (created_at desc);
create index if not exists shop_orders_payref_idx     on shop_orders (payment_reference);

-- ── trade-in quotes ─────────────────────────────────────────
create table if not exists shop_tradein_quotes (
  id             uuid primary key default gen_random_uuid(),
  quote_ref      text        not null unique,
  name           text        not null,
  phone          text        not null,
  model_id       text        not null,
  model_name     text        not null,
  storage_id     text,
  grade_id       text        not null,
  grade_name     text        not null,
  battery_health text,
  deductions     text[]      not null default '{}',
  value          integer     not null,              -- ngwee
  visit_when     text,
  notes          text,
  status         text        not null default 'new'
                 check (status in ('new','contacted','tested','completed','declined')),
  expires_at     timestamptz not null default (now() + interval '7 days'),
  created_at     timestamptz not null default now()
);

create index if not exists shop_tradein_phone_idx  on shop_tradein_quotes (phone);
create index if not exists shop_tradein_status_idx on shop_tradein_quotes (status);

-- ── live stock (optional override of data/catalog.json) ─────
-- Seed this table and the shop serves its stock numbers from here,
-- so the counter and the website never disagree.
create table if not exists shop_stock (
  sku        text primary key,                      -- productId::optionId
  product_id text    not null,
  option_id  text    not null,
  qty        integer not null default 0 check (qty >= 0),
  updated_at timestamptz not null default now()
);

-- Atomic decrement used after a payment is confirmed.
create or replace function shop_decrement_stock(p_sku text, p_qty integer)
returns integer
language plpgsql
as $$
declare remaining integer;
begin
  update shop_stock
     set qty = greatest(0, qty - p_qty), updated_at = now()
   where sku = p_sku
  returning qty into remaining;
  return coalesce(remaining, -1);   -- -1 means the SKU is not tracked here
end;
$$;

-- Keep updated_at honest on orders.
create or replace function shop_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists shop_orders_touch on shop_orders;
create trigger shop_orders_touch before update on shop_orders
for each row execute function shop_touch_updated_at();

-- ── row level security ──────────────────────────────────────
-- Nothing is readable with the anon key. Every read and write goes
-- through a Netlify Function holding the service role key, which
-- bypasses RLS. Shoppers reach their own order only through
-- /api/order-status, which demands reference + phone.
alter table shop_orders          enable row level security;
alter table shop_tradein_quotes  enable row level security;
alter table shop_stock           enable row level security;

drop policy if exists "stock is public" on shop_stock;
create policy "stock is public" on shop_stock for select using (true);

-- ── seed stock from the catalogue ───────────────────────────
-- Replace with your real counts, or leave empty to use data/catalog.json.
insert into shop_stock (sku, product_id, option_id, qty) values
  ('iphone-17-pro-max::256', 'iphone-17-pro-max', '256', 4),
  ('iphone-17-pro-max::512', 'iphone-17-pro-max', '512', 2),
  ('iphone-17-pro-max::1tb', 'iphone-17-pro-max', '1tb', 1),
  ('iphone-17-pro::256',     'iphone-17-pro',     '256', 5),
  ('iphone-17-pro::512',     'iphone-17-pro',     '512', 2),
  ('iphone-17::256',         'iphone-17',         '256', 8),
  ('iphone-17::512',         'iphone-17',         '512', 3),
  ('iphone-air::256',        'iphone-air',        '256', 3),
  ('iphone-air::512',        'iphone-air',        '512', 1),
  ('iphone-16-pro-max::256', 'iphone-16-pro-max', '256', 4),
  ('iphone-16-pro-max::512', 'iphone-16-pro-max', '512', 2),
  ('iphone-16::128',         'iphone-16',         '128', 6),
  ('iphone-16::256',         'iphone-16',         '256', 4),
  ('iphone-16e::128',        'iphone-16e',        '128', 5),
  ('iphone-16e::256',        'iphone-16e',        '256', 2),
  ('iphone-15::128',         'iphone-15',         '128', 4),
  ('iphone-15::256',         'iphone-15',         '256', 2),
  ('iphone-13::128',         'iphone-13',         '128', 6),
  ('iphone-13::256',         'iphone-13',         '256', 2),
  ('iphone-12::64',          'iphone-12',         '64',  5),
  ('iphone-12::128',         'iphone-12',         '128', 3),
  ('iphone-11::64',          'iphone-11',         '64',  7),
  ('iphone-11::128',         'iphone-11',         '128', 3)
on conflict (sku) do nothing;
