/* =============================================================================
   engine/analytics.js — working capital, receivables, payables, operational
   and industry analytics (master prompt §9, §10, §11, §14, §15).
   Every metric carries a data-status: actual · derived · estimated · unavailable.
   ============================================================================= */
(function(){
const U = BM.U, E = BM.E, AN = BM.AN = {};
const ann = f => f && f.days ? 365 / f.days : null;
const ISO = t => "\u2066" + t + "\u2069";
AN.SRC = {
  actual:["Actual","فعلي","good"], derived:["Derived","مشتق","info"], estimated:["Estimated","تقديري","warn"], unavailable:["Unavailable","غير متوفر","mute"]
};
AN.srcTag = s => { const x = AN.SRC[s] || AN.SRC.unavailable; return `<span class="b b-${x[2]}">${L(x[0], x[1])}</span>`; };

/* prior-year comparison frame + same-date balance sheet */
AN.prior = function(view){
  const co = view.co, p = view.period;
  const f = view.basis === "py" ? view.cmp : E.compareFrame(co, p, "py");
  let bs = E.balanceSheet(co, "actual", p.year - 1, p.month), note = L("same date last year","نفس التاريخ من السنة السابقة");
  if (!bs){ bs = E.balanceSheet(co, "actual", p.year, 0); note = L("prior year end","نهاية السنة السابقة"); }
  return {f, bs, note, R: BM.ratios(Object.assign({}, f, {bs: f.bs || bs}))};
};

/* ---------------- working capital ---------------- */
AN.workingCapital = function(view){
  const c = view.cur, b = c.bs, R = BM.ratios(c), pr = AN.prior(view), pb = pr.bs, PR = pr.R, t = BM.state.settings.risk;
  const revAnn = c.is ? c.is.rev * ann(c) : null;
  const rows = [
    ["ar","Accounts receivable","الذمم المدينة","money",-1, b && b.ar, pb && pb.ar],
    ["inventory","Inventory","المخزون","money",-1, b && b.inventory, pb && pb.inventory],
    ["ap","Accounts payable","الذمم الدائنة","money",0, b && b.ap, pb && pb.ap],
    ["owc","Operating working capital (AR + inventory − AP)","رأس المال العامل التشغيلي (ذمم + مخزون − دائنون)","money",-1, b && b.owc, pb && pb.owc],
    ["owcRev","Operating working capital ÷ annual revenue","رأس المال العامل التشغيلي ÷ الإيراد السنوي","pct",-1, b && revAnn ? b.owc / revAnn : null, pb && pr.f.is && pr.f.days ? pb.owc / (pr.f.is.rev * 365 / pr.f.days) : null],
    ["wc","Working capital (current assets − current liabilities)","رأس المال العامل (أصول متداولة − التزامات متداولة)","money",1, b && b.wc, pb && pb.wc],
    ["dso","DSO","فترة التحصيل","days",-1, R.dso.v, PR.dso.v],
    ["dio","Inventory days","أيام المخزون","days",-1, R.dio.v, PR.dio.v],
    ["dpo","DPO","فترة السداد","days",0, R.dpo.v, PR.dpo.v],
    ["ccc","Cash conversion cycle","دورة التحول النقدي","days",-1, R.ccc.v, PR.ccc.v]
  ].map(r => ({key:r[0], en:r[1], ar:r[2], unit:r[3], dir:r[4], cur:r[5], prev:r[6], chg:U.sub(r[5], r[6])}));
  /* overall status */
  const reasons = [], ccc = R.ccc.v, dccc = U.sub(R.ccc.v, PR.ccc.v), cr = R.cr.v;
  let level = null;
  if (U.has(ccc) || U.has(cr)){
    let score = 0;
    if (U.has(cr) && cr < 1){ score = 3; reasons.push(L("Current liabilities exceed current assets (current ratio {v}).","الالتزامات المتداولة تتجاوز الأصول المتداولة (النسبة المتداولة {v}).",{v:cr.toFixed(2)})); }
    if (U.has(ccc) && ccc > 150){ score = Math.max(score, 3); reasons.push(L("Cash conversion cycle is {d} days.","دورة التحول النقدي {d} يوماً.",{d:Math.round(ccc)})); }
    if (U.has(dccc) && dccc > 30){ score = Math.max(score, 2); reasons.push(L("Cash conversion cycle lengthened by {d} days against the prior year.","دورة التحول النقدي زادت {d} يوماً مقارنة بالسنة السابقة.",{d:Math.round(dccc)})); }
    else if (U.has(dccc) && dccc > 15){ score = Math.max(score, 2); reasons.push(L("Cash conversion cycle lengthened by {d} days against the prior year.","دورة التحول النقدي زادت {d} يوماً مقارنة بالسنة السابقة.",{d:Math.round(dccc)})); }
    if (U.has(R.dso.v) && R.dso.v > t.maxDSO){ score = Math.max(score, 2); reasons.push(L("DSO of {d} days is above the {m}-day limit.","فترة التحصيل {d} يوماً تتجاوز الحد {m} يوماً.",{d:Math.round(R.dso.v), m:t.maxDSO})); }
    const owcR = rows.find(r => r.key === "owc"), revG = view.cur.is && pr.f.is ? U.varPct(view.cur.is.rev, pr.f.is.rev) : null, owcG = owcR && U.has(owcR.prev) && owcR.prev > 0 ? U.varPct(owcR.cur, owcR.prev) : null;
    if (U.has(owcG) && U.has(revG) && owcG - revG > 0.15){ score = Math.max(score, 2); reasons.push(L("Operating working capital grew {a} while revenue grew {b}.","رأس المال العامل التشغيلي نما {a} بينما نمت الإيرادات {b}.",{a:ISO((owcG*100).toFixed(1)+"%"), b:ISO((revG*100).toFixed(1)+"%")})); }
    if (U.has(cr) && cr >= 1 && cr < t.minCurrentRatio){ score = Math.max(score, 2); reasons.push(L("Current ratio {v} is below the {m} minimum.","النسبة المتداولة {v} أقل من الحد الأدنى {m}.",{v:cr.toFixed(2), m:t.minCurrentRatio})); }
    if (score === 0){
      if (U.has(dccc) && dccc < -5){ reasons.push(L("Cash conversion cycle shortened by {d} days.","دورة التحول النقدي قصرت {d} يوماً.",{d:Math.round(-dccc)})); level = "healthy"; }
      else if (U.has(ccc) && ccc <= 60){ reasons.push(L("Short cash conversion cycle ({d} days) and limits respected.","دورة تحول نقدي قصيرة ({d} يوماً) والحدود محترمة.",{d:Math.round(ccc)})); level = "healthy"; }
      else { reasons.push(L("No threshold breached and the cycle is broadly unchanged.","لم يتم تجاوز أي حد والدورة شبه ثابتة.")); level = "stable"; }
    } else level = score >= 3 ? "high" : "pressure";
  }
  return {rows, level, reasons, priorNote: pr.note, R, PR};
};
AN.WC_LEVEL = {healthy:["good","Healthy","سليم"], stable:["info","Stable","مستقر"], pressure:["warn","Under pressure","تحت الضغط"], high:["bad","High risk","مخاطر مرتفعة"]};

/* ---------------- receivables ---------------- */
AN.receivables = function(view){
  const c = view.cur, b = c.bs, b0 = c.bs0, is = c.is, R = BM.ratios(c), pr = AN.prior(view);
  const revAnn = is ? is.rev * ann(c) : null;
  const out = {
    bal: b ? b.ar : null,
    pctRev: b && revAnn > 0 ? b.ar / revAnn : null,
    dso: R.dso.v, dsoPrev: pr.R.dso.v,
    growthPY: b && pr.bs ? U.varPct(b.ar, pr.bs.ar) : null,
    growthOpen: b && b0 ? U.varPct(b.ar, b0.ar) : null,
    revGrowth: is && pr.f.is ? U.varPct(is.rev, pr.f.is.rev) : null,
    /* collections are not in a trial balance: derived as revenue + opening AR − closing AR */
    collections: is && b && b0 ? is.rev + b0.ar - b.ar : null
  };
  out.collectRate = out.collections != null && (is.rev + b0.ar) > 0 ? out.collections / (is.rev + b0.ar) : null;
  const ag = view.co.aging && view.co.aging.ar;
  out.aging = ag ? BM.AG.summary(ag) : null;
  out.agingMeta = ag || null;
  out.recon = ag ? BM.AG.reconcile(view.co, "ar", ag) : null;
  out.concentration = BM.AG.concentrationLevel(out.aging);
  return out;
};

/* ---------------- payables ---------------- */
AN.payables = function(view){
  const c = view.cur, b = c.bs, b0 = c.bs0, is = c.is, R = BM.ratios(c), pr = AN.prior(view), t = BM.state.settings.risk;
  const cosAnn = is ? is.cos * ann(c) : null;
  const out = {
    bal: b ? b.ap : null, dpo: R.dpo.v, dpoPrev: pr.R.dpo.v,
    pctCos: b && cosAnn > 0 ? b.ap / cosAnn : null,
    growthPY: b && pr.bs ? U.varPct(b.ap, pr.bs.ap) : null,
    growthOpen: b && b0 ? U.varPct(b.ap, b0.ap) : null,
    cosGrowth: is && pr.f.is ? U.varPct(is.cos, pr.f.is.cos) : null,
    /* purchases ≈ cost of sales + change in inventory; payments ≈ purchases + opening AP − closing AP */
    purchases: is && b && b0 ? is.cos + (b.inventory - b0.inventory) : null
  };
  out.payments = out.purchases != null ? out.purchases + b0.ap - b.ap : null;
  const ag = view.co.aging && view.co.aging.ap;
  out.aging = ag ? BM.AG.summary(ag) : null; out.agingMeta = ag || null;
  out.recon = ag ? BM.AG.reconcile(view.co, "ap", ag) : null;
  out.concentration = BM.AG.concentrationLevel(out.aging);
  /* supplier payment pressure — every indicator is evidence-based */
  const ind = [];
  if (U.has(out.dpo) && out.dpo > t.maxDPO) ind.push(L("DPO {d} days is above the {m}-day limit.","فترة السداد {d} يوماً تتجاوز الحد {m} يوماً.",{d:Math.round(out.dpo), m:t.maxDPO}));
  if (U.has(out.dpo) && U.has(out.dpoPrev) && out.dpo - out.dpoPrev > 15) ind.push(L("DPO lengthened by {d} days against the prior year.","فترة السداد زادت {d} يوماً مقارنة بالسنة السابقة.",{d:Math.round(out.dpo - out.dpoPrev)}));
  if (U.has(out.growthPY) && U.has(out.cosGrowth) && out.growthPY - out.cosGrowth > 0.2) ind.push(L("Payables grew {a} while cost of sales grew {b}.","الذمم الدائنة نمت {a} بينما نمت تكلفة المبيعات {b}.",{a:ISO((out.growthPY*100).toFixed(1)+"%"), b:ISO((out.cosGrowth*100).toFixed(1)+"%")}));
  if (out.aging && out.aging.pOverdue != null && out.aging.pOverdue > 0.3) ind.push(L("{p} of payables are past due.","{p} من الذمم الدائنة متأخرة السداد.",{p:ISO((out.aging.pOverdue*100).toFixed(0)+"%")}));
  out.pressure = ind; out.pressureLevel = ind.length >= 3 ? "high" : ind.length === 2 ? "medium" : ind.length === 1 ? "medium" : (U.has(out.dpo) ? "low" : null);
  return out;
};

/* ---------------- operational ---------------- */
/* headcount is stored by calendar month ("2026-6"); the period may cross financial years */
const hcAt = (co, h, a) => { const f = E.fp(a); return h[E.calKey(co, f.fy, f.p)]; };
AN.headcount = function(co, view){
  const ops = co.ops || {}, h = ops.headcount || {}, [a1, a2] = E.span(view.period);
  const end = hcAt(co, h, a2), start = hcAt(co, h, a1 - 1);
  if (end == null) return {v:null};
  const vals = []; for (let a = a1 - 1; a <= a2; a++){ const v = hcAt(co, h, a); if (v != null) vals.push(+v); }
  return {v: vals.length > 1 ? vals.reduce((a, b) => a + b, 0) / vals.length : +end, avg: vals.length > 1, end:+end, start};
};
AN.operational = function(view){
  const co = view.co, c = view.cur, is = c.is, a = ann(c), ops = co.ops || {}, hc = AN.headcount(co, view);
  const pr = AN.prior(view).f.is;
  const m = [];
  const add = (k, en, ar, unit, v, src, why, dir) => m.push({k, en, ar, unit, v, src: U.has(v) ? src : "unavailable", why: U.has(v) ? why : (why || L("Not available","غير متوفر")), dir});
  const needHC = L("Enter the headcount for this period below.","أدخل عدد الموظفين لهذه الفترة أدناه.");
  add("revEmp","Revenue per employee (annualised)","الإيراد لكل موظف (سنوي)","money", is && hc.v ? is.rev * a / hc.v : null, "derived", hc.v ? L("Revenue ÷ {t} headcount","الإيراد ÷ {t} عدد الموظفين",{t:hc.avg ? L("average","متوسط") : L("period-end","نهاية الفترة")}) : needHC, 1);
  add("costEmp","Staff cost per employee (annualised)","تكلفة الموظف (سنوية)","money", is && hc.v ? (is.salaries + is.direct_labor) * a / hc.v : null, "derived", hc.v ? L("(Salaries + direct labour) ÷ headcount","(الرواتب + العمالة المباشرة) ÷ عدد الموظفين") : needHC, -1);
  add("gpEmp","Gross profit per employee (annualised) — productivity","مجمل الربح لكل موظف (سنوي) — الإنتاجية","money", is && hc.v ? is.gp * a / hc.v : null, "derived", hc.v ? L("Gross profit ÷ headcount","مجمل الربح ÷ عدد الموظفين") : needHC, 1);
  add("staffPct","Staff cost as % of revenue","تكلفة الموظفين % من الإيراد","pct", is && is.rev > 0 ? (is.salaries + is.direct_labor) / is.rev : null, "actual", L("From the income statement","من قائمة الدخل"), -1);
  add("salesEff","Revenue per unit of marketing spend","الإيراد لكل وحدة إنفاق تسويقي","x", is && is.marketing > 0 ? is.rev / is.marketing : null, "derived", is && is.marketing > 0 ? L("Revenue ÷ marketing expense","الإيراد ÷ مصروف التسويق") : L("No marketing expense recorded","لا يوجد مصروف تسويق مسجل"), 1);
  add("opexPct","Operating expenses as % of revenue","المصروفات التشغيلية % من الإيراد","pct", is && is.rev > 0 ? is.opex / is.rev : null, "actual", L("From the income statement","من قائمة الدخل"), -1);
  add("opexVsRev","Operating-expense growth minus revenue growth","نمو المصروفات التشغيلية ناقص نمو الإيرادات","pct", is && pr && pr.opex && pr.rev ? U.varPct(is.opex, pr.opex) - U.varPct(is.rev, pr.rev) : null, pr && pr.status === "estimated" ? "estimated" : "derived", pr ? L("Against the prior year — positive means costs grow faster than revenue","مقارنة بالسنة السابقة — الموجب يعني أن التكاليف تنمو أسرع من الإيرادات") : L("Prior-year data not loaded","بيانات السنة السابقة غير محمّلة"), -1);
  /* concentration */
  const conc = (list) => { if (!list || !list.rows || !list.rows.length) return null; const pos = list.rows.filter(r => r[1] > 0).sort((x, y) => y[1] - x[1]), t = pos.reduce((s, r) => s + r[1], 0); if (!t) return null;
    return {top1: pos[0][1] / t, top5: pos.slice(0, 5).reduce((s, r) => s + r[1], 0) / t, hhi: pos.reduce((s, r) => s + Math.pow(r[1] / t, 2), 0), n: pos.length, top: pos.slice(0, 10).map(r => [r[0], r[1], r[1] / t]), label: list.label}; };
  const cc = conc(ops.byCustomer), pc = conc(ops.byProduct);
  let custSrc = "actual", custWhy = cc ? L("Revenue by customer: {l}","الإيراد حسب العميل: {l}",{l:U.esc(ops.byCustomer.label || "")}) : null, cust = cc;
  if (!cc){ const s = view.co.aging && BM.AG.summary(view.co.aging.ar);
    if (s && s.top1 != null){ cust = {top1:s.top1, top5:s.top5, hhi:s.hhi, n:s.parties, top:s.top.map(x => [x.party, x.total, x.share])}; custSrc = "derived"; custWhy = L("Proxy: share of receivables, from the AR aging — not revenue","تقريبي: حصة من الذمم المدينة من تقرير الأعمار — وليس من الإيراد"); }
    else custWhy = L("Load revenue by customer below, or an AR aging report.","حمّل الإيراد حسب العميل أدناه، أو تقرير أعمار الذمم المدينة."); }
  add("cust1","Largest customer share","حصة أكبر عميل","pct", cust ? cust.top1 : null, custSrc, custWhy, -1);
  add("cust5","Top 5 customers share","حصة أكبر 5 عملاء","pct", cust ? cust.top5 : null, custSrc, custWhy, -1);
  let prod = pc, prodSrc = "actual", prodWhy = pc ? L("Revenue by product / service: {l}","الإيراد حسب المنتج / الخدمة: {l}",{l:U.esc(ops.byProduct.label || "")}) : null;
  if (!pc && is && is.rev > 0){ const parts = [["sales", is.sales], ["service", is.service_rev], ["other", is.other_op_rev]].filter(x => x[1] > 0);
    if (parts.length > 1){ const t = parts.reduce((s, x) => s + x[1], 0); prod = {top1: Math.max(...parts.map(x => x[1])) / t, top5: 1, n: parts.length, top: parts.map(x => [x[0] === "sales" ? L("Sales","المبيعات") : x[0] === "service" ? L("Services","الخدمات") : L("Other operating revenue","إيرادات تشغيلية أخرى"), x[1], x[1] / t])}; prodSrc = "derived"; prodWhy = L("From revenue lines in the trial balance (sales / services / other)","من بنود الإيراد في ميزان المراجعة (مبيعات / خدمات / أخرى)"); }
    else prodWhy = L("Load revenue by product / service below.","حمّل الإيراد حسب المنتج / الخدمة أدناه."); }
  add("prod1","Largest product / service share","حصة أكبر منتج / خدمة","pct", prod ? prod.top1 : null, prodSrc, prodWhy, -1);
  return {metrics:m, hc, cust, prod, custSrc, prodSrc};
};

/* ---------------- industry KPI library ---------------- */
const share = (a, b) => (U.has(a) && U.has(b) && b > 0) ? a / b : null;
AN.IKPI = {
  gm:["Gross margin","هامش الربح الإجمالي","pct",1,(f,R)=>R.gm.v],
  opm:["Operating margin","هامش الربح التشغيلي","pct",1,(f,R)=>R.opm.v],
  ebitdam:["EBITDA margin","هامش EBITDA","pct",1,(f,R)=>R.ebitdam.v],
  npm:["Net profit margin","هامش صافي الربح","pct",1,(f,R)=>R.npm.v],
  staff:["Staff cost % of revenue","تكلفة الموظفين % من الإيراد","pct",-1,f=>f.is && share(f.is.salaries + f.is.direct_labor, f.is.rev)],
  rentp:["Rent % of revenue","الإيجار % من الإيراد","pct",-1,f=>f.is && share(f.is.rent, f.is.rev)],
  utilp:["Utilities % of revenue","المرافق % من الإيراد","pct",-1,f=>f.is && share(f.is.utilities, f.is.rev)],
  mktp:["Marketing % of revenue","التسويق % من الإيراد","pct",-1,f=>f.is && share(f.is.marketing, f.is.rev)],
  trnp:["Transport % of revenue","النقل % من الإيراد","pct",-1,f=>f.is && share(f.is.transport, f.is.rev)],
  admp:["Administrative % of revenue","الإدارية % من الإيراد","pct",-1,f=>f.is && share(f.is.admin, f.is.rev)],
  matp:["Goods & materials % of cost of sales","البضاعة والمواد % من تكلفة المبيعات","pct",-1,f=>f.is && share(f.is.direct_materials + f.is.cogs, f.is.cos)],
  labp:["Direct labour % of cost of sales","العمالة المباشرة % من تكلفة المبيعات","pct",-1,f=>f.is && share(f.is.direct_labor, f.is.cos)],
  svcp:["Service revenue share","حصة إيرادات الخدمات","pct",0,f=>f.is && share(f.is.service_rev, f.is.rev)],
  dio:["Inventory days","أيام المخزون","days",-1,(f,R)=>R.dio.v],
  dso:["DSO","فترة التحصيل","days",-1,(f,R)=>R.dso.v],
  dpo:["DPO","فترة السداد","days",0,(f,R)=>R.dpo.v],
  ccc:["Cash conversion cycle","دورة التحول النقدي","days",-1,(f,R)=>R.ccc.v],
  at:["Asset turnover","دوران الأصول","x",1,(f,R)=>R.at.v],
  fai:["Fixed assets % of total assets","الأصول الثابتة % من إجمالي الأصول","pct",0,f=>f.bs && share(f.bs.fixed_assets, f.bs.ta)],
  capex:["Capital expenditure % of revenue (derived)","النفقات الرأسمالية % من الإيراد (مشتقة)","pct",0,f=>f.cf && !f.cf.na && f.is ? share(f.cf.capex, f.is.rev) : null],
  de:["Debt-to-equity","الديون إلى حقوق الملكية","x",-1,(f,R)=>R.de.v],
  roe:["Return on equity","العائد على حقوق الملكية","pct",1,(f,R)=>R.roe.v],
  revEmp:["Revenue per employee (annualised)","الإيراد لكل موظف (سنوي)","money",1,(f,R,x)=>x && x.hc && f.is ? f.is.rev * 365 / f.days / x.hc : null]
};
AN.IND_DEFAULT = {
  retail:["gm","dio","rentp","staff","mktp","revEmp","npm"], manufacturing:["gm","matp","labp","dio","at","fai","capex"],
  construction:["gm","dso","staff","de","ccc","opm"], services:["staff","gm","dso","revEmp","opm","svcp"],
  trading:["gm","dio","dso","dpo","ccc","trnp","npm"], hospitality:["staff","utilp","rentp","gm","ebitdam","fai"],
  healthcare:["staff","gm","dso","ebitdam","capex"], automotive:["dio","gm","dso","dpo","trnp","npm"],
  financial:["opm","staff","admp","de","roe"], technology:["gm","staff","mktp","dso","ebitdam","revEmp"], other:["gm","opm","npm","staff","ccc"]
};
AN.industryCfg = co => { co.industryCfg = co.industryCfg || {}; const d = co.industryCfg[co.industry] || (co.industryCfg[co.industry] = {kpis:(AN.IND_DEFAULT[co.industry] || AN.IND_DEFAULT.other).slice(), targets:{}}); return d; };
AN.industry = function(view){
  const co = view.co, cfg = AN.industryCfg(co), c = view.cur, R = BM.ratios(c), pr = AN.prior(view), bud = view.basis === "budget" ? view.cmp : E.compareFrame(co, view.period, "budget"), RB = BM.ratios(bud);
  const hc = AN.headcount(co, view).v;
  const pf = Object.assign({}, pr.f, {bs: pr.f.bs || pr.bs});
  return cfg.kpis.filter(k => AN.IKPI[k]).map(k => {
    const d = AN.IKPI[k], x = {hc};
    const cur = d[4](c, R, x), py = d[4](pf, pr.R, {hc:null}), bu = d[4](bud, RB, x);
    const tg = cfg.targets[k];
    return {k, en:d[0], ar:d[1], unit:d[2], dir:d[3], cur, py, bu, target: tg == null || tg === "" ? null : +tg};
  });
};
})();
