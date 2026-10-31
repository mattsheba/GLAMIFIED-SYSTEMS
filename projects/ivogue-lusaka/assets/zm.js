/* ============================================================
   iVOGUE LUSAKA — Zambian input rules (shared browser + server)
   Phone numbers, mobile money operators, NRC and TPIN.
   ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ZM = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  const OPERATORS = [
    { id: 'airtel', name: 'Airtel Money',  prefixes: ['97', '77'] },
    { id: 'mtn',    name: 'MTN MoMo',      prefixes: ['96', '76'] },
    { id: 'zamtel', name: 'Zamtel Kwacha', prefixes: ['95', '75'] },
  ];

  /**
   * Normalise any way a Zambian mobile number gets typed into 260XXXXXXXXX.
   * Accepts 0977123456, +260977123456, 260977123456, 977123456, with spaces or dashes.
   * @returns {string|null} 12-digit MSISDN, or null if it cannot be a Zambian mobile.
   */
  function normalizeMsisdn(input) {
    if (typeof input !== 'string' && typeof input !== 'number') return null;
    let d = String(input).replace(/[^\d]/g, '');
    if (d.startsWith('00260')) d = d.slice(5);
    else if (d.startsWith('260')) d = d.slice(3);
    else if (d.startsWith('0')) d = d.slice(1);
    if (d.length !== 9) return null;
    const prefix = d.slice(0, 2);
    if (!OPERATORS.some((o) => o.prefixes.includes(prefix))) return null;
    return '260' + d;
  }

  /** 260977669883 → "+260 977 669 883" */
  function formatMsisdn(msisdn) {
    const m = normalizeMsisdn(msisdn);
    if (!m) return '';
    const n = m.slice(3);
    return `+260 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
  }

  /** Which mobile money wallet a number belongs to. */
  function detectOperator(input) {
    const m = normalizeMsisdn(input);
    if (!m) return null;
    const prefix = m.slice(3, 5);
    return OPERATORS.find((o) => o.prefixes.includes(prefix)) || null;
  }

  /** NRC: 6 digits / 2 digits / 1 digit — e.g. 123456/78/1 */
  function normalizeNrc(input) {
    if (!input) return null;
    const d = String(input).replace(/[^\d]/g, '');
    if (d.length !== 9) return null;
    return `${d.slice(0, 6)}/${d.slice(6, 8)}/${d.slice(8)}`;
  }

  /** ZRA TPIN: exactly 10 digits. */
  function normalizeTpin(input) {
    if (!input) return null;
    const d = String(input).replace(/[^\d]/g, '');
    return d.length === 10 ? d : null;
  }

  function isEmail(v) {
    return typeof v === 'string' && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  }

  /** Strip control characters and clamp length — everything that reaches storage goes through this. */
  function cleanLine(v, max) {
    if (typeof v !== 'string') return '';
    let out = '';
    for (let i = 0; i < v.length; i++) {
      const c = v.charCodeAt(i);
      out += (c < 32 || c === 127) ? ' ' : v[i];
    }
    return out.replace(/\s+/g, ' ').trim().slice(0, max || 200);
  }

  /** Order reference: IVG-YYMMDD-XXXX, readable over a phone call. */
  function orderReference(date) {
    const d = date || new Date();
    const lusaka = new Date(d.toLocaleString('en-US', { timeZone: 'Africa/Lusaka' }));
    const yy = String(lusaka.getFullYear()).slice(2);
    const mm = String(lusaka.getMonth() + 1).padStart(2, '0');
    const dd = String(lusaka.getDate()).padStart(2, '0');
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1
    let tail = '';
    for (let i = 0; i < 4; i++) tail += alphabet[Math.floor(Math.random() * alphabet.length)];
    return `IVG-${yy}${mm}${dd}-${tail}`;
  }

  return { OPERATORS, normalizeMsisdn, formatMsisdn, detectOperator, normalizeNrc, normalizeTpin, isEmail, cleanLine, orderReference };
});
