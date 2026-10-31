/* ============================================================
   iVOGUE LUSAKA — application shell
   Nav, footer, basket, catalogue loading, formatting, toasts.
   Every page loads: config.js → pricing.js → app.js
   ============================================================ */
(function () {
  'use strict';

  const CFG = window.SHOP_CONFIG;
  const P = window.IVPricing;
  const CART_KEY = 'ivogue.cart.v2';
  const CATALOG_TTL = 5 * 60 * 1000;

  /* ─── small helpers ─────────────────────────────────────── */
  const qs = (name, url) => new URLSearchParams((url || window.location.search)).get(name) || '';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => P.formatZMW(n);
  const el = (id) => document.getElementById(id);

  function waLink(text) {
    return `https://wa.me/${CFG.contact.whatsapp}?text=${encodeURIComponent(text)}`;
  }

  /* Lusaka trading hours, evaluated in Africa/Lusaka no matter where the shopper is. */
  function lusakaNow() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: CFG.store.timezone }));
  }
  function openState() {
    const now = lusakaNow();
    const day = now.getDay(); // 0 Sun … 6 Sat
    const row = day === 0 ? CFG.store.hours[2] : day === 6 ? CFG.store.hours[1] : CFG.store.hours[0];
    const [oh, om] = row.open.split(':').map(Number);
    const [ch, cm] = row.close.split(':').map(Number);
    const mins = now.getHours() * 60 + now.getMinutes();
    const open = mins >= oh * 60 + om && mins < ch * 60 + cm;
    return { open, row, closesAt: row.close, opensAt: row.open, beforeCutoff: now.getHours() < CFG.store.cutoffHour };
  }

  /* ─── catalogue ─────────────────────────────────────────── */
  let catalogPromise = null;
  function loadCatalog() {
    if (catalogPromise) return catalogPromise;
    const cached = (() => {
      try {
        const raw = sessionStorage.getItem('ivogue.catalog');
        if (!raw) return null;
        const { at, data } = JSON.parse(raw);
        return Date.now() - at < CATALOG_TTL ? data : null;
      } catch { return null; }
    })();
    if (cached) { catalogPromise = Promise.resolve(cached); return catalogPromise; }

    catalogPromise = fetch('/api/catalog', { headers: { accept: 'application/json' } })
      .then((r) => { if (!r.ok) throw new Error('api'); return r.json(); })
      .catch(() => fetch('data/catalog.json').then((r) => r.json()))
      .then((data) => {
        try { sessionStorage.setItem('ivogue.catalog', JSON.stringify({ at: Date.now(), data })); } catch {}
        return data;
      });
    return catalogPromise;
  }

  /* ─── basket ────────────────────────────────────────────── */
  function readCart() {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(raw) ? raw.filter((i) => i && i.productId && i.optionId && i.colorId).slice(0, P.MAX_LINES) : [];
    } catch { return []; }
  }
  function writeCart(items) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch {}
    document.dispatchEvent(new CustomEvent('cart:change', { detail: items }));
    paintCartCount();
  }
  const cart = {
    items: readCart,
    count() { return readCart().reduce((s, i) => s + (Number(i.qty) || 0), 0); },
    add(productId, optionId, colorId, qty) {
      const items = readCart();
      const found = items.find((i) => i.productId === productId && i.optionId === optionId && i.colorId === colorId);
      if (found) found.qty = Math.min(P.MAX_QTY, (Number(found.qty) || 1) + (qty || 1));
      else items.push({ productId, optionId, colorId, qty: Math.min(P.MAX_QTY, qty || 1) });
      writeCart(items);
    },
    setQty(key, qty) {
      const items = readCart().map((i) => {
        if (`${i.productId}|${i.optionId}|${i.colorId}` !== key) return i;
        return { ...i, qty: Math.max(1, Math.min(P.MAX_QTY, qty)) };
      });
      writeCart(items);
    },
    remove(key) {
      writeCart(readCart().filter((i) => `${i.productId}|${i.optionId}|${i.colorId}` !== key));
    },
    clear() { writeCart([]); },
    promo() { try { return localStorage.getItem('ivogue.promo') || ''; } catch { return ''; } },
    setPromo(code) { try { code ? localStorage.setItem('ivogue.promo', code) : localStorage.removeItem('ivogue.promo'); } catch {} },
    zone() { try { return localStorage.getItem('ivogue.zone') || 'lsk-central'; } catch { return 'lsk-central'; } },
    setZone(id) { try { localStorage.setItem('ivogue.zone', id); } catch {} },
  };
  function paintCartCount() {
    const n = cart.count();
    document.querySelectorAll('[data-cart-count]').forEach((node) => {
      node.textContent = n;
      node.style.display = n ? 'inline-flex' : 'none';
    });
  }

  /* ─── toast ─────────────────────────────────────────────── */
  function toast(message, href, linkText) {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
    const node = document.createElement('div');
    node.className = 'toast';
    node.innerHTML = `<span>${esc(message)}</span>${href ? `<a href="${esc(href)}">${esc(linkText || 'View')}</a>` : ''}`;
    wrap.appendChild(node);
    setTimeout(() => { node.style.opacity = '0'; node.style.transition = 'opacity .3s'; }, 3200);
    setTimeout(() => node.remove(), 3600);
  }

  /* ─── nav + footer ──────────────────────────────────────── */
  const NAV_LINKS = [
    ['shop.html', 'Shop'],
    ['shop.html?category=new-iphone', 'New iPhone'],
    ['shop.html?category=preowned', 'Pre-owned'],
    ['shop.html?category=accessories', 'Accessories'],
    ['trade-in.html', 'Trade-in'],
    ['visit.html', 'Visit us'],
  ];

  function buildNav() {
    const path = (location.pathname.split('/').pop() || 'index.html');
    const search = location.search;
    const isActive = (href) => {
      const [hp, hq] = href.split('?');
      if (hp !== path) return false;
      if (!hq) return !search || path !== 'shop.html';
      return search.includes(hq);
    };
    const links = NAV_LINKS.map(([href, label]) =>
      `<a href="${href}" class="${isActive(href) ? 'active' : ''}">${label}</a>`).join('');
    const state = openState();
    return `
<div class="announce">
  ${state.open
    ? `<b>Open now</b> · ${esc(CFG.store.addressLines[0])} · closes ${state.closesAt}`
    : `<b>Opens ${state.opensAt}</b> · order on WhatsApp any time`}
  &nbsp;·&nbsp; Same-day Lusaka delivery before ${CFG.store.cutoffHour}:00
</div>
<div class="nav">
  <div class="wrap nav-inner">
    <a href="index.html" class="nav-logo" aria-label="${esc(CFG.brand.name)} home">
      <img src="assets/logo.svg" alt="" width="30" height="30">
      <b>iVogue</b><span>&nbsp;Lusaka</span>
    </a>
    <nav class="nav-links" aria-label="Primary">${links}</nav>
    <div class="nav-actions">
      <a class="btn btn-clay btn-sm" href="${waLink(`Hi ${CFG.brand.name}, I have a question about an iPhone.`)}"
         target="_blank" rel="noopener" style="display:none" data-wa-nav>WhatsApp</a>
      <a class="cart-btn" href="cart.html" aria-label="Basket">
        Basket <span class="cart-count" data-cart-count style="display:none">0</span>
      </a>
      <button class="nav-toggle" aria-expanded="false" aria-controls="nav-drawer" aria-label="Menu">☰</button>
    </div>
  </div>
  <div class="nav-drawer" id="nav-drawer"><div class="wrap">${links}</div></div>
</div>`;
  }

  function buildFooter() {
    const c = CFG.contact, b = CFG.brand;
    const hours = CFG.store.hours.map((h) => `<div class="spread small" style="gap:.5rem"><span>${h.days}</span><span style="color:#8C8780">${h.open}–${h.close}</span></div>`).join('');
    return `
<div class="wrap">
  <div class="foot-grid">
    <div>
      <div class="foot-logo">iVogue<span>.</span></div>
      <p class="small" style="margin-top:.8rem;max-width:34ch;color:#A8A29A">${esc(b.promise)}</p>
      <p class="small" style="margin-top:1rem">${CFG.store.addressLines.map(esc).join('<br>')}</p>
      <p class="small" style="margin-top:.6rem"><a href="tel:${esc(c.phoneDial)}">${esc(c.phoneDisplay)}</a><br><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>
    </div>
    <div>
      <h4>Shop</h4>
      <div class="foot-links">
        <a href="shop.html?category=new-iphone">New iPhone</a>
        <a href="shop.html?category=preowned">Certified pre-owned</a>
        <a href="shop.html?category=accessories">Accessories</a>
        <a href="shop.html?category=bundles">Styled bundles</a>
        <a href="trade-in.html">Trade in your old phone</a>
      </div>
    </div>
    <div>
      <h4>Help</h4>
      <div class="foot-links">
        <a href="order.html">Track an order</a>
        <a href="warranty.html">Warranty &amp; returns</a>
        <a href="warranty.html#delivery">Delivery</a>
        <a href="visit.html">Visit the store</a>
        <a href="${waLink('Hi, I need help with an order.')}" target="_blank" rel="noopener">WhatsApp us</a>
      </div>
    </div>
    <div>
      <h4>Opening hours</h4>
      <div style="display:grid;gap:.35rem">${hours}</div>
      <div class="foot-links" style="margin-top:1rem">
        <a href="https://instagram.com/${esc(c.instagram)}" target="_blank" rel="noopener">Instagram</a>
        <a href="https://facebook.com/${esc(c.facebook)}" target="_blank" rel="noopener">Facebook</a>
      </div>
    </div>
  </div>
  <div class="foot-bottom">
    <span>© <span data-year></span> ${esc(b.name)} — a ${esc(b.legalName)} store. Lusaka, Zambia.</span>
    <span style="display:flex;gap:1.2rem;flex-wrap:wrap">
      <a href="privacy.html">Privacy</a><a href="terms.html">Terms</a>
      <span>Airtel Money · MTN MoMo · Zamtel Kwacha · Visa · Mastercard</span>
    </span>
  </div>
</div>`;
  }

  function mountShell() {
    const navRoot = el('nav-root');
    if (navRoot) {
      navRoot.innerHTML = buildNav();
      const toggle = navRoot.querySelector('.nav-toggle');
      const drawer = el('nav-drawer');
      toggle?.addEventListener('click', () => {
        const open = drawer.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(open));
      });
      if (window.innerWidth > 900) navRoot.querySelector('[data-wa-nav]')?.style.removeProperty('display');
    }
    const footRoot = el('footer-root');
    if (footRoot) footRoot.innerHTML = buildFooter();

    document.querySelectorAll('[data-year]').forEach((n) => { n.textContent = lusakaNow().getFullYear(); });

    if (!document.querySelector('.wa-float')) {
      const a = document.createElement('a');
      a.className = 'wa-float';
      a.href = waLink(`Hi ${CFG.brand.name}, I'm on the website and I have a question.`);
      a.target = '_blank'; a.rel = 'noopener'; a.setAttribute('aria-label', 'Chat on WhatsApp');
      a.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2m0 1.67c2.2 0 4.27.86 5.82 2.42a8.2 8.2 0 0 1 2.42 5.82c0 4.54-3.7 8.24-8.25 8.24a8.2 8.2 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.26-8.24m-2.6 4.1c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1s.9 2.44 1.03 2.6c.12.17 1.76 2.68 4.26 3.76.6.26 1.06.41 1.42.53.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.19.2-.58.2-1.08.15-1.18-.06-.1-.23-.16-.48-.29-.25-.12-1.47-.72-1.7-.8-.23-.09-.4-.13-.56.12-.17.25-.64.8-.79.97-.14.16-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.1-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.76-1.85-.2-.48-.4-.42-.56-.43h-.48Z"/></svg>`;
      document.body.appendChild(a);
    }
    paintCartCount();
  }

  /* ─── scroll reveal ─────────────────────────────────────── */
  function mountReveal() {
    const nodes = document.querySelectorAll('.reveal');
    if (!nodes.length) return;
    if (!('IntersectionObserver' in window)) { nodes.forEach((n) => n.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    nodes.forEach((n) => io.observe(n));
  }

  /* ─── product helpers ───────────────────────────────────── */
  function fromPrice(product) {
    return Math.min(...product.options.map((o) => o.price));
  }
  function compareAtFor(product) {
    const cheapest = product.options.reduce((a, b) => (a.price <= b.price ? a : b));
    return cheapest.compareAt || null;
  }
  function totalStock(product) {
    return product.options.reduce((s, o) => s + (Number(o.stock) || 0), 0);
  }
  function art(productId, colorId) { return `assets/devices/${productId}--${colorId}.svg`; }

  function productCard(product) {
    const price = fromPrice(product);
    const was = compareAtFor(product);
    const stock = totalStock(product);
    const first = product.colors[0];
    const flags = [];
    if (was) flags.push(`<span class="badge badge-sale">Save ${money(was - price)}</span>`);
    if (product.condition === 'certified-preowned') flags.push('<span class="badge badge-ink">Certified pre-owned</span>');
    if (stock > 0 && stock <= 2) flags.push(`<span class="badge badge-warn">${stock} left</span>`);
    if (stock === 0) flags.push('<span class="badge badge-ink">Sold out</span>');
    return `
<a class="card" href="product.html?id=${encodeURIComponent(product.id)}">
  <div class="card-media">
    <img src="${art(product.id, first.id)}" alt="${esc(product.name)} in ${esc(first.name)}" loading="lazy" width="380" height="420">
    <div class="card-flags">${flags.join('')}</div>
  </div>
  <div class="card-body">
    <div class="card-name">${esc(product.name)}</div>
    <div class="card-tag">${esc(product.tagline || '')}</div>
    <div class="swatches">${product.colors.slice(0, 6).map((c) =>
      `<span class="swatch-dot" style="background:${esc(c.hex)}" title="${esc(c.name)}"></span>`).join('')}</div>
    <div class="card-price">
      <span class="price">${product.options.length > 1 ? 'From ' : ''}${money(price)}</span>
      ${was ? `<span class="price-was">${money(was)}</span>` : ''}
    </div>
  </div>
</a>`;
  }

  /* ─── boot ──────────────────────────────────────────────── */
  function boot() { mountShell(); mountReveal(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.IV = {
    cfg: CFG, qs, esc, money, waLink, loadCatalog, cart, toast, productCard,
    art, fromPrice, totalStock, openState, lusakaNow, paintCartCount, mountReveal,
  };
})();
