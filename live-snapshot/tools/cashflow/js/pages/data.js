/* =============================================================================
   pages/data.js — Trial Balance viewer, Account Mapping, Data Quality Center
   ============================================================================= */
(function(){
const U = BM.U, S = BM.state, E = BM.E, ui = BM.ui;
const accName = a => a ? (U.isAr() && a.nameAr ? a.nameAr : a.name) : "";
const snapLabel = s => `${s.scenario === "budget" ? L("Budget","موازنة") : L("Actual","فعلي")} — ${U.month(s.month, 1)} ${s.year}${s.kind === "opening" ? " · " + L("opening","افتتاحي") : s.kind === "pl-only" ? " · " + L("income statement only","قائمة الدخل فقط") : ""}`;
const sortSnaps = co => Object.entries(co.snapshots).sort((a, b) => (b[1].year - a[1].year) || (b[1].month - a[1].month) || (a[1].scenario < b[1].scenario ? -1 : 1));

/* ------------------------------ Trial balance ------------------------------ */
BM.PAGES.trialbalance = {render(ctx){
  const co = ctx.co; if (!co) return {html:""};
  const snaps = sortSnaps(co);
  if (!snaps.length) return {html: ui.card("", ui.empty(L("No trial balance loaded.","لا يوجد ميزان مراجعة محمّل."), `<a class="btn pri" href="#import">${L("Go to Inputs","انتقل إلى المدخلات")}</a>`))};
  const wc = ctx.period.year ? E.toCal(co, ctx.period.year, ctx.period.month) : null, want = wc ? E.key("actual", wc.y, wc.m) : null;
  if (!S.tbKey || !co.snapshots[S.tbKey] || S._tbCo !== co.id){ S.tbKey = co.snapshots[want] ? want : snaps[0][0]; S._tbCo = co.id; }
  const s = co.snapshots[S.tbKey], a = E.agg(co, s), f = S.tbFilter || "all", q = U.norm(S.tbQ || "");
  const rows = Object.keys(s.bal).sort().map(c => [c, co.accounts[c], s.bal[c]])
    .filter(([c, ac, v]) => (f === "all" || (f === "unmapped" && ac && !ac.fsKey && !ac.excluded) || (f === "excluded" && ac && ac.excluded) || (f === "nonzero" && Math.abs(v) >= 0.005))
      && (!q || U.norm(c + " " + accName(ac)).indexOf(q) >= 0));
  let dr = 0, cr = 0;
  const body = rows.slice(0, 2000).map(([c, ac, v]) => {
    const ex = ac && ac.excluded; if (!ex){ if (v > 0) dr += v; else cr -= v; }
    return `<tr${ex ? ` class="muted"` : ""}><td class="mono">${U.esc(c)}</td><td class="wrap">${U.esc(accName(ac))}${ex ? ` ${ui.badge("mute", L("Excluded","مستبعد"))}` : ""}</td>
      <td>${ac && ac.fsKey ? U.fsLabel(ac.fsKey) : `<span class="neg">${L("Unmapped","غير مصنف")}</span>`}</td>
      <td class="n">${v > 0 ? U.num(v, 2) : ""}</td><td class="n">${v < 0 ? U.num(-v, 2) : ""}</td></tr>`;
  }).join("");
  const bal = Math.abs(a.tb) <= Math.max(1, a.dr * 1e-5);
  const html = (bal ? ui.banner("good", `✔ <b>${L("Total debits = total credits","إجمالي المدين = إجمالي الدائن")}</b> (${U.numPlain(a.dr, 2)})`)
      : ui.banner("bad", `✖ <b>${L("This trial balance does not balance.","ميزان المراجعة هذا غير متوازن.")}</b> ${L("Debits {d} · credits {c} · difference {x}","المدين {d} · الدائن {c} · الفرق {x}",{d:U.numPlain(a.dr, 2), c:U.numPlain(a.cr, 2), x:U.numPlain(a.tb, 2)})}`)) +
    ui.tableCard(L("Trial balance","ميزان المراجعة"), `<table><thead><tr><th>${L("Code","الرقم")}</th><th>${L("Account","الحساب")}</th><th>${L("Statement line","بند القائمة")}</th><th class="n">${L("Debit","مدين")}</th><th class="n">${L("Credit","دائن")}</th></tr></thead>
      <tbody>${body}<tr class="t"><td></td><td>${L("Total shown (excluding excluded rows)","مجموع المعروض (دون المستبعد)")}</td><td></td><td class="n">${U.num(dr, 2)}</td><td class="n">${U.num(cr, 2)}</td></tr></tbody></table>`,
      {tall:true, sub:L("Amounts in {c} as loaded · income-statement accounts are year-to-date","المبالغ بعملة {c} كما حُمّلت · حسابات قائمة الدخل تراكمية منذ بداية السنة",{c:co.currency}),
       act:`<select class="in sm" aria-label="${L("Trial balance","ميزان المراجعة")}" onchange="BM.state.tbKey=this.value;BM.render()">${snaps.map(([k, x]) => `<option value="${k}" ${k === S.tbKey ? "selected" : ""}>${snapLabel(x)}</option>`).join("")}</select>
         <select class="in sm" aria-label="${L("Filter","تصفية")}" onchange="BM.state.tbFilter=this.value;BM.render()">${[["all","All accounts","كل الحسابات"],["nonzero","Non-zero balances","أرصدة غير صفرية"],["unmapped","Unmapped","غير مصنف"],["excluded","Excluded","مستبعد"]].map(o => `<option value="${o[0]}" ${f === o[0] ? "selected" : ""}>${L(o[1], o[2])}</option>`).join("")}</select>
         <input class="in sm" type="search" id="tbq" placeholder="${L("Search","بحث")}" value="${U.esc(S.tbQ || "")}" onchange="BM.state.tbQ=this.value;BM.render()">
         <button class="btn sm" onclick="BM.exportTB()">⤓ Excel</button>`}) +
    `<p class="small muted" style="margin:0">${L("Source: {s}","المصدر: {s}",{s:U.esc(s.source === "demo" ? L("demo generator","مولد البيانات التجريبية") : s.source)})}${rows.length > 2000 ? " · " + L("first 2,000 rows shown","يتم عرض أول 2000 صف") : ""}</p>`;
  return {html};
}};
BM.exportTB = () => {
  if (!BM.xlsxReady()) return;
  const co = BM.co(), s = co.snapshots[S.tbKey];
  const rows = [[L("Code","الرقم"), L("Account","الحساب"), L("Statement line","بند القائمة"), L("Debit","مدين"), L("Credit","دائن"), L("Excluded","مستبعد")]]
    .concat(Object.keys(s.bal).sort().map(c => { const a = co.accounts[c], v = s.bal[c]; return [c, accName(a), a && a.fsKey ? U.fsLabel(a.fsKey) : L("Unmapped","غير مصنف"), v > 0 ? v : "", v < 0 ? -v : "", a && a.excluded ? "✓" : ""]; }));
  const wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet(rows); ws["!cols"] = [{wch:12},{wch:44},{wch:30},{wch:16},{wch:16},{wch:9}];
  XLSX.utils.book_append_sheet(wb, ws, (s.scenario + "_" + s.year + "_" + s.month).slice(0, 31));
  BM.saveFile(`TB_${U.nm(co.name).replace(/[^\w؀-ۿ]+/g,"_")}_${s.scenario}_${s.year}-${String(s.month).padStart(2,"0")}.xlsx`, new Blob([XLSX.write(wb, {bookType:"xlsx", type:"array"})]));
};

/* ------------------------------ Account mapping ------------------------------ */
const M = BM.mapUI = {f:"all", q:"", page:0};
function latestBal(co){
  const l = E.latest(co), s = l ? E.snap(co, "actual", l.year, l.month) : sortSnaps(co)[0] && sortSnaps(co)[0][1];
  return s ? s.bal : {};
}
M.set = (i, k, el) => {
  const co = BM.co(); if (co.demo) return;
  const a = M.rows[i]; if (!a) return;
  a.fsKey = k || null; a.conf = k ? "manual" : "none"; BM.rememberMapping(a.code, a.name, a.fsKey);
  E.bump(co); BM.saveData();
  const cell = el && el.closest("tr").querySelector(".cf"); if (cell){ const c = BM.CONF_LABEL[a.conf]; cell.innerHTML = ui.badge(c[2], L(c[0], c[1])); }
  M.refreshSummary();
};
M.incl = (i, on) => { const co = BM.co(); if (co.demo) return; const a = M.rows[i]; if (!a) return; a.excluded = !on; E.bump(co); BM.saveData(); M.refreshSummary(); };
M.bulk = k => {
  const co = BM.co(); if (co.demo || !k) return;
  const list = M.list(co);
  BM.confirm(L("Assign {n} account(s) in this list to “{l}”?","تصنيف {n} حساب/حسابات في هذه القائمة إلى «{l}»؟",{n:list.length, l:U.fsLabel(k)}), L("Assign","تصنيف"), () => {
    list.forEach(a => { a.fsKey = k; a.conf = "manual"; BM.rememberMapping(a.code, a.name, k); });
    E.bump(co); BM.saveData(); BM.render(); BM.toast(L("Mapping updated.","تم تحديث التصنيف."));
  });
};
M.list = co => {
  const q = U.norm(M.q), f = M.f;
  return Object.values(co.accounts).filter(a => (f === "all" || (f === "review" && !a.excluded && (a.conf === "code" || !a.fsKey)) || (f === "unmapped" && !a.fsKey) || (f === "excluded" && a.excluded) || (f.indexOf("fs:") === 0 && a.fsKey === f.slice(3)))
    && (!q || U.norm(a.code + " " + a.name + " " + (a.nameAr || "")).indexOf(q) >= 0)).sort((x, y) => x.code < y.code ? -1 : 1);
};
M.refreshSummary = () => { const el = U.$("#mapSum"); if (el) el.innerHTML = summary(BM.co()); };
function summary(co){
  const bal = latestBal(co), t = {}; let un = 0;
  for (const c in bal){ const a = co.accounts[c]; if (!a || a.excluded) continue; if (a.fsKey) t[a.fsKey] = (t[a.fsKey] || 0) + bal[c]; else un += bal[c]; }
  return `<table><thead><tr><th>${L("Statement line","بند القائمة")}</th><th class="n">${L("Accounts","الحسابات")}</th><th class="n">${L("Balance (Dr +)","الرصيد (مدين +)")}</th></tr></thead><tbody>` +
    BM.FS_GROUPS.map(g => `<tr class="h"><td colspan="3">${L(g[0], g[1])}</td></tr>` + g[2].map(k => {
      const n = Object.values(co.accounts).filter(a => a.fsKey === k && !a.excluded).length;
      return n ? `<tr class="ind" style="cursor:pointer" onclick="BM.mapUI.f='fs:${k}';BM.mapUI.page=0;BM.render()"><td>${U.fsLabel(k)}</td><td class="n">${n}</td><td class="n">${U.num(t[k] || 0)}</td></tr>` : "";
    }).join("")).join("") +
    `<tr class="${un ? "" : "muted"}"><td class="${un ? "neg" : ""}">${L("Unmapped","غير مصنف")}</td><td class="n">${Object.values(co.accounts).filter(a => !a.fsKey && !a.excluded).length}</td><td class="n">${U.num(un)}</td></tr></tbody></table>`;
}
M.export = () => {
  if (!BM.xlsxReady()) return;
  const co = BM.co();
  const rows = [["Account code","Account name","Statement line key","Statement line","Excluded"]].concat(Object.values(co.accounts).sort((a, b) => a.code < b.code ? -1 : 1).map(a => [a.code, a.name, a.fsKey || "", a.fsKey ? BM.FS[a.fsKey][3] : "Unmapped", a.excluded ? "yes" : ""]));
  const keys = [["Statement line key","Statement line (EN)","Statement line (AR)","Statement"]].concat(BM.FS_KEYS.map(k => [k, BM.FS[k][3], BM.FS[k][4], BM.FS[k][0] === "BS" ? "Balance sheet" : "Income statement"]));
  const wb = XLSX.utils.book_new();
  const a = XLSX.utils.aoa_to_sheet(rows); a["!cols"] = [{wch:14},{wch:44},{wch:18},{wch:34},{wch:9}];
  const b = XLSX.utils.aoa_to_sheet(keys); b["!cols"] = [{wch:18},{wch:34},{wch:34},{wch:18}];
  XLSX.utils.book_append_sheet(wb, a, "Mapping"); XLSX.utils.book_append_sheet(wb, b, "Statement lines");
  BM.saveFile(`Mapping_${U.nm(co.name).replace(/[^\w؀-ۿ]+/g,"_")}.xlsx`, new Blob([XLSX.write(wb, {bookType:"xlsx", type:"array"})]));
};
M.importFile = async file => {
  if (!file || !BM.xlsxReady()) return;
  const co = BM.co(); if (co.demo) return;
  try {
    const book = await BM.IMP.readWorkbook(file), aoa = book.sheets[0].aoa, h = (aoa[0] || []).map(U.norm);
    const ic = h.findIndex(x => /code|رقم/.test(x)), ik = h.findIndex(x => /key/.test(x)), il = h.findIndex(x => /statement line|بند/.test(x) && !/key/.test(x)), ix = h.findIndex(x => /exclud|مستبعد/.test(x));
    if (ic < 0 || (ik < 0 && il < 0)) return BM.toast(L("The file needs an account-code column and a statement-line column.","الملف يحتاج عمود رقم الحساب وعمود بند القائمة."));
    const byLabel = {}; BM.FS_KEYS.forEach(k => { byLabel[U.norm(BM.FS[k][3])] = k; byLabel[U.norm(BM.FS[k][4])] = k; byLabel[k] = k; });
    let n = 0, bad = 0;
    aoa.slice(1).forEach(r => {
      const code = String(r[ic] == null ? "" : r[ic]).replace(/\.0+$/,"").trim(), a = co.accounts[code]; if (!a) return;
      const k = byLabel[U.norm(ik >= 0 ? r[ik] : "")] || byLabel[U.norm(il >= 0 ? r[il] : "")];
      if (!k){ bad++; return; }
      a.fsKey = k; a.conf = "manual"; BM.rememberMapping(a.code, a.name, k); n++;
      if (ix >= 0) a.excluded = /^(yes|y|1|true|نعم|✓)$/i.test(String(r[ix]).trim());
    });
    E.bump(co); BM.saveData(); BM.render();
    BM.toast(L("{n} account(s) updated{b}.","تم تحديث {n} حساب/حسابات{b}.",{n, b: bad ? L(" · {x} row(s) had an unknown statement line"," · {x} صف/صفوف ببند غير معروف",{x:bad}) : ""}));
  } catch(e){ console.error(e); BM.toast(L("The file could not be read.","تعذرت قراءة الملف.")); }
};

BM.PAGES.mapping = {render(ctx){
  const co = ctx.co; if (!co) return {html:""};
  const ro = co.demo || !BM.can("map");
  const all = Object.values(co.accounts);
  if (!all.length) return {html: ui.card("", ui.empty(L("No accounts yet.","لا توجد حسابات بعد."), `<a class="btn pri" href="#import">${L("Go to Inputs","انتقل إلى المدخلات")}</a>`))};
  const bal = latestBal(co), list = M.list(co), per = 200, pages = Math.max(1, Math.ceil(list.length / per)); M.page = Math.min(M.page, pages - 1);
  const opts = sel => `<option value="">${L("— Unmapped —","— غير مصنف —")}</option>` + BM.FS_GROUPS.map(g => `<optgroup label="${L(g[0], g[1])}">${g[2].map(k => `<option value="${k}" ${sel === k ? "selected" : ""}>${U.fsLabel(k)}</option>`).join("")}</optgroup>`).join("");
  const n = {all:all.length, review:all.filter(a => !a.excluded && (a.conf === "code" || !a.fsKey)).length, unmapped:all.filter(a => !a.fsKey).length, excluded:all.filter(a => a.excluded).length};
  const tab = (k, en, ar) => `<button class="${M.f === k ? "on" : ""}" onclick="BM.mapUI.f='${k}';BM.mapUI.page=0;BM.render()">${L(en, ar)} (${n[k]})</button>`;
  M.rows = list.slice(M.page * per, (M.page + 1) * per);
  const rows = M.rows.map((a, i) => {
    const cl = BM.CONF_LABEL[a.conf] || BM.CONF_LABEL.none;
    return `<tr${a.excluded ? ` style="opacity:.55"` : ""}><td><input type="checkbox" aria-label="${L("Include","تضمين")}" ${a.excluded ? "" : "checked"} ${ro ? "disabled" : ""} onchange="BM.mapUI.incl(${i},this.checked);this.closest('tr').style.opacity=this.checked?'':'.55'"></td>
      <td class="mono">${U.esc(a.code)}</td><td class="wrap">${U.esc(accName(a))}${a.summary ? ` ${ui.badge("info", L("Summary row","حساب تجميعي"))}` : ""}</td>
      <td class="n">${bal[a.code] != null ? U.num(bal[a.code]) : `<span class="muted">—</span>`}</td>
      <td><select class="in sm" aria-label="${L("Statement line","بند القائمة")}" ${ro ? "disabled" : ""} onchange="BM.mapUI.set(${i},this.value,this)">${opts(a.fsKey)}</select></td>
      <td class="cf">${ui.badge(cl[2], L(cl[0], cl[1]))}</td></tr>`;
  }).join("");
  const filterLabel = M.f.indexOf("fs:") === 0 ? `<span class="b b-info">${U.fsLabel(M.f.slice(3))} <a href="#mapping" onclick="BM.mapUI.f='all';BM.render();return false" style="color:inherit;text-decoration:none">✕</a></span>` : "";
  const html = (co.demo ? ui.banner("info", L("The demo company's mapping is fixed. Import your own trial balance to edit mappings.","تصنيف الشركة التجريبية ثابت. استورد ميزان المراجعة الخاص بك لتعديل التصنيف.")) : !BM.can("map") ? ui.banner("warn", L("Your role cannot change mappings.","دورك لا يسمح بتعديل التصنيف.")) : "") +
    `<div class="grid" style="grid-template-columns:minmax(0,2fr) minmax(0,1fr)" id="mapGrid">` +
    ui.card(L("Accounts","الحسابات"), `
      <div class="row" style="margin-bottom:10px;justify-content:space-between">
        <div class="seg">${tab("all","All","الكل")}${tab("review","Needs review","يحتاج مراجعة")}${tab("unmapped","Unmapped","غير مصنف")}${tab("excluded","Excluded","مستبعد")}</div>
        <input class="in" type="search" id="mq" placeholder="${L("Search code or name","ابحث بالرقم أو الاسم")}" value="${U.esc(M.q)}" onchange="BM.mapUI.q=this.value;BM.mapUI.page=0;BM.render()"></div>
      ${filterLabel ? `<div class="row" style="margin-bottom:8px">${filterLabel}</div>` : ""}
      ${ro ? "" : `<div class="row small" style="margin-bottom:10px"><label for="bulk">${L("Assign every account in this list to:","تصنيف كل الحسابات في هذه القائمة إلى:")}</label><select class="in sm" id="bulk">${opts("")}</select><button class="btn sm" onclick="BM.mapUI.bulk(document.getElementById('bulk').value)">${L("Apply","تطبيق")}</button></div>`}
      <div class="tw tall"><table><thead><tr><th>${L("Use","استخدام")}</th><th>${L("Code","الرقم")}</th><th>${L("Account","الحساب")}</th><th class="n">${L("Latest balance","آخر رصيد")}</th><th>${L("Statement line","بند القائمة")}</th><th>${L("Source","المصدر")}</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="6" class="muted">${L("Nothing in this list.","لا يوجد شيء في هذه القائمة.")}</td></tr>`}</tbody></table></div>
      ${pages > 1 ? `<div class="row" style="margin-top:8px"><button class="btn sm" ${M.page ? "" : "disabled"} onclick="BM.mapUI.page--;BM.render()">‹</button><span class="small">${M.page + 1} / ${pages}</span><button class="btn sm" ${M.page < pages - 1 ? "" : "disabled"} onclick="BM.mapUI.page++;BM.render()">›</button></div>` : ""}`,
      {act: co.demo ? "" : `<button class="btn sm" onclick="BM.mapUI.export()">⤓ ${L("Export mapping","تصدير التصنيف")}</button>${ro ? "" : `<label class="btn sm">⤒ ${L("Import mapping","استيراد التصنيف")}<input type="file" hidden accept=".xlsx,.xls,.csv" onchange="BM.mapUI.importFile(this.files[0])"></label>`}`}) +
    ui.card(L("Where the balances land","أين تذهب الأرصدة"), `<div class="tw" id="mapSum">${summary(co)}</div>`, {flush:true, sub:L("Latest actual trial balance","آخر ميزان مراجعة فعلي")}) + `</div>
    <p class="small muted" style="margin:0">${L("Every change is saved in this browser and remembered for future uploads (by account code and by account name). Statements update immediately.","كل تعديل يُحفظ في هذا المتصفح ويُتذكر في الاستيرادات القادمة (حسب رقم الحساب واسمه). القوائم تتحدث فوراً.")}</p>`;
  return {html, after(){ const g = U.$("#mapGrid"); if (g && window.innerWidth < 1000) g.style.gridTemplateColumns = "minmax(0,1fr)"; }};
}};

/* ------------------------------ Data quality ------------------------------ */
BM.PAGES.quality = {render(ctx){
  const co = ctx.co; if (!co) return {html:""};
  const q = BM.quality(co, ctx.period.year), sc = q.score;
  const col = sc >= 85 ? "var(--good)" : sc >= 65 ? "var(--warn)" : "var(--bad)";
  const cats = {balance:["Trial balance","ميزان المراجعة"], mapping:["Mapping","التصنيف"], structure:["Structure","البنية"], numbers:["Numbers","الأرقام"], duplicates:["Duplicates","التكرار"], accounting:["Accounting","المحاسبة"], periods:["Periods & comparatives","الفترات والمقارنات"], nature:["Account nature","طبيعة الحسابات"]};
  const iss = q.issues.length ? q.issues.map(i => `<div class="issue ${i.sev}"><span class="ic">${i.sev === "error" ? "✖" : i.sev === "warning" ? "!" : "i"}</span><div><span class="small muted">${L((cats[i.cat] || [i.cat])[0], (cats[i.cat] || [i.cat, i.cat])[1])}</span><br>${U.esc(i.msg)}</div></div>`).join("")
    : `<div class="issue info"><span class="ic">✓</span><div>${L("No issues found.","لا توجد ملاحظات.")}</div></div>`;
  const inv = sortSnaps(co).map(([k, s]) => {
    const a = E.agg(co, s), ok = Math.abs(a.tb) <= Math.max(1, a.dr * 1e-5);
    const b = s.hasBS ? E.bsCal(co, s.scenario, s.year, s.month) : null;
    return `<tr><td>${snapLabel(s)}</td><td>${s.scenario === "budget" && !s.hasBS ? `<span class="muted small">${L("n/a for a P&L budget","لا ينطبق على موازنة دخل")}</span>` : ok ? ui.badge("good", L("Balances","متوازن")) : ui.badge("bad", L("Out by {x}","فرق {x}",{x:U.numPlain(a.tb)}))}</td>
      <td>${b ? (Math.abs(b.diff) <= 1 ? ui.badge("good", "A = L + E") : ui.badge("bad", L("Off by {x}","فرق {x}",{x:U.numPlain(b.diff)}))) : `<span class="muted small">—</span>`}</td>
      <td class="n">${Object.keys(s.bal).length}</td><td class="small muted wrap">${U.esc(s.source === "demo" ? L("demo generator","مولد البيانات التجريبية") : s.source)}</td></tr>`;
  }).join("");
  const html = `<div class="grid g2">` + ui.card(L("Quality score","مؤشر الجودة"), `<div class="score">
      <div class="ring" style="--p:${sc};--sc:${col}"><b style="color:${col}">${sc}</b></div>
      <div style="flex:1;min-width:220px;display:flex;flex-direction:column;gap:9px">${q.parts.map(p => `<div><div class="row small" style="justify-content:space-between"><span><b>${L(p.en, p.ar)}</b></span><span class="mono">${p.got.toFixed(1)} / ${p.w}</span></div>
        <div class="meter" style="margin:3px 0"><i style="width:${(100 * p.got / p.w).toFixed(1)}%"></i></div><div class="small muted">${p.detail}</div></div>`).join("")}</div></div>`,
      {sub:L("0–100 · each component shows its own evidence","0–100 · كل مكوّن يعرض دليله")}) +
    ui.card(L("Issues","الملاحظات"), iss, {sub:L("{e} errors · {w} warnings","{e} أخطاء · {w} تحذيرات",{e:q.issues.filter(i => i.sev === "error").length, w:q.issues.filter(i => i.sev === "warning").length})}) + `</div>` +
    ui.tableCard(L("Loaded trial balances","موازين المراجعة المحمّلة"), `<table><thead><tr><th>${L("Trial balance","ميزان المراجعة")}</th><th>${L("Debits = credits","المدين = الدائن")}</th><th>${L("Balance sheet","الميزانية")}</th><th class="n">${L("Accounts","الحسابات")}</th><th>${L("Source","المصدر")}</th></tr></thead><tbody>${inv}</tbody></table>`, {tall:true}) +
    (co.demo ? "" : ui.tableCard(L("Import history","سجل الاستيراد"), `<table><thead><tr><th>${L("When","التاريخ")}</th><th>${L("File","الملف")}</th><th>${L("Loaded","ما تم تحميله")}</th><th class="n">${L("Accounts","الحسابات")}</th><th class="n">${L("Errors / warnings","أخطاء / تحذيرات")}</th></tr></thead><tbody>${(co.imports || []).map(im => `<tr><td class="small">${im.at.slice(0,16).replace("T"," ")}</td><td class="wrap small">${U.esc(im.file)} › ${U.esc(im.sheet)}</td><td class="small">${(im.written || []).map(w => (w.sc === "budget" ? "B " : "A ") + w.y + "-" + String(w.m).padStart(2,"0")).join(", ")}</td><td class="n">${im.accounts}</td><td class="n">${(im.issues || []).filter(i => i[0] === "error").length} / ${(im.issues || []).filter(i => i[0] === "warning").length}</td></tr>`).join("")}</tbody></table>`));
  return {html};
}};
})();
