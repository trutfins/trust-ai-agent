/* =============================================================================
   pages/workcap.js — Working Capital (§9), Accounts Receivable (§10),
   Accounts Payable (§11)
   ============================================================================= */
(function(){
const U = BM.U, E = BM.E, ui = BM.ui, AN = BM.AN, AG = BM.AG;

/* monthly series of single-month working-capital ratios for the period year */
function wcSeries(co, y, upto){
  const lab = [], dso = [], dio = [], dpo = [], ccc = [], ar = [], ap = [], inv = [];
  for (let m = 1; m <= 12; m++){
    const f = E.frame(co, "actual", y, m, m), R = BM.ratios(f);
    lab.push(E.pm(m)); dso.push(R.dso.v); dio.push(R.dio.v); dpo.push(R.dpo.v); ccc.push(R.ccc.v);
    ar.push(f.bs ? f.bs.ar : null); ap.push(f.bs ? f.bs.ap : null); inv.push(f.bs ? f.bs.inventory : null);
  }
  return {lab, dso, dio, dpo, ccc, ar, ap, inv};
}
const daysChart = (id, s) => { const C = BM.charts.colors();
  BM.charts.make(id, {type:"line", data:{labels:s.lab, datasets:[
    {label:L("DSO","فترة التحصيل"), data:s.dso, borderColor:C.c1, backgroundColor:C.c1, tension:.25, pointRadius:2, spanGaps:false},
    {label:L("Inventory days","أيام المخزون"), data:s.dio, borderColor:C.c3, backgroundColor:C.c3, tension:.25, pointRadius:2},
    {label:L("DPO","فترة السداد"), data:s.dpo, borderColor:C.c4, backgroundColor:C.c4, tension:.25, pointRadius:2},
    {label:L("Cash conversion cycle","دورة التحول النقدي"), data:s.ccc, borderColor:C.c2, backgroundColor:C.c2, borderWidth:3, tension:.25, pointRadius:2}]},
    options:{scales:{y:{ticks:{callback:v => Math.round(v)}}}, plugins:{tooltip:{callbacks:{label:c => " " + c.dataset.label + ": " + (c.raw == null ? L("N/A","غير متوفر") : Math.round(c.raw) + L(" days"," يوم"))}}}}}); };

BM.PAGES.workingcapital = {render(ctx){
  const v = ctx.view, w = AN.workingCapital(v);
  const lv = w.level ? AN.WC_LEVEL[w.level] : null;
  const rows = w.rows.map(r => {
    const tr = !U.has(r.chg) || !r.dir ? `<span class="muted small">—</span>` : Math.abs(r.chg) < (r.unit === "days" ? 1 : r.unit === "pct" ? 0.002 : 0.5) ? `<span class="muted">■ ${L("Stable","مستقر")}</span>`
      : `<span class="${r.chg * r.dir > 0 ? "pos" : "neg"}">${r.chg > 0 ? "▲" : "▼"} ${r.chg * r.dir > 0 ? L("Improved","تحسن") : L("Worse","تراجع")}</span>`;
    const R = w.R[r.key];
    return `<tr><td>${L(r.en, r.ar)}</td><td class="n"><b>${U.fmtUnit(r.unit, r.cur)}</b></td><td class="n">${U.fmtUnit(r.unit, r.prev)}</td><td class="n">${U.fmtDelta(r.unit, r.chg)}</td><td>${tr}</td><td>${R ? ui.level(R.level) : ""}</td></tr>`;
  }).join("");
  const html = `<div class="grid g2">${ui.card(L("Working-capital position","وضع رأس المال العامل"), lv ? `<div class="row" style="gap:12px;align-items:center"><span class="b b-${lv[0]}" style="font-size:15px;padding:4px 14px">${L(lv[1], lv[2])}</span><span class="small muted">${L("Compared with the {n}","مقارنة مع {n}",{n:w.priorNote})}</span></div>
      <ul class="small" style="margin:10px 0 0;padding-inline-start:18px;display:flex;flex-direction:column;gap:4px">${w.reasons.map(r => `<li>${U.esc(r)}</li>`).join("")}</ul>` : ui.empty(L("Insufficient data to assess working capital.","بيانات غير كافية لتقييم رأس المال العامل.")),
      {sub:L("Healthy · Stable · Under pressure · High risk","سليم · مستقر · تحت الضغط · مخاطر مرتفعة")})}
    ${ui.card(L("How the status is set","كيف يُحدد التقييم"), `<ul class="small" style="margin:0;padding-inline-start:18px;display:flex;flex-direction:column;gap:4px">
      <li>${L("High risk: current ratio below 1, or cycle above 150 days","مخاطر مرتفعة: النسبة المتداولة أقل من 1، أو الدورة أكثر من 150 يوماً")}</li>
      <li>${L("Under pressure: cycle up more than 15 days, DSO above the limit, current ratio below the minimum, or working capital growing 15 points faster than revenue","تحت الضغط: الدورة زادت أكثر من 15 يوماً، أو التحصيل فوق الحد، أو النسبة المتداولة دون الحد الأدنى، أو نمو رأس المال العامل أسرع من الإيرادات بـ15 نقطة")}</li>
      <li>${L("Healthy: cycle shortened or at most 60 days, with all limits respected","سليم: الدورة قصرت أو لا تتجاوز 60 يوماً مع احترام كل الحدود")}</li>
      <li>${L("Stable: none of the above","مستقر: لا شيء مما سبق")}</li></ul>
      <p class="small muted" style="margin:8px 0 0">${L("Limits are set in Settings → Risk thresholds.","الحدود تُضبط من الإعدادات ← حدود المخاطر.")}</p>`)}</div>` +
    ui.tableCard(L("Working-capital components — {p}","مكونات رأس المال العامل — {p}",{p:E.periodLabel(ctx.period)}),
      `<table><thead><tr><th>${L("Measure","المؤشر")}</th><th class="n">${L("Current","الحالي")}</th><th class="n">${L("Prior","السابق")}</th><th class="n">${L("Change","التغير")}</th><th>${L("Trend","الاتجاه")}</th><th>${L("Risk","المخاطر")}</th></tr></thead><tbody>${rows}</tbody></table>`,
      {sub:L("Prior = {n}. Days ratios use average balances over the period.","السابق = {n}. نسب الأيام تستخدم متوسط الأرصدة خلال الفترة.",{n:w.priorNote})}) +
    `<div class="grid g2">${ui.card(L("Working-capital days by month — {y}","أيام رأس المال العامل شهرياً — {y}",{y:E.fyName(ctx.period.year)}), `<div class="chart"><canvas id="wc1"></canvas></div>`, {sub:L("Single-month ratios","نسب الأشهر المنفردة")})}
      ${ui.card(L("Receivables, inventory and payables — month end","الذمم والمخزون والدائنون — نهاية الشهر"), `<div class="chart"><canvas id="wc2"></canvas></div>`)}</div>`;
  return {html, after(){
    const s = wcSeries(ctx.co, ctx.period.year), C = BM.charts.colors();
    daysChart("wc1", s);
    BM.charts.make("wc2", {type:"bar", data:{labels:s.lab, datasets:[
      {label:L("Receivables","الذمم المدينة"), data:s.ar, backgroundColor:C.c1, borderRadius:3},
      {label:L("Inventory","المخزون"), data:s.inv, backgroundColor:C.c3, borderRadius:3},
      {label:L("Payables","الذمم الدائنة"), data:s.ap, backgroundColor:C.c4, borderRadius:3}]}});
  }};
}};

/* ---------- aging blocks shared by AR and AP ---------- */
function agingBlocks(kind, a, co){
  const meta = a.agingMeta, s = a.aging;
  if (!s) return ui.card(L("Aging","الأعمار"), ui.empty(L("No {k} aging report is loaded, so overdue balances and concentration cannot be calculated. Nothing is estimated in its place.","لا يوجد تقرير أعمار {k} محمّل، لذلك لا يمكن احتساب المتأخرات والتركز. لا يتم تقدير أي شيء بدلاً منه.",{k:kind === "ar" ? L("receivables","للذمم المدينة") : L("payables","للذمم الدائنة")}),
    BM.can("import") && !co.demo ? `<a class="btn pri" href="#import" onclick="BM.wz.startAging('${kind}')">${L("Import an aging report","استيراد تقرير أعمار")}</a>` : ""));
  const rc = a.recon;
  const recon = !rc || rc.tb == null ? ui.banner("info", L("No trial balance at the aging date ({d}) to reconcile against.","لا يوجد ميزان مراجعة في تاريخ الأعمار ({d}) للمطابقة.",{d:meta.asOf}))
    : rc.ok ? ui.banner("good", `✔ ${L("Aging total {a} agrees with the trial balance {b} at {d}.","إجمالي الأعمار {a} يطابق ميزان المراجعة {b} في {d}.",{a:U.numPlain(rc.aging), b:U.numPlain(rc.tb), d:meta.asOf})}`)
    : ui.banner("warn", L("Aging total {a} differs from the trial balance {b} at {d} by {x}. Check that the aging covers all {k}.","إجمالي الأعمار {a} يختلف عن ميزان المراجعة {b} في {d} بمقدار {x}. تحقق أن تقرير الأعمار يشمل كل {k}.",{a:U.numPlain(rc.aging), b:U.numPlain(rc.tb), d:meta.asOf, x:U.numPlain(rc.diff), k:kind === "ar" ? L("customers","العملاء") : L("suppliers","الموردين")}));
  const bucketRows = s.b.map((v, i) => `<tr><td>${AG.bucketLabel(i)}</td><td class="n">${U.money(v)}</td><td class="n">${U.pct(s.total ? v / s.total : null)}</td><td style="width:40%"><div class="meter"><i style="width:${s.total ? Math.max(0, 100 * v / s.total) : 0}%;background:${i === 0 ? "var(--good)" : i < 3 ? "var(--navy-3)" : i < 5 ? "var(--warn)" : "var(--bad)"}"></i></div></td></tr>`).join("");
  const top = s.top.map(t => `<tr><td class="wrap">${U.esc(t.party)}</td><td class="n">${U.money(t.total)}</td><td class="n">${U.pct(t.share)}</td></tr>`).join("");
  return recon + `<div class="grid g2">` +
    ui.tableCard(L("Aging buckets — as at {d}","فئات الأعمار — كما في {d}",{d:meta.asOf}), `<table><thead><tr><th>${L("Days past due","أيام التأخر")}</th><th class="n">${L("Amount","المبلغ")}</th><th class="n">%</th><th></th></tr></thead><tbody>${bucketRows}
      <tr class="t"><td>${L("Total","الإجمالي")}</td><td class="n">${U.money(s.total)}</td><td class="n">100%</td><td></td></tr></tbody></table>`,
      {sub:L("{n} parties · {o} overdue · {g} over 90 days","{n} طرف · {o} متأخر · {g} أكثر من 90 يوماً",{n:s.parties, o:U.pct(s.pOverdue), g:U.pct(s.pOver90)})}) +
    ui.tableCard(L("Largest balances","أكبر الأرصدة"), `<table><thead><tr><th>${kind === "ar" ? L("Customer","العميل") : L("Supplier","المورد")}</th><th class="n">${L("Balance","الرصيد")}</th><th class="n">${L("Share","الحصة")}</th></tr></thead><tbody>${top}</tbody></table>`,
      {sub:L("Largest {a} · top 5 {b} · concentration index {h}","الأكبر {a} · أكبر 5 {b} · مؤشر التركز {h}",{a:U.pct(s.top1), b:U.pct(s.top5), h:s.hhi != null ? Math.round(s.hhi * 10000) : "—"}), act:ui.level(a.concentration)}) + `</div>
    <p class="small muted" style="margin:0">${L("Source: {s} · loaded {t}. Concentration index = sum of squared shares × 10,000 (above 2,500 is highly concentrated).","المصدر: {s} · تاريخ التحميل {t}. مؤشر التركز = مجموع مربعات الحصص × 10,000 (أكثر من 2,500 يعني تركزاً مرتفعاً).",{s:U.esc(meta.source === "demo" ? L("demo data","بيانات تجريبية") : meta.source), t:String(meta.at).slice(0,10)})}
    ${BM.can("import") && !co.demo ? ` · <a href="#import" onclick="BM.wz.startAging('${kind}')">${L("Replace","استبدال")}</a>` : ""}</p>`;
}

BM.PAGES.ar = {render(ctx){
  const v = ctx.view, a = AN.receivables(v), t = BM.state.settings.risk;
  const k = (t1, t2, val, sub, st) => `<div class="kpi ${st || ""}"><div class="t">${L(t1, t2)}</div><div class="v">${val}</div>${sub ? `<div class="d">${sub}</div>` : ""}</div>`;
  const gap = U.has(a.growthPY) && U.has(a.revGrowth) ? a.growthPY - a.revGrowth : null;
  const html = `<div class="kpis">
    ${k("Receivables balance","رصيد الذمم المدينة", U.money(a.bal), L("Month end","نهاية الشهر"))}
    ${k("Receivables ÷ annual revenue","الذمم ÷ الإيراد السنوي", U.pct(a.pctRev), L("Revenue annualised","الإيراد على أساس سنوي"))}
    ${k("DSO","فترة التحصيل", U.days(a.dso), L("Prior year: {v} · limit {m}","السنة السابقة: {v} · الحد {m}",{v:U.days(a.dsoPrev), m:t.maxDSO}), U.has(a.dso) ? (a.dso > t.maxDSO ? "s-bad" : "s-good") : "")}
    ${k("Growth vs prior year","النمو مقابل السنة السابقة", U.pct(a.growthPY), L("Revenue growth: {v}","نمو الإيرادات: {v}",{v:U.pct(a.revGrowth)}), U.has(gap) ? (gap > 0.15 ? "s-bad" : gap > 0.05 ? "s-warn" : "s-good") : "")}
    ${k("Growth since period start","النمو منذ بداية الفترة", U.pct(a.growthOpen), "")}
    ${k("Collections (derived)","التحصيلات (مشتقة)", U.money(a.collections), L("Collection rate {v}","نسبة التحصيل {v}",{v:U.pct(a.collectRate)}))}
  </div>
  <p class="small muted" style="margin:0">${L("Collections are not in a trial balance. They are derived as revenue + opening receivables − closing receivables; collection rate = collections ÷ (revenue + opening receivables). VAT, write-offs and non-trade items can distort them.","التحصيلات غير موجودة في ميزان المراجعة. تُشتق كالتالي: الإيرادات + الذمم أول الفترة − الذمم آخر الفترة؛ ونسبة التحصيل = التحصيلات ÷ (الإيرادات + الذمم أول الفترة). ضريبة القيمة المضافة والشطب والبنود غير التجارية قد تؤثر عليها.")}</p>` +
    agingBlocks("ar", a, ctx.co) +
    ui.card(L("Collection trend — {y}","اتجاه التحصيل — {y}",{y:E.fyName(ctx.period.year)}), `<div class="chart sm"><canvas id="ar1"></canvas></div>`, {sub:L("Month-end receivables and single-month DSO","الذمم المدينة في نهاية الشهر وفترة التحصيل الشهرية")});
  return {html, after(){
    const s = wcSeries(ctx.co, ctx.period.year), C = BM.charts.colors();
    BM.charts.make("ar1", {type:"bar", data:{labels:s.lab, datasets:[
      {label:L("Receivables","الذمم المدينة"), data:s.ar, backgroundColor:C.c1, borderRadius:3, yAxisID:"y"},
      {label:L("DSO (days)","فترة التحصيل (يوم)"), data:s.dso, type:"line", borderColor:C.c3, backgroundColor:C.c3, tension:.25, pointRadius:2, yAxisID:"y2"}]},
      options:{scales:{y2:{position:BM.U.isAr() ? "left" : "right", grid:{display:false}, ticks:{color:C.ink, callback:v => Math.round(v)}}}}});
  }};
}};

BM.PAGES.ap = {render(ctx){
  const v = ctx.view, a = AN.payables(v), t = BM.state.settings.risk;
  const k = (t1, t2, val, sub, st) => `<div class="kpi ${st || ""}"><div class="t">${L(t1, t2)}</div><div class="v">${val}</div>${sub ? `<div class="d">${sub}</div>` : ""}</div>`;
  const html = `<div class="kpis">
    ${k("Payables balance","رصيد الذمم الدائنة", U.money(a.bal), L("Month end","نهاية الشهر"))}
    ${k("DPO","فترة السداد", U.days(a.dpo), L("Prior year: {v} · limit {m}","السنة السابقة: {v} · الحد {m}",{v:U.days(a.dpoPrev), m:t.maxDPO}), U.has(a.dpo) ? (a.dpo > t.maxDPO ? "s-bad" : "s-good") : "")}
    ${k("Payables ÷ annual cost of sales","الدائنون ÷ تكلفة المبيعات السنوية", U.pct(a.pctCos), "")}
    ${k("Growth vs prior year","النمو مقابل السنة السابقة", U.pct(a.growthPY), L("Cost of sales growth: {v}","نمو تكلفة المبيعات: {v}",{v:U.pct(a.cosGrowth)}))}
    ${k("Purchases (derived)","المشتريات (مشتقة)", U.money(a.purchases), L("Cost of sales + change in inventory","تكلفة المبيعات + التغير في المخزون"))}
    ${k("Payments to suppliers (derived)","المدفوعات للموردين (مشتقة)", U.money(a.payments), L("Purchases + opening − closing payables","المشتريات + الدائنون أول الفترة − آخر الفترة"))}
  </div>` +
    ui.card(L("Supplier payment pressure","ضغط السداد للموردين"), (a.pressure.length ? `<ul class="small" style="margin:0;padding-inline-start:18px;display:flex;flex-direction:column;gap:4px">${a.pressure.map(p => `<li>${U.esc(p)}</li>`).join("")}</ul>` : `<p class="small" style="margin:0">${L("No payment-pressure indicator is triggered.","لا يوجد أي مؤشر على ضغط في السداد.")}</p>`) +
      `<p class="small muted" style="margin:8px 0 0">${L("Indicators: DPO above the limit, DPO up more than 15 days, payables growing 20 points faster than cost of sales, more than 30% of payables past due (needs an AP aging).","المؤشرات: فترة السداد فوق الحد، زيادة فترة السداد أكثر من 15 يوماً، نمو الدائنين أسرع من تكلفة المبيعات بـ20 نقطة، أكثر من 30% من الدائنين متأخرة (يتطلب تقرير أعمار للدائنين).")}</p>`,
      {act:ui.level(a.pressureLevel)}) +
    agingBlocks("ap", a, ctx.co) +
    ui.card(L("Payables trend — {y}","اتجاه الذمم الدائنة — {y}",{y:E.fyName(ctx.period.year)}), `<div class="chart sm"><canvas id="ap1"></canvas></div>`);
  return {html, after(){
    const s = wcSeries(ctx.co, ctx.period.year), C = BM.charts.colors();
    BM.charts.make("ap1", {type:"bar", data:{labels:s.lab, datasets:[
      {label:L("Payables","الذمم الدائنة"), data:s.ap, backgroundColor:C.c4, borderRadius:3, yAxisID:"y"},
      {label:L("DPO (days)","فترة السداد (يوم)"), data:s.dpo, type:"line", borderColor:C.c1, backgroundColor:C.c1, tension:.25, pointRadius:2, yAxisID:"y2"}]},
      options:{scales:{y2:{position:BM.U.isAr() ? "left" : "right", grid:{display:false}, ticks:{color:C.ink, callback:v => Math.round(v)}}}}});
  }};
}};
})();
