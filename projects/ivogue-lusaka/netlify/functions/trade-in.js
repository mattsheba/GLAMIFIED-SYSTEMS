/**
 * POST /api/trade-in
 * Values a customer's old iPhone with the same matrix the calculator shows,
 * stores the lead, and emails the counter so somebody can call them back.
 */
const P  = require('../../assets/pricing.js');
const ZM = require('../../assets/zm.js');
const { ok, bad, preflight, json, serverError, parseBody, throttled } = require('./lib/respond');
const { getCatalog } = require('./lib/catalog');
const { db } = require('./lib/db');
const mail = require('./lib/mail');

function quoteRef() {
  const d = new Date();
  const stamp = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const tail = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TQ-${stamp}-${tail}`;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (throttled(event, 6, 60000)) return json(429, { error: 'Too many requests. Give it a minute.' });

  const parsed = parseBody(event, 8000);
  if (parsed.error) return bad(parsed.error);
  const body = parsed.data || {};

  const name = ZM.cleanLine(body.name, 80);
  const phone = ZM.normalizeMsisdn(body.phone);
  if (name.length < 3) return bad('Please give us a name.');
  if (!phone) return bad('Use a Zambian mobile number so we can call you.');

  let catalog;
  try { catalog = await getCatalog(); }
  catch (err) { console.error('[ivogue] catalog failed:', err.message); return serverError('We cannot price that right now.'); }

  const deductions = Array.isArray(body.deductions)
    ? body.deductions.filter((d) => typeof d === 'string').slice(0, 5) : [];

  const valued = P.valueTradeIn(catalog, {
    modelId: body.modelId,
    gradeId: body.gradeId,
    storageId: body.storageId,
    deductions,
  });
  if (!valued) return bad('Pick the model and the condition first.');

  const grade = catalog.tradeIn.grades.find((g) => g.id === body.gradeId);
  const record = {
    quote_ref: quoteRef(),
    name,
    phone,
    model_id: body.modelId,
    model_name: valued.modelName,
    storage_id: ZM.cleanLine(body.storageId, 8) || null,
    grade_id: body.gradeId,
    grade_name: grade ? grade.name : valued.gradeName,
    battery_health: ZM.cleanLine(body.batteryHealth, 8) || null,
    deductions,
    value: valued.value,
    visit_when: ZM.cleanLine(body.when, 40) || null,
    notes: ZM.cleanLine(body.notes, 400) || null,
  };

  const supabase = db();
  if (supabase) {
    const { error } = await supabase.from('shop_tradein_quotes').insert(record);
    if (error) console.error('[ivogue] trade-in insert failed:', error.message);
  } else {
    console.warn('[ivogue] trade-in lead not stored (no database):', record.quote_ref);
  }

  try { await mail.sendTradeInQuote({ ...record, email: null }); }
  catch (err) { console.error('[ivogue] trade-in mail failed:', err.message); }

  return ok({
    quoteRef: record.quote_ref,
    value: valued.value,
    modelName: valued.modelName,
    gradeName: valued.gradeName,
    heldForDays: 7,
  });
};
