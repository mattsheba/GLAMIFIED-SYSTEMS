/* ============================================================
   GLAMIFIED SYSTEMS — SHARED JAVASCRIPT
   Nav, Footer, WhatsApp, Animations, Purchase Modal
   ============================================================ */

(function () {
  'use strict';

  const PHONE = '260977669883';
  const SITE  = 'https://glamifiedsystems.com';
  const LENCO_PUBLIC_KEY = 'pub-cd353f758b26d57cead328816d6e7691b9f0dcea6f5a9f7b';

  /* ─── LOAD LENCO SDK ────────────────────────────────────── */
  function preloadLencoSDK() {
    if (window.LencoPay?.getPaid) return;
    if (document.querySelector('script[src*="pay.lenco.co"]')) return;
    const s = document.createElement('script');
    s.src = 'https://pay.lenco.co/js/v1/inline.js';
    s.async = true;
    document.head.appendChild(s);
  }

  async function ensureLencoLoaded() {
    if (window.LencoPay?.getPaid) return;
    const existing = document.querySelector('script[src*="pay.lenco.co"]');
    if (!existing) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://pay.lenco.co/js/v1/inline.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    } else {
      // Script already loading (preloaded at page init) — poll until SDK is ready
      await new Promise((resolve, reject) => {
        const t0 = Date.now();
        const poll = setInterval(() => {
          if (window.LencoPay?.getPaid) { clearInterval(poll); resolve(); }
          else if (Date.now() - t0 > 5000) { clearInterval(poll); reject(new Error('LencoPay timed out')); }
        }, 50);
      });
    }
    if (!window.LencoPay?.getPaid) throw new Error('LencoPay failed to initialize');
  }

  /* ─── NAV HTML ─────────────────────────────────────────── */
  function buildNav() {
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    const active = (href) => {
      if (href === 'index.html' && (path === '/' || path.endsWith('index.html'))) return 'active';
      if (href !== 'index.html' && path.endsWith(href)) return 'active';
      return '';
    };
    return `
<nav id="site-nav">
  <a href="index.html" class="nav-logo" style="font-size:2.1rem;font-weight:800;letter-spacing:-1px;display:flex;align-items:center;gap:10px;">
    <img src="assets/logo.png" alt="GlamifiedSystems" style="height:52px;width:52px;mix-blend-mode:lighten;" />
    <span class="nav-logo-text" style="font-size:2.1rem;font-weight:800;line-height:1;">
      <span style="color:#fff;">Glamified</span><span style="color:var(--gold2);">Systems</span>
    </span>
  </a>
  <ul class="nav-links">
    <li><a href="glamifiedhr.html" class="${active('glamifiedhr.html')} nav-main-product" style="font-size:1.13em;font-weight:800;color:var(--gold2);letter-spacing:-.5px;">GlamifiedHR</a></li>
    <li><a href="jobs.html" class="${active('jobs.html')}">Jobs</a></li>
    <li><a href="cvpro.html" class="${active('cvpro.html')}">CVPro</a></li>
    <li><a href="consulting.html" class="${active('consulting.html')}">Consulting</a></li>
    <li><a href="about.html" class="${active('about.html')}">About</a></li>
    <li><a href="contact.html" class="${active('contact.html')}">Contact</a></li>
    <li><a href="glamifiedhr.html#pricing" class="nav-cta">Buy Now</a></li>
  </ul>
  <div class="nav-hamburger" id="hamburger" onclick="window.toggleMobileNav()">
    <span></span><span></span><span></span>
  </div>
</nav>
<nav class="mobile-nav" id="mobile-nav">
  <a href="index.html" class="${active('index.html')}">Home</a>
  <a href="glamifiedhr.html" class="${active('glamifiedhr.html')} nav-main-product" style="font-weight:800;color:var(--gold2);">GlamifiedHR</a>
  <a href="jobs.html" class="${active('jobs.html')}">Jobs</a>
  <a href="cvpro.html" class="${active('cvpro.html')}">CVPro Zambia</a>
  <a href="consulting.html" class="${active('consulting.html')}">Consulting</a>
  <a href="about.html" class="${active('about.html')}">About</a>
  <a href="contact.html" class="${active('contact.html')}">Contact</a>
  <a href="glamifiedhr.html#pricing" class="nav-cta-mobile" onclick="document.getElementById('mobile-nav').classList.remove('open')">Buy GlamifiedHR</a>
</nav>`;
  }

  /* ─── FOOTER HTML ───────────────────────────────────────── */
  function buildFooter() {
    return `
<footer id="site-footer">
  <div class="footer-grid">
    <div class="footer-brand">
      <div class="footer-brand-logo">
        <img src="assets/logo.png" alt="Glamified Systems" />
        <span>Glamified<em>Systems</em></span>
      </div>
      <p>Zambia's technology company. We build HR software, career platforms, and provide IT consulting and business solutions for Zambian organisations.</p>
      <div class="footer-products">
        <a href="glamifiedhr.html" class="footer-product-tag">
          <img src="assets/logo-cv.png" alt="GlamifiedHR" />
          <span>GlamifiedHR</span>
        </a>
        <a href="cvpro.html" class="footer-product-tag">
          <img src="assets/logo-hr.png" alt="CVPro Zambia" />
          <span>CVPro Zambia</span>
        </a>
        <a href="jobs.html" class="footer-product-tag">
          <span style="font-size:1rem;">💼</span>
          <span>Glamified Jobs</span>
        </a>
      </div>
    </div>
    <div class="footer-col">
      <h5>GlamifiedHR</h5>
      <ul>
        <li><a href="glamifiedhr.html#features">Features</a></li>
        <li><a href="glamifiedhr.html#pricing">Pricing</a></li>
        <li><a href="glamifiedhr.html#download">Download</a></li>
        <li><a href="glamifiedhr.html#compliance">Compliance</a></li>
        <li><a href="contact.html">Request demo</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h5>Platform</h5>
      <ul>
        <li><a href="jobs.html">Job listings</a></li>
        <li><a href="jobs.html#post">Post a job</a></li>
        <li><a href="https://cvprozambia.com/" target="_blank">Generate Cover Letter</a></li>
        <li><a href="https://cvprozambia.com" target="_blank">Build your CV</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h5>Consulting</h5>
      <ul>
        <li><a href="consulting.html#it">IT Services</a></li>
        <li><a href="consulting.html#business">Business Consulting</a></li>
        <li><a href="consulting.html#company-registration">Company Registration</a></li>
        <li><a href="consulting.html#business-documents">Business Documents</a></li>
        <li><a href="consulting.html#hr-advisory">HR Advisory</a></li>
        <li><a href="consulting.html#digital">Digital Presence</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h5>Company</h5>
      <ul>
        <li><a href="about.html">About us</a></li>
        <li><a href="contact.html">Contact</a></li>
        <li><a href="https://wa.me/${PHONE}" target="_blank">WhatsApp us</a></li>
        <li><a href="contact.html#quote">Get a quote</a></li>
      </ul>
    </div>
  </div>
  <div class="footer-bottom">
    <span>© 2026 Glamified Systems. All rights reserved. Lusaka, Zambia.</span>

  </div>
</footer>`;
  }

  /* ─── WHATSAPP BUTTON ───────────────────────────────────── */
  function buildWhatsApp() {
    return `
<div id="wa-float">
  <div id="wa-tooltip">Chat with us</div>
  <a href="https://wa.me/${PHONE}" target="_blank" aria-label="Chat on WhatsApp">
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  </a>
</div>`;
  }

  /* ─── PURCHASE MODAL ────────────────────────────────────── */
  function buildPurchaseModal() {
    return `
<div id="purchase-modal">
  <div class="modal-box">
    <button class="modal-close" onclick="window.closePurchaseModal()">×</button>
    <h3 style="font-size:1.3rem;margin-bottom:0.3rem;">Complete your purchase</h3>
    <p id="modal-plan-label" class="modal-plan"></p>
    <div class="form-row">
      <div class="form-group"><label>First name</label><input type="text" id="buy-name" placeholder="John" /></div>
      <div class="form-group"><label>Last name</label><input type="text" id="buy-lastname" placeholder="Banda" /></div>
    </div>
    <div class="form-group"><label>Email address</label><input type="email" id="buy-email" placeholder="john@company.com" /></div>
    <div class="form-group"><label>Phone (mobile money)</label><input type="tel" id="buy-phone" placeholder="097XXXXXXX" /></div>
    <div class="form-group">
      <label>Payment method</label>
      <select id="buy-method">
        <option value="">Select payment method</option>
        <option value="airtel">Airtel Money</option>
        <option value="mtn">MTN MoMo</option>
        <option value="card">Bank / Debit Card</option>
      </select>
    </div>
    <button class="form-submit" onclick="window.submitPurchase()">Proceed to payment →</button>
    <p style="font-size:0.75rem;color:var(--muted);text-align:center;margin-top:1rem;line-height:1.6;">
      Secure payment via Lenco. Your license key is emailed immediately after payment confirmation.
    </p>
  </div>
</div>`;
  }

  /* ─── INJECT EVERYTHING ─────────────────────────────────── */
  function init() {
    // Nav
    const navEl = document.getElementById('nav-container');
    if (navEl) navEl.outerHTML = buildNav();
    else document.body.insertAdjacentHTML('afterbegin', buildNav());

    // Footer
    const footerEl = document.getElementById('footer-container');
    if (footerEl) footerEl.outerHTML = buildFooter();
    else document.body.insertAdjacentHTML('beforeend', buildFooter());

    // WhatsApp
    document.body.insertAdjacentHTML('beforeend', buildWhatsApp());

    // Purchase Modal
    document.body.insertAdjacentHTML('beforeend', buildPurchaseModal());

    // Click outside modal to close
    document.getElementById('purchase-modal').addEventListener('click', function (e) {
      if (e.target === this) window.closePurchaseModal();
    });

    // Preconnect + background SDK preload so payment modal opens instantly
    if (!document.querySelector('link[rel="preconnect"][href*="pay.lenco.co"]')) {
      const pc = document.createElement('link');
      pc.rel = 'preconnect';
      pc.href = 'https://pay.lenco.co';
      document.head.appendChild(pc);
    }
    preloadLencoSDK();
  }

  /* ─── SCROLL EFFECTS ────────────────────────────────────── */
  function initScroll() {
    const nav = document.getElementById('site-nav');
    if (!nav) return;
    const update = () => nav.classList.toggle('scrolled', window.scrollY > 40);
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  /* ─── REVEAL ANIMATIONS ─────────────────────────────────── */
  function initReveal() {
    const els = document.querySelectorAll('.reveal');
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e, i) => {
        if (e.isIntersecting) {
          setTimeout(() => e.target.classList.add('visible'), i * 80);
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.08 });
    els.forEach(el => obs.observe(el));
  }

  /* ─── FAQ ACCORDION ─────────────────────────────────────── */
  function initFaq() {
    document.querySelectorAll('.faq-q').forEach(q => {
      q.addEventListener('click', () => {
        const item = q.closest('.faq-item');
        const wasOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
        if (!wasOpen) item.classList.add('open');
      });
    });
  }

  /* ─── PRICING TOGGLE ────────────────────────────────────── */
  window.toggleBilling = function (type) {
    const monthly = document.querySelectorAll('.price-monthly');
    const annual  = document.querySelectorAll('.price-annual');
    const btnM = document.getElementById('billing-monthly');
    const btnA = document.getElementById('billing-annual');

    if (type === 'monthly') {
      monthly.forEach(el => el.style.display = 'block');
      annual.forEach(el => el.style.display = 'none');
      if (btnM) { btnM.classList.add('active'); btnA.classList.remove('active'); }
    } else {
      monthly.forEach(el => el.style.display = 'none');
      annual.forEach(el => el.style.display = 'block');
      if (btnA) { btnA.classList.add('active'); btnM.classList.remove('active'); }
    }
  };

  /* ─── MOBILE NAV ────────────────────────────────────────── */
  window.toggleMobileNav = function () {
    document.getElementById('mobile-nav').classList.toggle('open');
  };

  /* ─── PURCHASE MODAL ────────────────────────────────────── */
  // Guards against double-submission while a Lenco prompt is active
  let _paymentInFlight = false;

  window.openPurchaseModal = function (plan, amount) {
    // If a payment is already in flight, don't allow re-opening
    if (_paymentInFlight) return;
    document.getElementById('modal-plan-label').textContent = plan + ' — K' + Number(amount).toLocaleString() + ' (one-time license)';
    document.getElementById('purchase-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
    // Store for submit
    window._purchasePlan = plan;
    window._purchaseAmount = amount;
  };

  window.closePurchaseModal = function () {
    document.getElementById('purchase-modal').classList.remove('open');
    document.body.style.overflow = '';
  };

  function _resetPaymentBtn() {
    const btn = document.querySelector('#purchase-modal .form-submit');
    if (btn) {
      btn.textContent = 'Proceed to payment →';
      btn.disabled = false;
    }
    _paymentInFlight = false;
  }

  window.submitPurchase = async function () {
    // Prevent firing a second payment while one is already active
    if (_paymentInFlight) return;

    const name     = (document.getElementById('buy-name').value + ' ' + document.getElementById('buy-lastname').value).trim();
    const email    = document.getElementById('buy-email').value.trim();
    const phone    = document.getElementById('buy-phone').value.trim();
    const method   = document.getElementById('buy-method').value;
    const plan     = window._purchasePlan;
    const amount   = window._purchaseAmount;

    if (!name || !email || !phone || !method) {
      alert('Please fill in all fields to continue.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert('Please enter a valid email address.');
      return;
    }

    const submitBtn = document.querySelector('#purchase-modal .form-submit');
    submitBtn.textContent = 'Loading payment...';
    submitBtn.disabled = true;
    _paymentInFlight = true;

    try {
      // Load Lenco SDK
      await ensureLencoLoaded();

      // Generate unique reference
      const reference = 'GLAM-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();

      // Map payment method to Lenco channel
      const channelMap = {
        'airtel': ['mobile-money'],
        'mtn': ['mobile-money'],
        'card': ['card']
      };
      const channels = channelMap[method] || ['mobile-money', 'card'];

      // Close our modal before Lenco opens theirs
      window.closePurchaseModal();

      // Open Lenco payment popup.
      // NOTE: getPaid() is callback-based and returns immediately — the button
      // must NOT be re-enabled in a finally block or it will be ready to fire
      // again while the phone prompt is still active. Only onSuccess / onClose
      // are allowed to reset state.
      window.LencoPay.getPaid({
        key: LENCO_PUBLIC_KEY,
        reference: reference,
        email: email,
        amount: amount,
        currency: 'ZMW',
        channels: channels,
        customer: {
          name: name,
          phone: phone
        },
        metadata: {
          plan: plan,
          product: 'GlamifiedHR'
        },
        onSuccess: function(response) {
          _paymentInFlight = false;
          // Payment successful — redirect to success page
          // The webhook will generate license key and email it
          const successUrl = `${SITE}/payment-success.html?ref=${reference}&plan=${encodeURIComponent(plan)}&email=${encodeURIComponent(email)}`;
          window.location.href = successUrl;
        },
        onClose: function() {
          // User cancelled or closed the Lenco screen — reset fully so they
          // can try again, but only by explicitly re-opening the modal.
          // Do NOT auto-resubmit — that would cause a second phone prompt.
          _resetPaymentBtn();
        }
      });

    } catch (err) {
      console.error('Payment error:', err);
      // Fallback to WhatsApp if Lenco fails to load
      const msg = encodeURIComponent(
        `Hi, I want to buy GlamifiedHR ${plan} (K${amount}). Name: ${name}, Email: ${email}, Phone: ${phone}`
      );
      window.open(`https://wa.me/${PHONE}?text=${msg}`, '_blank');
      window.closePurchaseModal();
      _resetPaymentBtn();
    }
    // No finally block — button state is managed exclusively by onSuccess/onClose/catch
    // to prevent re-enabling the button while a Lenco phone prompt is still active.
  };

  /* ─── CONTACT & JOB POST FORM ───────────────────────────── */
  window.handleContactForm = async function (e) {
    e.preventDefault();
    const form = e.target;
    const success = document.getElementById('form-success');

    // Detect if this is the job posting form (by structure)
    const isJobForm = Array.from(form.querySelectorAll('button, .form-submit')).some(btn => btn.textContent && btn.textContent.toLowerCase().includes('job posting'));

    if (isJobForm) {
      // Collect job form fields (order matches jobs.html)
      const [company, contactName] = form.querySelectorAll('input[type="text"]');
      const email = form.querySelector('input[type="email"]');
      const jobTitle = form.querySelectorAll('input[type="text"]')[2];
      const location = form.querySelectorAll('select')[0];
      const jobType = form.querySelectorAll('select')[1];
      const salary = form.querySelectorAll('input[type="text"]')[3];
      const description = form.querySelector('textarea');

      // Basic validation (HTML5 required covers most)
      if (!company.value || !contactName.value || !email.value || !jobTitle.value || !location.value || !jobType.value || !description.value) {
        alert('Please fill in all required fields.');
        return;
      }

      // Disable submit button
      const submitBtn = form.querySelector('.form-submit');
      if (submitBtn) { submitBtn.textContent = 'Submitting...'; submitBtn.disabled = true; }

      // Prepare payload
      const payload = {
        company: company.value,
        contactName: contactName.value,
        email: email.value,
        jobTitle: jobTitle.value,
        location: location.value,
        jobType: jobType.value,
        salary: salary.value,
        description: description.value
      };

      try {
        const res = await fetch('/api/submit-job', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          if (success) { success.style.display = 'block'; form.style.display = 'none'; }
        } else {
          const data = await res.json().catch(() => ({}));
          alert(data.error || 'Failed to submit job posting. Please try again later.');
        }
      } catch (err) {
        alert('Network error. Please try again later.');
      } finally {
        if (submitBtn) { submitBtn.textContent = 'Submit job posting →'; submitBtn.disabled = false; }
      }
      return;
    }

    // Default: contact form fallback
    if (success) { success.style.display = 'block'; form.style.display = 'none'; }
  };

  /* ─── TAB SWITCHER ──────────────────────────────────────── */
  window.switchTab = function (tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const tab = document.getElementById('tab-' + tabId);
    if (tab) tab.classList.add('active');
    if (btn) btn.classList.add('active');
  };

  /* ─── INIT ──────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init(); initScroll(); initReveal(); initFaq(); });
  } else {
    init(); initScroll(); initReveal(); initFaq();
  }

})();
