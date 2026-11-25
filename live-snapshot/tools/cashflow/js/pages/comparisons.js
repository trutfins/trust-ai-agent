/* =============================================================================
   pages/comparisons.js — Budget Analysis (§12) and Prior Year Analysis (§13)
   ============================================================================= */
(function(){
const U = BM.U, E = BM.E, ui = BM.ui, S = BM.state;

BM.PAGES.budget = {render(ctx){
  const co = ctx.co, cur = ctx.view.cur.is, f = E.compareFrame(co, ctx.period, "budget"), B = f.is, m = S.settings.materiality;
  const ot = BM.outlookTable(co, ctx.period.year, ctx.period.month);
  const outlook = ot ? ui.tableCard(L("Full-year outlook — {y}","نظرة على السنة الكاملة — {y}",{y:E.fyLabel(ctx.period.year)}), ot.table, {sub:BM.outlookNote(co, ctx.period.year, ctx.period.month)}) : "";
  if (!B) return {html: ui.banner("info", L("No budget is loaded for {y}. Import a budget (a trial balance with Scenario = Budget, or a budget column / monthly budget columns) to use this page.","لا توجد موازنة محمّلة لسنة {y}. استورد موازنة (ميزان مراجعة بسيناريو موازنة، أو عمود موازنة، أو أعمدة موازنة شهرية) لاستخدام هذه الصفحة.",{y:E.fyName(ctx.period.year)}) + ` <a href="#import" style="color:inherit">${L("Go to Inputs","انتقل إلى المدخلات")}</a>`) + outlook};
  const counts = {good:0, warn:0, bad:0, mute:0};
  const rows = BM.IS_LINES.map(([k, en, ar, dir, sty]) => {
    const a = cur && cur[k], b = B[k];
    if (sty === "ind" && [a, b].every(x => !x || Math.abs(x) < 0.5)) return "";
    const st = ui.varStatus(a, b, dir, "money"); if (counts[st.cls] != null) counts[st.cls]++;
    if (S.budgetMaterialOnly && st.cls !== "bad") return "";
    const d = U.sub(a, b), c = U.has(d) ? (d * dir > 0 ? "pos" : d * dir < 0 ? "neg" : "") : "";
    return `<tr class="${sty === "ind" ? "ind" : sty}"><td>${L(en, ar)}</td><td class="n">${U.money(a)}</td><td class="n">${U.money(b)}</td>
      <td class="n ${c}">${U.money(d)}</td><td class="n ${c}">${U.pct(U.varPct(a, b))}</td><td>${ui.varBadge(st)}</td></tr>`;
  }).join("");
  const sum = `<div class="kpis">
    <div class="kpi s-good"><div class="t">${L("Favourable","إيجابي")}</div><div class="v">${counts.good}</div></div>
    <div class="kpi"><div class="t">${L("Within tolerance","ضمن الحد المقبول")}</div><div class="v">${counts.mute}</div><div class="d">${L("unfavourable below {a}%","سلبي أقل من {a}%",{a:m.attentionPct})}</div></div>
    <div class="kpi s-warn"><div class="t">${L("Needs attention","يحتاج متابعة")}</div><div class="v">${counts.warn}</div><div class="d">${L("{a}% – {b}% unfavourable","سلبي بين {a}% و{b}%",{a:m.attentionPct, b:m.materialPct})}</div></div>
    <div class="kpi s-bad"><div class="t">${L("Material — unfavourable","جوهري — سلبي")}</div><div class="v">${counts.bad}</div><div class="d">${L("≥ {b}%{x}","≥ {b}%{x}",{b:m.materialPct, x: m.minAmount ? L(" and ≥ {n}"," و≥ {n}",{n:U.numPlain(m.minAmount)}) : ""})}</div></div></div>`;
  let html = (B.status === "derived" ? ui.banner("info", `${ui.statusTag("derived")} ${U.esc(B.note || "")}`) : "") + sum;
  html += ui.tableCard(L("Actual vs budget — {p}","الفعلي مقابل الموازنة — {p}",{p:E.periodLabel(ctx.period)}),
    `<table><thead><tr><th>${L("Line item","البند")}</th><th class="n">${L("Actual","الفعلي")}</th><th class="n">${L("Budget","الموازنة")}</th><th class="n">${L("Variance","الانحراف")}</th><th class="n">${L("Variance %","نسبة الانحراف")}</th><th>${L("Status","الحالة")}</th></tr></thead><tbody>${rows || `<tr><td colspan="6" class="muted">${L("No material unfavourable variances.","لا توجد انحرافات سلبية جوهرية.")}</td></tr>`}</tbody></table>`,
    {sub:L("Thresholds: attention {a}% · material {b}% — change them in Settings","الحدود: متابعة {a}% · جوهري {b}% — يمكن تغييرها من الإعدادات",{a:m.attentionPct, b:m.materialPct}),
     act:`<button class="btn sm" onclick="BM.state.budgetMaterialOnly=!BM.state.budgetMaterialOnly;BM.render()">${S.budgetMaterialOnly ? L("Show all lines","إظهار كل البنود") : L("Material variances only","الانحرافات الجوهرية فقط")}</button>`});
  html += outlook;
  html += ui.card(L("Cumulative revenue and net profit vs budget — {y}","الإيرادات وصافي الربح التراكمي مقابل الموازنة — {y}",{y:E.fyName(ctx.period.year)}), `<div class="chart sm"><canvas id="bv1"></canvas></div>`);
  return {html, after(){
    const y = ctx.period.year, C = BM.charts.colors(), lab = [], ar = [], br = [], an = [], bn = [];
    for (let mm = 1; mm <= 12; mm++){
      const a = E.incomeStatement(E.plPeriod(co, "actual", y, 1, mm)), b = E.incomeStatement(E.plPeriod(co, "budget", y, 1, mm));
      lab.push(E.pm(mm)); ar.push(a ? a.rev : null); br.push(b ? b.rev : null); an.push(a ? a.np : null); bn.push(b ? b.np : null);
    }
    BM.charts.make("bv1", {type:"line", data:{labels:lab, datasets:[
      {label:L("Revenue — actual","الإيرادات — فعلي"), data:ar, borderColor:C.c1, backgroundColor:C.c1, pointRadius:2, tension:.2},
      {label:L("Revenue — budget","الإيرادات — موازنة"), data:br, borderColor:C.c1, borderDash:[5,4], pointRadius:0, tension:.2},
      {label:L("Net profit — actual","صافي الربح — فعلي"), data:an, borderColor:C.c2, backgroundColor:C.c2, pointRadius:2, tension:.2},
      {label:L("Net profit — budget","صافي الربح — موازنة"), data:bn, borderColor:C.c2, borderDash:[5,4], pointRadius:0, tension:.2}]}});
  }};
}};

/* ------------------------------ Prior year ------------------------------ */
BM.PAGES.prioryear = {render(ctx){
  const co = ctx.co, y = ctx.period.year, m = ctx.period.month, cur = ctx.view.cur;
  const f = E.compareFrame(co, ctx.period, "py"), P = f.is;
  let pb = E.balanceSheet(co, "actual", y - 1, m), pbNote = L("same date last year","نفس التاريخ من السنة السابقة");
  if (!pb){ pb = E.balanceSheet(co, "actual", y, 0); pbNote = L("prior year end","نهاية السنة السابقة"); }
  const b = cur.bs, is = cur.is;
  const items = [
    ["Revenue","الإيرادات",is && is.rev, P && P.rev, 1],
    ["Gross profit","مجمل الربح",is && is.gp, P && P.gp, 1],
    ["EBITDA","EBITDA",is && is.ebitda, P && P.ebitda, 1],
    ["Operating expenses","المصروفات التشغيلية",is && is.opex, P && P.opex, -1],
    ["Net profit","صافي الربح",is && is.np, P && P.np, 1],
    ["Total assets","إجمالي الأصول",b && b.ta, pb && pb.ta, 0],
    ["Total liabilities","إجمالي الالتزامات",b && b.tl, pb && pb.tl, -1],
    ["Equity","حقوق الملكية",b && b.te, pb && pb.te, 1],
    ["Working capital","رأس المال العامل",b && b.wc, pb && pb.wc, 1],
    ["Cash and bank","النقد والبنوك",b && b.cashAll, pb && pb.cashAll, 1],
    ["Borrowings","القروض",b && b.debt, pb && pb.debt, -1]
  ];
  const pos = [], neg = [];
  const rows = items.map(([en, ar, a, p, dir], i) => {
    const d = U.sub(a, p), g = U.varPct(a, p);
    let tag = `<span class="muted small">—</span>`;
    if (U.has(d) && dir){
      const good = d * dir > 0;
      if (Math.abs(g || 0) >= 0.005){ tag = good ? ui.badge("good", L("Positive trend","اتجاه إيجابي")) : ui.badge("bad", L("Negative trend","اتجاه سلبي")); (good ? pos : neg).push([L(en, ar), g]); }
      else tag = ui.badge("mute", L("Stable","مستقر"));
    } else if (U.has(d)) tag = ui.badge("mute", d >= 0 ? L("Higher","أعلى") : L("Lower","أقل"));
    return `${i === 5 ? `<tr class="h"><td colspan="6">${L("Financial position — compared with {n}","المركز المالي — مقارنة مع {n}",{n:pbNote})}</td></tr>` : ""}
      <tr><td>${L(en, ar)}</td><td class="n">${U.money(a)}</td><td class="n">${U.money(p)}</td><td class="n">${U.money(d)}</td><td class="n">${U.pct(g)}</td><td>${tag}</td></tr>`;
  }).join("");
  let html = "";
  if (!P) html += ui.banner("info", L("No prior-year data is loaded for this period. Load the {y} trial balance (or a prior-year column in your file) to see growth.","لا توجد بيانات للسنة السابقة لهذه الفترة. حمّل ميزان مراجعة {y} (أو عمود السنة السابقة في ملفك) لعرض النمو.",{y:E.fyName(y - 1)}));
  else if (P.status === "estimated") html += ui.banner("warn", `${ui.statusTag("estimated")} ${U.esc(P.note || "")}`);
  const list = (arr, cls) => arr.length ? `<ul style="margin:0;padding-inline-start:18px;display:flex;flex-direction:column;gap:4px">${arr.map(x => `<li>${x[0]} <b class="${cls}">${U.pct(x[1])}</b></li>`).join("")}</ul>` : `<span class="muted small">${L("None","لا يوجد")}</span>`;
  html += `<div class="grid g2">${ui.card(L("Positive trends","اتجاهات إيجابية"), list(pos, "pos"))}${ui.card(L("Negative trends","اتجاهات سلبية"), list(neg, "neg"))}</div>`;
  html += ui.tableCard(L("Growth against prior year — {p}","النمو مقارنة بالسنة السابقة — {p}",{p:E.periodLabel(ctx.period)}),
    `<table><thead><tr><th>${L("Measure","المؤشر")}</th><th class="n">${L("Current","الحالي")}</th><th class="n">${L("Prior year","السنة السابقة")} ${ui.statusTag(P && P.status)}</th><th class="n">${L("Change","التغير")}</th><th class="n">${L("Growth","النمو")}</th><th>${L("Trend","الاتجاه")}</th></tr></thead><tbody>
    <tr class="h"><td colspan="6">${L("Performance — same period","الأداء — نفس الفترة")}</td></tr>${rows}</tbody></table>`);
  return {html};
}};
})();
