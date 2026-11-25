/* =============================================================================
   app.js — shell, navigation, period bar and routing.
   Pages register themselves in BM.PAGES (js/pages/*.js):
     BM.PAGES.key = { t:[en,ar], s:[en,ar], render(ctx) → {html, after?} }
   Routing uses the URL hash (#income, #balance …).
   ============================================================================= */
(function(){
const U = BM.U, S = BM.state, E = BM.E;
BM.PAGES = BM.PAGES || {};
BM.PAGE_NAMES = {
  access:["Access management","إدارة الوصول"],
  dashboard:["Executive Dashboard","لوحة المؤشرات التنفيذية"], income:["Income Statement","قائمة الدخل"],
  balance:["Balance Sheet","قائمة المركز المالي"], cashflow:["Cash Flow","التدفقات النقدية"], ratios:["Financial Ratios","النسب المالية"],
  workingcapital:["Working Capital","رأس المال العامل"], ar:["Accounts Receivable","الذمم المدينة"], ap:["Accounts Payable","الذمم الدائنة"],
  trialbalance:["Trial Balance","ميزان المراجعة"], budget:["Budget Analysis","تحليل الموازنة"], prioryear:["Prior Year","مقارنة السنة السابقة"],
  trend:["Multi-year Trend","الاتجاه متعدد السنوات"], industry:["Industry Analysis","التحليل القطاعي"], operational:["Operational Analysis","التحليل التشغيلي"], risk:["Risk Analysis","تحليل المخاطر"],
  commentary:["Management Commentary","التعليق الإداري"], execsummary:["Executive Summary","الملخص التنفيذي"], reports:["Report Studio","استوديو التقارير"],
  import:["Inputs","المدخلات"], mapping:["Account Mapping","تصنيف الحسابات"], quality:["Data Quality","جودة البيانات"],
  settings:["Settings","الإعدادات"], about:["About","حول المنصة"]
};
BM.pageName = k => L(BM.PAGE_NAMES[k][0], BM.PAGE_NAMES[k][1]);

/* ---------- shell ---------- */
function buildNav(){
  U.$("#nav").innerHTML = BM.NAV.filter(([k]) => k !== "access" || (BM.gate && BM.gate.isAdmin())).map(([k, ic, phase], i) => {
    const off = !!phase;
    return `<a ${off ? `class="off" aria-disabled="true" title="${L("Arrives in phase {p} of the build","يتوفر في المرحلة {p} من البناء",{p:phase})}"` : `href="#${k}" class="${S.page === k ? "on" : ""}"`} data-k="${k}">
      <span class="n">${String(i + 1).padStart(2,"0")}</span><span class="i" aria-hidden="true">${ic}</span><span class="lbl">${BM.pageName(k)}</span>${off ? `<span class="tag">${L("P","م")}${phase}</span>` : ""}</a>`;
  }).join("");
  U.$("#railSub").textContent = U.nm(BM.BRAND.sub);
  const rp = U.$("#railProduct"); if (rp) rp.textContent = U.nm(BM.BRAND.product);
  U.$("#railOwner").textContent = U.nm(BM.BRAND.owner);
  const lg = U.$("#railLogo"); if (lg && !lg.firstChild) lg.innerHTML = BM.logo(38);
  const who = BM.auth.user();
  U.$("#railFoot").innerHTML = (who ? `<div class="racct"><span dir="ltr" title="${U.esc(who.email)}">${U.esc(who.email)}</span><button type="button" onclick="BM.admin.accountOut()">${L("Sign out","خروج")}</button></div>` : "") + `© ${U.nm(BM.BRAND.owner)} · v${BM.VERSION}<br>${S.storageOk ? L("Data is saved in this browser only.","البيانات محفوظة في هذا المتصفح فقط.") : L("Browser storage is blocked — data will not be kept after closing.","تخزين المتصفح محظور — لن تُحفظ البيانات بعد الإغلاق.")}`;
}

/* selectable period ends for the current view type, newest first (fiscal year, period) */
function periodOptions(co, type){
  const am = E.actualMonths(co), t = type || S.period.type, out = [];
  Object.keys(am).map(Number).sort((a, b) => b - a).forEach(y => {
    const ms = am[y].slice().sort((a, b) => b - a);
    if (t === "year"){ if (ms.indexOf(12) >= 0) out.push([y, 12]); }
    else if (t === "quarter"){ ms.filter(m => m % 3 === 0).forEach(m => out.push([y, m])); }
    else if (t === "half"){ ms.filter(m => m % 6 === 0).forEach(m => out.push([y, m])); }
    else if (t === "ltm"){ ms.forEach(m => { const a = E.abs(y, m); if (E.plSpan(co, "actual", a - 11, a)) out.push([y, m]); }); }
    else if (t === "from"){ ms.forEach(m => { if (m === 1 || ms.indexOf(m - 1) >= 0) out.push([y, m]); }); }
    else ms.forEach(m => out.push([y, m]));
  });
  return out;
}
BM.periodOptions = periodOptions;
function fixPeriod(){
  const co = BM.co(); if (!co) return;
  const opts = periodOptions(co);
  if (!opts.length){
    if (S.period.type !== "ytd"){ S.period.type = "ytd"; return fixPeriod(); }
    S.period.year = null; S.period.month = null; return;
  }
  if (!opts.some(o => o[0] === S.period.year && o[1] === S.period.month)){
    const fy = +S.settings.fiscalYear, pick = (fy && opts.find(o => o[0] === fy)) || opts[0];
    S.period.year = pick[0]; S.period.month = pick[1];
  }
  /* custom range: the start must be a valid month on or before the end */
  if (S.period.type === "custom"){
    const fr = periodOptions(co, "from").filter(o => E.abs(o[0], o[1]) <= E.abs(S.period.year, S.period.month));
    if (!fr.some(o => o[0] === S.period.fromYear && o[1] === S.period.fromMonth)){
      const d = fr.find(o => o[0] === S.period.year && o[1] === 1) || fr[fr.length - 1] || [S.period.year, S.period.month];
      S.period.fromYear = d[0]; S.period.fromMonth = d[1];
    }
  }
}

/* v3.10.2 — no control bar at the top of any page. The analysis view (period type, period,
   comparison, report currency) is set once on the Inputs page («Analysis view» card); the company
   is the Inputs «Company file» and the language its «Working language», so nothing appears twice.
   Analysis pages show the current choice as text under their title, with a link to change it. */
function buildBar(){ const bar = U.$("#ctls"); bar.hidden = true; bar.innerHTML = ""; const hb = U.$("#homeBtn"); if (hb){ hb.lastElementChild.textContent = L("TRUST main site","الموقع الرئيسي"); hb.title = "trustfins.org"; } }
const VC = BM.vc = {};
VC.type = v => { S.period.type = v; fixPeriod(); render(); };
VC.period = v => { const [y, m] = v.split("-").map(Number); S.period.year = y; S.period.month = m; fixPeriod(); render(); };
VC.from = v => { const [y, m] = v.split("-").map(Number); S.period.fromYear = y; S.period.fromMonth = m; render(); };
VC.cmp = v => { S.compare = v; render(); };
VC.cur = v => { const co = BM.co(); S.settings.reportCurrency = v === (co && co.currency) ? null : v; BM.saveSettings(); render(); };
VC.edit = () => { BM.go("import"); setTimeout(() => { const c = document.getElementById("viewCard"); if (c){ c.scrollIntoView({behavior:"smooth", block:"start"}); const f = c.querySelector("select"); if (f) f.focus({preventScroll:true}); } }, 120); };
/* the «Analysis view» card: on the Inputs page, and (v3.10.4) at the top of every analysis page and the Report Studio */
BM.viewCard = function(where){
  const co = BM.co(); if (!co) return "";
  const opts = periodOptions(co), cust = S.period.type === "custom";
  const pLabel = ([y, m]) => E.periodLabel({type: cust ? "month" : S.period.type, year:y, month:m}, true);
  const fromOpts = cust ? periodOptions(co, "from").filter(o => E.abs(o[0], o[1]) <= E.abs(S.period.year, S.period.month)) : [];
  const f = (id, lab, sel, hint) => `<div class="field"><label for="${id}">${lab}</label>${sel}${hint ? `<span class="small muted" style="display:block;margin-top:4px">${hint}</span>` : ""}</div>`;
  const body = !opts.length ? `<p class="small muted" style="margin:0">${L("The analysis view becomes available after the first trial balance is posted.","يتاح عرض التحليل بعد ترحيل أول ميزان مراجعة.")}</p>` : `<div class="form">
      ${f("vcT", L("View","العرض"), `<select class="in" id="vcT" onchange="BM.vc.type(this.value)">${E.TYPES.map(o => `<option value="${o[0]}" ${S.period.type === o[0] ? "selected" : ""}>${L(o[1], o[2])}</option>`).join("")}</select>`)}
      ${cust ? f("vcF", L("From","من"), `<select class="in" id="vcF" onchange="BM.vc.from(this.value)">${fromOpts.map(o => `<option value="${o[0]}-${o[1]}" ${o[0] === S.period.fromYear && o[1] === S.period.fromMonth ? "selected" : ""}>${pLabel(o)}</option>`).join("")}</select>`) : ""}
      ${f("vcP", cust ? L("To","إلى") : L("Period","الفترة"), `<select class="in" id="vcP" onchange="BM.vc.period(this.value)">${opts.map(o => `<option value="${o[0]}-${o[1]}" ${o[0] === S.period.year && o[1] === S.period.month ? "selected" : ""}>${pLabel(o)}</option>`).join("")}</select>`)}
      ${f("vcC", L("Compare with","المقارنة مع"), `<select class="in" id="vcC" onchange="BM.vc.cmp(this.value)">${["budget","py","prev"].map(b => `<option value="${b}" ${S.compare === b ? "selected" : ""}>${E.BASES[b]()}</option>`).join("")}</select>`, L("Changes the comparison column and variance only; actual figures stay the same.","تغيّر عمود المقارنة والانحراف فقط، ولا تغيّر الأرقام الفعلية."))}
      ${f("vcR", L("Report currency","عملة العرض والتقارير"), `<select class="in" id="vcR" onchange="BM.vc.cur(this.value)">${Object.keys(BM.CURRENCIES).map(c => `<option ${(S.settings.reportCurrency || co.currency) === c ? "selected" : ""}>${c}</option>`).join("")}</select>`, (rc => rc.unavailable ? L("No {f}→{t} rate entered, so figures stay in {f}. <a href=\"#settings\">Enter the rate in Settings</a>.","لم يُدخل سعر تحويل {f}→{t}، لذلك تبقى الأرقام بعملة {f}. <a href=\"#settings\">أدخل السعر من الإعدادات</a>.",{f:rc.code,t:rc.unavailable}) : rc.converted ? L("Converted at the rate you entered: {r}.","محوّلة بالسعر الذي أدخلته: {r}.",{r:rc.rate}) : "")(BM.reportCurrency()))}
    </div>`;
  return `<section class="card" id="viewCard" style="margin-bottom:18px"><div class="card-h"><h2>${L("Analysis view","عرض التحليل")}</h2><span class="small muted">${U.esc(U.nm(co.name))}${co.demo ? " · " + L("illustrative data","بيانات افتراضية") : ""}</span></div>
    <div class="card-b">${body}${where === "page" ? "" : `<p class="small muted" style="margin:10px 0 0">${L("Applies to every analysis page and report. The company is chosen in «Company file» below.","يُطبَّق على كل صفحات التحليل والتقارير. الشركة تُختار من «ملف الشركة» أدناه.")}</p>`}</div></section>`;
};
function view0(co){ try { return E.BASES[S.compare] ? L("vs","مقابل") + " " + E.BASES[S.compare]() : ""; } catch(e){ return ""; } }
function persistNav(){ S.settings._dataset = S.dataset; S.settings._companyId = S.companyId; BM.saveSettings(); }

function applyLang(){
  document.documentElement.lang = S.settings.lang;
  document.documentElement.dir = U.isAr() ? "rtl" : "ltr";
  document.title = BM.brandName();
}
BM.applyTheme = function(){
  const t = S.settings.theme;
  if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
  else document.documentElement.removeAttribute("data-theme");
};

/* shell-level notices that apply to every analytical page */
function shellNotes(){
  const co = BM.co(), out = [], rc = BM.reportCurrency();
  if (co && co.demo) out.push(BM.ui.banner("demo", L("DEMO DATA — FOR ILLUSTRATION ONLY","بيانات تجريبية — للتوضيح فقط") + `<span style="font-weight:400;margin-inline-start:auto">${L("Upload your trial balance on the Inputs page.","حمّل ميزان المراجعة من صفحة المدخلات.")}</span>`));
  if (rc.unavailable) out.push(BM.ui.banner("warn", `<b>${L("Conversion rate unavailable.","سعر التحويل غير متوفر.")}</b> ${L("Figures are shown in {f}, the company's currency. Enter a {f}→{t} rate in Settings to report in {t}.","الأرقام معروضة بعملة الشركة {f}. أدخل سعر تحويل {f}→{t} في الإعدادات لعرضها بعملة {t}.",{f:co.currency, t:rc.unavailable})}`));
  else if (rc.converted) out.push(BM.ui.banner("info", L("Converted from {f} to {t} at the rate you entered: {r} (as at {d}). No live exchange-rate source is connected.","محوّل من {f} إلى {t} بالسعر الذي أدخلته: {r} (بتاريخ {d}). لا يوجد مصدر أسعار صرف مباشر.",{f:rc.from, t:rc.code, r:rc.rate, d:rc.date || "—"})));
  return out.join("");
}
BM.ANALYTIC = ["dashboard","trend","income","balance","cashflow","ratios","workingcapital","ar","ap","budget","prioryear","industry","operational","risk","commentary","execsummary","reports"];

function render(){
  if (!BM.gate || BM.gate.view !== "granted") return;
  BM.charts.clear();
  const page = BM.PAGES[S.page] ? S.page : "dashboard";
  S.page = page;
  buildNav(); buildBar();
  const co = BM.co();
  const rc = BM.reportCurrency();
  U.$("#pTitle").textContent = BM.pageName(page);
  const sub = U.$("#pSub"), showCtx = co && ["trialbalance","mapping","quality"].indexOf(page) >= 0;
  sub.innerHTML = !showCtx ? "" : U.esc([U.nm(co.name), S.period.year ? E.periodLabel(S.period) : "", S.period.year ? view0(co) : "", rc.code].filter(Boolean).join(" · "))
    + ` <button type="button" class="sublink" onclick="BM.vc.edit()">${L("Change","تغيير")}</button>`;
  let out;
  try {
    const ctx = {co, period:S.period, basis:S.compare};
    if (BM.ANALYTIC.indexOf(page) >= 0){
      if (!S.period.year) out = {html: BM.ui.card("", BM.ui.empty(L("This company has no actual trial balance yet.","لا يوجد ميزان مراجعة فعلي لهذه الشركة بعد."), `<a class="btn pri" href="#import">${L("Import a trial balance","استيراد ميزان مراجعة")}</a>`))};
      else { ctx.view = E.view(co, S.period, S.compare); out = BM.PAGES[page].render(ctx); }
    } else out = BM.PAGES[page].render(ctx);
  } catch(err){
    console.error(err);
    out = {html: BM.ui.banner("bad", `<b>${L("This page could not be displayed.","تعذر عرض هذه الصفحة.")}</b> ${U.esc(err.message)}`)};
  }
  U.$("#content").innerHTML = (BM.ANALYTIC.indexOf(page) >= 0 && co && S.period.year ? BM.viewCard("page") : "") + (BM.ANALYTIC.indexOf(page) >= 0 || page === "trialbalance" ? shellNotes() : (co && co.demo && page !== "about" && page !== "import" && page !== "settings" && page !== "access" ? shellNotes() : "")) + out.html;
  if (out.after) try { out.after(); } catch(e){ console.error(e); }
}
BM.render = render;

async function route(){
  if (!BM.gate || BM.gate.view !== "granted" || await BM.gate.guard()) return;
  const k = (location.hash || "").replace("#","");
  if (k && BM.PAGE_NAMES[k] && BM.PAGES[k]) S.page = k;
  else if (k && BM.PAGE_NAMES[k]) S.page = "dashboard";
  U.$("#rail").classList.remove("open");
  render(); window.scrollTo(0, 0);
}
BM.go = k => { if (location.hash === "#" + k) route(); else location.hash = k; };

async function boot(){
  BM.loadSettings();
  /* Language from a TRUST link (?lang=ar|en): applied once on arrival and saved like a manual choice,
     then removed from the address bar. A later manual switch stays saved for direct visits. */
  try {
    const q = new URLSearchParams(location.search), l = q.get("lang");
    if (l === "ar" || l === "en"){
      S.settings.lang = l; BM.saveSettings();
      q.delete("lang");
      const s = q.toString();
      history.replaceState(null, "", location.pathname + (s ? "?" + s : "") + location.hash);
    }
  } catch(e){ /* keep the saved language */ }
  applyLang(); BM.applyTheme();
  await BM.loadData();
  S.demo = BM.buildDemo();
  if (S.settings._dataset === "uploaded" && S.companies.length){ S.dataset = "uploaded"; S.companyId = S.settings._companyId; }
  else if (S.companies.length && !S.settings._dataset){ S.dataset = "uploaded"; S.companyId = S.companies[0].id; }
  fixPeriod();
  U.$("#menuBtn").onclick = () => U.$("#rail").classList.toggle("open");
  window.addEventListener("hashchange", route);
  window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").addEventListener && window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => render());
  /* nothing is shown before the TRUST account is signed in and approved */
  BM.gate.start(route);
}
BM.fixPeriod = fixPeriod;
BM.applyLang = applyLang;
document.addEventListener("DOMContentLoaded", boot);
})();
