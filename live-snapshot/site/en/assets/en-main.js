/* TRUST — shared scripts for the English pages: mobile menu, tracking, contact form.
   Same behaviour as /assets/js/main.js on the Arabic pages, with English texts. */
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

// Signed-in clients see "My account" instead of "Client login"
try {
  if (localStorage.getItem('sb-jbeiipdxcyzdqarxzbyo-auth-token')) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-account]'), function (a) { a.textContent = 'My account'; });
  }
} catch (e) {}

// Privacy-friendly measurement hooks (same as the Arabic pages)
window.TRUST_TRACK = function (name, props) {
  try {
    props = props || {}; props.lang = 'en';
    (window.TRUST_EVENTS = window.TRUST_EVENTS || []).push({ e: name, p: props, t: Date.now() });
    if (typeof window.TRUST_ANALYTICS === 'function') window.TRUST_ANALYTICS(name, props);
  } catch (e) {}
};
document.addEventListener('click', function (e) {
  var a = e.target.closest ? e.target.closest('[data-ev], a[href*="wa.me/"]') : null;
  if (!a) return;
  window.TRUST_TRACK(a.getAttribute('data-ev') || 'whatsapp_click', { main: a.getAttribute('data-main') || undefined, page: location.pathname });
});
try {
  if (!sessionStorage.getItem('trust_src')) {
    var q = new URLSearchParams(location.search), src = {};
    ['utm_source', 'utm_medium', 'utm_campaign'].forEach(function (k) { var v = q.get(k); if (v) src[k] = v.slice(0, 60); });
    if (document.referrer) { var h = new URL(document.referrer).hostname; if (h && h !== location.hostname) src.ref = h; }
    src.landing = location.pathname;
    sessionStorage.setItem('trust_src', JSON.stringify(src));
  }
} catch (e) {}

// Contact form
var form = document.getElementById('contact-form');
if (!form) return;

// English names shown in the form; the request itself keeps the service ids and the Arabic
// service name (window.TRUST_SERVICES), so requests look the same in the CRM whatever the language.
var EN = {
  mains: { 'accounting-systems': 'Accounting & administrative systems setup', 'financial-management': 'Financial management & periodic follow-up', 'feasibility-growth': 'Feasibility studies & growth and financing decisions' },
  subs: {
    'accounting-cycle': 'Setting up and organising the accounting cycle', 'records-review': 'Organising accounts and reviewing records', 'accounting-system-design': 'Designing accounting systems and forms',
    'internal-controls': 'Improving procedures and internal controls', 'forms-workflow': 'Designing forms and workflows', 'excel-accounting': 'Excel-based accounting systems', 'automation': 'Automating recurring finance tasks',
    'financial-statements': 'Preparing financial statements', 'closing': 'Periodic reconciliations and closings', 'financial-analysis': 'Financial analysis and ratio interpretation', 'budgeting': 'Preparing budgets',
    'cash-flow': 'Cash flow and financial planning', 'cost-profitability': 'Cost and profitability analysis', 'management-reporting': 'Management reports and KPI dashboards', 'report-design': 'Developing management reports',
    'process-efficiency': 'Improving operational efficiency', 'kpi-design': 'Defining key performance indicators', 'budget-template': 'Budget templates', 'dashboards': 'Interactive reports and dashboards',
    'data-analysis': 'Data analysis models and periodic reports', 'feasibility-study': 'Economic and financial feasibility studies', 'business-plan': 'Preparing business plans', 'financial-model': 'Building financial models',
    'break-even': 'Break-even analysis', 'scenarios': 'Assessing investment scenarios', 'growth-plan': 'Growth and expansion plans', 'decision-support': 'Financial and operational decision support'
  },
  sectors: { restaurants: 'Restaurants & cafés', retail: 'Retail shops', factories: 'Small factories & workshops', services: 'Service companies', contracting: 'Contracting', wholesale: 'Distribution & wholesale', home: 'Home-based & online businesses', startup: 'Entrepreneurs & start-ups', medium: 'Medium-sized companies', other: 'Other activity' }
};

var params = new URLSearchParams(window.location.search);
var SV = window.TRUST_SERVICES || { mains: [], subs: [], sectors: {} };
var sel = form.querySelector('#f-main');
var subSel = form.querySelector('#f-sub');
var subWrap = document.getElementById('f-sub-wrap');
var secSel = form.querySelector('#f-sector');
var svcField = form.querySelector('#f-service');
var SPECIAL = { session: 'جلسة استشارية أولية', unsure: 'غير متأكد، أحتاج توجيهاً' };
var SPECIAL_EN = { session: 'Initial consultation session', unsure: 'Not sure, I need guidance' };

var sectorKeys = Object.keys(SV.sectors).length ? Object.keys(SV.sectors) : Object.keys(EN.sectors);
if (secSel) sectorKeys.forEach(function (k) { var o = document.createElement('option'); o.value = k; o.textContent = EN.sectors[k] || SV.sectors[k] || k; secSel.appendChild(o); });

function subsOf(mainId) {
  return SV.subs.filter(function (x) { return x.main === mainId; });
}
function fillSubs(mainId, keep) {
  if (!subSel) return;
  while (subSel.options.length > 1) subSel.remove(1);
  var list = subsOf(mainId);
  list.forEach(function (x) { var o = document.createElement('option'); o.value = x.id; o.textContent = EN.subs[x.id] || x.name; subSel.appendChild(o); });
  subSel.value = list.some(function (x) { return x.id === keep; }) ? keep : '';
  if (subWrap) subWrap.classList.toggle('hidden', !list.length);
}
function mainName(id, en) {
  if (SPECIAL[id]) return en ? SPECIAL_EN[id] : SPECIAL[id];
  if (en && EN.mains[id]) return EN.mains[id];
  var m = SV.mains.filter(function (x) { return x.id === id; })[0]; return m ? m.name : (EN.mains[id] || '');
}
function subName(id, en) {
  if (en && EN.subs[id]) return EN.subs[id];
  var m = SV.subs.filter(function (x) { return x.id === id; })[0]; return m ? m.name : (EN.subs[id] || '');
}
function serviceLabel(en) { return (subSel && subSel.value ? subName(subSel.value, en) : '') || mainName(sel.value, en); }
function syncService() { if (svcField) svcField.value = serviceLabel(false); }
window.TRUST_SERVICE_LABEL = function () { return serviceLabel(false); };

// Prefill from links: ?main=&sub=&sector=&plan=
var pMain = params.get('main'), pSub = params.get('sub'), pSector = params.get('sector');
if (pMain && !(SPECIAL[pMain] || EN.mains[pMain])) pMain = null;
if (pSub && !pMain) { var ps = SV.subs.filter(function (x) { return x.id === pSub; })[0]; if (ps) pMain = ps.main; }
if (pMain && sel && Array.prototype.some.call(sel.options, function (o) { return o.value === pMain; })) sel.value = pMain;
fillSubs(sel ? sel.value : '', pSub);
if (pSector && secSel && (SV.sectors[pSector] || EN.sectors[pSector])) secSel.value = pSector;
var PLANS = { start: 'Start plan ($250 a month)', growth: 'Growth plan ($650 a month)', enterprise: 'Enterprise plan (custom price)' };
var pPlan = params.get('plan'), planField = form.querySelector('#f-plan'), planNote = document.getElementById('f-plan-note');
if (pPlan && PLANS[pPlan] && planField) {
  planField.value = pPlan;
  if (planNote) { planNote.textContent = 'Selected plan: ' + PLANS[pPlan] + '. You can add any details in the description of your need.'; planNote.classList.remove('hidden'); }
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
  return !!r && r.value === 'بريد إلكتروني';   // value kept as on the Arabic form (used by the CRM)
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
  if (hint) hint.textContent = need ? 'Required because you chose to be contacted by email.' : 'Optional';
  if (!need && !email.value.trim()) setErr(email, '');
}
Array.prototype.forEach.call(form.querySelectorAll('input[name="contact_method"]'), function (r) { r.addEventListener('change', syncEmailRequirement); });

function validate() {
  var ok = true, first = null;
  var name = form.querySelector('#f-name'), phone = form.querySelector('#f-phone'), email = form.querySelector('#f-email');
  var need = form.querySelector('#f-need'), consent = form.querySelector('#f-consent');
  if (name.value.trim().length < 2) { setErr(name, 'Please enter your name.'); ok = false; first = first || name; } else setErr(name, '');
  var digits = phone.value.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) { setErr(phone, 'Please enter a valid phone number, e.g. 0599123456.'); ok = false; first = first || phone; } else setErr(phone, '');
  var ev = email.value.trim();
  if (emailPreferred() && !ev) { setErr(email, 'You chose to be contacted by email, so please enter your email.'); ok = false; first = first || email; }
  else if (ev && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(ev)) { setErr(email, 'The email format is not valid, e.g. name@example.com'); ok = false; first = first || email; }
  else setErr(email, '');
  if (!sel.value) { setErr(sel, 'Please choose the type of request or service.'); ok = false; first = first || sel; } else setErr(sel, '');
  if (need.value.trim().length < 10) { setErr(need, 'Please describe your need briefly (at least 10 characters).'); ok = false; first = first || need; } else setErr(need, '');
  if (!consent.checked) { setErr(consent, 'You need to agree to the privacy policy to send the request.'); ok = false; first = first || consent; } else setErr(consent, '');
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
  if (submit.disabled) return;
  syncService();
  if (!validate()) return;
  submit.disabled = true; var label = submit.textContent; submit.textContent = 'Sending…';
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
      var txt = 'Hello TRUST, I would like to ask about your services in ' + (serviceLabel(true) || 'accounting and financial services') + '. Please send me the details.';
      var a = document.getElementById('form-err-wa');
      if (a) a.href = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(txt);
      errBox.classList.remove('hidden'); errBox.focus();
    })
    .then(function () { submit.disabled = false; submit.textContent = label; });
});
})();
