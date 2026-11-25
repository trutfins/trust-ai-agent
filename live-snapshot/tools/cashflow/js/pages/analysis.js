/* =============================================================================
   pages/analysis.js — Executive Dashboard and Financial Ratios
   ============================================================================= */
(function(){
const U = BM.U, E = BM.E, ui = BM.ui;

/* KPI catalogue (master prompt §6): key, EN, AR, unit, direction, getter(frame, ratios, extra) */
const KPIS = [
  ["Performance","الأداء",[
    ["rev","Revenue","الإيرادات","money",1,(f)=>f.is && f.is.rev],
    ["growth","Revenue growth","نمو الإيرادات","pct",1,(f,R,x)=>x.growth],
    ["gp","Gross profit","مجمل الربح","money",1,(f)=>f.is && f.is.gp],
    ["gm","Gross margin","هامش الربح الإجمالي","pct",1,(f,R)=>R.gm.v],
    ["ebitda","EBITDA","EBITDA","money",1,(f)=>f.is && f.is.ebitda],
    ["ebitdam","EBITDA margin","هامش EBITDA","pct",1,(f,R)=>R.ebitdam.v],
    ["ebit","Operating profit","الربح التشغيلي","money",1,(f)=>f.is && f.is.ebit],
    ["np","Net profit","صافي الربح","money",1,(f)=>f.is && f.is.np],
    ["npm","Net profit margin","هامش صافي الربح","pct",1,(f,R)=>R.npm.v]]],
  ["Financial position & liquidity","المركز المالي والسيولة",[
    ["ta","Total assets","إجمالي الأصول","money",0,(f)=>f.bs && f.bs.ta],
    ["tl","Total liabilities","إجمالي الالتزامات","money",-1,(f)=>f.bs && f.bs.tl],
    ["te","Equity","حقوق الملكية","money",1,(f)=>f.bs && f.bs.te],
    ["cash","Cash and bank","النقد والبنوك","money",1,(f)=>f.bs && f.bs.cashAll],
    ["wc","Working capital","رأس المال العامل","money",1,(f)=>f.bs && f.bs.wc],
    ["cr","Current ratio","النسبة المتداولة","x",1,(f,R)=>R.cr.v],
    ["qr","Quick ratio","النسبة السريعة","x",1,(f,R)=>R.qr.v],
    ["de","Debt-to-equity","الديون إلى حقوق الملكية","x",-1,(f,R)=>R.de.v]]],
  ["Returns & efficiency","العوائد والكفاءة",[
    ["roa","ROA (annualised)","العائد على الأصول (سنوي)","pct",1,(f,R)=>R.roa.v],
    ["roe","ROE (annualised)","العائد على حقوق الملكية (سنوي)","pct",1,(f,R)=>R.roe.v],
    ["dso","DSO","فترة التحصيل","days",-1,(f,R)=>R.dso.v],
    ["dpo","DPO","فترة السداد","days",0,(f,R)=>R.dpo.v],
    ["dio","Inventory days","أيام المخزون","days",-1,(f,R)=>R.dio.v],
    ["ccc","Cash conversion cycle","دورة التحول النقدي","days",-1,(f,R)=>R.ccc.v]]]
];
BM.KPIS = KPIS;

function revGrowth(f, base){ return (f && f.is && base && base.is) ? U.varPct(f.is.rev, base.is.rev) : null; }
/* v3.10.5 — revenue growth of the comparison figures. Budget: budget vs prior-year actual.
   Prior year / previous period: that period vs the same span one year earlier (N/A when not loaded). */
BM.cmpGrowth = function(v, py){
  if (!v || !v.cmp || !v.cmp.is) return null;
  if (v.basis === "budget") return revGrowth(v.cmp, py);
  return revGrowth(v.cmp, E.frameSpan(v.co, "actual", v.cmp.a1 - 12, v.cmp.a2 - 12, {estimate: true}));
};

BM.PAGES.dashboard = {render(ctx){
  const v = ctx.view, co = ctx.co, Rc = BM.ratios(v.cur), Rk = BM.ratios(v.cmp);
  const py = v.basis === "py" ? v.cmp : E.compareFrame(co, ctx.period, "py");
  const xc = {growth: revGrowth(v.cur, py)}, xk = {growth: BM.cmpGrowth(v, py)};
  const tile = (d) => {
    const [k, en, ar, unit, dir, get] = d;
    const a = get(v.cur, Rc, xc), b = get(v.cmp, Rk, xk);
    const diff = U.sub(a, b), p = unit === "money" ? U.varPct(a, b) : null;
    const st = ui.varStatus(a, b, dir, unit);
    const cls = st.cls === "good" ? "s-good" : st.cls === "warn" ? "s-warn" : st.cls === "bad" ? "s-bad" : "";
    const why = !U.has(a) && Rc[k] && Rc[k].why ? ` title="${U.esc(Rc[k].why)}"` : "";
    return `<div class="kpi ${cls}"${why}>
      <div class="t">${L(en, ar)}${k === "growth" ? `<span class="muted small" style="font-weight:400">${L("vs prior year","مقابل السنة السابقة")}</span>` : ""}</div>
      <div class="v">${U.fmtUnit(unit, a)}</div>
      <div class="d"><span>${U.esc(v.label)}: <b>${U.fmtUnit(unit, b)}</b></span></div>
      <div class="d"><span>${L("Variance","الانحراف")}: <b>${U.has(diff) ? U.fmtDelta(unit, diff) : U.NA()}</b></span>${p != null ? `<span>${ui.arrow(diff, dir || 1)} ${U.pct(p)}</span>` : ""}</div>
      <div class="f">${ui.varBadge(st)}</div></div>`;
  };
  let html = ui.viewNotes(v);
  KPIS.forEach(g => { html += ui.sec(L(g[0], g[1])) + `<div class="kpis">${g[2].map(tile).join("")}</div>`; });
  html += `<div class="grid g2">
    ${ui.card(L("Monthly revenue — {y}","الإيرادات الشهرية — {y}",{y:E.fyName(ctx.period.year)}), `<div class="chart"><canvas id="c1"></canvas></div>`, {sub:L("Actual · budget · prior year","فعلي · موازنة · سنة سابقة")})}
    ${ui.card(L("Margin trend — {y}","اتجاه الهوامش — {y}",{y:E.fyName(ctx.period.year)}), `<div class="chart"><canvas id="c2"></canvas></div>`, {sub:L("Single-month margins","هوامش الأشهر المنفردة")})}
  </div>
  ${ui.card(L("Cash, working capital and borrowings — month end","النقد ورأس المال العامل والقروض — نهاية الشهر"), `<div class="chart sm"><canvas id="c3"></canvas></div>`)}`;
  return {html, after(){
    const y = ctx.period.year, A = E.monthly(co, "actual", y), B = E.monthly(co, "budget", y), P = E.monthly(co, "actual", y - 1), C = BM.charts.colors();
    const lab = A.map(x => E.pm(x.m));
    const val = (arr, f) => arr.map(x => x.is ? f(x.is) : null);
    BM.charts.make("c1", {type:"bar", data:{labels:lab, datasets:[
      {label:L("Actual","فعلي"), data:val(A, i => i.rev), backgroundColor:C.c1, borderRadius:3, order:2},
      {label:L("Budget","موازنة"), data:val(B, i => i.rev), type:"line", borderColor:C.c3, backgroundColor:C.c3, borderDash:[5,4], pointRadius:2, tension:.25, order:1, spanGaps:true},
      {label:L("Prior year","سنة سابقة"), data:val(P, i => i.rev), backgroundColor:C.c4, borderRadius:3, order:3}]}});
    const m = (arr, f) => arr.map(x => x.is && x.is.rev > 0 ? f(x.is) / x.is.rev : null);
    BM.charts.make("c2", {type:"line", pct:true, data:{labels:lab, datasets:[
      {label:L("Gross margin","الهامش الإجمالي"), data:m(A, i => i.gp), borderColor:C.c1, backgroundColor:C.c1, tension:.25, pointRadius:2},
      {label:L("EBITDA margin","هامش EBITDA"), data:m(A, i => i.ebitda), borderColor:C.c2, backgroundColor:C.c2, tension:.25, pointRadius:2},
      {label:L("Net margin","هامش صافي الربح"), data:m(A, i => i.np), borderColor:C.c3, backgroundColor:C.c3, tension:.25, pointRadius:2}]}});
    const bs = (f) => A.map(x => x.bs ? f(x.bs) : null);
    BM.charts.make("c3", {type:"line", data:{labels:lab, datasets:[
      {label:L("Cash and bank","النقد والبنوك"), data:bs(b => b.cashAll), borderColor:C.c2, backgroundColor:C.c2, tension:.25, pointRadius:2},
      {label:L("Working capital","رأس المال العامل"), data:bs(b => b.wc), borderColor:C.c1, backgroundColor:C.c1, tension:.25, pointRadius:2},
      {label:L("Borrowings","القروض"), data:bs(b => b.debt), borderColor:C.c3, backgroundColor:C.c3, tension:.25, pointRadius:2}]}});
  }};
}};

/* ---------------------------- Financial ratios ---------------------------- */
BM.PAGES.ratios = {render(ctx){
  const co = ctx.co, v = ctx.view;
  const fBud = v.basis === "budget" ? v.cmp : E.compareFrame(co, ctx.period, "budget");
  const fPY = v.basis === "py" ? v.cmp : E.compareFrame(co, ctx.period, "py");
  const R = BM.ratios(v.cur), RP = BM.ratios(fPY), RB = BM.ratios(fBud);
  const cell = (k, r) => U.has(r.v) ? U.fmtUnit(BM.RATIO_BY[k][6], r.v) + (r.closing ? ` <span class="muted small" title="${L("Closing balance used — opening not available","استُخدم الرصيد الختامي — الافتتاحي غير متوفر")}">*</span>` : "")
    : `<span class="na" title="${U.esc(r.why || "")}">${r.nm ? L("Not meaningful","غير ذي دلالة") : L("N/A","غير متوفر")}</span>`;
  const trend = (k) => {
    const a = R[k].v, b = RP[k].v, dir = BM.RATIO_BY[k][7];
    if (!U.has(a) || !U.has(b)) return `<span class="muted small">—</span>`;
    const d = a - b, th = BM.RATIO_BY[k][6] === "pct" ? 0.005 : BM.RATIO_BY[k][6] === "days" ? 2 : 0.05;
    if (Math.abs(d) < th) return `<span class="muted">■ ${L("Stable","مستقر")}</span>`;
    if (!dir) return `<span class="muted">${d > 0 ? "▲" : "▼"} ${U.fmtDelta(BM.RATIO_BY[k][6], d)}</span>`;
    return `<span class="${d * dir > 0 ? "pos" : "neg"}">${d > 0 ? "▲" : "▼"} ${U.fmtDelta(BM.RATIO_BY[k][6], d)}</span>`;
  };
  let html = ui.viewNotes(Object.assign({}, v, {cmp: fPY, label: L("Prior year","السنة السابقة")}));
  html += ui.banner("info", L("Return and turnover ratios are annualised (× 365 ÷ {d} days in the period). Averages use opening and closing balances; * marks a ratio that had to use the closing balance only.","نسب العائد والدوران محسوبة على أساس سنوي (× 365 ÷ {d} يوماً في الفترة). المتوسطات تستخدم الرصيد الافتتاحي والختامي؛ العلامة * تعني استخدام الرصيد الختامي فقط.",{d:v.cur.days}));
  Object.keys(BM.RATIO_GROUPS).forEach(g => {
    const rows = BM.RATIO_DEFS.filter(r => r[1] === g).map(r => {
      const k = r[0];
      return `<tr><td class="wrap"><b>${L(r[2], r[3])}</b><div class="formula">${L(r[4], r[5])}</div></td>
        <td class="n"><b>${cell(k, R[k])}</b></td><td class="n">${cell(k, RP[k])}</td><td class="n">${cell(k, RB[k])}</td>
        <td>${trend(k)}</td><td class="wrap small" style="min-width:260px">${BM.ratioReading(k, R[k], RP[k].v)}</td><td>${ui.level(R[k].level)}</td></tr>`;
    }).join("");
    html += ui.tableCard(L(BM.RATIO_GROUPS[g][0], BM.RATIO_GROUPS[g][1]), `<table><thead><tr><th>${L("Ratio and formula","النسبة والمعادلة")}</th><th class="n">${L("Actual","الفعلي")}</th><th class="n">${L("Prior year","السنة السابقة")}</th><th class="n">${L("Budget","الموازنة")}</th><th>${L("Trend vs prior year","الاتجاه مقابل السنة السابقة")}</th><th>${L("Interpretation","التفسير")}</th><th>${L("Risk","المخاطر")}</th></tr></thead><tbody>${rows}</tbody></table>`);
  });
  html += `<p class="small muted" style="margin:0">${L("Risk levels use the thresholds in Settings → Risk thresholds. Interpretations describe what the ratio shows; they do not state causes the data cannot support.","مستويات المخاطر تستخدم الحدود في الإعدادات ← حدود المخاطر. التفسيرات تصف ما تظهره النسبة ولا تذكر أسباباً لا تدعمها البيانات.")}</p>`;
  return {html};
}};
})();
