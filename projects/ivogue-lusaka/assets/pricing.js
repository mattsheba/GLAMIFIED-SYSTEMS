/* ============================================================
   iVOGUE LUSAKA — pricing engine (shared browser + server)
   All money is an integer number of ngwee. 1 ZMW = 100 ngwee.
   The browser uses this for display; the order function uses the
   SAME file to recompute every total, so a tampered basket cannot
   change what is charged.
   ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IVPricing = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  const MAX_QTY = 5;
  const MAX_LINES = 20;

  function findProduct(catalog, id) {
    return catalog.products.find((p) => p.id === id) || null;
  }

  /** Resolve one basket item against the catalog. Returns null if it cannot be priced. */
  function resolveItem(catalog, item) {
    const product = findProduct(catalog, item && item.productId);
    if (!product) return null;
    const option = product.options.find((o) => o.id === item.optionId);
    if (!option) return null;
    const color = product.colors.find((c) => c.id === item.colorId);
    if (!color || color.soldOut) return null;

    let qty = Math.floor(Number(item.qty) || 0);
    if (qty < 1) qty = 1;
    const stock = Math.max(0, Math.floor(Number(option.stock) || 0));
    qty = Math.min(qty, MAX_QTY, stock || MAX_QTY);

    return {
      key: `${product.id}|${option.id}|${color.id}`,
      productId: product.id,
      name: product.name,
      optionId: option.id,
      optionLabel: option.label,
      optionName: product.optionLabel,
      colorId: color.id,
      colorName: color.name,
      colorHex: color.hex,
      category: product.category,
      condition: product.condition,
      unit: option.price,
      compareAt: option.compareAt || null,
      qty,
      stock,
      inStock: stock > 0,
      lineTotal: option.price * qty,
      art: `assets/devices/${product.id}--${color.id}.svg`,
    };
  }

  function promoEligibleSubtotal(lines, appliesTo) {
    return lines.reduce((sum, l) => {
      if (appliesTo === 'all') return sum + l.lineTotal;
      if (appliesTo === 'accessories' && (l.category === 'accessories' || l.category === 'bundles')) return sum + l.lineTotal;
      if (appliesTo === 'preowned' && l.condition === 'certified-preowned') return sum + l.lineTotal;
      return sum;
    }, 0);
  }

  function findPromo(catalog, code, now) {
    if (!code) return null;
    const wanted = String(code).trim().toUpperCase();
    const promo = (catalog.promos || []).find((p) => p.code.toUpperCase() === wanted);
    if (!promo) return { error: 'That code is not one of ours.' };
    if (promo.expires && new Date(promo.expires + 'T23:59:59+02:00') < now) {
      return { error: 'That code has expired.' };
    }
    return { promo };
  }

  function findZone(catalog, zoneId) {
    return (catalog.deliveryZones || []).find((z) => z.id === zoneId) || null;
  }

  /**
   * Price a whole basket.
   * @returns {{lines, subtotal, delivery, discount, total, zone, promo, promoError, itemCount, errors}}
   */
  function priceCart(catalog, input) {
    const opts = input || {};
    const now = opts.now ? new Date(opts.now) : new Date();
    const errors = [];

    const rawItems = Array.isArray(opts.items) ? opts.items.slice(0, MAX_LINES) : [];
    const lines = [];
    for (const item of rawItems) {
      const line = resolveItem(catalog, item);
      if (!line) { errors.push('An item in your basket is no longer available and was removed.'); continue; }
      if (!line.inStock) { errors.push(`${line.name} (${line.optionLabel}) is out of stock.`); continue; }
      const existing = lines.find((l) => l.key === line.key);
      if (existing) existing.qty = Math.min(existing.qty + line.qty, MAX_QTY, existing.stock);
      else lines.push(line);
    }
    for (const l of lines) l.lineTotal = l.unit * l.qty;

    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const itemCount = lines.reduce((s, l) => s + l.qty, 0);

    const zone = findZone(catalog, opts.zoneId);
    let delivery = zone ? zone.fee : 0;

    let discount = 0;
    let promo = null;
    let promoError = null;
    if (opts.promoCode) {
      const found = findPromo(catalog, opts.promoCode, now);
      if (found.error) {
        promoError = found.error;
      } else {
        const p = found.promo;
        const eligible = promoEligibleSubtotal(lines, p.appliesTo);
        if (subtotal < (p.minSubtotal || 0)) {
          promoError = `Spend at least ${formatZMW(p.minSubtotal)} to use ${p.code}.`;
        } else if (p.type !== 'shipping' && eligible <= 0) {
          promoError = `${p.code} only applies to ${p.appliesTo === 'preowned' ? 'pre-owned handsets' : 'accessories and bundles'}.`;
        } else {
          promo = p;
          if (p.type === 'percent') discount = Math.round((eligible * p.value) / 100);
          else if (p.type === 'fixed') discount = Math.min(p.value, eligible);
          else if (p.type === 'shipping') delivery = 0;
        }
      }
    }
    if (discount > subtotal) discount = subtotal;

    const total = Math.max(0, subtotal - discount) + delivery;

    return {
      lines, subtotal, delivery, discount, total, itemCount,
      zone: zone || null,
      promo: promo ? { code: promo.code, label: promo.label, type: promo.type } : null,
      promoError,
      errors,
    };
  }

  /** K31,500 — or K1,250.50 when there are odd ngwee. */
  function formatZMW(ngwee) {
    const n = Math.round(Number(ngwee) || 0);
    const kwacha = n / 100;
    const hasCents = n % 100 !== 0;
    return 'K' + kwacha.toLocaleString('en-ZM', {
      minimumFractionDigits: hasCents ? 2 : 0,
      maximumFractionDigits: hasCents ? 2 : 0,
    });
  }

  /** Trade-in valuation — same matrix on screen and on the server. */
  function valueTradeIn(catalog, input) {
    const t = catalog.tradeIn;
    const model = t.models.find((m) => m.id === (input && input.modelId));
    const grade = t.grades.find((g) => g.id === (input && input.gradeId));
    if (!model || !grade) return null;
    const storageBonus = t.storageBonus[String(input.storageId || '').toLowerCase()] || 0;
    const chosen = Array.isArray(input.deductions) ? input.deductions : [];
    const applied = t.deductions.filter((d) => chosen.includes(d.id));
    const deduction = applied.reduce((s, d) => s + d.amount, 0);
    const gross = Math.round((model.base + storageBonus) * grade.factor);
    const value = Math.max(0, gross - deduction);
    return {
      modelName: model.name, gradeName: grade.name, storageBonus, gross, deduction,
      deductionLabels: applied.map((d) => d.label), value,
    };
  }

  return { MAX_QTY, MAX_LINES, findProduct, resolveItem, priceCart, formatZMW, findZone, valueTradeIn };
});
