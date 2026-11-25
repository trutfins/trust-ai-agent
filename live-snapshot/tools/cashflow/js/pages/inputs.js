/* =============================================================================
   pages/inputs.js — Inputs page (first page of the platform)
   Built on the Import Excel page: company details, financial periods and a
   dedicated trial-balance upload area. Uploaded files continue through the
   existing import wizard (columns → mapping → validation) unchanged.

   Stored on the company:
     co.name {en, ar} · co.industry · co.sectorNote · co.currency · co.fyStart
     co.inputs = { hist:{fy,fm,ty,tm}, fc:{fy,fm,ty,tm}, freq:"monthly"|"quarterly"|"annual" }
   Months and years are calendar months as printed on the trial balances.
   ============================================================================= */
(function(){
const U = BM.U, S = BM.state, ui = BM.ui;
const I = BM.inputs = {d:null, errs:{}};

const FREQ = [["monthly","Monthly","شهري"],["quarterly","Quarterly","ربعي"],["semiannual","Semi-annual","نصف سنوي"],["annual","Annual","سنوي"]];
const SZ = {monthly:1, quarterly:3, semiannual:6, annual:12};
const VIEW = {monthly:"ytd", quarterly:"quarter", semiannual:"half", annual:"year"};
const ym = (y, m) => y * 12 + m - 1;
const E = BM.E;
/* ranges are stored as calendar months (start of the first unit, end of the last);
   the form shows them in units of the chosen frequency on the company's financial calendar */
const cal = d => ({fyStart: +d.fyStart || 1});
function snapRange(d, key, freq){
  const n = SZ[freq] || 1, P = cal(d), r = d[key];
  const a = E.toFis(P, r.fy, r.fm), b = E.toFis(P, r.ty, r.tm);
  const s1 = E.toCal(P, a.fy, (Math.ceil(a.p / n) - 1) * n + 1), e1 = E.toCal(P, b.fy, Math.ceil(b.p / n) * n);
  d[key] = {fy:s1.y, fm:s1.m, ty:e1.y, tm:e1.m};
}
const histFreq = d => d.dfreq || "monthly", fcFreq = d => d.freq || "monthly";
/* frequency of each financial year (an override per year, else the default) */
I.yearFreq = (co, F) => { const i = co.inputs || {}; return (i.yfreq && i.yfreq[F]) || i.dfreq || "monthly"; };
/* expected period-ends inside the historical range, per financial year */
I.plan = co => {
  const h = co && co.inputs && co.inputs.hist; if (!h) return [];
  const a = ym(h.fy, h.fm), b = ym(h.ty, h.tm), F1 = E.toFis(co, h.fy, h.fm).fy, F2 = E.toFis(co, h.ty, h.tm).fy, out = [];
  for (let F = F1; F <= F2; F++){
    const fq = I.yearFreq(co, F), n = SZ[fq], ends = [];
    for (let p = n; p <= 12; p += n){ const c = E.toCal(co, F, p), i = ym(c.y, c.m); if (i < a || i > b) continue;
      const s = co.snapshots[E.key("actual", c.y, c.m)]; ends.push({y:c.y, m:c.m, p, ok: !!(s && s.kind !== "opening")}); }
    out.push({F, fq, ends});
  }
  return out;
};
/* the view that suits the data frequency of a financial year */
I.viewFor = (co, F) => co && co.inputs ? VIEW[I.yearFreq(co, F)] : null;
/* next period-end still to load (used as the default in the import wizard) */
I.nextEnd = co => { for (const yr of I.plan(co)) for (const e of yr.ends) if (!e.ok) return {y:e.y, m:e.m}; return null; };

/* draft built from the selected company (or blank for a new one) */
function draftFor(co){
  const ar = U.isAr(), now = new Date(), cy = now.getFullYear();
  if (!co || co.demo){
    return {_for:"new", id:"", name:"", name2:"", industry:"", sectorNote:"", currency:"ILS", fyStart:1,
      hist:{fy:cy - 3, fm:1, ty:cy - 1, tm:12}, fc:{fy:cy, fm:1, ty:cy + 2, tm:12}, freq:"", dfreq:""};
  }
  const inp = co.inputs || {}, l = BM.E.latest(co), end = l ? BM.E.toCal(co, l.year, l.month) : null;
  const hist = inp.hist || (end ? {fy:end.y - 2, fm:1, ty:end.y, tm:end.m} : {fy:cy - 3, fm:1, ty:cy - 1, tm:12});
  const nx = ym(hist.ty, hist.tm) + 1;
  const fc = inp.fc || {fy:Math.floor(nx / 12), fm:nx % 12 + 1, ty:Math.floor(nx / 12) + 2, tm:nx % 12 || 12};
  const n1 = (ar ? co.name.ar : co.name.en) || "", n2 = (ar ? co.name.en : co.name.ar) || "";
  return {_for:co.id, id:co.id, name:n1 || n2, name2:n2 !== n1 ? n2 : "",
    industry:co.industry || "", sectorNote:co.sectorNote || "", currency:co.currency || "ILS", fyStart:BM.E.fs(co),
    hist:Object.assign({}, hist), fc:Object.assign({}, fc), freq:inp.freq || "", dfreq:inp.dfreq || (inp.hist ? "monthly" : "")};
}
function current(){
  const co = S.dataset === "uploaded" ? BM.co() : null, key = co ? co.id : "new";
  if (!I.d || I.d._for !== key) { I.d = draftFor(co); I.errs = {}; }
  return I.d;
}

/* ---------- actions ---------- */
I.set = (k, v) => { const d = current(); const p = k.split("."); if (p.length === 2) d[p[0]][p[1]] = +v; else d[k] = v; if (I.errs[k.split(".")[0]]) { delete I.errs[k.split(".")[0]]; }
  if (k === "dfreq" || k === "fyStart") snapRange(d, "hist", histFreq(d));
  if (k === "freq" || k === "fyStart") snapRange(d, "fc", fcFreq(d));
  if (["industry","dfreq","freq","fyStart"].indexOf(k) >= 0) BM.render(); };
/* one end of a range changed: side = "f" (from) or "t" (to); part = "F" (financial year) or "u" (unit) */
I.setRange = (key, side, part, v) => {
  const d = current(), fq = key === "hist" ? histFreq(d) : fcFreq(d), n = SZ[fq], P = cal(d), r = d[key];
  const a = E.toFis(P, r.fy, r.fm), b = E.toFis(P, r.ty, r.tm);
  const A = {F:a.fy, u:Math.ceil(a.p / n)}, B = {F:b.fy, u:Math.ceil(b.p / n)}, X = side === "f" ? A : B;
  X[part] = +v;
  const s1 = E.toCal(P, A.F, (A.u - 1) * n + 1), e1 = E.toCal(P, B.F, B.u * n);
  d[key] = {fy:s1.y, fm:s1.m, ty:e1.y, tm:e1.m}; delete I.errs[key]; BM.render();
};
/* per-year data frequency, saved straight to the company */
I.setYear = (F, v) => { const co = BM.co(); if (!co || co.demo || !co.inputs) return; co.inputs.yfreq = co.inputs.yfreq || {};
  if (v === co.inputs.dfreq) delete co.inputs.yfreq[F]; else co.inputs.yfreq[F] = v; BM.saveData(); BM.render(); };
I.pick = v => {
  if (v === "new"){ S.dataset = "demo"; }
  else { S.dataset = "uploaded"; S.companyId = v; }
  S.settings._dataset = S.dataset; S.settings._companyId = S.companyId; BM.saveSettings();
  I.d = null; S.period.year = null; BM.fixPeriod(); BM.render();
};
/* the main name field follows the working language, so the two names swap */
I.lang = v => { const d = current(); if (v !== S.settings.lang && d.name2){ const t = d.name; d.name = d.name2; d.name2 = t; } BM.admin.val("lang", v, true); };

function validate(d){
  const e = {};
  if (!d.name.trim()) e.name = L("Enter the company name.","أدخل اسم الشركة.");
  if (!d.industry) e.industry = L("Choose the economic sector.","اختر القطاع الاقتصادي.");
  else if (d.industry === "other" && !d.sectorNote.trim()) e.industry = L("Describe the sector.","اكتب وصف القطاع.");
  const h1 = ym(d.hist.fy, d.hist.fm), h2 = ym(d.hist.ty, d.hist.tm), f1 = ym(d.fc.fy, d.fc.fm), f2 = ym(d.fc.ty, d.fc.tm);
  if (h1 > h2) e.hist = L("The start of the historical period must be on or before its end.","بداية الفترة التاريخية يجب أن تكون قبل نهايتها أو مساوية لها.");
  if (f1 > f2) e.fc = L("The start of the forecast period must be on or before its end.","بداية الفترة المتنبأ بها يجب أن تكون قبل نهايتها أو مساوية لها.");
  else if (f1 <= h2) e.fc = L("The forecast period must start after the historical period ends.","يجب أن تبدأ الفترة المتنبأ بها بعد نهاية الفترة التاريخية.");
  if (!d.freq) e.freq = L("Choose how forecast data is presented.","اختر دورية بيانات التنبؤ.");
  if (!d.dfreq) e.dfreq = L("Choose how often you enter trial balances.","اختر دورية إدخال موازين المراجعة.");
  return e;
}

I.save = () => {
  const d = current(); I.errs = validate(d);
  if (Object.keys(I.errs).length){ BM.render(); const f = document.querySelector(".in.err"); if (f) f.focus(); BM.toast(L("Complete the required fields.","أكمل الحقول المطلوبة.")); return; }
  const ar = U.isAr(), now = new Date().toISOString();
  const name = {en: ar ? (d.name2.trim() || d.name.trim()) : d.name.trim(), ar: ar ? d.name.trim() : (d.name2.trim() || d.name.trim())};
  const old = d.id && (S.companies.find(c => c.id === d.id) || {}).inputs;
  const inputs = {hist:Object.assign({}, d.hist), fc:Object.assign({}, d.fc), freq:d.freq, dfreq:d.dfreq, yfreq:(old && old.yfreq) || {}, savedAt:now};
  let co = d.id ? S.companies.find(c => c.id === d.id) : null;
  const finish = () => {
    co.name = name; co.industry = d.industry; co.sectorNote = d.industry === "other" ? d.sectorNote.trim() : ""; co.currency = d.currency; co.inputs = inputs;
    S.dataset = "uploaded"; S.companyId = co.id; S.settings._dataset = "uploaded"; S.settings._companyId = co.id; BM.saveSettings();
    BM.E.bump(co); S.period.year = null; S.period.type = VIEW[d.dfreq] || S.period.type; BM.fixPeriod(); BM.saveData();
    I.d = null; I.errs = {}; BM.render(); BM.toast(L("Inputs saved. You can now upload the trial balances.","تم حفظ المدخلات. يمكنك الآن رفع موازين المراجعة."));
  };
  if (!co){
    co = {id:U.uid("co"), name, currency:d.currency, industry:d.industry, fyStart:+d.fyStart || 1, accounts:{}, snapshots:{}, imports:[], createdAt:now};
    S.companies.push(co); return finish();
  }
  if ((+d.fyStart || 1) !== BM.E.fs(co) && Object.keys(co.snapshots).length){
    return BM.confirm(L("Income-statement balances in your trial balances must be cumulative from the first month of the financial year. Change the start to {m}? The loaded data is re-read with the new calendar; nothing is deleted.","يجب أن تكون أرصدة حسابات قائمة الدخل في موازين المراجعة تراكمية من أول شهر في السنة المالية. هل تريد تغيير البداية إلى {m}؟ ستُقرأ البيانات المحمّلة حسب التقويم الجديد ولن يُحذف شيء.",{m:U.month(+d.fyStart, true)}),
      L("Change","تغيير"), () => { co.fyStart = +d.fyStart; S.settings.fiscalYear = null; finish(); });
  }
  co.fyStart = +d.fyStart || 1; finish();
};

/* ---------- view ---------- */
const req = `<b class="req" aria-hidden="true">*</b>`;
const err = k => I.errs[k] ? `<span class="ferr" role="alert">${U.esc(I.errs[k])}</span>` : "";
const years = (a, b) => { const o = []; for (let y = b; y >= a; y--) o.push(y); return o; };
/* unit and financial-year pickers that follow the frequency */
function unitLabel(fq, u, P){
  if (fq === "monthly") return E.pm(u, true, P);
  const n = SZ[fq], span = E.pm((u - 1) * n + 1, false, P) + " – " + E.pm(u * n, false, P);
  if (fq === "quarterly") return (U.isAr() ? "الربع " + ["الأول","الثاني","الثالث","الرابع"][u - 1] : "Q" + u) + " (" + span + ")";
  return (U.isAr() ? (u === 1 ? "النصف الأول" : "النصف الثاني") : "H" + u) + " (" + span + ")";
}
function sideSel(key, side, fq, X, P, yl, bad){
  const n = SZ[fq], cls = `in${bad ? " err" : ""}`;
  const unit = n < 12 ? `<select class="${cls}" id="${key}${side}u" aria-label="${L("Period","الفترة")}" onchange="BM.inputs.setRange('${key}','${side}','u',this.value)">${Array.from({length:12 / n}, (_, i) => `<option value="${i + 1}" ${X.u === i + 1 ? "selected" : ""}>${unitLabel(fq, i + 1, P)}</option>`).join("")}</select>` : "";
  const list = yl.indexOf(X.F) < 0 ? yl.concat([X.F]).sort((a, b) => b - a) : yl;
  const year = `<select class="${cls}" id="${key}${side}F" aria-label="${L("Financial year","السنة المالية")}" onchange="BM.inputs.setRange('${key}','${side}','F',this.value)">${list.map(F => `<option value="${F}" ${X.F === F ? "selected" : ""}>${E.fs(P) === 1 ? F : E.fyLabel(F, P)}</option>`).join("")}</select>`;
  return unit + year;
}
function range(key, title, hint, d, yl, fq){
  const bad = !!I.errs[key], r = d[key], P = cal(d), n = SZ[fq];
  const a = E.toFis(P, r.fy, r.fm), b = E.toFis(P, r.ty, r.tm);
  const A = {F:a.fy, u:Math.ceil(a.p / n)}, B = {F:b.fy, u:Math.ceil(b.p / n)};
  const units = Math.max(0, (ym(r.ty, r.tm) - ym(r.fy, r.fm) + 1) / n);
  return `<div class="field span2"><label>${title} ${req}</label>
    <div class="prange"><div class="pside"><span class="pl">${L("From","من")}</span>${sideSel(key, "f", fq, A, P, yl, bad)}</div>
    <div class="pside"><span class="pl">${L("To","إلى")}</span>${sideSel(key, "t", fq, B, P, yl, bad)}</div></div>
    <span class="hint">${U.month(r.fm, true)} ${r.fy} – ${U.month(r.tm, true)} ${r.ty} · ${L("{n} period(s)","{n} فترة",{n:Math.round(units)})}${hint ? " · " + hint : ""}</span>${err(key)}</div>`;
}
const freqSel = (id, k, v) => `<select class="in${I.errs[k] ? " err" : ""}" id="${id}" onchange="BM.inputs.set('${k}',this.value)"><option value="">${L("— Choose —","— اختر —")}</option>${FREQ.map(f => `<option value="${f[0]}" ${v === f[0] ? "selected" : ""}>${L(f[1], f[2])}</option>`).join("")}</select>`;

/* which planned period-ends are loaded, year by year; each year's frequency can be changed */
function coverage(co){
  const plan = I.plan(co); if (!plan.length) return "";
  let n = 0, t = 0;
  const rows = plan.map(yr => {
    t += yr.ends.length; n += yr.ends.filter(e => e.ok).length;
    const sel = `<select class="in sm" aria-label="${L("Frequency","الدورية")} ${E.fyName(yr.F, co)}" onchange="BM.inputs.setYear(${yr.F},this.value)">${FREQ.map(f => `<option value="${f[0]}" ${yr.fq === f[0] ? "selected" : ""}>${L(f[1], f[2])}</option>`).join("")}</select>`;
    return `<tr><td><b>${E.fyLabel(yr.F, co)}</b></td><td>${sel}</td><td><div class="cov">${yr.ends.map(e => { const sg = !e.ok && BM.wz.stagedAt(e.y, e.m); return `<span class="${e.ok ? "on" : ""}"${sg ? ` style="background:var(--warn-soft);border-color:var(--warn);color:var(--warn);font-weight:600"` : ""} title="${e.ok ? L("Loaded: {d}","محمّل: {d}",{d:U.month(e.m, true) + " " + e.y}) : sg ? L("In the list, waiting to be posted: {d}","في القائمة بانتظار الترحيل: {d}",{d:U.month(e.m, true) + " " + e.y}) : L("Not loaded yet: {d}","لم يُحمّل بعد: {d}",{d:U.month(e.m, true) + " " + e.y})}">${U.month(e.m)}<br><small>${e.y}</small></span>`; }).join("") || `<span class="muted small">—</span>`}</div></td><td class="n">${yr.ends.filter(e => e.ok).length} / ${yr.ends.length}</td></tr>`;
  }).join("");
  const nx = I.nextEnd(co);
  return `<div class="cov-head small"><b>${L("Trial balances loaded: {n} of {t} planned period-ends","موازين المراجعة المحمّلة: {n} من {t} نهاية فترة مخططة",{n, t})}</b>
    <span class="muted">${L("Change the frequency of any year (e.g. annual for older years, monthly for the latest). Each trial balance is the balance at the end of its period; income-statement accounts are cumulative from the start of the financial year.","يمكن تغيير دورية أي سنة (مثلاً سنوي للسنوات القديمة وشهري لآخر سنة). كل ميزان مراجعة هو الأرصدة في نهاية فترته، وحسابات قائمة الدخل تراكمية من بداية السنة المالية.")}${nx ? " " + L("Next to load: {d}.","التالي للتحميل: {d}.",{d:U.month(nx.m, true) + " " + nx.y}) : ""}</span></div>
    <div class="tw"><table class="covt"><thead><tr><th>${L("Financial year","السنة المالية")}</th><th>${L("Data frequency","دورية البيانات")}</th><th>${L("Period-ends","نهايات الفترات")}</th><th class="n">${L("Loaded","محمّل")}</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="small muted" style="margin:8px 0 0">${L("Green = posted · amber = in the list, waiting to be posted. To add or replace a trial balance, drop it in the box above: its date is read from the file.","الأخضر = مُرحّل · البرتقالي = في القائمة بانتظار الترحيل. لإضافة ميزان أو استبداله اسحبه إلى المربع أعلاه، ويُقرأ تاريخه من الملف نفسه.")}</p>`;
}

/* welcome — what the Smart CFO is, what it needs, what it gives, how data is protected (v3.9).
   Open for a first visit (no company yet), folded once the user has companies. */
I.demo = () => { S.dataset = "demo"; S.settings._dataset = "demo"; S.settings.reportCurrency = null; S.period.year = null; BM.fixPeriod(); BM.saveSettings(); BM.go("dashboard"); };
I.start = () => { const el = U.$("#inName"); if (el){ el.scrollIntoView({behavior:"smooth", block:"center"}); setTimeout(() => el.focus(), 350); } };
function welcome(){
  const first = !S.companies.length;
  const steps = [["Upload data","رفع البيانات"],["Review accounts","مراجعة الحسابات"],["Financial analysis","التحليل المالي"],["Results","النتائج"],["Report","التقرير"]];
  const q = (t, body) => `<div class="wq"><h3>${t}</h3>${body}</div>`;
  return `<details class="welcome" ${first ? "open" : ""}><summary><span class="wt">${L("Smart CFO — from trial balance to smarter financial decisions","المدير المالي الذكي — من ميزان المراجعة إلى قرارات مالية أذكى")}</span><span class="wm">${L("How it works","كيف تعمل المنصة")}</span></summary>
    <p class="wl">${L("Upload your trial balance and within minutes get your financial statements, your cash flow, budget against actual and the full-year outlook, with smart commentary that explains what the numbers mean and what to do next.","ارفع ميزان المراجعة، واحصل خلال دقائق على قوائمك المالية، وتدفقك النقدي، ومقارنة الموازنة بالفعلي، وتوقعات نهاية السنة، مع تعليق ذكي يشرح لك ماذا تعني الأرقام وماذا تفعل بعدها.")}</p>
    <ol class="wflow">${steps.map((s, i) => `<li><i>${i + 1}</i>${L(s[0], s[1])}</li>`).join("")}</ol>
    <div class="wgrid">
      ${q(L("What you need","ما الذي تحتاجه"), `<ul><li>${L("A trial balance for each period: account code, account name, debit, credit.","ميزان مراجعة لكل فترة: رمز الحساب، اسم الحساب، مدين، دائن.")}</li><li>${L("For the cash flow: the trial balance at the start of the period as well.","للتدفق النقدي: ميزان المراجعة في بداية الفترة أيضاً.")}</li><li>${L("Optional: a budget, and receivables / payables aging at the latest date.","اختياري: موازنة، وأعمار الذمم المدينة والدائنة في آخر تاريخ.")}</li></ul>`)}
      ${q(L("Accepted files","الملفات المقبولة"), `<p><span dir="ltr" style="display:inline-block">Excel (.xlsx · .xlsm · .xls)</span> ${L("and","و")} <span dir="ltr" style="display:inline-block">CSV</span>. ${L("Several files can be uploaded at once; the platform sorts them by date.","يمكن رفع عدة ملفات معاً، وتقوم المنصة بترتيبها حسب التاريخ.")}</p><button class="btn sm" type="button" onclick="BM.wz.sample()">⤓ ${L("Download a sample trial balance","تنزيل نموذج ميزان مراجعة")}</button>`)}
      ${q(L("What you get","ما الذي تحصل عليه"), `<p>${L("Income statement, balance sheet, derived cash flow, ratios, working capital, budget variances, multi-year trend and full-year outlook, risks, commentary — and a PDF / Excel report.","قائمة الدخل والمركز المالي، تدفق نقدي مشتق، نسب مالية، رأس المال العامل، انحرافات الموازنة، الاتجاه متعدد السنوات وتوقعات نهاية السنة، المخاطر، التعليق — وتقرير PDF / Excel.")}</p>`)}
      ${q(L("How your data is protected","كيف تُحمى بياناتك"), `<p>${L("Files are read and kept in this browser on this device only; they are not uploaded to a TRUST server. AI commentary, when you ask for it, sends only the company name and summary figures to the TRUST service.","تُقرأ الملفات وتُحفظ في هذا المتصفح على هذا الجهاز فقط، ولا تُرفع إلى خادم TRUST. عند طلبك التعليق بالذكاء الاصطناعي يُرسل اسم الشركة والأرقام الملخّصة فقط إلى خدمة TRUST.")} <a href="#settings">${L("Keep a backup (Settings)","احتفظ بنسخة احتياطية (الإعدادات)")}</a></p>`)}
    </div>
    <div class="wcta"><button class="btn pri" type="button" onclick="BM.inputs.start()">${L("Start: enter your company details","ابدأ: أدخل بيانات شركتك")}</button><button class="btn" type="button" onclick="BM.inputs.demo()">${L("See an example (illustrative data)","شاهد مثالاً (بيانات افتراضية)")}</button></div>
  </details>`;
}

BM.inputsHome = function(dropHtml){
  const d = current(), co = d.id ? S.companies.find(c => c.id === d.id) : null, cy = new Date().getFullYear();
  const yl = years(2000, cy + 10);
  const coSel = `<div class="field"><label for="inCo">${L("Company file","ملف الشركة")}</label><select class="in" id="inCo" onchange="BM.inputs.pick(this.value)">
      <option value="new" ${!d.id ? "selected" : ""}>${L("+ New company","+ شركة جديدة")}</option>${S.companies.map(c => `<option value="${c.id}" ${d.id === c.id ? "selected" : ""}>${U.esc(U.nm(c.name))}</option>`).join("")}</select></div>`;
  const company = `<div class="form">
      ${coSel}
      <div class="field"><label for="inLang">${L("Working language","لغة العمل")}</label><select class="in" id="inLang" onchange="BM.inputs.lang(this.value)"><option value="ar" ${U.isAr() ? "selected" : ""}>العربية</option><option value="en" ${!U.isAr() ? "selected" : ""}>English</option></select></div>
      <div class="field"><label for="inName">${L("Company name","اسم الشركة")} ${req}</label><input class="in${I.errs.name ? " err" : ""}" id="inName" value="${U.esc(d.name)}" autocomplete="off" oninput="BM.inputs.set('name',this.value)">${err("name")}</div>
      <div class="field"><label for="inName2">${U.isAr() ? "Company name (English)" : "اسم الشركة (بالعربية)"} <span class="opt">${L("(optional)","(اختياري)")}</span></label><input class="in" id="inName2" dir="${U.isAr() ? "ltr" : "rtl"}" value="${U.esc(d.name2)}" autocomplete="off" oninput="BM.inputs.set('name2',this.value)"></div>
      <div class="field"><label for="inSec">${L("Economic sector","القطاع الاقتصادي")} ${req}</label><select class="in${I.errs.industry ? " err" : ""}" id="inSec" onchange="BM.inputs.set('industry',this.value)"><option value="">${L("— Choose —","— اختر —")}</option>${BM.INDUSTRIES.map(i => `<option value="${i[0]}" ${d.industry === i[0] ? "selected" : ""}>${L(i[1], i[2])}</option>`).join("")}</select>${d.industry === "other" ? "" : err("industry")}</div>
      ${d.industry === "other" ? `<div class="field"><label for="inSecN">${L("Describe the sector","وصف القطاع")} ${req}</label><input class="in${I.errs.industry ? " err" : ""}" id="inSecN" value="${U.esc(d.sectorNote)}" placeholder="${L("e.g. construction materials","مثال: مواد بناء")}" oninput="BM.inputs.set('sectorNote',this.value)">${err("industry")}</div>` : ""}
      <div class="field"><label for="inCur">${L("Currency of the figures","عملة الأرقام")} ${req}</label><select class="in" id="inCur" onchange="BM.inputs.set('currency',this.value)">${Object.keys(BM.CURRENCIES).map(c => `<option ${d.currency === c ? "selected" : ""}>${c}</option>`).join("")}</select></div>
      <div class="field"><label for="inFys">${L("Financial year starts in","بداية السنة المالية")} ${req}</label><select class="in" id="inFys" onchange="BM.inputs.set('fyStart',+this.value)">${BM.MONTHS.map((m, i) => `<option value="${i + 1}" ${+d.fyStart === i + 1 ? "selected" : ""}>${U.month(i + 1, true)}</option>`).join("")}</select></div>
    </div>`;
  const periods = `<div class="form">
      <div class="field"><label for="inDFreq">${L("Data entry frequency (trial balances)","دورية إدخال البيانات (موازين المراجعة)")} ${req}</label>${freqSel("inDFreq", "dfreq", d.dfreq)}<span class="hint">${L("The period pickers below follow this choice. It can be changed per year after saving.","منتقيات الفترات أدناه تتبع هذا الاختيار، ويمكن تغييره لكل سنة بعد الحفظ.")}</span>${err("dfreq")}</div>
      ${range("hist", L("Historical financial data period","فترة البيانات المالية التاريخية"), "", d, yl, histFreq(d))}
      <div class="field"><label for="inFreq">${L("Forecast data frequency","دورية بيانات التنبؤ")} ${req}</label>${freqSel("inFreq", "freq", d.freq)}${err("freq")}</div>
      ${range("fc", L("Forecast period","الفترة المتنبأ بها"), "", d, yl, fcFreq(d))}
    </div>
    <p class="small muted" style="margin:10px 0 0">${L("The forecast period and its frequency are saved with the company. The analysis pages continue to show the actual figures from your trial balances.","تُحفظ الفترة المتنبأ بها ودوريتها مع بيانات الشركة. صفحات التحليل تبقى تعرض الأرقام الفعلية من موازين المراجعة.")}</p>`;
  const saved = !!(co && co.inputs);
  const upload = saved
    ? BM.wz.stagingHtml(coverage(co))
    : ui.card("", `<div class="drop locked" aria-disabled="true"><span class="big">${L("Save the company inputs first","احفظ مدخلات الشركة أولاً")}</span><span class="small muted">${L("The upload area opens after the company name, sector and periods are saved.","تُفتح منطقة الرفع بعد حفظ اسم الشركة والقطاع والفترات.")}</span></div>`);
  return `<div class="inputs">
    ${welcome()}
    ${BM.viewCard()}
    <div class="in-head"><div>${BM.logo(44)}</div><div><h2>${L("Company inputs","مدخلات الشركة")}</h2><p class="small muted">${L("Fields marked * are required. Enter the company details and periods, save, then upload the trial balances.","الحقول المعلّمة بـ * مطلوبة. أدخل بيانات الشركة والفترات واحفظها، ثم ارفع موازين المراجعة.")}</p></div></div>
    <div class="grid g2">${ui.card(L("1 · Company information","1 · بيانات الشركة"), company)}${ui.card(L("2 · Financial periods","2 · الفترات المالية"), periods)}</div>
    <div class="row in-save"><button class="btn pri" id="inSave" onclick="BM.inputs.save()">${saved ? L("Save changes","حفظ التعديلات") : L("Save inputs","حفظ المدخلات")}</button>${saved ? `<span class="small muted">${L("Saved","محفوظ")} · ${U.esc((co.inputs.savedAt || "").slice(0, 16).replace("T", " "))}</span>` : ""}</div>
    ${ui.sec(L("3 · Upload the files, then post the data","3 · رفع الملفات ثم ترحيل البيانات") + (saved ? " — " + U.esc(U.nm(co.name)) : ""))}
    ${upload}
  </div>`;
};
})();
