/* TRUST — shared scripts: mobile menu, WhatsApp links, contact form */
(function () {
  'use strict';
  var WA = '970599371188';

  // Mobile menu
  var btn = document.querySelector('.menu-btn');
  var nav = document.getElementById('site-nav');
  if (btn && nav) {
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') { nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) { nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
    });
  }

  // Footer year
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  // Signed-in clients see "حسابي" instead of "دخول العملاء"
  try {
    if (localStorage.getItem('sb-jbeiipdxcyzdqarxzbyo-auth-token')) {
      Array.prototype.forEach.call(document.querySelectorAll('[data-account]'), function (a) { a.textContent = 'حسابي'; });
    }
  } catch (e) {}

  // Privacy-friendly measurement hooks: events stay in the page (window.TRUST_EVENTS) until an
  // approved analytics tool is connected through window.TRUST_ANALYTICS. No personal data is ever passed.
  window.TRUST_TRACK = function (name, props) {
    try {
      (window.TRUST_EVENTS = window.TRUST_EVENTS || []).push({ e: name, p: props || {}, t: Date.now() });
      if (typeof window.TRUST_ANALYTICS === 'function') window.TRUST_ANALYTICS(name, props || {});
    } catch (e) {}
  };
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('[data-ev], a[href*="wa.me/"]') : null;
    if (!a) return;
    window.TRUST_TRACK(a.getAttribute('data-ev') || 'whatsapp_click', { main: a.getAttribute('data-main') || undefined, sub: a.getAttribute('data-sub') || undefined, page: location.pathname });
  });
  // Visit source (campaign tags / referring site only) kept for this browser session
  try {
    if (!sessionStorage.getItem('trust_src')) {
      var q = new URLSearchParams(location.search), src = {};
      ['utm_source', 'utm_medium', 'utm_campaign'].forEach(function (k) { var v = q.get(k); if (v) src[k] = v.slice(0, 60); });
      if (document.referrer) { var h = new URL(document.referrer).hostname; if (h && h !== location.hostname) src.ref = h; }
      src.landing = location.pathname;
      sessionStorage.setItem('trust_src', JSON.stringify(src));
    }
  } catch (e) {}
  // Copy a shareable link to a sub-service
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('[data-share]') : null;
    if (!a || !navigator.clipboard) return;
    e.preventDefault();
    var url = location.origin + location.pathname + a.getAttribute('href');
    history.replaceState(null, '', a.getAttribute('href'));
    navigator.clipboard.writeText(url).then(function () { var t = a.textContent; a.textContent = 'تم نسخ الرابط ✓'; setTimeout(function () { a.textContent = t; }, 1800); }, function () {});
  });

  // Sub-service cards: collapsed on phones, the shared/targeted one stays open
  var subs = document.querySelectorAll('details.sub-d');
  if (subs.length) {
    var openTarget = function () { var id = (location.hash || '').slice(1); var t = id && document.getElementById(id); var d = t && t.querySelector && t.querySelector('details.sub-d'); if (d) d.open = true; };
    if (window.matchMedia && window.matchMedia('(max-width:700px)').matches) Array.prototype.forEach.call(subs, function (d) { d.open = false; });
    openTarget(); window.addEventListener('hashchange', openTarget);
    // on wide screens the cards stay open
    Array.prototype.forEach.call(subs, function (d) { d.querySelector('summary').addEventListener('click', function (e) { if (!window.matchMedia('(max-width:700px)').matches) e.preventDefault(); }); });
  }

  // Contact form
  var form = document.getElementById('contact-form');
  if (!form) return;

  var params = new URLSearchParams(window.location.search);
  var SV = window.TRUST_SERVICES || { mains: [], subs: [], sectors: {} };
  var sel = form.querySelector('#f-main');
  var subSel = form.querySelector('#f-sub');
  var subWrap = document.getElementById('f-sub-wrap');
  var secSel = form.querySelector('#f-sector');
  var svcField = form.querySelector('#f-service');
  var SPECIAL = { session: 'جلسة استشارية أولية', unsure: 'غير متأكد، أحتاج توجيهاً' };

  if (secSel) Object.keys(SV.sectors).forEach(function (k) { var o = document.createElement('option'); o.value = k; o.textContent = SV.sectors[k]; secSel.appendChild(o); });

  function fillSubs(mainId, keep) {
    if (!subSel) return;
    while (subSel.options.length > 1) subSel.remove(1);
    var list = SV.subs.filter(function (x) { return x.main === mainId; });
    list.forEach(function (x) { var o = document.createElement('option'); o.value = x.id; o.textContent = x.name; subSel.appendChild(o); });
    // never keep a sub-service that does not belong to the chosen main service
    subSel.value = list.some(function (x) { return x.id === keep; }) ? keep : '';
    if (subWrap) subWrap.classList.toggle('hidden', !list.length);
  }
  function mainName(id) { if (SPECIAL[id]) return SPECIAL[id]; var m = SV.mains.filter(function (x) { return x.id === id; })[0]; return m ? m.name : ''; }
  function subName(id) { var m = SV.subs.filter(function (x) { return x.id === id; })[0]; return m ? m.name : ''; }
  function serviceLabel() { return (subSel && subSel.value ? subName(subSel.value) : '') || mainName(sel.value); }
  function syncService() { if (svcField) svcField.value = serviceLabel(); }
  window.TRUST_SERVICE_LABEL = serviceLabel;

  // Prefill from links: ?main=&sub=&sector= (new) or ?service=<Arabic name> (old links)
  var pMain = params.get('main'), pSub = params.get('sub'), pSector = params.get('sector'), pOld = params.get('service');
  if (pMain && !(SPECIAL[pMain] || SV.mains.some(function (x) { return x.id === pMain; }))) pMain = null; // ignore unknown values
  if (pSub && !pMain) { var ps = SV.subs.filter(function (x) { return x.id === pSub; })[0]; if (ps) pMain = ps.main; }
  if (pOld && !pMain) {
    var t = pOld.trim();
    var hit = SV.subs.filter(function (x) { return x.name === t; })[0];
    if (hit) { pMain = hit.main; pSub = hit.id; }
    else if (t === SPECIAL.session) pMain = 'session';
    else if (t === SPECIAL.unsure || t.indexOf('غير متأكد') === 0) pMain = 'unsure';
    else { var hm = SV.mains.filter(function (x) { return x.name === t; })[0]; pMain = hm ? hm.id : 'unsure'; }
  }
  if (pMain && sel && Array.prototype.some.call(sel.options, function (o) { return o.value === pMain; })) sel.value = pMain;
  fillSubs(sel ? sel.value : '', pSub);
  if (pSector && secSel && SV.sectors[pSector]) secSel.value = pSector;
  var PLANS = { start: 'الباقة الأساسية ($200 شهرياً)', growth: 'الباقة المتقدمة ($450 شهرياً)', enterprise: 'الباقة الشاملة (سعر مخصص)' };
  var pPlan = params.get('plan'), planField = form.querySelector('#f-plan'), planNote = document.getElementById('f-plan-note');
  if (pPlan && PLANS[pPlan] && planField) {
    planField.value = pPlan;
    if (planNote) { planNote.textContent = 'الباقة المختارة: ' + PLANS[pPlan] + '. يمكنك إضافة أي تفاصيل في وصف الاحتياج.'; planNote.classList.remove('hidden'); }
  }
  syncService();
  if (sel) sel.addEventListener('change', function () { fillSubs(sel.value, subSel ? subSel.value : ''); syncService(); setErr(sel, ''); });
  if (subSel) subSel.addEventListener('change', syncService);

  function setErr(el, msg) {
    var box = document.getElementById(el.id + '-msg');
    el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (box) box.textContent = msg || '';
  }

  function emailPreferred() {
    var r = form.querySelector('input[name="contact_method"]:checked');
    return !!r && r.value === 'بريد إلكتروني';
  }
  function syncEmailRequirement() {
    var email = form.querySelector('#f-email');
    var lab = form.querySelector('label[for="f-email"]');
    var need = emailPreferred();
    email.required = need;
    email.setAttribute('aria-required', need ? 'true' : 'false');
    if (lab) {
      var star = lab.querySelector('.req');
      if (need && !star) { star = document.createElement('span'); star.className = 'req'; star.setAttribute('aria-hidden', 'true'); star.textContent = ' *'; lab.appendChild(star); }
      if (!need && star) star.remove();
    }
    var hint = document.getElementById('f-email-hint');
    if (hint) hint.textContent = need ? 'مطلوب لأنك اخترت التواصل بالبريد الإلكتروني.' : 'اختياري';
    if (!need && !email.value.trim()) setErr(email, '');
  }
  Array.prototype.forEach.call(form.querySelectorAll('input[name="contact_method"]'), function (r) { r.addEventListener('change', syncEmailRequirement); });

  function validate() {
    var ok = true, first = null;
    var name = form.querySelector('#f-name');
    var phone = form.querySelector('#f-phone');
    var email = form.querySelector('#f-email');
    var need = form.querySelector('#f-need');
    var consent = form.querySelector('#f-consent');

    if (name.value.trim().length < 2) { setErr(name, 'الرجاء كتابة الاسم.'); ok = false; first = first || name; } else setErr(name, '');
    var digits = phone.value.replace(/\D/g, '');
    if (digits.length < 9 || digits.length > 15) { setErr(phone, 'الرجاء إدخال رقم هاتف صحيح، مثل 0599123456.'); ok = false; first = first || phone; } else setErr(phone, '');
    var wantsEmail = emailPreferred();
    var ev = email.value.trim();
    if (wantsEmail && !ev) { setErr(email, 'اخترت التواصل بالبريد الإلكتروني، فالرجاء كتابة بريدك.'); ok = false; first = first || email; }
    else if (ev && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(ev)) { setErr(email, 'صيغة البريد الإلكتروني غير صحيحة، مثل name@example.com'); ok = false; first = first || email; }
    else setErr(email, '');
    if (!sel.value) { setErr(sel, 'الرجاء اختيار نوع الطلب أو الخدمة.'); ok = false; first = first || sel; } else setErr(sel, '');
    if (need.value.trim().length < 10) { setErr(need, 'الرجاء وصف احتياجك باختصار (10 أحرف على الأقل).'); ok = false; first = first || need; } else setErr(need, '');
    if (!consent.checked) { setErr(consent, 'يجب الموافقة على سياسة الخصوصية لإرسال الطلب.'); ok = false; first = first || consent; } else setErr(consent, '');
    if (first) first.focus();
    return ok;
  }

  syncEmailRequirement();
  var okBox = document.getElementById('form-ok');
  var errBox = document.getElementById('form-err');
  var submit = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    okBox.classList.add('hidden'); errBox.classList.add('hidden');
    if (submit.disabled) return; // prevent double submit
    syncService();
    if (!validate()) return;
    submit.disabled = true; var label = submit.textContent; submit.textContent = 'جارٍ الإرسال…';
    var send = window.TRUST_SUBMIT ? window.TRUST_SUBMIT(form)
      : fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(new FormData(form)).toString() })
          .then(function (r) { return r.ok; });
    send
      .then(function (ok) {
        if (!ok) throw new Error('not sent');
        form.reset(); form.classList.add('hidden');
        okBox.classList.remove('hidden'); okBox.focus();
        window.TRUST_TRACK('request_success', { form: 'contact' });
      })
      .catch(function () {
        var txt = 'مرحبًا TRUST، أرغب في الاستفسار عن خدماتكم في مجال ' + (serviceLabel() || 'الخدمات المالية والمحاسبية') + '. أرجو تزويدي بالمعلومات اللازمة.';
        var a = document.getElementById('form-err-wa');
        if (a) a.href = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(txt);
        errBox.classList.remove('hidden'); errBox.focus();
      })
      .then(function () { submit.disabled = false; submit.textContent = label; });
  });
})();
