/* =============================================================================
   pages/report.js — Report Studio (§20), PDF export (§21), Excel export (§22)
   PDF: a dedicated A4 print layout (real text, selectable, Arabic shaped by
   the browser) printed through the browser's "Save as PDF". The same report
   can be downloaded as a standalone HTML file that prints identically.
   Excel: analytical results as numbers, one sheet per section.
   ============================================================================= */
(function(){
const U = BM.U, E = BM.E, S = BM.state, AN = BM.AN, IN = BM.IN, AG = BM.AG;
const RP = BM.report = {};
RP.SECTIONS = [
  ["execsummary","Executive Summary","الملخص التنفيذي"],["kpis","Key Performance Indicators","مؤشرات الأداء الرئيسية"],["trend","Multi-year Trend","الاتجاه متعدد السنوات"],
  ["income","Income Statement","قائمة الدخل"],["balance","Balance Sheet","قائمة المركز المالي"],["cashflow","Cash Flow (derived)","التدفقات النقدية (مشتقة)"],
  ["ratios","Financial Ratios","النسب المالية"],["workingcapital","Working Capital","رأس المال العامل"],["ar","Accounts Receivable","الذمم المدينة"],
  ["ap","Accounts Payable","الذمم الدائنة"],["budget","Budget Analysis","تحليل الموازنة"],["prioryear","Prior Year Analysis","تحليل السنة السابقة"],
  ["industry","Industry Analysis","التحليل القطاعي"],["operational","Operational Analysis","التحليل التشغيلي"],["risk","Risk Analysis","تحليل المخاطر"],
  ["commentary","Management Commentary","التعليق الإداري"],["limits","Data Sources & Limits of the Analysis","مصادر البيانات وحدود التحليل"]];

/* ---------- small helpers (plain text values for print) ---------- */
const na = () => `<span class="na">${L("N/A","غير متوفر")}</span>`;
const f = (unit, v) => U.has(v) ? U.fmtUnit(unit, v) : na();
const fd = (unit, v) => U.has(v) ? U.fmtDelta(unit, v) : na();
const chip = s => s && s.cls !== "none" ? `<span class="chip ${s.cls}">${s.text}</span>` : `<span class="muted">—</span>`;
const lvl = l => l ? `<span class="chip ${IN.LEVEL[l][0]}">${L(IN.LEVEL[l][1], IN.LEVEL[l][2])}</span>` : `<span class="chip mute">${L("Insufficient data","بيانات غير كافية")}</span>`;
const tbl = (head, rows, cls) => `<table class="${cls || ""}"><thead><tr>${head.map(h => `<th${h[1] ? ` class="n"` : ""}>${h[0]}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
const note = t => `<p class="note">${t}</p>`;

/* AI commentary generated on the Commentary page for this company and period (kept in memory only) */
const aiBlock = (x) => { const a = BM.cmUI && BM.cmUI.ai, v = x.view;
  if (!a || !a.text || a.key !== v.co.id + "|" + E.periodLabel(v.period)) return "";
  return `<div class="cm ai"><h3>${L("Smart CFO commentary (AI-generated)","تعليق المدير المالي الذكي (مولّد بالذكاء الاصطناعي)")}</h3>
  <p class="note">${L("Generated on {d} from the figures in this report. Check every figure against the statements before use.","أُنشئ بتاريخ {d} من أرقام هذا التقرير. راجع كل رقم مقابل القوائم قبل الاستخدام.",{d:a.at.slice(0,10)})}</p>
  ${U.esc(a.text).split(/\n{2,}/).map(t => `<p>${t.replace(/\n/g,"<br>")}</p>`).join("")}</div>
  <h3 style="margin-top:14pt">${L("Rule-based commentary (computed from the data)","التعليق المحسوب آلياً من البيانات")}</h3>`; };

/* off-screen chart → PNG (always light palette for paper) */
const PAL = {c1:"#0E2238", c2:"#C9A15A", c3:"#5B6878", c4:"#8FA9BF", grid:"#E3E9EF", ink:"#55697A"};
function chartImg(cfg, w, h){
  if (typeof Chart === "undefined") return "";
  const box = document.createElement("div"); box.style.cssText = `position:fixed;left:-10000px;top:0;width:${w}px;height:${h}px`;
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h; box.appendChild(cv); document.body.appendChild(box);
  const pct = cfg.pct; delete cfg.pct;
  cfg.options = Object.assign({responsive:false, animation:false, devicePixelRatio:2,
    plugins:{legend:{position:"bottom", labels:{boxWidth:10, boxHeight:10, color:PAL.ink, font:{size:11}}}},
    scales:{x:{reverse:U.isAr(), grid:{display:false}, ticks:{color:PAL.ink, font:{size:10}}},
      y:{position:U.isAr() ? "right" : "left", grid:{color:PAL.grid}, ticks:{color:PAL.ink, font:{size:10}, callback:v => pct ? Math.round(v * 100) + "%" : U.short(v)}}}}, cfg.options || {});
  let url = "";
  try { const ch = new Chart(cv.getContext("2d"), cfg); url = cv.toDataURL("image/png"); ch.destroy(); } catch(e){ console.error(e); }
  box.remove();
  return url ? `<figure class="fig"><img src="${url}" alt=""></figure>` : "";
}
function monthly(co, y){ const out = []; for (let m = 1; m <= 12; m++) out.push(E.frame(co, "actual", y, m, m)); return out; }

/* ---------- section builders ---------- */
const B = {};
/* data sources and limits — what the report is built on, and what it is not */
B.limits = (x) => { const v = x.view, co = v.co, snaps = Object.values(co.snapshots || {});
  const act = snaps.filter(t => t.scenario === "actual"), bud = snaps.filter(t => t.scenario === "budget");
  const ym = t => t.year + "-" + String(t.month).padStart(2, "0"), rng = a => a.length ? `<bdi dir="ltr">${a.map(ym).sort()[0]} → ${a.map(ym).sort().slice(-1)[0]}</bdi>` : "";
  const ag = k => co.aging && co.aging[k] ? L("loaded, as of {d}","محمّلة بتاريخ {d}",{d:`<bdi dir="ltr">${U.esc(co.aging[k].asOf || "—")}</bdi>`}) : L("not loaded","غير محمّلة");
  const li = (k, t) => `<tr><td><b>${k}</b></td><td>${t}</td></tr>`;
  return tbl([[L("Item","البند")],[L("Status","الحالة")]], [
    li(L("Trial balances (actual)","موازين المراجعة (فعلي)"), act.length ? L("{n} period(s): {r}","{n} فترة: {r}",{n:act.length, r:rng(act)}) : L("none","لا يوجد")),
    li(L("Budget","الموازنة"), bud.length ? L("{n} period(s): {r}","{n} فترة: {r}",{n:bud.length, r:rng(bud)}) : L("not loaded — budget comparisons are not shown","غير محمّلة — لا تُعرض مقارنات الموازنة")),
    li(L("Receivables aging","أعمار الذمم المدينة"), ag("ar")), li(L("Payables aging","أعمار الذمم الدائنة"), ag("ap")),
    li(L("Cash flow","التدفقات النقدية"), x.cf ? L("Derived by the indirect method from balance movements between two trial balances — an estimate, not a bank cash book.","مشتقة بالطريقة غير المباشرة من حركة الأرصدة بين ميزانَي مراجعة — تقدير وليست دفتر نقدية بنكي.") : L("Not available — needs the trial balance at the start of the period.","غير متوفرة — تحتاج ميزان المراجعة في بداية الفترة.")),
    li(L("Full-year outlook","توقعات نهاية السنة"), L("Estimates: latest estimate = actual to date + remaining budget; run-rate = actual to date annualised. Not a forecast of events.","تقديرات: التقدير الأحدث = الفعلي حتى تاريخه + المتبقي من الموازنة؛ معدل التشغيل = الفعلي حتى تاريخه على أساس سنوي. ليست تنبؤاً بالأحداث.")),
    li(L("Commentary","التعليق"), L("Computed from the figures; where a cause cannot be proven from the data it is stated as a possibility. AI text, when included, is marked as such.","محسوب من الأرقام؛ السبب الذي لا تثبته البيانات يُذكر كاحتمال. النص المولّد بالذكاء الاصطناعي، إن أُدرج، معلَّم بذلك.")),
    li(L("Data","البيانات"), co.demo ? `<b>${L("DEMO DATA — FOR ILLUSTRATION ONLY","بيانات تجريبية — للتوضيح فقط")}</b>` : L("Supplied by the company; not audited by TRUST unless agreed separately.","مقدمة من الشركة؛ غير مدققة من TRUST ما لم يُتفق على ذلك.")),
    li(L("Issued","تاريخ الإصدار"), U.iso(new Date()))]) + note(L("Missing data is shown as N/A and is never filled with assumed values.","البيانات الناقصة تظهر «غير متوفر» ولا تُملأ بقيم مفترضة.")); };
B.execsummary = (x) => { const s = IN.summary(x), band = IN.scoreBand(s.score);
  const li = arr => arr.length ? `<ul>${arr.map(a => `<li>${a}</li>`).join("")}</ul>` : `<p class="muted">${L("Nothing significant in this period.","لا شيء جوهري في هذه الفترة.")}</p>`;
  return `<div class="score"><div class="big">${s.score == null ? "—" : s.score}<small>/100</small></div><div>${band ? `<span class="chip ${band[0]}">${L(band[1], band[2])}</span>` : ""}
    <table class="mini">${s.parts.map(p => `<tr><td>${L(p[0], p[1])} (${p[2]})</td><td class="n">${p[3] == null ? L("n/a","غ/م") : Math.round(p[3] * 100) + "%"}</td></tr>`).join("")}</table></div></div>
    <div class="cols"><div><h3>${L("Key positive developments","أهم التطورات الإيجابية")}</h3>${li(s.positives.map(U.esc))}</div><div><h3>${L("Key concerns","أهم المخاوف")}</h3>${li(s.concerns.map(U.esc))}</div></div>
    <div class="cols"><div><h3>${L("Financial risks","المخاطر المالية")}</h3>${li(s.risks.map(r => `${lvl(r.level)} <b>${L(r.en, r.ar)}</b> — ${U.esc(r.evidence[0])}`))}</div><div><h3>${L("Management priorities","أولويات الإدارة")}</h3>${li(s.priorities.map(U.esc))}</div></div>
    <h3>${L("Financial outlook","النظرة المالية")}</h3><p>${U.esc(s.outlook)}</p>`; };
B.kpis = (x, o) => { const v = x.view, Rc = x.R, Rk = BM.ratios(v.cmp), py = x.pr.f;
  const xc = {growth: v.cur.is && py.is ? U.varPct(v.cur.is.rev, py.is.rev) : null}, xk = {growth: BM.cmpGrowth(v, py)};
  let h = "";
  BM.KPIS.forEach(g => { h += `<h3>${L(g[0], g[1])}</h3>` + tbl([[L("Indicator","المؤشر")],[L("Actual","الفعلي"),1],[U.esc(v.label),1],[L("Variance","الانحراف"),1],[L("Variance %","نسبة الانحراف"),1],[L("Status","الحالة")]],
    g[2].map(d => { const a = d[5](v.cur, Rc, xc), b = d[5](v.cmp, Rk, xk), df = U.sub(a, b); return `<tr><td>${L(d[1], d[2])}</td><td class="n"><b>${f(d[3], a)}</b></td><td class="n">${f(d[3], b)}</td><td class="n">${fd(d[3], df)}</td><td class="n">${d[3] === "money" ? f("pct", U.varPct(a, b)) : ""}</td><td>${chip(BM.ui.varStatus(a, b, d[4], d[3]))}</td></tr>`; })); });
  if (o.charts){ const A = monthly(x.view.co, x.view.period.year), Bd = []; for (let m = 1; m <= 12; m++) Bd.push(E.frame(x.view.co, "budget", x.view.period.year, m, m));
    h += chartImg({type:"bar", data:{labels:A.map((z, i) => E.pm(i + 1)), datasets:[{label:L("Revenue — actual","الإيرادات — فعلي"), data:A.map(z => z.is ? z.is.rev * BM.fxFactor() : null), backgroundColor:PAL.c1}, {label:L("Revenue — budget","الإيرادات — موازنة"), type:"line", data:Bd.map(z => z.is ? z.is.rev * BM.fxFactor() : null), borderColor:PAL.c3, borderDash:[5,4], pointRadius:2}]}}, 900, 300);
    h += chartImg({type:"line", pct:true, data:{labels:A.map((z, i) => E.pm(i + 1)), datasets:[["Gross margin","الهامش الإجمالي","gp",PAL.c1],["EBITDA margin","هامش EBITDA","ebitda",PAL.c2],["Net margin","هامش صافي الربح","np",PAL.c3]].map(d => ({label:L(d[0], d[1]), data:A.map(z => z.is && z.is.rev > 0 ? z.is[d[2]] / z.is.rev : null), borderColor:d[3], pointRadius:2, tension:.25}))}}, 900, 260); }
  return h; };
B.income = (x) => { const v = x.view, cur = v.cur.is, bud = x.bis, py = x.pis, rev = cur && cur.rev;
  const rows = BM.IS_LINES.map(([k, en, ar, dir, sty]) => { const a = cur && cur[k], b = bud && bud[k], p = py && py[k];
    if (sty === "ind" && [a, b, p].every(z => !z || Math.abs(z) < 0.5)) return "";
    return `<tr class="${sty === "ind" ? "ind" : sty}"><td>${L(en, ar)}</td><td class="n">${f("money", a)}</td><td class="n muted">${rev > 0 && U.has(a) ? U.pct(a / rev) : ""}</td><td class="n">${f("money", b)}</td><td class="n">${f("money", U.sub(a, b))}</td><td class="n">${f("pct", U.varPct(a, b))}</td><td class="n">${f("money", p)}</td><td class="n">${f("pct", U.varPct(a, p))}</td></tr>`; });
  return tbl([[L("Line item","البند")],[L("Actual","الفعلي"),1],["%",1],[L("Budget","الموازنة"),1],[L("Variance","الانحراف"),1],["%",1],[L("Prior year","السنة السابقة"),1],["%",1]], rows) +
    (bud && bud.status !== "actual" ? note(L("Budget: {n}","الموازنة: {n}",{n:U.esc(bud.note || L("derived","مشتقة"))})) : "") + (py && py.status === "estimated" ? note(L("Prior year: {n}","السنة السابقة: {n}",{n:U.esc(py.note)})) : ""); };
B.balance = (x) => { const b = x.bs; if (!b) return note(L("Balance sheet not available for this period.","الميزانية غير متوفرة لهذه الفترة."));
  const p = E.balanceSheet(x.view.co, "actual", x.view.period.year, 0);
  const L2 = [["h","Assets","الأصول"],["cash","Cash on hand","النقد في الصندوق"],["bank","Bank balances","الأرصدة لدى البنوك"],["ar","Accounts receivable","الذمم المدينة"],["inventory","Inventory","المخزون"],["prepayments","Prepayments & advances","المدفوعات المقدمة"],["other_ca","Other current assets","أصول متداولة أخرى"],["tca","Total current assets","إجمالي الأصول المتداولة","s"],
    ["fixed_assets","Fixed assets (net)","الأصول الثابتة (بالصافي)"],["intangibles","Intangible assets","الأصول غير الملموسة"],["other_nca","Other non-current assets","أصول غير متداولة أخرى"],["ta","Total assets","إجمالي الأصول","t"],
    ["h","Liabilities and equity","الالتزامات وحقوق الملكية"],["ap","Accounts payable","الذمم الدائنة"],["st_loans","Short-term loans","القروض قصيرة الأجل"],["accrued","Accrued expenses","المصروفات المستحقة"],["other_cl","Other current liabilities","التزامات متداولة أخرى"],["tcl","Total current liabilities","إجمالي الالتزامات المتداولة","s"],
    ["lt_loans","Long-term loans","القروض طويلة الأجل"],["other_ncl","Other non-current liabilities","التزامات غير متداولة أخرى"],["tl","Total liabilities","إجمالي الالتزامات","s"],
    ["capital","Paid-in capital","رأس المال المدفوع"],["reserves","Reserves","الاحتياطيات"],["retained","Retained earnings","الأرباح المدورة"],["other_equity","Other equity","حقوق ملكية أخرى"],["cye","Current-year profit","ربح السنة الحالية"],["te","Total equity","إجمالي حقوق الملكية","s"],["tle","Total liabilities and equity","إجمالي الالتزامات وحقوق الملكية","t"]];
  const rows = L2.map(([k, en, ar, st]) => k === "h" ? `<tr class="h"><td colspan="4">${L(en, ar)}</td></tr>` : (!st && !b[k] && !(p && p[k])) ? "" : `<tr class="${st || "ind"}"><td>${L(en, ar)}</td><td class="n">${f("money", b[k])}</td><td class="n">${f("money", p && p[k])}</td><td class="n">${f("money", p ? b[k] - p[k] : null)}</td></tr>`);
  return tbl([[L("Line item","البند")],[U.month(b.month) + " " + b.year,1],[E.fyEndLabel(b.fy - 1),1],[L("Change","التغير"),1]], rows) +
    (Math.abs(b.diff) <= 1 ? note("✔ " + L("Assets = Liabilities + Equity.","الأصول = الالتزامات + حقوق الملكية.")) : `<p class="alert">✖ ${L("The balance sheet does not balance: difference {d}.","الميزانية غير متوازنة: الفرق {d}.",{d:U.numPlain(b.diff * BM.fxFactor())})}</p>`); };
B.cashflow = (x, o) => { const c = x.view.cur.cf; if (c.na) return note(U.esc(c.na));
  const k = x.view.cmp.cf && !x.view.cmp.cf.na ? x.view.cmp.cf : null;
  const L3 = [["np","Net profit","صافي الربح"],["dep","Depreciation & amortisation","الاستهلاك والإطفاء"],["wc","Working-capital movements","حركات رأس المال العامل"],["cfo","Net cash from operating activities","صافي النقد من الأنشطة التشغيلية","s"],["capexN","Capital expenditure (inferred)","النفقات الرأسمالية (مستنتجة)"],["dONCA","Other non-current assets","أصول غير متداولة أخرى"],["cfi","Net cash from investing activities","صافي النقد من الأنشطة الاستثمارية","s"],
    ["dST","Short-term loans — net","القروض قصيرة الأجل — صافي"],["dLT","Long-term loans — net","القروض طويلة الأجل — صافي"],["eqMove","Equity movements","حركات حقوق الملكية"],["cff","Net cash from financing activities","صافي النقد من الأنشطة التمويلية","s"],["net","Net change in cash","صافي التغير في النقد","t"],["open","Cash — opening","النقد — أول الفترة"],["close","Cash — closing","النقد — آخر الفترة","s"],["fcf","Free cash flow","التدفق النقدي الحر","s"]];
  const g = (o2, key) => !o2 ? null : key === "capexN" ? -o2.capex : o2[key];
  let h = `<p class="alert warn">${L("ESTIMATED / DERIVED — calculated from balance-sheet movements (indirect method), not from cash records.","تقديري / مشتق — محسوب من حركات الميزانية (الطريقة غير المباشرة) وليس من سجلات النقد.")}</p>` +
    tbl([[L("Line item","البند")],[L("Actual","الفعلي"),1],[U.esc(x.view.label),1]], L3.map(([key, en, ar, st]) => `<tr class="${st || "ind"}"><td>${L(en, ar)}</td><td class="n">${f("money", g(c, key))}</td><td class="n">${f("money", g(k, key))}</td></tr>`)) +
    (Math.abs(c.unrec) > 1 ? `<p class="alert">${L("Unreconciled difference: {d}.","فرق غير مطابق: {d}.",{d:U.numPlain(c.unrec * BM.fxFactor())})}</p>` : "");
  if (o.charts){ const A = []; for (let m = 1; m <= 12; m++){ const fr = E.frame(x.view.co, "actual", x.view.period.year, m, m); A.push(fr.cf && !fr.cf.na ? fr.cf.cfo * BM.fxFactor() : null); }
    h += chartImg({type:"bar", data:{labels:A.map((z, i) => E.pm(i + 1)), datasets:[{label:L("Monthly operating cash flow (derived)","التدفق النقدي التشغيلي الشهري (مشتق)"), data:A, backgroundColor:A.map(z => z < 0 ? "#B4372A" : PAL.c2)}]}}, 900, 240); }
  return h; };
B.ratios = (x) => { const R = x.R, RP = x.PR, RB = BM.ratios(x.bud);
  const cell = (k, r) => U.has(r.v) ? U.fmtUnit(BM.RATIO_BY[k][6], r.v) + (r.closing ? "*" : "") : `<span class="na">${r.nm ? L("Not meaningful","غير ذي دلالة") : L("N/A","غير متوفر")}</span>`;
  return Object.keys(BM.RATIO_GROUPS).map(g => `<h3>${L(BM.RATIO_GROUPS[g][0], BM.RATIO_GROUPS[g][1])}</h3>` + tbl([[L("Ratio","النسبة")],[L("Formula","المعادلة")],[L("Actual","الفعلي"),1],[L("Prior year","السنة السابقة"),1],[L("Budget","الموازنة"),1],[L("Risk","المخاطر")]],
    BM.RATIO_DEFS.filter(r => r[1] === g).map(r => `<tr><td>${L(r[2], r[3])}</td><td class="small">${L(r[4], r[5])}</td><td class="n"><b>${cell(r[0], R[r[0]])}</b></td><td class="n">${cell(r[0], RP[r[0]])}</td><td class="n">${cell(r[0], RB[r[0]])}</td><td>${R[r[0]].level ? lvl(R[r[0]].level) : ""}</td></tr>`))).join("") +
    note(L("Return and turnover ratios are annualised. * closing balance used (opening not available).","نسب العائد والدوران سنوية. * استُخدم الرصيد الختامي (الافتتاحي غير متوفر).")); };
B.workingcapital = (x, o) => { const w = x.wc, lv = w.level ? AN.WC_LEVEL[w.level] : null;
  let h = `<p>${lv ? `<span class="chip ${lv[0]}">${L(lv[1], lv[2])}</span> ` : ""}${w.reasons.map(U.esc).join(" ")}</p>` +
    tbl([[L("Measure","المؤشر")],[L("Current","الحالي"),1],[L("Prior","السابق"),1],[L("Change","التغير"),1]], w.rows.map(r => `<tr><td>${L(r.en, r.ar)}</td><td class="n">${f(r.unit, r.cur)}</td><td class="n">${f(r.unit, r.prev)}</td><td class="n">${fd(r.unit, r.chg)}</td></tr>`)) + note(L("Prior = {n}.","السابق = {n}.",{n:w.priorNote}));
  if (o.charts){ const A = monthly(x.view.co, x.view.period.year).map(fr => BM.ratios(fr));
    h += chartImg({type:"line", data:{labels:A.map((z, i) => E.pm(i + 1)), datasets:[["dso","DSO","فترة التحصيل",PAL.c1],["dio","Inventory days","أيام المخزون",PAL.c3],["dpo","DPO","فترة السداد",PAL.c4],["ccc","Cash conversion cycle","دورة التحول النقدي",PAL.c2]].map(d => ({label:L(d[1], d[2]), data:A.map(z => z[d[0]].v), borderColor:d[3], pointRadius:2, tension:.25}))},
      options:{scales:{y:{ticks:{callback:v => Math.round(v)}}}}}, 900, 260); }
  return h; };
const agingTbl = (a, kind) => { const s = a.aging; if (!s) return note(L("No aging report loaded — overdue and concentration analysis not available.","لا يوجد تقرير أعمار — تحليل المتأخرات والتركز غير متوفر."));
  return `<h3>${L("Aging as at {d}","الأعمار كما في {d}",{d:a.agingMeta.asOf})}</h3>` + tbl([[L("Bucket","الفئة")],[L("Amount","المبلغ"),1],["%",1]], s.b.map((v, i) => `<tr><td>${AG.bucketLabel(i)}</td><td class="n">${f("money", v)}</td><td class="n">${U.pct(s.total ? v / s.total : null)}</td></tr>`).concat([`<tr class="t"><td>${L("Total","الإجمالي")}</td><td class="n">${f("money", s.total)}</td><td class="n">100%</td></tr>`])) +
    `<h3>${kind === "ar" ? L("Largest customers","أكبر العملاء") : L("Largest suppliers","أكبر الموردين")}</h3>` + tbl([[L("Name","الاسم")],[L("Balance","الرصيد"),1],[L("Share","الحصة"),1]], s.top.map(t => `<tr><td>${U.esc(t.party)}</td><td class="n">${f("money", t.total)}</td><td class="n">${U.pct(t.share)}</td></tr>`)) +
    (a.recon && a.recon.tb != null ? note(a.recon.ok ? L("Aging agrees with the trial balance.","الأعمار تطابق ميزان المراجعة.") : L("Aging differs from the trial balance by {d}.","الأعمار تختلف عن ميزان المراجعة بمقدار {d}.",{d:U.numPlain(a.recon.diff)})) : ""); };
B.ar = (x) => { const a = x.ar;
  return tbl([[L("Measure","المؤشر")],[L("Value","القيمة"),1]], [
    [L("Receivables balance","رصيد الذمم المدينة"), f("money", a.bal)], [L("Receivables ÷ annual revenue","الذمم ÷ الإيراد السنوي"), f("pct", a.pctRev)], [L("DSO","فترة التحصيل"), f("days", a.dso)], [L("DSO — prior year","فترة التحصيل — السنة السابقة"), f("days", a.dsoPrev)],
    [L("Growth vs prior year","النمو مقابل السنة السابقة"), f("pct", a.growthPY)], [L("Revenue growth","نمو الإيرادات"), f("pct", a.revGrowth)], [L("Collections (derived)","التحصيلات (مشتقة)"), f("money", a.collections)], [L("Collection rate (derived)","نسبة التحصيل (مشتقة)"), f("pct", a.collectRate)]].map(r => `<tr><td>${r[0]}</td><td class="n">${r[1]}</td></tr>`)) + agingTbl(a, "ar"); };
B.ap = (x) => { const a = x.ap;
  return tbl([[L("Measure","المؤشر")],[L("Value","القيمة"),1]], [
    [L("Payables balance","رصيد الذمم الدائنة"), f("money", a.bal)], [L("DPO","فترة السداد"), f("days", a.dpo)], [L("DPO — prior year","فترة السداد — السنة السابقة"), f("days", a.dpoPrev)],
    [L("Growth vs prior year","النمو مقابل السنة السابقة"), f("pct", a.growthPY)], [L("Purchases (derived)","المشتريات (مشتقة)"), f("money", a.purchases)], [L("Payments to suppliers (derived)","المدفوعات للموردين (مشتقة)"), f("money", a.payments)]].map(r => `<tr><td>${r[0]}</td><td class="n">${r[1]}</td></tr>`)) +
    `<h3>${L("Supplier payment pressure","ضغط السداد للموردين")} ${lvl(a.pressureLevel)}</h3>` + (a.pressure.length ? `<ul>${a.pressure.map(p => `<li>${U.esc(p)}</li>`).join("")}</ul>` : `<p>${L("No indicator triggered.","لا يوجد مؤشر.")}</p>`) + agingTbl(a, "ap"); };
/* multi-year trend: one column per financial year */
B.trend = (x, o) => { const co = x.view.co, T = BM.trend(co), ys = T.years;
  if (ys.length < 2) return note(L("Fewer than two financial years are loaded — no trend can be shown.","تم تحميل أقل من سنتين ماليتين — لا يمكن عرض الاتجاه."));
  let i = 0; const rows = BM.TREND_ROWS.map(r => { if (r[0] === "h") return `<tr class="h"><td colspan="${ys.length + 2}">${L(r[1], r[2])}</td></tr>`;
    const z = T.rows[i++]; return `<tr><td>${L(z.en, z.ar)}</td>${z.vals.map(v => `<td class="n">${f(z.unit, v)}</td>`).join("")}<td class="n">${z.unit === "money" ? f("pct", z.cagr) : ""}</td></tr>`; });
  let h = tbl([[L("Measure","المؤشر")]].concat(ys.map(y => [BM.trendColLabel(y, co), 1])).concat([["CAGR",1]]), rows) +
    note(L("Partial years are year to date. CAGR uses complete years only. Ratios are annualised.","السنوات الجزئية منذ بداية السنة. النمو المركب يستخدم السنوات الكاملة فقط. النسب محسوبة على أساس سنوي."));
  if (o.charts){ const g = k => T.rows.find(r => r.key === k).vals, lab = ys.map(y => E.fyName(y.fy, co) + (y.full ? "" : " *"));
    h += chartImg({type:"bar", data:{labels:lab, datasets:[{label:L("Revenue","الإيرادات"), data:g("rev").map(v => U.has(v) ? v * BM.fxFactor() : null), backgroundColor:PAL.c1}, {label:L("Net profit","صافي الربح"), data:g("np").map(v => U.has(v) ? v * BM.fxFactor() : null), backgroundColor:PAL.c2}]}}, 900, 260); }
  return h; };
const outlookPrint = (x) => { const co = x.view.co, ot = E.outlookFY(co, x.view.period.year, x.view.period.month); if (!ot.ytd) return "";
  const ln = [["rev","Revenue","الإيرادات"],["gp","Gross profit","مجمل الربح"],["opex","Operating expenses","المصروفات التشغيلية"],["ebitda","EBITDA","EBITDA"],["np","Net profit","صافي الربح"]], g = (o, k) => o ? o[k] : null;
  return `<h3>${L("Full-year outlook — {y}","نظرة على السنة الكاملة — {y}",{y:E.fyLabel(x.view.period.year, co)})}</h3>` +
    tbl([[L("Line item","البند")],[L("Actual to date","الفعلي حتى تاريخه"),1],[L("Latest estimate","التقدير المحدث"),1],[L("Full-year budget","موازنة السنة"),1],[L("Run-rate","المعدل الجاري"),1],[L("Prior full year","السنة السابقة كاملة"),1]],
      ln.map(([k, en, ar]) => `<tr><td>${L(en, ar)}</td><td class="n">${f("money", g(ot.ytd, k))}</td><td class="n">${f("money", g(ot.le, k))}</td><td class="n">${f("money", g(ot.bud, k))}</td><td class="n">${f("money", g(ot.rr, k))}</td><td class="n">${f("money", g(ot.py, k))}</td></tr>`)) +
    note(U.esc(BM.outlookNote(co, x.view.period.year, x.view.period.month))); };
B.budget = (x) => { const cur = x.is, b = x.bis; if (!b) return note(L("No budget loaded for this period.","لا توجد موازنة لهذه الفترة.")) + outlookPrint(x);
  return outlookPrint(x) + tbl([[L("Line item","البند")],[L("Actual","الفعلي"),1],[L("Budget","الموازنة"),1],[L("Variance","الانحراف"),1],["%",1],[L("Status","الحالة")]],
    BM.IS_LINES.filter(l => l[4] !== "ind").map(([k, en, ar, dir, sty]) => `<tr class="${sty}"><td>${L(en, ar)}</td><td class="n">${f("money", cur && cur[k])}</td><td class="n">${f("money", b[k])}</td><td class="n">${f("money", U.sub(cur && cur[k], b[k]))}</td><td class="n">${f("pct", U.varPct(cur && cur[k], b[k]))}</td><td>${chip(BM.ui.varStatus(cur && cur[k], b[k], dir, "money"))}</td></tr>`)) +
    note(L("Thresholds: attention {a}%, material {m}%.","الحدود: متابعة {a}%، جوهري {m}%.",{a:S.settings.materiality.attentionPct, m:S.settings.materiality.materialPct})); };
B.prioryear = (x) => { const is = x.is, p = x.pis, b = x.bs, pb = x.pbs;
  const it = [["Revenue","الإيرادات",is && is.rev, p && p.rev],["Gross profit","مجمل الربح",is && is.gp, p && p.gp],["EBITDA","EBITDA",is && is.ebitda, p && p.ebitda],["Net profit","صافي الربح",is && is.np, p && p.np],
    ["Total assets","إجمالي الأصول",b && b.ta, pb && pb.ta],["Total liabilities","إجمالي الالتزامات",b && b.tl, pb && pb.tl],["Equity","حقوق الملكية",b && b.te, pb && pb.te],["Working capital","رأس المال العامل",b && b.wc, pb && pb.wc]];
  return tbl([[L("Measure","المؤشر")],[L("Current","الحالي"),1],[L("Prior year","السنة السابقة"),1],[L("Change","التغير"),1],[L("Growth","النمو"),1]], it.map(r => `<tr><td>${L(r[0], r[1])}</td><td class="n">${f("money", r[2])}</td><td class="n">${f("money", r[3])}</td><td class="n">${f("money", U.sub(r[2], r[3]))}</td><td class="n">${f("pct", U.varPct(r[2], r[3]))}</td></tr>`)) +
    note(L("Balance-sheet items compared with the {n}.","بنود الميزانية مقارنة مع {n}.",{n:x.pr.note})) + (p && p.status === "estimated" ? note(U.esc(p.note)) : ""); };
B.industry = (x) => { const rows = AN.industry(x.view);
  return `<p class="alert info">${L("Benchmark data unavailable — no industry benchmark database is connected. Internal trend analysis is shown.","بيانات المعايير القطاعية غير متوفرة — لا توجد قاعدة بيانات معايير. يُعرض تحليل الاتجاه الداخلي.")}</p>` +
    tbl([[L("Indicator","المؤشر")],[L("Current","الحالي"),1],[L("Prior year","السنة السابقة"),1],[L("Budget","الموازنة"),1],[L("Your target","مستهدفك"),1]], rows.map(r => `<tr><td>${L(r.en, r.ar)}</td><td class="n">${f(r.unit, r.cur)}</td><td class="n">${f(r.unit, r.py)}</td><td class="n">${f(r.unit, r.bu)}</td><td class="n">${f(r.unit, r.target)}</td></tr>`)); };
B.operational = (x) => tbl([[L("Indicator","المؤشر")],[L("Value","القيمة"),1],[L("Data","البيانات")],[L("Basis","الأساس")]], x.op.metrics.map(m => `<tr><td>${L(m.en, m.ar)}</td><td class="n">${f(m.unit, m.v)}</td><td>${L(AN.SRC[m.src][0], AN.SRC[m.src][1])}</td><td class="small">${m.why || ""}</td></tr>`));
B.risk = (x) => { const rs = IN.risks(x);
  return tbl([[L("Risk","المخاطرة")],[L("Severity","الخطورة")],[L("Evidence","الدليل")],[L("Financial impact","الأثر المالي")],[L("Recommended action","الإجراء المقترح")]],
    rs.map(r => `<tr><td><b>${L(r.en, r.ar)}</b></td><td>${lvl(r.data ? r.level : null)}</td><td class="small">${r.evidence.map(U.esc).join("<br>")}</td><td class="small">${U.esc(r.impact)}</td><td class="small">${U.esc(r.action)}</td></tr>`), "wrapall"); };
B.commentary = (x) => aiBlock(x) + IN.commentary(x).map(p => `<div class="cm ${p.tone}"><h3>${L(IN.SECTIONS[p.sec][0], IN.SECTIONS[p.sec][1])}</h3>
  <p><b>${L("What happened:","ما حدث:")}</b> ${U.esc(p.what)}</p><p><b>${L("Why:","لماذا:")}</b> ${U.esc(p.why)}</p><p><b>${L("Financial impact:","الأثر المالي:")}</b> ${U.esc(p.impact)}</p><p><b>${L("What to do:","ما يجب فعله:")}</b> ${U.esc(p.action)}</p></div>`).join("") || note(L("Commentary needs the income statement for this period.","التعليق يحتاج قائمة الدخل لهذه الفترة."));

/* ---------- full document ---------- */
RP.CSS = (lang) => `
@page{size:A4 portrait;margin:18mm 14mm 20mm 14mm;
  @bottom-left{content:"${BM.brandName(lang)} · ${lang === "ar" ? "تقرير إداري" : "Management report"}";font:8pt "IBM Plex Sans","IBM Plex Sans Arabic",sans-serif;color:#6B7D8C}
  @bottom-right{content:"${lang === "ar" ? "صفحة " : "Page "}" counter(page) "${lang === "ar" ? " من " : " of "}" counter(pages);font:8pt "IBM Plex Sans",sans-serif;color:#6B7D8C}}
@page:first{@bottom-left{content:none}@bottom-right{content:none}}
*{box-sizing:border-box}
.rpt{-webkit-print-color-adjust:exact;print-color-adjust:exact;font:10pt/1.45 "IBM Plex Sans","IBM Plex Sans Arabic",Tahoma,sans-serif;color:#14212C;font-variant-numeric:tabular-nums;max-width:190mm;margin:0 auto;background:#fff}
.rpt[dir="rtl"]{font-family:"IBM Plex Sans Arabic","IBM Plex Sans",Tahoma,sans-serif}
.rpt h1{font-size:26pt;color:#0E2238;margin:0;line-height:1.15}
.rpt h2{font-size:14pt;color:#0E2238;margin:0 0 8pt;padding-bottom:4pt;border-bottom:2pt solid #0E2238}
.rpt h3{font-size:10.5pt;color:#0E2238;margin:12pt 0 5pt}
.rpt p{margin:4pt 0}
.rpt ul{margin:3pt 0;padding-inline-start:16pt}.rpt li{margin:2pt 0}
.cover{min-height:250mm;display:flex;flex-direction:column;justify-content:space-between;padding:6mm 0}
.mark{display:flex;align-items:center;gap:10pt}.mark .logo{width:42pt;height:42pt;border-radius:8pt;background:#0E2238;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16pt;direction:ltr}
.mark .logo span{color:#D9B46E}.mark b{font-size:14pt;color:#0E2238;display:block}.mark small{color:#55697A}
.cover .mid{border-top:3pt solid #C9A15A;padding-top:14pt}
.cover .co{font-size:15pt;margin-top:8pt;color:#33475A}
.cover dl{display:grid;grid-template-columns:auto 1fr;gap:4pt 14pt;margin:18pt 0 0;font-size:10.5pt}.cover dt{color:#6B7D8C}.cover dd{margin:0;font-weight:600}
.cover .clogo{max-height:70pt;max-width:180pt;object-fit:contain}
.demo{border:1.5pt solid #B8650F;color:#B8650F;padding:6pt 10pt;font-weight:700;letter-spacing:.04em;text-align:center;margin:8pt 0}
.toc ol{padding-inline-start:18pt;font-size:11pt}.toc li{padding:3pt 0;border-bottom:.5pt dotted #C9D3DC}
.sec{break-before:page;page-break-before:always}
table{width:100%;border-collapse:collapse;margin:4pt 0 8pt;font-size:8.8pt}
th,td{padding:3.5pt 6pt;text-align:start;border-bottom:.5pt solid #E1E7ED;vertical-align:top}
thead{display:table-header-group}thead th{background:#EEF3F7;color:#33475A;font-weight:600;font-size:8.3pt}
tr{break-inside:avoid;page-break-inside:avoid}
td.n,th.n{text-align:end;white-space:nowrap}
tr.s td{font-weight:600;background:#F6F9FB}tr.t td{font-weight:700;border-top:1.2pt solid #33475A;background:#EEF3F7}tr.h td{font-weight:600;color:#0E2238;background:#F6F9FB}
tr.ind td:first-child{padding-inline-start:14pt;color:#43586A}
table.wrapall td{white-space:normal}
.small{font-size:8pt}.muted{color:#6B7D8C}.na{color:#8A9AA8;font-style:italic}
.note{font-size:8.3pt;color:#55697A;margin:3pt 0 8pt}
.alert{border-inline-start:3pt solid #B4372A;background:#FBEAE7;color:#8C2A1F;padding:5pt 8pt;font-size:9pt}
.alert.warn{border-color:#B8650F;background:#FCF1E2;color:#7A4A10}.alert.info{border-color:#24679E;background:#E8F0F7;color:#1B4E73}
.chip{display:inline-block;font-size:7.8pt;font-weight:600;border-radius:8pt;padding:0 6pt;white-space:nowrap}
.chip.good{background:#E3F3E6;color:#23863A}.chip.warn{background:#FBEEDD;color:#A35A0D}.chip.bad{background:#F9E5E2;color:#B4372A}.chip.crit{background:#F3D9D5;color:#7E1B12}.chip.info{background:#E6EFF7;color:#24679E}.chip.mute{background:#ECF0F3;color:#55697A}
.score{display:flex;gap:16pt;align-items:center}.score .big{font-size:34pt;font-weight:700;color:#0E2238}.score .big small{font-size:12pt;color:#6B7D8C}
table.mini{width:auto;font-size:8.5pt}table.mini td{border:0;padding:1pt 6pt}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:12pt}
.fig{margin:8pt 0;break-inside:avoid}.fig img{width:100%;height:auto;border:.5pt solid #E1E7ED}
.cm{border-inline-start:3pt solid #C9D3DC;padding:2pt 0 2pt 9pt;margin:8pt 0;break-inside:avoid}.rpt[dir="rtl"] .cm{padding:2pt 9pt 2pt 0}
.cm.pos{border-color:#1F7A4D}.cm.ai{border-color:#C9A15A;background:#FBF6EC;padding:6pt 9pt;border-radius:4pt}.cm.neg{border-color:#B4372A}.cm h3{margin-top:0}
.foot{font-size:8pt;color:#6B7D8C;border-top:.5pt solid #C9D3DC;padding-top:6pt;margin-top:12pt}
@media screen{.rpt{padding:16mm 14mm;box-shadow:0 2px 14px rgba(0,0,0,.12);margin:16px auto}.sec{border-top:1px dashed #C9D3DC;margin-top:18mm;padding-top:10mm}}
@media print{.rpt{max-width:none}.noprint{display:none!important}}`;

RP.build = function(opt){
  const co = BM.co(), saved = S.settings.lang, rebuild = co.demo && opt.lang !== saved;
  S.settings.lang = opt.lang; if (rebuild) S.demo = BM.buildDemo();
  try {
    const c2 = BM.co(), view = E.view(c2, S.period, S.compare), x = IN.context(view), rc = BM.reportCurrency();
    const secs = RP.SECTIONS.filter(s => opt.sections.indexOf(s[0]) >= 0);
    const pf = c2.logo ? `<img class="clogo" src="${c2.logo}" alt="">` : "";
    const cover = `<section class="cover"><div class="mark">${BM.logo(56, "tlogo")}<div><b>${BM.brandName(opt.lang)}</b><small>${U.esc(U.nm(BM.BRAND.sub))}</small></div></div>
      <div class="mid">${pf}<h1>${L("Management Report","التقرير الإداري")}</h1><div class="co">${U.esc(U.nm(c2.name))}</div>
      ${c2.demo ? `<div class="demo">${L("DEMO DATA — FOR ILLUSTRATION ONLY","بيانات تجريبية — للتوضيح فقط")}</div>` : ""}
      <dl><dt>${L("Reporting period","فترة التقرير")}</dt><dd>${E.periodLabel(view.period)}</dd><dt>${L("Compared with","المقارنة مع")}</dt><dd>${U.esc(view.label)}</dd>
      <dt>${L("Currency","العملة")}</dt><dd>${rc.code}${rc.converted ? " — " + L("converted from {f} at the user-entered rate {r} ({d})","محوّلة من {f} بالسعر المُدخل {r} ({d})",{f:rc.from, r:rc.rate, d:rc.date || "—"}) : rc.unavailable ? " — " + L("conversion rate unavailable for {t}","سعر التحويل غير متوفر لـ{t}",{t:rc.unavailable}) : ""}</dd>
      <dt>${L("Prepared","تاريخ الإعداد")}</dt><dd>${U.iso(new Date())}</dd><dt>${L("Prepared with","أُعد بواسطة")}</dt><dd>${BM.brandName(opt.lang)} — ${U.esc(U.nm(BM.BRAND.owner))}</dd></dl></div>
      <div class="foot">${L("All figures come from the trial balances and files loaded for this company. Derived and estimated figures are labelled. Missing data is shown as N/A. Commentary states causes as possibilities where the data cannot prove them.","كل الأرقام من موازين المراجعة والملفات المحمّلة لهذه الشركة. الأرقام المشتقة والتقديرية معلّمة. البيانات الناقصة تظهر «غير متوفر». التعليق يذكر الأسباب كاحتمالات عندما لا تثبتها البيانات.")}</div></section>`;
    const toc = `<section class="sec toc"><h2>${L("Contents","المحتويات")}</h2><ol>${secs.map(s => `<li>${L(s[1], s[2])}</li>`).join("")}</ol></section>`;
    const body = secs.map((s, i) => { let inner; try { inner = B[s[0]](x, opt); } catch(e){ console.error(e); inner = `<p class="alert">${L("This section could not be produced: {e}","تعذر إنشاء هذا القسم: {e}",{e:U.esc(e.message)})}</p>`; }
      return `<section class="sec"><h2>${i + 1}. ${L(s[1], s[2])}</h2>${inner}</section>`; }).join("");
    return {html:`<div class="rpt" dir="${opt.lang === "ar" ? "rtl" : "ltr"}" lang="${opt.lang}">${cover}${toc}${body}</div>`, name:`${BM.BRAND.file}_Report_${U.nm(c2.name).replace(/[^\w؀-ۿ]+/g,"_")}_${E.periodLabel(view.period, true).replace(/\s+/g,"_")}`};
  } finally { S.settings.lang = saved; if (rebuild) S.demo = BM.buildDemo(); }
};

const FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&family=IBM+Plex+Sans:wght@400;600;700&display=swap">';
RP.standalone = (doc, opt) => `<!DOCTYPE html><html lang="${opt.lang}" dir="${opt.lang === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${U.esc(doc.name)}</title>${FONTS}<style>body{margin:0;background:#E9EEF2}@media print{body{background:#fff}}${RP.CSS(opt.lang)}
.bar{position:sticky;top:0;background:#0E2238;color:#fff;padding:10px 16px;display:flex;gap:12px;align-items:center;font:13px "IBM Plex Sans",sans-serif;z-index:2}.bar button{background:#C9A15A;color:#0E2238;border:0;border-radius:6px;padding:7px 14px;font-weight:600;cursor:pointer}</style></head>
<body><div class="bar noprint"><span>${opt.lang === "ar" ? "لحفظ التقرير كملف PDF: اضغط «طباعة» ثم اختر «حفظ كملف PDF»." : "To save as PDF: press Print and choose “Save as PDF”."}</span><button onclick="window.print()">${opt.lang === "ar" ? "طباعة / حفظ PDF" : "Print / Save as PDF"}</button></div>${doc.html}</body></html>`;

/* ---------- Excel export ---------- */
RP.xlsx = function(opt){
  if (BM.gate && !BM.gate.canExport()) return BM.gate.locked();
  if (!BM.xlsxReady()) return;
  const saved = S.settings.lang, co0 = BM.co(), rebuild = co0.demo && opt.lang !== saved;
  S.settings.lang = opt.lang; if (rebuild) S.demo = BM.buildDemo();
  try {
    const co = BM.co(), view = E.view(co, S.period, S.compare), x = IN.context(view), fx = BM.fxFactor(), rc = BM.reportCurrency();
    const n = v => U.has(v) ? Math.round(v * fx * 100) / 100 : "N/A", r4 = v => U.has(v) ? Math.round(v * 10000) / 10000 : "N/A", d1 = v => U.has(v) ? Math.round(v * 10) / 10 : "N/A";
    const val = (unit, v) => unit === "money" ? n(v) : unit === "days" ? d1(v) : r4(v);
    const wb = XLSX.utils.book_new(), add = (name, aoa, w) => { const ws = XLSX.utils.aoa_to_sheet(aoa); ws["!cols"] = (w || [40,16,16,16,16,16,16]).map(c => ({wch:c})); XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31)); };
    add("About", [[BM.brandName() + " — " + L("Management report export","تصدير التقرير الإداري")],[L("Company","الشركة"), U.nm(co.name)],[L("Period","الفترة"), E.periodLabel(view.period)],[L("Compared with","المقارنة مع"), view.label],[L("Currency","العملة"), rc.code + (rc.converted ? " (" + L("user-entered rate","سعر مُدخل") + " " + rc.rate + ")" : "")],[L("Exported","تاريخ التصدير"), new Date().toISOString().slice(0,16).replace("T"," ")],
      [L("Data","البيانات"), co.demo ? "DEMO DATA — FOR ILLUSTRATION ONLY" : L("Uploaded trial balances","موازين مراجعة محمّلة")],[L("Notes","ملاحظات"), L("N/A = not available. Percentages are decimals (0.25 = 25%). Cash flow is derived from balance-sheet movements.","N/A = غير متوفر. النسب كسور عشرية (0.25 = 25%). التدفقات النقدية مشتقة من حركات الميزانية.")]], [24,70]);
    const Rc = x.R, Rk = BM.ratios(view.cmp), py = x.pr.f, xc = {growth: view.cur.is && py.is ? U.varPct(view.cur.is.rev, py.is.rev) : null}, xk = {growth: BM.cmpGrowth(view, py)};
    const k = [[L("KPI","المؤشر"), L("Unit","الوحدة"), L("Actual","الفعلي"), view.label, L("Variance","الانحراف"), L("Variance %","نسبة الانحراف"), L("Status","الحالة")]];
    BM.KPIS.forEach(g => g[2].forEach(d => { const a = d[5](view.cur, Rc, xc), b = d[5](view.cmp, Rk, xk); k.push([L(d[1], d[2]), d[3], val(d[3], a), val(d[3], b), val(d[3], U.sub(a, b)), d[3] === "money" ? r4(U.varPct(a, b)) : "", BM.ui.varStatus(a, b, d[4], d[3]).text]); }));
    add("Dashboard KPIs", k, [34,8,16,16,16,12,22]);
    const isRows = (is, b, p) => BM.IS_LINES.map(([key, en, ar]) => [L(en, ar), n(is && is[key]), n(b && b[key]), n(U.sub(is && is[key], b && b[key])), r4(U.varPct(is && is[key], b && b[key])), n(p && p[key]), r4(U.varPct(is && is[key], p && p[key]))]);
    add("Income statement", [[L("Line item","البند"), L("Actual","الفعلي"), L("Budget","الموازنة"), L("Variance","الانحراف"), L("Variance %","%"), L("Prior year","السنة السابقة"), L("Growth %","النمو %")]].concat(isRows(x.is, x.bis, x.pis)), [44,16,16,16,10,16,10]);
    const b = x.bs, pb = E.balanceSheet(co, "actual", view.period.year, 0);
    const bk = [["cash","Cash on hand","النقد في الصندوق"],["bank","Bank balances","البنوك"],["ar","Accounts receivable","الذمم المدينة"],["inventory","Inventory","المخزون"],["prepayments","Prepayments","المدفوعات المقدمة"],["other_ca","Other current assets","أصول متداولة أخرى"],["tca","Total current assets","إجمالي الأصول المتداولة"],["fixed_assets","Fixed assets (net)","الأصول الثابتة"],["intangibles","Intangible assets","الأصول غير الملموسة"],["other_nca","Other non-current assets","أصول غير متداولة أخرى"],["ta","Total assets","إجمالي الأصول"],
      ["ap","Accounts payable","الذمم الدائنة"],["st_loans","Short-term loans","القروض قصيرة الأجل"],["accrued","Accrued expenses","المستحقات"],["other_cl","Other current liabilities","التزامات متداولة أخرى"],["tcl","Total current liabilities","إجمالي الالتزامات المتداولة"],["lt_loans","Long-term loans","القروض طويلة الأجل"],["other_ncl","Other non-current liabilities","التزامات غير متداولة أخرى"],["tl","Total liabilities","إجمالي الالتزامات"],
      ["capital","Paid-in capital","رأس المال"],["reserves","Reserves","الاحتياطيات"],["retained","Retained earnings","الأرباح المدورة"],["other_equity","Other equity","حقوق ملكية أخرى"],["cye","Current-year profit","ربح السنة الحالية"],["te","Total equity","إجمالي حقوق الملكية"],["tle","Total liabilities and equity","إجمالي الالتزامات وحقوق الملكية"],["diff","Check: assets − (liabilities + equity)","تحقق: الأصول − (الالتزامات + حقوق الملكية)"]];
    add("Balance sheet", [[L("Line item","البند"), L("Current","الحالي"), L("Prior year end","نهاية السنة السابقة"), L("Change","التغير")]].concat(bk.map(([key, en, ar]) => [L(en, ar), n(b && b[key]), n(pb && pb[key]), n(b && pb ? b[key] - pb[key] : null)])), [44,16,16,16]);
    const cf = view.cur.cf && !view.cur.cf.na ? view.cur.cf : null;
    add("Cash flow (derived)", [[L("ESTIMATED / DERIVED from balance-sheet movements","تقديري / مشتق من حركات الميزانية")],[L("Line item","البند"), L("Actual","الفعلي")]].concat([["np","Net profit","صافي الربح"],["dep","Depreciation","الاستهلاك"],["wc","Working-capital movements","حركات رأس المال العامل"],["cfo","Operating cash flow","التدفق التشغيلي"],["capex","Capital expenditure (inferred)","النفقات الرأسمالية"],["cfi","Investing cash flow","التدفق الاستثماري"],["cff","Financing cash flow","التدفق التمويلي"],["net","Net change in cash","صافي التغير في النقد"],["open","Opening cash","النقد أول الفترة"],["close","Closing cash","النقد آخر الفترة"],["unrec","Unreconciled difference","فرق غير مطابق"],["fcf","Free cash flow","التدفق النقدي الحر"]].map(([key, en, ar]) => [L(en, ar), n(cf && cf[key])])), [44,16]);
    const RB = BM.ratios(x.bud);
    add("Ratios", [[L("Ratio","النسبة"), L("Formula","المعادلة"), L("Unit","الوحدة"), L("Actual","الفعلي"), L("Prior year","السنة السابقة"), L("Budget","الموازنة"), L("Risk","المخاطر"), L("Note","ملاحظة")]].concat(BM.RATIO_DEFS.map(r => [L(r[2], r[3]), L(r[4], r[5]), r[6], val(r[6], Rc[r[0]].v), val(r[6], x.PR[r[0]].v), val(r[6], RB[r[0]].v), Rc[r[0]].level || "", Rc[r[0]].why || ""])), [30,44,7,12,12,12,10,40]);
    add("Working capital", [[L("Measure","المؤشر"), L("Unit","الوحدة"), L("Current","الحالي"), L("Prior","السابق"), L("Change","التغير")]].concat(x.wc.rows.map(r => [L(r.en, r.ar), r.unit, val(r.unit, r.cur), val(r.unit, r.prev), val(r.unit, r.chg)])).concat([[], [L("Status","الحالة"), x.wc.level || "N/A"], [L("Reasons","الأسباب"), x.wc.reasons.join(" ")]]), [48,8,16,16,16]);
    const ag = (a, kind) => { const out = []; if (a.aging){ out.push([], [L("Aging as at","الأعمار كما في"), a.agingMeta.asOf]); a.aging.b.forEach((v, i) => out.push([AG.BUCKETS[i][0], n(v)])); out.push([L("Total","الإجمالي"), n(a.aging.total)], []);
      out.push([kind === "ar" ? L("Customer","العميل") : L("Supplier","المورد"), L("Balance","الرصيد"), L("Share","الحصة")]); a.aging.top.forEach(t => out.push([t.party, n(t.total), r4(t.share)])); } else out.push([], [L("No aging report loaded","لا يوجد تقرير أعمار")]); return out; };
    const a = x.ar; add("AR", [[L("Measure","المؤشر"), L("Value","القيمة")],[L("Receivables","الذمم المدينة"), n(a.bal)],[L("Receivables ÷ annual revenue","الذمم ÷ الإيراد السنوي"), r4(a.pctRev)],["DSO", d1(a.dso)],[L("DSO prior year","فترة التحصيل السنة السابقة"), d1(a.dsoPrev)],[L("Growth vs prior year","النمو"), r4(a.growthPY)],[L("Collections (derived)","التحصيلات (مشتقة)"), n(a.collections)]].concat(ag(a, "ar")), [36,16,12]);
    const p = x.ap; add("AP", [[L("Measure","المؤشر"), L("Value","القيمة")],[L("Payables","الذمم الدائنة"), n(p.bal)],["DPO", d1(p.dpo)],[L("DPO prior year","فترة السداد السنة السابقة"), d1(p.dpoPrev)],[L("Growth vs prior year","النمو"), r4(p.growthPY)],[L("Purchases (derived)","المشتريات (مشتقة)"), n(p.purchases)],[L("Payments (derived)","المدفوعات (مشتقة)"), n(p.payments)],[L("Payment pressure","ضغط السداد"), p.pressureLevel || "N/A", p.pressure.join(" ")]].concat(ag(p, "ap")), [36,16,60]);
    add("Budget analysis", [[L("Line item","البند"), L("Actual","الفعلي"), L("Budget","الموازنة"), L("Variance","الانحراف"), L("Variance %","%"), L("Status","الحالة")]].concat(BM.IS_LINES.map(([key, en, ar, dir]) => [L(en, ar), n(x.is && x.is[key]), n(x.bis && x.bis[key]), n(U.sub(x.is && x.is[key], x.bis && x.bis[key])), r4(U.varPct(x.is && x.is[key], x.bis && x.bis[key])), BM.ui.varStatus(x.is && x.is[key], x.bis && x.bis[key], dir, "money").text])), [44,16,16,16,10,24]);
    { const T = BM.trend(co), ys = T.years;
      add("Multi-year trend", [[L("Measure","المؤشر"), L("Unit","الوحدة")].concat(ys.map(y => BM.trendColLabel(y, co))).concat(["CAGR"])].concat(T.rows.map(r => [L(r.en, r.ar), r.unit].concat(r.vals.map(v => val(r.unit, v))).concat([r.unit === "money" ? r4(r.cagr) : ""]))).concat([[], [L("Partial years are year to date. CAGR uses complete years only.","السنوات الجزئية منذ بداية السنة. النمو المركب يستخدم السنوات الكاملة فقط.")]]), [34,8].concat(ys.map(() => 18)).concat([10])); }
    { const ot = E.outlookFY(co, view.period.year, view.period.month), ln = [["rev","Revenue","الإيرادات"],["gp","Gross profit","مجمل الربح"],["opex","Operating expenses","المصروفات التشغيلية"],["ebitda","EBITDA","EBITDA"],["np","Net profit","صافي الربح"]], g = (o, k2) => o ? o[k2] : null;
      if (ot.ytd) add("Full-year outlook", [[L("ESTIMATES — not forecasts","تقديرات — ليست توقعات"), E.fyLabel(view.period.year, co)], [L("Line item","البند"), L("Actual to date","الفعلي حتى تاريخه"), L("Budget — remaining months","الموازنة — الأشهر المتبقية"), L("Latest estimate","التقدير المحدث"), L("Full-year budget","موازنة السنة"), L("Run-rate","المعدل الجاري"), L("Prior full year","السنة السابقة كاملة")]]
        .concat(ln.map(([k2, en, ar]) => [L(en, ar), n(g(ot.ytd, k2)), n(g(ot.rem, k2)), n(g(ot.le, k2)), n(g(ot.bud, k2)), n(g(ot.rr, k2)), n(g(ot.py, k2))])).concat([[], [BM.outlookNote(co, view.period.year, view.period.month)]]), [30,16,18,16,16,16,16]); }
    add("Prior year", [[L("Measure","المؤشر"), L("Current","الحالي"), L("Prior year","السنة السابقة"), L("Growth %","النمو %")]].concat([["rev","Revenue","الإيرادات"],["gp","Gross profit","مجمل الربح"],["ebitda","EBITDA","EBITDA"],["np","Net profit","صافي الربح"]].map(([key, en, ar]) => [L(en, ar), n(x.is && x.is[key]), n(x.pis && x.pis[key]), r4(U.varPct(x.is && x.is[key], x.pis && x.pis[key]))]))
      .concat([["ta","Total assets","إجمالي الأصول"],["tl","Total liabilities","إجمالي الالتزامات"],["te","Equity","حقوق الملكية"],["wc","Working capital","رأس المال العامل"]].map(([key, en, ar]) => [L(en, ar), n(x.bs && x.bs[key]), n(x.pbs && x.pbs[key]), r4(U.varPct(x.bs && x.bs[key], x.pbs && x.pbs[key]))])), [36,16,16,12]);
    add("Risk analysis", [[L("Risk","المخاطرة"), L("Severity","الخطورة"), L("Evidence","الدليل"), L("Financial impact","الأثر المالي"), L("Recommended action","الإجراء المقترح")]].concat(IN.risks(x).map(r => [L(r.en, r.ar), r.data ? r.level.toUpperCase() : L("Insufficient data","بيانات غير كافية"), r.evidence.join(" "), r.impact, r.action])), [28,14,70,50,60]);
    const out = XLSX.write(wb, {bookType:"xlsx", type:"array"});
    return BM.saveFile(`${BM.BRAND.file}_${U.nm(co.name).replace(/[^\w؀-ۿ]+/g,"_")}_${E.periodLabel(view.period, true).replace(/\s+/g,"_")}.xlsx`, new Blob([out], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
  } finally { S.settings.lang = saved; if (rebuild) S.demo = BM.buildDemo(); }
};

/* ---------- viewer overlay + printing ---------- */
const canPrint = () => { try { return window.self === window.top; } catch(e){ return false; } };
RP.open = function(opt){
  if (BM.gate && !BM.gate.canExport()) return BM.gate.locked();
  const doc = RP.build(opt); RP.last = {doc, opt};
  let ov = document.getElementById("rptView");
  if (!ov){ ov = document.createElement("div"); ov.id = "rptView"; document.body.appendChild(ov); }
  let st = document.getElementById("rptCss"); if (!st){ st = document.createElement("style"); st.id = "rptCss"; document.head.appendChild(st); }
  st.textContent = RP.CSS(opt.lang) + `
#rptView{position:fixed;inset:0;z-index:300;background:#E9EEF2;overflow:auto;padding-top:env(safe-area-inset-top,0px)}
#rptView .rbar{position:sticky;top:0;z-index:2;background:#0E2238;color:#fff;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 16px;font:13px var(--sans)}
#rptView .rbar .sp{margin-inline-start:auto}#rptView .rbar button{border:0;border-radius:6px;padding:7px 12px;font-weight:600;cursor:pointer;background:#fff;color:#0E2238}#rptView .rbar button.go{background:#C9A15A;color:#0E2238}
@media screen and (max-width:820px){#rptView .rpt{padding:16px;margin:8px}}
@media print{body.rpt-open .app,body.rpt-open .toast,body.rpt-open .modal,#rptView .rbar{display:none!important}body.rpt-open #rptView{position:static;overflow:visible;background:#fff}body.rpt-open{background:#fff}}`;
  ov.innerHTML = `<div class="rbar"><b>${L("Report preview","معاينة التقرير")}</b><span class="small" style="opacity:.8">${opt.sections.length} ${L("sections","قسم")}</span><span class="sp"></span>
    ${canPrint() ? `<button class="go" onclick="window.print()">${L("Print / Save as PDF","طباعة / حفظ PDF")}</button>` : `<span class="small" style="opacity:.85">${L("Printing is not available in this preview — download the report and open it in your browser.","الطباعة غير متاحة في هذه المعاينة — نزّل التقرير وافتحه في المتصفح.")}</span>`}
    <button onclick="BM.report.download()">⤓ ${L("Download report (HTML)","تنزيل التقرير (HTML)")}</button><button onclick="BM.report.close()">✕ ${L("Close","إغلاق")}</button></div>${doc.html}`;
  ov.hidden = false; document.body.classList.add("rpt-open"); ov.scrollTop = 0;
};
RP.close = () => { const ov = document.getElementById("rptView"); if (ov){ ov.hidden = true; ov.innerHTML = ""; } document.body.classList.remove("rpt-open"); };
RP.download = (opt) => { if (!canX()) return BM.gate.locked();
  const o = opt || (RP.last && RP.last.opt); if (!o) return;
  const doc = opt ? RP.build(opt) : RP.last.doc;
  BM.saveFile(doc.name + ".html", new Blob([RP.standalone(doc, o)], {type:"text/html"}));
};

/* ---------- Report Studio page ---------- */
const ST = BM.studio = {};
const stOf = () => S.studio || (S.studio = {sections: RP.SECTIONS.map(s => s[0]), lang: S.settings.lang, charts: String(S.settings.exportPrefs.includeCharts) !== "false"});
ST.toggle = k => { const s = stOf(), i = s.sections.indexOf(k); if (i >= 0) s.sections.splice(i, 1); else s.sections.push(k); s.sections = RP.SECTIONS.map(x => x[0]).filter(x => s.sections.indexOf(x) >= 0); BM.render(); };
ST.all = on => { stOf().sections = on ? RP.SECTIONS.map(s => s[0]) : []; BM.render(); };
ST.set = (k, v) => { stOf()[k] = v; BM.render(); };
ST.opts = () => { const s = stOf(); return {sections:s.sections.slice(), lang:s.lang, charts:s.charts}; };
/* final report and exports: activated clients (full access); demo data stays open — same rule as the TRUST analysis tool */
const canX = () => !BM.gate || BM.gate.canExport();
ST.preview = () => { if (!canX()) return BM.gate.locked(); if (!stOf().sections.length) return BM.toast(L("Select at least one section.","اختر قسماً واحداً على الأقل.")); RP.open(ST.opts()); };
ST.html = () => { if (!canX()) return BM.gate.locked(); if (!stOf().sections.length) return BM.toast(L("Select at least one section.","اختر قسماً واحداً على الأقل.")); RP.download(ST.opts()); };
ST.xlsx = () => canX() ? RP.xlsx(ST.opts()) : BM.gate.locked();
BM.PAGES.reports = {render(ctx){
  const s = stOf(), co = ctx.co;
  if (!ctx.period.year) return {html: BM.ui.card("", BM.ui.empty(L("Load a trial balance first.","حمّل ميزان مراجعة أولاً."), `<a class="btn pri" href="#import">${L("Go to Inputs","انتقل إلى المدخلات")}</a>`))};
  const q = BM.quality(co, ctx.period.year), errs = q.issues.filter(i => i.sev === "error").length;
  const chips = RP.SECTIONS.map(x => `<label class="row small" style="gap:6px;padding:6px 8px;border:1px solid var(--line);border-radius:6px;cursor:pointer;background:${s.sections.indexOf(x[0]) >= 0 ? "var(--info-soft)" : "var(--surface)"}"><input type="checkbox" ${s.sections.indexOf(x[0]) >= 0 ? "checked" : ""} onchange="BM.studio.toggle('${x[0]}')"> ${L(x[1], x[2])}</label>`).join("");
  const rc = BM.reportCurrency();
  const html = (errs ? BM.ui.banner("warn", L("Data Quality shows {n} error(s) for this company. The report will show them (for example an unbalanced balance sheet) — review Data Quality first if this report is going to management.","مركز جودة البيانات يظهر {n} خطأ/أخطاء لهذه الشركة. سيظهرها التقرير (مثل ميزانية غير متوازنة) — راجع جودة البيانات أولاً إذا كان التقرير سيُرفع للإدارة.",{n:errs}) + ` <a href="#quality" style="color:inherit">${L("Open Data Quality","فتح جودة البيانات")}</a>`) : "") +
    `<div class="grid g2">` + BM.ui.card(L("1. Report contents","1. محتويات التقرير"), `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px">${chips}</div>
      <div class="row" style="margin-top:10px"><button class="btn sm" onclick="BM.studio.all(true)">${L("Select all","تحديد الكل")}</button><button class="btn sm" onclick="BM.studio.all(false)">${L("Clear","إلغاء التحديد")}</button></div>`,
      {sub:L("Every report starts with a cover page and a contents page","كل تقرير يبدأ بصفحة غلاف وصفحة محتويات")}) +
    BM.ui.card(L("2. Company, period, currency, language","2. الشركة والفترة والعملة واللغة"), `<dl class="dl">
      <dt>${L("Company","الشركة")}</dt><dd>${U.esc(U.nm(co.name))}${co.demo ? ` <span class="b b-warn">${L("Demo","تجريبي")}</span>` : ""}</dd>
      <dt>${L("Period","الفترة")}</dt><dd>${E.periodLabel(ctx.period)}</dd><dt>${L("Compared with","المقارنة مع")}</dt><dd>${U.esc(ctx.view.label)}</dd>
      <dt>${L("Currency","العملة")}</dt><dd>${rc.code}${rc.unavailable ? ` <span class="b b-warn">${L("rate unavailable","السعر غير متوفر")}</span>` : ""}</dd></dl>
      <p class="small muted" style="margin:8px 0 12px">${L("Company, period, comparison and currency come from the «Analysis view» card at the top of the page.","الشركة والفترة والمقارنة والعملة تؤخذ من بطاقة «عرض التحليل» أعلى الصفحة.")}</p>
      <div class="form"><div class="field"><label for="stLang">${L("Report language","لغة التقرير")}</label><select class="in" id="stLang" onchange="BM.studio.set('lang',this.value)"><option value="en" ${s.lang === "en" ? "selected" : ""}>English</option><option value="ar" ${s.lang === "ar" ? "selected" : ""}>العربية</option></select></div>
      <div class="field"><label for="stCh">${L("Charts","الرسوم البيانية")}</label><select class="in" id="stCh" onchange="BM.studio.set('charts',this.value==='1')"><option value="1" ${s.charts ? "selected" : ""}>${L("Include","تضمين")}</option><option value="0" ${!s.charts ? "selected" : ""}>${L("Leave out","استبعاد")}</option></select></div></div>`) + `</div>` +
    BM.ui.card(L("3. Produce","3. الإخراج"), (canX() ? "" : BM.ui.banner("warn", L("Trial account: the final report and exports are available to activated clients. Contact TRUST to activate full access.","حساب تجريبي: التقرير النهائي والتصدير متاحان للعملاء المفعّلين. تواصل مع TRUST لتفعيل الوصول الكامل."))) + `<div class="row" style="gap:10px">
      <button class="btn pri" onclick="BM.studio.preview()">${L("Preview report","معاينة التقرير")}${canPrint() ? " · " + L("Print / PDF","طباعة / PDF") : ""}</button>
      <button class="btn" onclick="BM.studio.html()">⤓ ${L("Download report (HTML → PDF)","تنزيل التقرير (HTML ← PDF)")}</button>
      <button class="btn" onclick="BM.studio.xlsx()">⤓ ${L("Export analysis to Excel","تصدير التحليل إلى Excel")}</button></div>
      <ul class="small muted" style="margin:12px 0 0;padding-inline-start:18px;display:flex;flex-direction:column;gap:3px">
      <li>${L("PDF: open the preview and choose Print → Save as PDF. The layout is A4 with a cover, contents, numbered sections, page numbers and a footer (page numbers need Chrome or Edge).","PDF: افتح المعاينة واختر طباعة ← حفظ كملف PDF. التنسيق A4 مع غلاف ومحتويات وأقسام مرقمة وأرقام صفحات وتذييل (أرقام الصفحات تتطلب Chrome أو Edge).")}</li>
      <li>${L("The HTML file is the same report as a single file: open it in any browser and print it, or send it by email.","ملف HTML هو نفس التقرير في ملف واحد: افتحه في أي متصفح واطبعه، أو أرسله بالبريد.")}</li>
      <li>${L("The Excel file contains the figures as numbers, one sheet per section: KPIs, statements, cash flow, ratios, working capital, AR, AP, budget, multi-year trend, full-year outlook, prior year and risks.","ملف Excel يحتوي الأرقام كقيم رقمية، ورقة لكل قسم: المؤشرات والقوائم والتدفقات والنسب ورأس المال العامل والذمم والموازنة والسنة السابقة والمخاطر.")}</li></ul>`);
  return {html};
}};
})();
