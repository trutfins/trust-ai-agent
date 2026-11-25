/* =============================================================================
   pages/insight.js — Industry Analysis (§14), Operational Analysis (§15),
   Risk Analysis (§16), Management Commentary (§17–§18), Executive Summary (§19)
   ============================================================================= */
(function(){
const U = BM.U, E = BM.E, ui = BM.ui, AN = BM.AN, IN = BM.IN, S = BM.state;

/* ------------------------------ Industry ------------------------------ */
const IX = BM.indUI = {chart:null};
IX.toggle = k => { const co = BM.co(), cfg = AN.industryCfg(co), i = cfg.kpis.indexOf(k); if (i >= 0) cfg.kpis.splice(i, 1); else cfg.kpis.push(k); if (!co.demo) BM.saveData(); BM.render(); };
IX.target = (k, v) => { const co = BM.co(), cfg = AN.industryCfg(co); const n = parseFloat(v); if (v === "" || !isFinite(n)) delete cfg.targets[k]; else cfg.targets[k] = AN.IKPI[k][2] === "pct" ? n / 100 : n; if (!co.demo) BM.saveData(); BM.render(); };
IX.reset = () => { const co = BM.co(); co.industryCfg[co.industry] = {kpis:(AN.IND_DEFAULT[co.industry] || AN.IND_DEFAULT.other).slice(), targets:{}}; if (!co.demo) BM.saveData(); BM.render(); };
BM.PAGES.industry = {render(ctx){
  const co = ctx.co, rows = AN.industry(ctx.view), cfg = AN.industryCfg(co);
  const ind = BM.INDUSTRIES.find(i => i[0] === co.industry) || BM.INDUSTRIES[BM.INDUSTRIES.length - 1];
  if (!IX.chart || cfg.kpis.indexOf(IX.chart) < 0) IX.chart = cfg.kpis[0];
  const tr = r => { if (!U.has(r.cur) || !U.has(r.py) || !r.dir) return `<span class="muted small">—</span>`; const d = r.cur - r.py; const small = r.unit === "pct" ? 0.002 : r.unit === "days" ? 1 : r.unit === "x" ? 0.02 : Math.abs(r.py) * 0.01;
    return Math.abs(d) < small ? `<span class="muted">■ ${L("Stable","مستقر")}</span>` : `<span class="${d * r.dir > 0 ? "pos" : "neg"}">${d > 0 ? "▲" : "▼"} ${U.fmtDelta(r.unit, d)}</span>`; };
  const tst = r => { if (!U.has(r.target) || !U.has(r.cur)) return `<span class="muted small">—</span>`; if (!r.dir) return ui.badge("mute", L("Reference","مرجعي")); return (r.cur - r.target) * r.dir >= 0 ? ui.badge("good", L("On target","ضمن المستهدف")) : ui.badge("warn", L("Below target","دون المستهدف")); };
  const tIn = r => { const v = r.target; const shown = v == null ? "" : r.unit === "pct" ? +(v * 100).toFixed(2) : v;
    return `<input class="in sm" style="width:90px" type="number" step="any" aria-label="${L("Your target","مستهدفك")}" value="${shown}" placeholder="—" onchange="BM.indUI.target('${r.k}',this.value)">${r.unit === "pct" ? " %" : ""}`; };
  const body = rows.map(r => `<tr><td><b>${L(r.en, r.ar)}</b></td><td class="n"><b>${U.fmtUnit(r.unit, r.cur)}</b></td><td class="n">${U.fmtUnit(r.unit, r.py)}</td><td class="n">${U.fmtUnit(r.unit, r.bu)}</td><td>${tr(r)}</td><td>${tIn(r)}</td><td>${tst(r)}</td>
    <td class="muted small">${L("Unavailable","غير متوفر")}</td></tr>`).join("");
  const chips = Object.keys(AN.IKPI).map(k => `<button type="button" class="b ${cfg.kpis.indexOf(k) >= 0 ? "b-info" : "b-mute"}" style="border:0;cursor:pointer" aria-pressed="${cfg.kpis.indexOf(k) >= 0}" onclick="BM.indUI.toggle('${k}')">${cfg.kpis.indexOf(k) >= 0 ? "✓ " : "+ "}${L(AN.IKPI[k][0], AN.IKPI[k][1])}</button>`).join(" ");
  const html = ui.banner("info", `<b>${L("Benchmark data unavailable.","بيانات المعايير القطاعية غير متوفرة.")}</b> ${L("No industry benchmark database is connected, so no external benchmark is shown. The analysis uses the company's own trend: prior year, budget, monthly movement and your own targets.","لا توجد قاعدة بيانات لمعايير القطاع، لذلك لا يُعرض أي معيار خارجي. التحليل يستخدم اتجاه الشركة نفسها: السنة السابقة والموازنة والحركة الشهرية ومستهدفاتك.")}`) +
    ui.tableCard(L("{i} — key indicators","{i} — المؤشرات الرئيسية",{i:L(ind[1], ind[2])}),
      `<table><thead><tr><th>${L("Indicator","المؤشر")}</th><th class="n">${L("Current","الحالي")}</th><th class="n">${L("Prior year","السنة السابقة")}</th><th class="n">${L("Budget","الموازنة")}</th><th>${L("Trend","الاتجاه")}</th><th>${L("Your target","مستهدفك")}</th><th>${L("Status","الحالة")}</th><th>${L("Industry benchmark","معيار القطاع")}</th></tr></thead><tbody>${body || `<tr><td colspan="8" class="muted">${L("No indicators selected.","لم يتم اختيار مؤشرات.")}</td></tr>`}</tbody></table>`,
      {sub:L("Industry is set in Settings → Company. Targets are your own figures, not benchmarks.","القطاع يُضبط من الإعدادات ← الشركة. المستهدفات أرقامك أنت وليست معايير.")}) +
    `<div class="grid g2">` + ui.card(L("Choose the indicators for this industry","اختر مؤشرات هذا القطاع"), `<div style="display:flex;flex-wrap:wrap;gap:6px">${chips}</div><div class="row" style="margin-top:10px"><button class="btn sm" onclick="BM.indUI.reset()">${L("Restore the default set","استعادة المجموعة الافتراضية")}</button></div>`) +
    ui.card(L("Monthly trend — {y}","الاتجاه الشهري — {y}",{y:E.fyName(ctx.period.year)}), `<div class="row" style="margin-bottom:8px"><select class="in sm" aria-label="${L("Indicator","المؤشر")}" onchange="BM.indUI.chart=this.value;BM.render()">${cfg.kpis.map(k => `<option value="${k}" ${IX.chart === k ? "selected" : ""}>${L(AN.IKPI[k][0], AN.IKPI[k][1])}</option>`).join("")}</select></div><div class="chart sm"><canvas id="in1"></canvas></div>`) + `</div>`;
  return {html, after(){
    const k = IX.chart; if (!k) return; const d = AN.IKPI[k], C = BM.charts.colors(), lab = [], a = [], p = [];
    const hc = co.ops && co.ops.headcount || {};
    for (let m = 1; m <= 12; m++){ lab.push(E.pm(m));
      const f = E.frame(co, "actual", ctx.period.year, m, m); a.push(d[4](f, BM.ratios(f), {hc: hc[E.calKey(co, ctx.period.year, m)]}));
      const g = E.frame(co, "actual", ctx.period.year - 1, m, m); p.push(d[4](g, BM.ratios(g), {hc: hc[E.calKey(co, ctx.period.year - 1, m)]})); }
    const pct = d[2] === "pct";
    BM.charts.make("in1", {type:"line", pct, data:{labels:lab, datasets:[
      {label:E.fyName(ctx.period.year), data:a, borderColor:C.c1, backgroundColor:C.c1, tension:.25, pointRadius:2},
      {label:E.fyName(ctx.period.year - 1), data:p, borderColor:C.c4, backgroundColor:C.c4, borderDash:[5,4], tension:.25, pointRadius:0}]},
      options: d[2] === "days" || d[2] === "x" ? {scales:{y:{ticks:{callback:v => d[2] === "x" ? v.toFixed(1) + "×" : Math.round(v)}}}, plugins:{tooltip:{callbacks:{label:c => " " + c.dataset.label + ": " + (c.raw == null ? L("N/A","غير متوفر") : d[2] === "x" ? c.raw.toFixed(2) + "×" : Math.round(c.raw))}}}} : {}});
  }};
}};

/* ------------------------------ Operational ------------------------------ */
const OP = BM.opsUI = {};
const opsOf = co => co.ops || (co.ops = {headcount:{}});
OP.hc = (y, m, v) => { const co = BM.co(); if (co.demo) return; const o = opsOf(co); const n = parseFloat(v);
  if (v === "" || !isFinite(n)) delete o.headcount[y + "-" + m]; else if (n < 0) return BM.toast(L("Headcount cannot be negative.","عدد الموظفين لا يمكن أن يكون سالباً.")); else o.headcount[y + "-" + m] = n;
  BM.saveData(); BM.render(); };
OP.upload = async (which, file) => {
  if (!file || !BM.xlsxReady()) return; const co = BM.co(); if (co.demo) return;
  try {
    const book = await BM.IMP.readWorkbook(file), aoa = book.sheets[0].aoa;
    const hr = BM.IMP.detectHeader(aoa), rows = [];
    let nc = -1, vc = -1; const sample = aoa.slice(hr + 1, hr + 30);
    const ncol = Math.max(...sample.map(r => r.length));
    for (let c = 0; c < ncol; c++){ const vals = sample.map(r => r[c]).filter(x => x !== "" && x != null);
      if (nc < 0 && vals.length && vals.filter(x => typeof x === "string" && !/^[\d.,\s()-]+$/.test(x)).length / vals.length > 0.6) nc = c;
      else if (vc < 0 && vals.length && vals.filter(x => !U.parseNum(x).bad).length / vals.length > 0.8 && c !== nc) vc = c; }
    if (nc < 0 || vc < 0) return BM.toast(L("The file needs a name column and an amount column.","الملف يحتاج عمود اسم وعمود مبلغ."));
    let bad = 0; aoa.slice(hr + 1).forEach(r => { const n = String(r[nc] == null ? "" : r[nc]).trim(), p = U.parseNum(r[vc]); if (!n || /^(total|الاجمالي|المجموع|اجمالي)/i.test(U.norm(n))) return; if (p.bad){ bad++; return; } if (p.v) rows.push([n, p.v]); });
    if (!rows.length) return BM.toast(L("No rows with a name and an amount were found.","لم يتم العثور على صفوف تحتوي اسماً ومبلغاً."));
    opsOf(co)[which] = {label: file.name + " · " + E.periodLabel(S.period), rows, at:new Date().toISOString()};
    BM.saveData(); BM.render(); BM.toast(L("{n} rows loaded{b}.","تم تحميل {n} صفاً{b}.",{n:rows.length, b: bad ? L(" · {x} rows with invalid amounts skipped"," · تم تخطي {x} صفاً بمبالغ غير صالحة",{x:bad}) : ""}));
  } catch(e){ console.error(e); BM.toast(L("The file could not be read.","تعذرت قراءة الملف.")); }
};
OP.clear = which => { const co = BM.co(); if (co.demo || !co.ops) return; delete co.ops[which]; BM.saveData(); BM.render(); };
BM.PAGES.operational = {render(ctx){
  const co = ctx.co, op = AN.operational(ctx.view), can = BM.can("import") && !co.demo;
  const rows = op.metrics.map(m => `<tr><td><b>${L(m.en, m.ar)}</b></td><td class="n"><b>${U.has(m.v) ? U.fmtUnit(m.unit, m.v) : U.NA()}</b></td><td>${AN.srcTag(m.src)}</td><td class="wrap small muted">${m.why || ""}</td></tr>`).join("");
  const conc = (title, c, src) => c ? ui.tableCard(title, `<table><thead><tr><th>${L("Name","الاسم")}</th><th class="n">${L("Amount","المبلغ")}</th><th class="n">${L("Share","الحصة")}</th></tr></thead><tbody>${c.top.map(r => `<tr><td class="wrap">${U.esc(r[0])}</td><td class="n">${U.money(r[1])}</td><td class="n">${U.pct(r[2])}</td></tr>`).join("")}</tbody></table>`, {act:AN.srcTag(src), sub:L("{n} items · largest {a}","{n} بند · الأكبر {a}",{n:c.n, a:U.pct(c.top1)})}) : "";
  const y = ctx.period.year, hc = (co.ops && co.ops.headcount) || {};
  const hcIn = `<div class="tw"><table><thead><tr>${BM.MONTHS.map((m, i) => `<th>${E.pm(i + 1)}</th>`).join("")}</tr></thead><tbody><tr>${BM.MONTHS.map((m, i) => { const c = E.toCal(co, y, i + 1), k = c.y + "-" + c.m; return `<td><input class="in sm" style="width:64px" type="number" min="0" step="1" aria-label="${L("Headcount","عدد الموظفين")} ${E.pDate(y, i + 1, true)}" value="${hc[k] != null ? hc[k] : ""}" ${can ? "" : "disabled"} onchange="BM.opsUI.hc(${c.y},${c.m},this.value)"></td>`; }).join("")}</tr></tbody></table></div>`;
  const up = (which, en, ar) => { const d = co.ops && co.ops[which];
    return `<div class="field"><label>${L(en, ar)}</label><div class="row">${can ? `<label class="btn sm">⤒ ${L("Upload Excel","رفع Excel")}<input type="file" hidden accept=".xlsx,.xls,.csv" onchange="BM.opsUI.upload('${which}',this.files[0])"></label>` : ""}
      ${d ? `<span class="small">${U.esc(d.label || "")} · ${d.rows.length} ${L("rows","صف")}</span>${can ? `<button class="btn sm danger" onclick="BM.opsUI.clear('${which}')">${L("Remove","إزالة")}</button>` : ""}` : `<span class="small muted">${L("Not loaded","غير محمّل")}</span>`}</div></div>`; };
  const html = ui.banner("info", L("Each metric is tagged: Actual (read from your data), Derived (calculated from it), Estimated (an approximation) or Unavailable (data not loaded).","كل مؤشر معلّم: فعلي (مقروء من بياناتك)، مشتق (محسوب منها)، تقديري (تقريب)، غير متوفر (البيانات غير محمّلة).")) +
    ui.tableCard(L("Operational indicators — {p}","المؤشرات التشغيلية — {p}",{p:E.periodLabel(ctx.period)}), `<table><thead><tr><th>${L("Indicator","المؤشر")}</th><th class="n">${L("Value","القيمة")}</th><th>${L("Data","البيانات")}</th><th>${L("Basis","الأساس")}</th></tr></thead><tbody>${rows}</tbody></table>`) +
    `<div class="grid g2">${conc(L("Customer concentration","تركز العملاء"), op.cust, op.custSrc)}${conc(L("Product / service concentration","تركز المنتجات / الخدمات"), op.prod, op.prodSrc)}</div>` +
    ui.card(L("Operational data","البيانات التشغيلية"), (co.demo ? ui.banner("demo", L("DEMO DATA — FOR ILLUSTRATION ONLY","بيانات تجريبية — للتوضيح فقط")) : "") +
      `<div class="field"><label>${L("Headcount at each month end — {y}","عدد الموظفين في نهاية كل شهر — {y}",{y})}</label>${hcIn}</div>
      <div class="form" style="margin-top:12px">${up("byCustomer","Revenue by customer (name + amount)","الإيراد حسب العميل (اسم + مبلغ)")}${up("byProduct","Revenue by product / service (name + amount)","الإيراد حسب المنتج / الخدمة (اسم + مبلغ)")}</div>
      <p class="small muted" style="margin:10px 0 0">${L("Revenue breakdowns should cover the same period as the report. The file needs one column of names and one column of amounts; the first sheet is read.","تفصيل الإيرادات يجب أن يغطي نفس فترة التقرير. الملف يحتاج عمود أسماء وعمود مبالغ؛ تُقرأ الورقة الأولى فقط.")}</p>`);
  return {html};
}};

/* ------------------------------ Risk ------------------------------ */
BM.PAGES.risk = {render(ctx){
  const x = IN.context(ctx.view), risks = IN.risks(x), have = risks.filter(r => r.data), none = risks.filter(r => !r.data);
  const cnt = l => have.filter(r => r.level === l).length;
  const worst = ["critical","high","medium","low"].find(l => cnt(l));
  const posture = worst === "critical" ? ["crit","Critical","حرج"] : worst === "high" ? ["bad","Elevated","مرتفع"] : worst === "medium" ? ["warn","Moderate","متوسط"] : worst ? ["good","Low","منخفض"] : ["mute","Insufficient data","بيانات غير كافية"];
  const k = (l) => `<div class="kpi ${l === "critical" || l === "high" ? "s-bad" : l === "medium" ? "s-warn" : "s-good"}"><div class="t">${IN.levelBadge(l)}</div><div class="v">${cnt(l)}</div></div>`;
  const rows = have.map(r => `<tr><td class="wrap" style="min-width:150px"><b>${L(r.en, r.ar)}</b></td><td>${IN.levelBadge(r.level)}</td><td class="wrap small">${r.evidence.map(U.esc).join("<br>")}</td><td class="wrap small">${U.esc(r.impact)}</td><td class="wrap small" style="min-width:220px">${U.esc(r.action)}</td></tr>`).join("");
  const html = `<div class="grid g2">${ui.card(L("Overall risk posture","الوضع العام للمخاطر"), `<div class="row" style="gap:12px"><span class="b b-${posture[0]}" style="font-size:15px;padding:4px 14px">${L(posture[1], posture[2])}</span><span class="small muted">${L("{n} of {t} risks assessed","تم تقييم {n} من {t} مخاطر",{n:have.length, t:risks.length})}</span></div>`)}
    <div class="kpis" style="grid-template-columns:repeat(4,minmax(0,1fr))">${k("critical")}${k("high")}${k("medium")}${k("low")}</div></div>` +
    ui.tableCard(L("Risk register — {p}","سجل المخاطر — {p}",{p:E.periodLabel(ctx.period)}), `<table><thead><tr><th>${L("Risk","المخاطرة")}</th><th>${L("Severity","الخطورة")}</th><th>${L("Evidence","الدليل")}</th><th>${L("Financial impact","الأثر المالي")}</th><th>${L("Recommended action","الإجراء المقترح")}</th></tr></thead><tbody>${rows}</tbody></table>`,
      {sub:L("Thresholds from Settings → Risk thresholds","الحدود من الإعدادات ← حدود المخاطر")}) +
    (none.length ? ui.card(L("Not assessed — insufficient data","لم يتم تقييمها — بيانات غير كافية"), `<ul class="small" style="margin:0;padding-inline-start:18px;display:flex;flex-direction:column;gap:4px">${none.map(r => `<li><b>${L(r.en, r.ar)}</b>: ${U.esc(r.evidence.join(" "))} ${U.esc(r.action)}</li>`).join("")}</ul>`) : "") +
    `<p class="small muted" style="margin:0">${L("Severity: LOW · MEDIUM · HIGH · CRITICAL. A risk is never rated low when the data to assess it is missing.","الخطورة: منخفض · متوسط · مرتفع · حرج. لا تُصنّف المخاطرة منخفضة عند غياب البيانات اللازمة لتقييمها.")}</p>`;
  return {html};
}};

/* ------------------------------ Commentary ------------------------------ */
const CM = BM.cmUI = {ai:null, busy:false, err:null};
CM.run = async () => {
  const v = E.view(BM.co(), S.period, S.compare), x = IN.context(v);
  CM.busy = true; CM.err = null; BM.render();
  try { CM.ai = {text: await IN.callAI(x), at:new Date().toISOString(), key: v.co.id + "|" + E.periodLabel(S.period)}; }
  catch(e){ CM.err = e.message || String(e); }
  CM.busy = false; BM.render();
};
BM.PAGES.commentary = {render(ctx){
  const x = IN.context(ctx.view), pts = IN.commentary(x), ai = S.settings.ai;
  if (!pts.length) return {html: ui.banner("info", L("Commentary needs the income statement for this period.","التعليق يحتاج قائمة الدخل لهذه الفترة."))};
  const card = p => `<section class="card" style="border-inline-start:4px solid ${p.tone === "pos" ? "var(--good)" : p.tone === "neg" ? "var(--bad)" : "var(--line)"}"><div class="card-h"><h2>${L(IN.SECTIONS[p.sec][0], IN.SECTIONS[p.sec][1])}</h2></div>
    <div class="card-b"><dl style="margin:0;display:grid;grid-template-columns:minmax(90px,auto) minmax(0,1fr);gap:8px 14px;font-size:13px">
      <dt class="muted">${L("What happened","ما حدث")}</dt><dd style="margin:0"><b>${U.esc(p.what)}</b></dd>
      <dt class="muted">${L("Why","لماذا")}</dt><dd style="margin:0">${U.esc(p.why)}</dd>
      <dt class="muted">${L("Financial impact","الأثر المالي")}</dt><dd style="margin:0">${U.esc(p.impact)}</dd>
      <dt class="muted">${L("What to do","ما يجب فعله")}</dt><dd style="margin:0">${U.esc(p.action)}</dd></dl></div></section>`;
  const aiKey = ctx.co.id + "|" + E.periodLabel(ctx.period);
  const aiBox = ai.enabled ? ui.card(L("AI commentary","التعليق بالذكاء الاصطناعي"), (!BM.aiEndpoint() ? ui.banner("warn", L("AI commentary is ON but no endpoint is set. Add your backend URL in Settings.","التعليق بالذكاء الاصطناعي مفعّل لكن لا يوجد رابط. أضف رابط الخادم في الإعدادات.")) : BM.aiMode() === "trust" && !BM.auth.user() && !BM.auth.code() ? ui.banner("warn", L("Sign in with your TRUST account to use AI commentary.","سجّل الدخول بحساب TRUST لاستخدام التعليق بالذكاء الاصطناعي.") + ` <a href="#settings" style="color:inherit">${L("Settings","الإعدادات")}</a>`) : "") +
      (CM.err ? ui.banner("bad", U.esc(CM.err) + " " + L("The local commentary below is unaffected.","التعليق المحلي أدناه غير متأثر.")) : "") +
      (CM.ai && CM.ai.key === aiKey ? `<div class="banner warn" style="margin-bottom:8px">${L("AI-generated text — check every figure against the statements before use.","نص مولّد بالذكاء الاصطناعي — تحقق من كل رقم مقابل القوائم قبل الاستخدام.")}</div><div style="white-space:pre-wrap;font-size:13px">${U.esc(CM.ai.text)}</div>` : "") +
      `<div class="row" style="margin-top:10px"><button class="btn pri" ${CM.busy || !BM.aiEndpoint() ? "disabled" : ""} onclick="BM.cmUI.run()">${CM.busy ? L("Generating…","جارٍ الإنشاء…") : L("Generate with AI","إنشاء بالذكاء الاصطناعي")}</button>
      <span class="small muted">${L("Sends structured figures (no ledgers, no keys) to {e}.","يرسل الأرقام المنظمة (دون دفاتر أو مفاتيح) إلى {e}.",{e:U.esc(BM.aiMode() === "trust" ? L("the TRUST AI service","خدمة TRUST للذكاء الاصطناعي") + (BM.auth.user() ? " · " + BM.auth.user().email : "") : (BM.aiEndpoint() || "—"))})}</span></div>`) : "";
  const html = ui.banner("info", `<b>${L("Rule-based commentary.","تعليق قائم على القواعد.")}</b> ${L("Written from the loaded figures only. Where the cause cannot be proven from the data, it is stated as a possibility that needs investigation. Compared with: {b}.","مكتوب من الأرقام المحمّلة فقط. عندما لا يمكن إثبات السبب من البيانات يُذكر كاحتمال يحتاج تحققاً. المقارنة مع: {b}.",{b:U.esc(ctx.view.cmp.is ? ctx.view.label : L("Prior year","السنة السابقة"))})}`) +
    aiBox + pts.map(card).join("");
  return {html};
}};

/* ------------------------------ Executive summary ------------------------------ */
BM.PAGES.execsummary = {render(ctx){
  const x = IN.context(ctx.view), s = IN.summary(x), band = IN.scoreBand(s.score);
  const col = !band ? "var(--ink-3)" : band[0] === "good" ? "var(--good)" : band[0] === "info" ? "var(--info)" : band[0] === "warn" ? "var(--warn)" : "var(--bad)";
  const list = (arr, empty) => arr.length ? `<ul style="margin:0;padding-inline-start:18px;display:flex;flex-direction:column;gap:6px;font-size:13px">${arr.map(a => `<li>${a}</li>`).join("")}</ul>` + (arr.length < 3 ? `<p class="small muted" style="margin:8px 0 0">${L("Only items supported by the data are listed.","تُذكر فقط البنود التي تدعمها البيانات.")}</p>` : "") : `<p class="small muted" style="margin:0">${empty}</p>`;
  const html = `<div class="grid g2">` + ui.card(L("Overall financial health","الصحة المالية العامة"), `<div class="score">
      <div class="ring" style="--p:${s.score || 0};--sc:${col}"><b style="color:${col}">${s.score == null ? "—" : s.score}</b></div>
      <div style="flex:1;min-width:220px;display:flex;flex-direction:column;gap:8px">${band ? `<span class="b b-${band[0]}" style="align-self:flex-start;font-size:13px;padding:3px 12px">${L(band[1], band[2])}</span>` : ""}
      ${s.parts.map(p => `<div class="row small" style="justify-content:space-between;gap:10px"><span>${L(p[0], p[1])} <span class="muted">(${p[2]})</span></span><span class="mono">${p[3] == null ? L("n/a","غ/م") : Math.round(p[3] * 100) + "%"}</span></div><div class="meter"><i style="width:${p[3] == null ? 0 : p[3] * 100}%"></i></div>`).join("")}</div></div>
      <p class="small muted" style="margin:10px 0 0">${L("Score 0–100: weighted from the risk levels of each area (low 100%, medium 60%, high 25%, critical 0%) and net profit against budget. Areas without data are left out and the weights rescaled ({n} of 6 used).","المؤشر 0–100: مرجّح من مستويات المخاطر لكل مجال (منخفض 100%، متوسط 60%، مرتفع 25%، حرج 0%) وصافي الربح مقابل الموازنة. المجالات بلا بيانات تُستبعد ويُعاد توزيع الأوزان (استُخدم {n} من 6).",{n:s.used})}</p>`) +
    ui.card(L("Financial outlook","النظرة المالية"), `<p style="margin:0;font-size:13.5px">${U.esc(s.outlook)}</p>`, {sub:L("Based strictly on recent results","مبنية حصراً على النتائج الأخيرة")}) + `</div>
    <div class="grid g2">${ui.card(L("Key positive developments","أهم التطورات الإيجابية"), list(s.positives.map(U.esc), L("No significant positive movement in this period.","لا يوجد تحسن جوهري في هذه الفترة.")))}
    ${ui.card(L("Key concerns","أهم المخاوف"), list(s.concerns.map(U.esc), L("No significant negative movement in this period.","لا يوجد تراجع جوهري في هذه الفترة.")))}</div>
    <div class="grid g2">${ui.card(L("Financial risks","المخاطر المالية"), list(s.risks.map(r => `${IN.levelBadge(r.level)} <b>${L(r.en, r.ar)}</b> — ${U.esc(r.evidence[0])}`), L("No risk above low in this period.","لا توجد مخاطر أعلى من منخفضة في هذه الفترة.")))}
    ${ui.card(L("Management priorities","أولويات الإدارة"), list(s.priorities.map(U.esc), L("No priority actions arise from the risk assessment.","لا تنتج أولويات من تقييم المخاطر.")))}</div>`;
  return {html};
}};
})();
