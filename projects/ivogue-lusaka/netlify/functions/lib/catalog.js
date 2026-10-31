/** The catalogue, with live stock from shop_stock when the table has rows.
 *  data/catalog.json stays the source of truth for names, prices and art. */
const base = require('../../../data/catalog.json');
const { db } = require('./db');

let cache = null;
let cachedAt = 0;
const TTL = 60 * 1000;

function clone(value) {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

async function getCatalog() {
  if (cache && Date.now() - cachedAt < TTL) return cache;

  const catalog = clone(base);
  const supabase = db();
  if (supabase) {
    try {
      const { data, error } = await supabase.from('shop_stock').select('product_id, option_id, qty');
      if (error) throw error;
      if (data && data.length) {
        const bySku = new Map(data.map((r) => [`${r.product_id}::${r.option_id}`, r.qty]));
        for (const product of catalog.products) {
          for (const option of product.options) {
            const live = bySku.get(`${product.id}::${option.id}`);
            if (typeof live === 'number') option.stock = live;
          }
        }
      }
    } catch (err) {
      console.warn('[ivogue] live stock unavailable, using catalog.json:', err.message);
    }
  }

  cache = catalog;
  cachedAt = Date.now();
  return catalog;
}

/** Called after a sale so the next shopper sees the real number. */
function invalidate() { cache = null; }

module.exports = { getCatalog, invalidate };
