/** Supabase service-role client. Returns null when the shop has not been
 *  wired to a database yet, so the storefront still runs in development. */
let client = null;
let attempted = false;

function db() {
  if (attempted) return client;
  attempted = true;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.warn('[ivogue] SUPABASE_URL / SUPABASE_SERVICE_KEY not set — database features are off');
    return null;
  }
  const { createClient } = require('@supabase/supabase-js');
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

module.exports = { db };
