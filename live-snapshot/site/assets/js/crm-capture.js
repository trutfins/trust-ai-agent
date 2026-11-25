/* TRUST — sends public form submissions to the CRM (Supabase "leads" table).
   TRUST_SB.forms = 'netlify'  → also posts to Netlify Forms (email notifications), CRM gets a copy.
   TRUST_SB.forms = 'supabase' → CRM only (any static host, e.g. Cloudflare Pages).
   The browser can only ADD a lead — it can never read any lead back. */
(function () {
  'use strict';
  var SB = window.TRUST_SB;
  if (!SB || !window.fetch) return;

  function v(fd, k) { var x = fd.get(k); return (typeof x === 'string') ? x.trim() : ''; }
  function cut(s, n) { return s ? s.slice(0, n) : null; }
  function digits(s) { return (s || '').replace(/\D/g, ''); }
  // campaign tags / referring site of this visit (never personal data)
  function src() { try { var x = JSON.parse(sessionStorage.getItem('trust_src') || 'null'); return x || undefined; } catch (e) { return undefined; } }

  var MAP = {
    'trust-consultations': function (fd) {
      return { source: 'consultation', full_name: v(fd, 'person'), phone: v(fd, 'phone'), email: v(fd, 'email'),
        business: v(fd, 'business'), service: v(fd, 'service'), message: v(fd, 'details'), details: { src: src() },
        ok: fd.get('consent') !== null, honey: v(fd, 'bot-field') };
    },
    'contact': function (fd) {
      return { source: 'contact', full_name: v(fd, 'name'), phone: v(fd, 'phone'), email: v(fd, 'email'),
        business: v(fd, 'organization'), service: v(fd, 'service'), message: v(fd, 'need'),
        details: { contact_method: v(fd, 'contact_method'), main_service: v(fd, 'main_service') || undefined, sub_service: v(fd, 'sub_service') || undefined,
          sector: v(fd, 'sector') || undefined, plan: v(fd, 'plan') || undefined, marketing_ok: fd.get('marketing_ok') ? true : undefined, src: src() },
        ok: fd.get('privacy_consent') !== null && v(fd, 'need').length >= 10 && (v(fd, 'contact_method') !== 'بريد إلكتروني' || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v(fd, 'email'))), honey: v(fd, 'bot-field') };
    },
    'health-check': function (fd) {
      return { source: 'health_check', full_name: v(fd, 'name'), phone: v(fd, 'phone'), email: '',
        business: v(fd, 'business'), service: 'فحص الصحة المالية', message: '',
        details: { score: v(fd, 'score'), band: v(fd, 'band'), weak_areas: v(fd, 'weak_areas'), activity: v(fd, 'activity'), src: src() },
        ok: true, honey: v(fd, 'company_website') };
    }
  };

  var NETLIFY = (SB.forms || 'netlify') === 'netlify';

  // Build the CRM row for a form. Returns null when the data is not good enough, {spam:true} for bots.
  function build(form) {
    var name = form && form.getAttribute && form.getAttribute('name');
    if (!name || !MAP[name]) return null;
    var d = MAP[name](new FormData(form));
    if (d.honey) return { spam: true };
    if (!d.ok || d.full_name.length < 2 || digits(d.phone).length < 9) return null;
    return {
        source: d.source, full_name: cut(d.full_name, 120), phone: cut(d.phone, 40), email: cut(d.email, 200),
        business: cut(d.business, 160), service: cut(d.service, 120), message: cut(d.message, 3000), details: d.details
    };
  }
  function insert(body) {
    return fetch(SB.url + '/rest/v1/leads', {
      method: 'POST', keepalive: true,
      headers: { 'apikey': SB.key, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.ok; }, function () { return false; });
  }
  function toNetlify(form) {
    return fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(new FormData(form)).toString() }).then(function (r) { return r.ok; }, function () { return false; });
  }

  // Used by the pages' own scripts: resolves true when the request reached TRUST.
  window.TRUST_SUBMIT = function (form) {
    var body;
    try { body = build(form); } catch (e) { body = null; }
    if (body && body.spam) return Promise.resolve(true);
    var jobs = [body ? insert(body) : Promise.resolve(false)];
    if (NETLIFY) jobs.push(toNetlify(form));
    return Promise.all(jobs).then(function (r) { return r.indexOf(true) !== -1; });
  };

  // The consultation form submits natively on Netlify; elsewhere it is sent here and then redirected.
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || !form.getAttribute || form.getAttribute('name') !== 'trust-consultations') return;
    if (e.defaultPrevented) return; // the page's validation stopped it
    if (NETLIFY) {
      try { var body = build(form); if (body && !body.spam) insert(body); } catch (err) { /* never block the form */ }
      return;
    }
    e.preventDefault();
    var btn = form.querySelector('button[type=submit]'), msg = document.getElementById('consErr');
    window.TRUST_SUBMIT(form).then(function (ok) {
      if (ok) { location.href = form.getAttribute('action') || '/consultation-success.html'; return; }
      if (btn) { btn.disabled = false; btn.textContent = 'إرسال الطلب'; }
      if (msg) msg.textContent = 'تعذّر الإرسال الآن. بياناتك ما زالت في النموذج، حاول مرة أخرى أو راسلنا على واتساب.';
    });
  }, false);
})();
