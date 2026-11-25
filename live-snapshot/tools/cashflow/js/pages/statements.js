/* =============================================================================
   pages/statements.js — Income Statement, Balance Sheet, Cash Flow
   ============================================================================= */
(function(){
const U = BM.U, E = BM.E, ui = BM.ui, S = BM.state;

/* income-statement layout: key, EN, AR, direction, style (ind = detail line, s = subtotal, t = total) */
BM.IS_LINES = [
  ["sales","Sales","المبيعات",1,"ind"],["service_rev","Service revenue","إيرادات الخدمات",1,"ind"],["other_op_rev","Other operating revenue","إيرادات تشغيلية أخرى",1,"ind"],
  ["rev","Revenue","الإيرادات",1,"s"],
  ["cogs","Cost of goods sold","تكلفة البضاعة المباعة",-1,"ind"],["direct_materials","Direct materials","المواد المباشرة",-1,"ind"],["direct_labor","Direct labour","العمالة المباشرة",-1,"ind"],["other_direct","Other direct costs","تكاليف مباشرة أخرى",-1,"ind"],
  ["cos","Cost of sales","تكلفة المبيعات",-1,"s"],
  ["gp","Gross profit","مجمل الربح",1,"s"],
  ["salaries","Salaries & benefits","الرواتب والمزايا",-1,"ind"],["rent","Rent","الإيجارات",-1,"ind"],["utilities","Utilities","المرافق",-1,"ind"],["marketing","Marketing","التسويق",-1,"ind"],
  ["transport","Transportation","النقل والمواصلات",-1,"ind"],["admin","Administrative expenses","المصروفات الإدارية",-1,"ind"],["other_opex","Other operating expenses","مصروفات تشغيلية أخرى",-1,"ind"],
  ["opex","Operating expenses (before depreciation)","المصروفات التشغيلية (قبل الاستهلاك)",-1,"s"],
  ["ebitda","EBITDA","الأرباح قبل الفوائد والضرائب والاستهلاك",1,"s"],
  ["depreciation","Depreciation & amortisation","الاستهلاك والإطفاء",-1,""],
  ["ebit","Operating profit","الربح التشغيلي",1,"s"],
  ["finance_income","Finance income","إيرادات التمويل",1,"ind"],["finance_costs","Finance costs","تكاليف التمويل",-1,"ind"],
  ["fx","Foreign exchange gains / (losses)","فروقات العملة",1,"ind"],["other_gl","Other gains / (losses)","أرباح / (خسائر) أخرى",1,"ind"],["other_rev","Other revenue","إيرادات أخرى",1,"ind"],
  ["pbt","Profit before tax","الربح قبل الضريبة",1,"s"],
  ["taxes","Income tax","ضريبة الدخل",-1,""],
  ["np","Net profit","صافي الربح",1,"t"]
];
const g = (o, k) => o ? o[k] : null;
const hideZero = (k, sty, vals) => sty === "ind" && !S.showAllLines && vals.every(x => !x || Math.abs(x) < 0.5);

BM.PAGES.income = {render(ctx){
  const co = ctx.co, v = ctx.view, cur = v.cur.is;
  const bud = v.basis === "budget" ? v.cmp : E.compareFrame(co, ctx.period, "budget");
  const py = v.basis === "py" ? v.cmp : E.compareFrame(co, ctx.period, "py");
  const B = bud.is, P = py.is, rev = cur && cur.rev;
  const rows = BM.IS_LINES.map(([k, en, ar, dir, sty]) => {
    const a = g(cur, k), b = g(B, k), p = g(P, k);
    if (hideZero(k, sty, [a, b, p])) return "";
    const vb = U.sub(a, b), vp = U.sub(a, p), st = ui.varStatus(a, b, dir, "money");
    const c = x => U.has(x) ? (x * dir > 0 ? "pos" : x * dir < 0 ? "neg" : "") : "";
    return `<tr class="${sty === "ind" ? "ind" : sty}"><td>${L(en, ar)}</td>
      <td class="n">${U.money(a)}</td><td class="n muted">${rev > 0 && U.has(a) ? U.pct(a / rev) : ""}</td>
      <td class="n">${U.money(b)}</td><td class="n ${c(vb)}">${U.money(vb)}</td><td class="n ${c(vb)}">${U.pct(U.varPct(a, b))}</td><td>${sty === "ind" ? "" : ui.varBadge(st)}</td>
      <td class="n">${U.money(p)}</td><td class="n ${c(vp)}">${U.money(vp)}</td><td class="n ${c(vp)}">${U.pct(U.varPct(a, p))}</td></tr>`;
  }).join("");
  const table = `<table><thead><tr><th>${L("Line item","البند")}</th><th class="n">${L("Actual","الفعلي")}</th><th class="n">${L("% of revenue","% من الإيراد")}</th>
    <th class="n">${L("Budget","الموازنة")} ${ui.statusTag(B && B.status)}</th><th class="n">${L("Variance","الانحراف")}</th><th class="n">%</th><th>${L("Status","الحالة")}</th>
    <th class="n">${L("Prior year","السنة السابقة")} ${ui.statusTag(P && P.status)}</th><th class="n">${L("Variance","الانحراف")}</th><th class="n">%</th></tr></thead><tbody>${rows}</tbody></table>`;
  let notes = "";
  if (!cur) notes += ui.viewNotes(v);
  if (!B) notes += ui.banner("info", L("No budget loaded for this period — budget columns show N/A.","لا توجد موازنة لهذه الفترة — أعمدة الموازنة تظهر غير متوفر."));
  else if (B.status === "derived") notes += ui.banner("info", `${ui.statusTag("derived")} ${U.esc(B.note || "")}`);
  if (!P) notes += ui.banner("info", L("No prior-year data for this period — prior-year columns show N/A.","لا توجد بيانات للسنة السابقة لهذه الفترة — أعمدة السنة السابقة تظهر غير متوفر."));
  else if (P.status === "estimated") notes += ui.banner("warn", `${ui.statusTag("estimated")} ${U.esc(P.note || "")}`);
  const html = notes + ui.tableCard(L("Income statement — {p}","قائمة الدخل — {p}",{p:E.periodLabel(ctx.period)}), table,
    {sub: L("Amounts in {c}","المبالغ بعملة {c}",{c:BM.reportCurrency().code}),
     act:`<button class="btn sm" onclick="BM.state.showAllLines=!BM.state.showAllLines;BM.render()">${S.showAllLines ? L("Hide empty lines","إخفاء البنود الفارغة") : L("Show all lines","إظهار كل البنود")}</button>`});
  return {html};
}};

/* ------------------------------ Balance sheet ------------------------------ */
const BS_LINES = [
  ["h","Current assets","الأصول المتداولة"],["cash","Cash on hand","النقد في الصندوق"],["bank","Bank balances","الأرصدة لدى البنوك"],["ar","Accounts receivable","الذمم المدينة"],
  ["inventory","Inventory","المخزون"],["prepayments","Prepayments & advances","المدفوعات المقدمة"],["other_ca","Other current assets","أصول متداولة أخرى"],["tca","Total current assets","إجمالي الأصول المتداولة","s"],
  ["h","Non-current assets","الأصول غير المتداولة"],["fixed_assets","Fixed assets (net)","الأصول الثابتة (بالصافي)"],["intangibles","Intangible assets","الأصول غير الملموسة"],["other_nca","Other non-current assets","أصول غير متداولة أخرى"],
  ["tnca","Total non-current assets","إجمالي الأصول غير المتداولة","s"],["ta","TOTAL ASSETS","إجمالي الأصول","t"],
  ["h","Current liabilities","الالتزامات المتداولة"],["ap","Accounts payable","الذمم الدائنة"],["st_loans","Short-term loans & overdrafts","القروض قصيرة الأجل"],["accrued","Accrued expenses","المصروفات المستحقة"],
  ["other_cl","Other current liabilities","التزامات متداولة أخرى"],["tcl","Total current liabilities","إجمالي الالتزامات المتداولة","s"],
  ["h","Non-current liabilities","الالتزامات غير المتداولة"],["lt_loans","Long-term loans","القروض طويلة الأجل"],["other_ncl","Other non-current liabilities","التزامات غير متداولة أخرى"],
  ["tncl","Total non-current liabilities","إجمالي الالتزامات غير المتداولة","s"],["tl","Total liabilities","إجمالي الالتزامات","s"],
  ["h","Equity","حقوق الملكية"],["capital","Paid-in capital","رأس المال المدفوع"],["reserves","Reserves","الاحتياطيات"],["retained","Retained earnings","الأرباح المدورة"],
  ["other_equity","Other equity","حقوق ملكية أخرى"],["cye","Current-year profit / (loss)","ربح / (خسارة) السنة الحالية"],["te","Total equity","إجمالي حقوق الملكية","s"],
  ["tle","TOTAL LIABILITIES AND EQUITY","إجمالي الالتزامات وحقوق الملكية","t"]
];
BM.balanceCheck = b => {
  if (!b) return "";
  if (Math.abs(b.diff) <= 1) return ui.banner("good", `✔ <b>${L("Balance sheet balances:","الميزانية متوازنة:")}</b> ${L("Assets {a} = Liabilities {l} + Equity {e}","الأصول {a} = الالتزامات {l} + حقوق الملكية {e}",{a:U.numPlain(b.ta*BM.fxFactor()), l:U.numPlain(b.tl*BM.fxFactor()), e:U.numPlain(b.te*BM.fxFactor())})}`);
  return ui.banner("bad", `✖ <b>${L("The balance sheet does NOT balance.","الميزانية غير متوازنة.")}</b> ${L("Assets − (Liabilities + Equity) = {d}.","الأصول − (الالتزامات + حقوق الملكية) = {d}.",{d:U.numPlain(b.diff*BM.fxFactor())})}
    ${b.unmappedN ? L(" {n} unmapped account(s) hold a net {x}."," {n} حساب/حسابات غير مصنفة صافيها {x}.",{n:b.unmappedN, x:U.numPlain(b.unmapped*BM.fxFactor())}) : ""}
    ${Math.abs(b.tbDiff) > 1 ? L(" The trial balance itself is out by {x}."," ميزان المراجعة نفسه غير متوازن بفرق {x}.",{x:U.numPlain(b.tbDiff*BM.fxFactor())}) : ""}
    <a href="#mapping" style="color:inherit">${L("Open Account Mapping","افتح تصنيف الحسابات")}</a>`);
};

BM.PAGES.balance = {render(ctx){
  const co = ctx.co, y = ctx.period.year, m = ctx.period.month;
  const b = ctx.view.cur.bs;
  const py = E.balanceSheet(co, "actual", y, 0);                  // prior year end
  const pySame = E.balanceSheet(co, "actual", y - 1, m);
  const bud = E.balanceSheet(co, "budget", y, m);
  if (!b) return {html: ui.banner("bad", L("No balance sheet is available at {p}. The trial balance for this month-end is missing or contains only income-statement accounts.","لا توجد ميزانية في {p}. ميزان المراجعة لنهاية هذا الشهر غير موجود أو يحتوي حسابات قائمة الدخل فقط.",{p:E.pDate(y, m, true)}))};
  const rows = BS_LINES.map(([k, en, ar, sty]) => {
    if (k === "h") return `<tr class="h"><td colspan="7">${L(en, ar)}</td></tr>`;
    const a = b[k], p = g(py, k), s = g(pySame, k), bu = g(bud, k);
    if (!sty && [a, p, s, bu].every(x => !x || Math.abs(x) < 0.5)) return "";
    const ch = U.sub(a, p);
    return `<tr class="${sty || "ind"}"><td>${L(en, ar)}</td><td class="n">${U.money(a)}</td><td class="n muted">${b.ta ? U.pct(a / (["tcl","tl","te","tle","ap","st_loans","accrued","other_cl","lt_loans","other_ncl","tncl","capital","reserves","retained","other_equity","cye"].indexOf(k) >= 0 ? b.tle : b.ta)) : ""}</td>
      <td class="n">${U.money(p)}</td><td class="n">${U.money(ch)}</td><td class="n">${U.money(s)}</td><td class="n">${U.money(bu)}</td></tr>`;
  }).join("") + (b.unmappedN ? `<tr class="h"><td colspan="7">${L("Not included above","غير مدرج أعلاه")}</td></tr><tr class="ind"><td class="neg">${L("Unmapped accounts (net debit)","حسابات غير مصنفة (صافي مدين)")}</td><td class="n neg">${U.money(b.unmapped)}</td><td colspan="5"></td></tr>` : "");
  const table = `<table><thead><tr><th>${L("Line item","البند")}</th><th class="n">${E.pDate(y, m)}</th><th class="n">%</th><th class="n">${E.fyEndLabel(y - 1)}</th><th class="n">${L("Change","التغير")}</th><th class="n">${E.pDate(y - 1, m)}</th><th class="n">${L("Budget","الموازنة")}</th></tr></thead><tbody>${rows}</tbody></table>`;
  return {html: BM.balanceCheck(b) + ui.tableCard(L("Statement of financial position — {d}","قائمة المركز المالي — {d}",{d:E.pDate(y, m, true)}), table,
    {sub:L("Pre-closing trial balance: the current-year result is shown as a separate equity line.","ميزان مراجعة قبل الإقفال: نتيجة السنة الحالية تظهر كبند مستقل في حقوق الملكية.")})};
}};

/* ------------------------------ Cash flow ------------------------------ */
const CF_LINES = [
  ["h","Operating activities","الأنشطة التشغيلية"],["np","Net profit","صافي الربح",1],["dep","Depreciation & amortisation","الاستهلاك والإطفاء",1],
  ["dAR","(Increase) / decrease in receivables","(الزيادة) / النقص في الذمم المدينة",1],["dInv","(Increase) / decrease in inventory","(الزيادة) / النقص في المخزون",1],
  ["dPrep","(Increase) / decrease in prepayments","(الزيادة) / النقص في المدفوعات المقدمة",1],["dOCA","(Increase) / decrease in other current assets","(الزيادة) / النقص في الأصول المتداولة الأخرى",1],
  ["dAP","Increase / (decrease) in payables","الزيادة / (النقص) في الذمم الدائنة",1],["dAcc","Increase / (decrease) in accrued expenses","الزيادة / (النقص) في المصروفات المستحقة",1],
  ["dOCL","Increase / (decrease) in other current liabilities","الزيادة / (النقص) في الالتزامات المتداولة الأخرى",1],["dONCL","Increase / (decrease) in non-current provisions","الزيادة / (النقص) في المخصصات غير المتداولة",1],
  ["cfo","Net cash from operating activities","صافي النقد من الأنشطة التشغيلية",1,"s"],
  ["h","Investing activities","الأنشطة الاستثمارية"],["capexN","Capital expenditure (inferred)","النفقات الرأسمالية (مستنتجة)",1],["dONCA","Other non-current assets","أصول غير متداولة أخرى",1],
  ["cfi","Net cash from investing activities","صافي النقد من الأنشطة الاستثمارية",1,"s"],
  ["h","Financing activities","الأنشطة التمويلية"],["dST","Short-term loans — net","القروض قصيرة الأجل — صافي",1],["dLT","Long-term loans — net","القروض طويلة الأجل — صافي",1],
  ["eqMove","Equity movements (capital, dividends, other)","حركات حقوق الملكية (رأس المال، التوزيعات، أخرى)",1],["cff","Net cash from financing activities","صافي النقد من الأنشطة التمويلية",1,"s"],
  ["net","Net change in cash","صافي التغير في النقد",1,"t"],["open","Cash and bank — opening","النقد والبنوك — أول الفترة",1],["close","Cash and bank — closing","النقد والبنوك — آخر الفترة",1,"s"],
  ["fcf","Free cash flow (operating cash flow − capex)","التدفق النقدي الحر (التشغيلي − الرأسمالي)",1,"s"]
];
BM.PAGES.cashflow = {render(ctx){
  const v = ctx.view, c = v.cur.cf, k = v.cmp.cf;
  let html = ui.banner("warn", `<span class="st est">${L("Estimated / Derived","تقديري / مشتق")}</span> ${L("This cash flow is derived from the movement between two balance sheets plus the period result (indirect method). It is not taken from cash records. Capital expenditure is inferred as the change in net fixed and intangible assets plus depreciation.","هذه التدفقات مشتقة من التغير بين ميزانيتين مع نتيجة الفترة (الطريقة غير المباشرة)، وليست مأخوذة من سجلات النقد. النفقات الرأسمالية مستنتجة من التغير في صافي الأصول الثابتة وغير الملموسة مضافاً إليه الاستهلاك.")}`);
  if (c.na) return {html: html + ui.banner("bad", U.esc(c.na))};
  if (Math.abs(c.unrec) > 1) html += ui.banner("bad", `<b>${L("Unreconciled difference: {x}.","فرق غير مطابق: {x}.",{x:U.numPlain(c.unrec*BM.fxFactor())})}</b> ${L("The derived cash flow does not explain the change in cash because one of the balance sheets does not balance. Fix the mapping or trial balance first.","التدفق المشتق لا يفسر التغير في النقد لأن إحدى الميزانيتين غير متوازنة. أصلح التصنيف أو ميزان المراجعة أولاً.")}`);
  const val = (o, key) => !o || o.na ? null : key === "capexN" ? -o.capex : o[key];
  const rows = CF_LINES.map(([key, en, ar, dir, sty]) => {
    if (key === "h") return `<tr class="h"><td colspan="4">${L(en, ar)}</td></tr>`;
    const a = val(c, key), b = val(k, key);
    return `<tr class="${sty || "ind"}"><td>${L(en, ar)}</td><td class="n">${U.money(a)}</td><td class="n">${U.money(b)}</td><td class="n">${U.money(U.sub(a, b))}</td></tr>`;
  }).join("") + (Math.abs(c.unrec) > 1 ? `<tr class="ind"><td class="neg">${L("Unreconciled difference","فرق غير مطابق")}</td><td class="n neg">${U.money(c.unrec)}</td><td></td><td></td></tr>` : "");
  html += ui.tableCard(L("Cash flow statement (derived) — {p}","قائمة التدفقات النقدية (مشتقة) — {p}",{p:E.periodLabel(ctx.period)}),
    `<table><thead><tr><th>${L("Line item","البند")}</th><th class="n">${L("Actual","الفعلي")}</th><th class="n">${U.esc(v.label)}${k && k.na ? ` <span class="na" title="${U.esc(k.na)}">ⓘ</span>` : ""}</th><th class="n">${L("Difference","الفرق")}</th></tr></thead><tbody>${rows}</tbody></table>`);
  html += ui.card(L("Monthly operating cash flow — {y} (derived)","التدفق النقدي التشغيلي الشهري — {y} (مشتق)",{y:E.fyName(ctx.period.year)}), `<div class="chart sm"><canvas id="cf1"></canvas></div>`);
  return {html, after(){
    const co = ctx.co, y = ctx.period.year, C = BM.charts.colors(), lab = [], cfo = [], np = [];
    for (let m = 1; m <= 12; m++){ const f = E.frame(co, "actual", y, m, m); lab.push(E.pm(m)); cfo.push(f.cf && !f.cf.na ? f.cf.cfo : null); np.push(f.is ? f.is.np : null); }
    BM.charts.make("cf1", {type:"bar", data:{labels:lab, datasets:[
      {label:L("Operating cash flow","التدفق التشغيلي"), data:cfo, backgroundColor:cfo.map(x => x < 0 ? C.bad : C.c2), borderRadius:3},
      {label:L("Net profit","صافي الربح"), data:np, type:"line", borderColor:C.c1, backgroundColor:C.c1, pointRadius:2, tension:.25}]}});
  }};
}};
})();
