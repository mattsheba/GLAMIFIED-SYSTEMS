// ============================================================
// Netlify Function: /api/download-count
// GET  — return the current download count
// POST — record a download (atomic increment via Supabase RPC)
//
// Requires in Supabase (run once in the SQL editor):
//
//   create table if not exists download_counts (
//     product    text primary key,
//     count      bigint not null default 0,
//     updated_at timestamptz not null default now()
//   );
//
//   create or replace function increment_download_count(p_product text)
//   returns bigint
//   language sql
//   security definer
//   as $$
//     insert into download_counts (product, count)
//     values (p_product, 1)
//     on conflict (product) do update
//       set count = download_counts.count + 1,
//           updated_at = now()
//     returning count;
//   $$;
// ============================================================

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

// Whitelist so random requests can't create junk counter rows
const PRODUCTS = ['glamifiedhr'];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  const product = (event.queryStringParameters?.product || 'glamifiedhr').toLowerCase();
  if (!PRODUCTS.includes(product)) {
    return {
      statusCode: 400,
      headers: CORS,
      body: JSON.stringify({ error: 'Unknown product' }),
    };
  }

  // ── GET /api/download-count ────────────────────────────────
  if (event.httpMethod === 'GET') {
    try {
      const { data, error } = await supabase
        .from('download_counts')
        .select('count')
        .eq('product', product)
        .maybeSingle();

      if (error) throw error;

      return {
        statusCode: 200,
        headers: { ...CORS, 'Cache-Control': 'public, max-age=60' },
        body: JSON.stringify({ product, count: data?.count ?? 0 }),
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ error: err.message }),
      };
    }
  }

  // ── POST /api/download-count ───────────────────────────────
  if (event.httpMethod === 'POST') {
    try {
      const { data, error } = await supabase.rpc('increment_download_count', {
        p_product: product,
      });

      if (error) throw error;

      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ product, count: data }),
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ error: err.message }),
      };
    }
  }

  return {
    statusCode: 405,
    headers: CORS,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
};
