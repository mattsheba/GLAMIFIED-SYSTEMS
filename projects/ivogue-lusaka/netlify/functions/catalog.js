/**
 * GET /api/catalog
 * The storefront's catalogue with live stock. Cached hard at the edge for a
 * minute: shoppers get a fast shelf, the counter still sees its own numbers.
 */
const { ok, preflight, json, serverError } = require('./lib/respond');
const { getCatalog } = require('./lib/catalog');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  try {
    const catalog = await getCatalog();
    return ok(catalog, { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' });
  } catch (err) {
    console.error('[ivogue] catalog error:', err.message);
    return serverError('The catalogue is briefly unavailable.');
  }
};
