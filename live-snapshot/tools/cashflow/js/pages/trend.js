/* =============================================================================
   pages/trend.js — Multi-year trend (up to five financial years side by side)
   Each column is one financial year of the company's own calendar: the full
   year when its last month is loaded, otherwise year to date (marked Partial).
   Compound growth (CAGR) uses complete years only.
   ============================================================================= */
(function(){
const U = BM.U, E = BM.E, ui = BM.ui;

/* rows: key, EN, AR, unit, direction, getter(frame, ratios) */
const ROWS = [
  ["h","Performance","الأداء"],
  ["rev","Revenue","الإيرادات","money",1,(f)=>f.is && f.is.rev],
  ["gp","Gross profit","مجمل الربح","money",1,(f)=>f.is && f.is.gp],
  ["gm","Gross margin","هامش الربح الإجمالي","pct",1,(f,R)=>R.gm.v],
  ["opex","Operating expenses","المصروفات التشغيلية","money",-1,(f)=>f.is && f.is.opex],
  ["ebitda","EBITDA","EBITDA","money",1,(f)=>f.is && f.is.ebitda],
  ["ebitdam","EBITDA margin","هامش EBITDA","pct",1,(f,R)=>R.ebitdam.v],
  ["np","Net profit","صافي الربح","money",1,(f)=>f.is && f.is.np],
  ["npm","Net profit margin","هامش صافي الربح","pct",1,(f,R)=>R.npm.v],
  ["h","Financial position (year end)","المركز المالي (نهاية السنة)"],
  ["ta","Total assets","إجمالي الأصول","money",0,(f)=>f.bs && f.bs.ta],
  ["te","Equity","حقوق الملكية","money",1,(f)=>f.bs && f.bs.te],
  ["debt","Borrowings","القروض","money",-1,(f)=>f.bs && f.bs.debt],
  ["cash","Cash and bank","النقد والبنوك","money",1,(f)=>f.bs && f.bs.cashAll],
  ["wc","Working capital","رأس المال العامل","money",1,(f)=>f.bs && f.bs.wc],
  ["h","Cash flow (derived)","التدفق النقدي (مشتق)"],
  ["cfo","Operating cash flow","التدفق النقدي التشغيلي","money",1,(f)=>f.cf && !f.cf.na ? f.cf.cfo : null],
  ["fcf","Free cash flow","التدفق النقدي الحر","money",1,(f)=>f.cf && !f.cf.na ? f.cf.fcf : null],
  ["h","Ratios","النسب"],
  ["cr","Current ratio","النسبة المتداولة","x",1,(f,R)=>R.cr.v],
  ["de","Debt-to-equity","الديون إلى حقوق الملكية","x",-1,(f,R)=>R.de.v],
  ["icr","Interest cover","تغطية الفوائد","x",1,(f,R)=>R.icr.v],
  ["roe","ROE (annualised)","العائد على حقوق الملكية (سنوي)","pct",1,(f,R)=>R.roe.v],
  ["roa","ROA (annualised)","العائد على الأصول (سنوي)","pct",1,(f,R)=>R.roa.v],
  ["dso","DSO","فترة التحصيل","days",-1,(f,R)=>R.dso.v],
  ["dio","Inventory days","أيام المخزون","days",-1,(f,R)=>R.dio.v],
  ["dpo","DPO","فترة السداد","days",0,(f,R)=>R.dpo.v],
  ["ccc","Cash conversion cycle","دورة التحول النقدي","days",-1,(f,R)=>R.ccc.v]
];
BM.TREND_ROWS = ROWS;

/* shared by the page, the PDF report and the Excel export */
BM.trend = function(co){
  const ys = E.years(co, 5), full = ys.filter(y => y.full);
  const rows = ROWS.filter(r => r[0] !== "h").map(r => {
    const vals = ys.map(y => r[5](y.f, y.R));
    let cagr = null, n = 0;
    if (r[3] === "money" && full.length >= 2){ const a = full[0], b = full[full.length - 1]; n = b.fy - a.fy; cagr = E.cagr(r[5](a.f, a.R), r[5](b.f, b.R), n); }
    return {key:r[0], en:r[1], ar:r[2], unit:r[3], dir:r[4], vals, cagr};
  });
  return {years: ys, full, rows, cagrSpan: full.length >= 2 ? [full[0].fy, full[full.length - 1].fy] : null};
};
BM.trendColLabel = (y, co) => E.fyLabel(y.fy, co) + (y.full ? "" : " · " + L("YTD","حتى") + " " + E.pm(y.last, false, co));

BM.PAGES.trend = {render(ctx){
  const co = ctx.co, T = BM.trend(co), ys = T.years;
  let html = ui.banner("info", L("Each column is one financial year ({a} – {b}): the full year when its last month is loaded, otherwise year to date, marked Partial. Partial years are not comparable with full years for amounts; ratios are annualised. Growth rates (CAGR) use complete years only.","كل عمود سنة مالية واحدة ({a} – {b}): السنة كاملة عند تحميل شهرها الأخير، وإلا فمنذ بداية السنة مع علامة «جزئية». السنوات الجزئية غير قابلة للمقارنة بالمبالغ مع السنوات الكاملة؛ النسب محسوبة على أساس سنوي. معدلات النمو المركب تستخدم السنوات الكاملة فقط.",{a:E.pm(1, true, co), b:E.pm(12, true, co)}));
  if (ys.length < 2) return {html: html + ui.card("", ui.empty(L("Load at least two financial years to see a trend. The trial balance at the end of each year is enough.","حمّل سنتين ماليتين على الأقل لعرض الاتجاه. يكفي ميزان المراجعة في نهاية كل سنة."), `<a class="btn pri" href="#import">${L("Go to Inputs","انتقل إلى المدخلات")}</a>`))};
  const g = k => T.rows.find(r => r.key === k);
  const span = T.cagrSpan ? L("{a} → {b}","{a} ← {b}",{a:E.fyName(T.cagrSpan[0], co), b:E.fyName(T.cagrSpan[1], co)}) : L("needs two complete years","يحتاج سنتين كاملتين");
  const tile = (k, en, ar) => { const r = g(k); return `<div class="kpi"><div class="t">${L(en, ar)}</div><div class="v">${U.pct(r.cagr)}</div><div class="d"><span>${span}</span></div></div>`; };
  html += `<div class="kpis">${tile("rev","Revenue growth (CAGR)","نمو الإيرادات (مركب)")}${tile("np","Net profit growth (CAGR)","نمو صافي الربح (مركب)")}${tile("te","Equity growth (CAGR)","نمو حقوق الملكية (مركب)")}
    <div class="kpi"><div class="t">${L("Years loaded","السنوات المحمّلة")}</div><div class="v">${ys.length}</div><div class="d"><span>${L("{n} complete","{n} كاملة",{n:T.full.length})}</span></div></div></div>`;
  let i = 0;
  const body = ROWS.map(r => {
    if (r[0] === "h") return `<tr class="h"><td colspan="${ys.length + 2}">${L(r[1], r[2])}</td></tr>`;
    const x = T.rows[i++];
    const cells = x.vals.map((v, j) => {
      let d = "";
      if (j && x.unit === "money" && ys[j].full && ys[j - 1].full){ const gr = U.varPct(v, x.vals[j - 1]); if (U.has(gr)) d = `<div class="small ${gr * (x.dir || 0) > 0 ? "pos" : gr * (x.dir || 0) < 0 ? "neg" : "muted"}">${U.pct(gr)}</div>`; }
      return `<td class="n">${U.fmtUnit(x.unit, v)}${d}</td>`;
    }).join("");
    return `<tr><td>${L(x.en, x.ar)}</td>${cells}<td class="n">${x.unit === "money" ? U.pct(x.cagr) : ""}</td></tr>`;
  }).join("");
  html += ui.tableCard(L("Financial years side by side","السنوات المالية جنباً إلى جنب"),
    `<table><thead><tr><th>${L("Measure","المؤشر")}</th>${ys.map(y => `<th class="n">${BM.trendColLabel(y, co)}${y.full ? "" : ` ${ui.badge("warn", L("Partial","جزئية"))}`}</th>`).join("")}<th class="n">CAGR</th></tr></thead><tbody>${body}</tbody></table>`,
    {sub:L("Small figures under an amount: growth against the previous complete year","الأرقام الصغيرة تحت المبلغ: النمو مقارنة بالسنة الكاملة السابقة")});
  html += `<div class="grid g2">${ui.card(L("Revenue and net profit by year","الإيرادات وصافي الربح حسب السنة"), `<div class="chart"><canvas id="tr1"></canvas></div>`, {sub:L("Partial years are year to date","السنوات الجزئية منذ بداية السنة")})}
    ${ui.card(L("Margins by year","الهوامش حسب السنة"), `<div class="chart"><canvas id="tr2"></canvas></div>`)}</div>`;
  return {html, after(){
    const C = BM.charts.colors(), lab = ys.map(y => E.fyName(y.fy, co) + (y.full ? "" : " *"));
    BM.charts.make("tr1", {type:"bar", data:{labels:lab, datasets:[
      {label:L("Revenue","الإيرادات"), data:g("rev").vals, backgroundColor:ys.map(y => y.full ? C.c1 : C.c4), borderRadius:3},
      {label:L("Net profit","صافي الربح"), data:g("np").vals, backgroundColor:C.c2, borderRadius:3}]}});
    BM.charts.make("tr2", {type:"line", pct:true, data:{labels:lab, datasets:[
      {label:L("Gross margin","الهامش الإجمالي"), data:g("gm").vals, borderColor:C.c1, backgroundColor:C.c1, tension:.25, pointRadius:3},
      {label:L("EBITDA margin","هامش EBITDA"), data:g("ebitdam").vals, borderColor:C.c2, backgroundColor:C.c2, tension:.25, pointRadius:3},
      {label:L("Net margin","هامش صافي الربح"), data:g("npm").vals, borderColor:C.c3, backgroundColor:C.c3, tension:.25, pointRadius:3}]}});
  }};
}};

/* ---------- full-year outlook card (used on the Budget page and in reports) ---------- */
BM.outlookTable = function(co, fy, p){
  const o = E.outlookFY(co, fy, p);
  if (!o.ytd) return null;
  const lines = [["rev","Revenue","الإيرادات",1],["gp","Gross profit","مجمل الربح",1],["opex","Operating expenses","المصروفات التشغيلية",-1],["ebitda","EBITDA","EBITDA",1],["np","Net profit","صافي الربح",1]];
  const v = (x, k) => x ? x[k] : null;
  const rows = lines.map(([k, en, ar, dir]) => {
    const le = v(o.le, k), bud = v(o.bud, k), d = U.sub(le, bud), c = U.has(d) ? (d * dir > 0 ? "pos" : d * dir < 0 ? "neg" : "") : "";
    return `<tr><td>${L(en, ar)}</td><td class="n">${U.money(v(o.ytd, k))}</td><td class="n">${U.money(v(o.rem, k))}</td><td class="n"><b>${U.money(le)}</b></td><td class="n">${U.money(bud)}</td><td class="n ${c}">${U.money(d)}</td><td class="n">${U.money(v(o.rr, k))}</td><td class="n">${U.money(v(o.py, k))}</td></tr>`;
  }).join("");
  return {o, table:`<table><thead><tr><th>${L("Line item","البند")}</th><th class="n">${L("Actual to date","الفعلي حتى تاريخه")}</th><th class="n">${L("Budget — remaining months","الموازنة — الأشهر المتبقية")}</th><th class="n">${L("Latest estimate","التقدير المحدث")} ${ui.statusTag("estimated")}</th><th class="n">${L("Full-year budget","موازنة السنة")}</th><th class="n">${L("Estimate vs budget","التقدير مقابل الموازنة")}</th><th class="n">${L("Run-rate","المعدل الجاري")} ${ui.statusTag("estimated")}</th><th class="n">${L("Prior full year","السنة السابقة كاملة")}</th></tr></thead><tbody>${rows}</tbody></table>`};
};
BM.outlookNote = (co, fy, p) => L("Latest estimate = actual for {a} plus the budget for the remaining {n} month(s). Run-rate = actual to date × 12 ÷ {m}; it assumes the rest of the year repeats the average month so far and ignores seasonality. Both are estimates, not forecasts.","التقدير المحدث = الفعلي حتى {a} مضافاً إليه الموازنة للأشهر المتبقية ({n}). المعدل الجاري = الفعلي حتى تاريخه × 12 ÷ {m}؛ ويفترض أن بقية السنة تكرر متوسط الأشهر الماضية ويتجاهل الموسمية. كلاهما تقدير وليس توقعاً.",{a:E.pDate(fy, p, true, co), n:12 - p, m:p});
})();
