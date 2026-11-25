/* =============================================================================
   pages/import.js — Import Excel wizard (master prompt §4)
   1 Upload → 2 Columns & settings → 3 Account mapping → 4 Validate & import
   ============================================================================= */
(function(){
const U = BM.U, S = BM.state, IMP = BM.IMP, ui = BM.ui;
const W = BM.wz = {st:null};

function guessYM(text){
  const t = U.norm(text); let y = null, m = null;
  const ym = t.match(/\b(20\d{2})\b/); if (ym) y = +ym[1];
  const MK = [["كانون الثاني",1],["كانون الاول",12],["تشرين الاول",10],["تشرين الثاني",11],["شباط",2],["اذار",3],["نيسان",4],["ايار",5],["حزيران",6],["تموز",7],["ايلول",9],
    ["يناير",1],["فبراير",2],["مارس",3],["ابريل",4],["مايو",5],["يونيو",6],["يوليو",7],["اغسطس",8],["سبتمبر",9],["اكتوبر",10],["نوفمبر",11],["ديسمبر",12],
    ["january",1],["february",2],["march",3],["april",4],["june",6],["july",7],["august",8],["september",9],["october",10],["november",11],["december",12],
    ["jan",1],["feb",2],["mar",3],["apr",4],["may",5],["jun",6],["jul",7],["aug",8],["sep",9],["oct",10],["nov",11],["dec",12]];
  for (const [k, v] of MK) if ((" " + t + " ").indexOf(" " + U.norm(k) + " ") >= 0){ m = v; break; }
  const d = t.match(/\b(\d{1,2}) (20\d{2})\b/); if (!m && d && +d[1] >= 1 && +d[1] <= 12) m = +d[1];
  const e = t.match(/\b(20\d{2}) (\d{1,2})\b/); if (!m && e && +e[2] >= 1 && +e[2] <= 12) m = +e[2];
  return {y, m};
}

W.guessYM = guessYM;
W.startBook = book => start(book);
function start(book){
  const best = book.sheets.reduce((b, s, i) => s.aoa.length > book.sheets[b].aoa.length ? i : b, 0);
  /* period hints: file name, sheet name and any title rows above the header */
  const aoa0 = book.sheets[best].aoa, hr0 = IMP.detectHeader(aoa0);
  const titles = aoa0.slice(0, hr0).map(r => r.filter(x => typeof x === "string").join(" ")).join(" ");
  const g1 = guessYM(titles), g2 = guessYM(book.file + " " + book.sheets[best].name);
  const g = {y: g1.y || g2.y, m: g1.m || g2.m};
  const co = S.dataset === "uploaded" ? BM.co() : null;
  const latest = co ? BM.E.latest(co) : null, he = co && co.inputs && co.inputs.hist ? (BM.inputs.nextEnd(co) ? {ty:BM.inputs.nextEnd(co).y, tm:BM.inputs.nextEnd(co).m} : co.inputs.hist) : null;
  W.st = {step:2, book, sheet:best, hr:0, roles:[], filter:"review", q:"", page:0,
    opts:{scenario:"actual", year:g.y || (he && he.ty) || (latest && BM.E.toCal(co, latest.year, latest.month).y) || new Date().getFullYear(), month:g.m || (he && he.tm) || 12, sign:"dr", openAt:"year", pyAt:"yearend", budAt:"annual"},
    target: co ? {id:co.id} : {id:"", nameEn:book.file.replace(/\.(xlsx|xlsm|xls|csv)$/i,"").replace(/[_]+/g," "), nameAr:"", currency:"ILS", industry:"other", fyStart:1}};
  if (/budget|موازن/i.test(book.file + book.sheets[best].name)) W.st.opts.scenario = "budget";
  /* uploaded from a specific year / period-end on the Inputs page: that date wins over the guess */
  if (W.forced){ W.st.opts.year = W.forced.y; W.st.opts.month = W.forced.m; W.st.forced = W.forced; W.st.opts.scenario = "actual"; W.forced = null; }
  W.pickSheet(best, true);
}
W.pickSheet = (i, silent) => {
  const st = W.st; st.sheet = +i; const aoa = st.book.sheets[st.sheet].aoa;
  st.hr = IMP.detectHeader(aoa);
  st.roles = IMP.detectRoles(aoa, st.hr, +st.opts.year);
  reparse(); if (!silent) BM.render(); else BM.render();
};
W.setHeader = v => { const st = W.st, aoa = st.book.sheets[st.sheet].aoa; st.hr = Math.max(0, Math.min(aoa.length - 1, (+v || 1) - 1)); st.roles = IMP.detectRoles(aoa, st.hr, +st.opts.year); reparse(); BM.render(); };
W.setRole = (c, r) => { const st = W.st; if (r !== "ignore") st.roles = st.roles.map((x, i) => (x === r && i !== c) ? "ignore" : x); st.roles[c] = r; reparse(); BM.render(); };
W.setOpt = (k, v) => { W.st.opts[k] = v; if (k === "sign" || k === "scenario") reparse(); BM.render(); };
W.setTarget = (k, v) => { if (k === "id"){ W.st.target = v ? {id:v} : {id:"", nameEn:"", nameAr:"", currency:"ILS", industry:"other", fyStart:1}; } else W.st.target[k] = v; if (k === "id" || k === "fyStart") BM.render(); };
/* the company whose financial calendar applies to this import */
const fco = st => (st.target.id && S.companies.find(c => c.id === st.target.id)) || {fyStart: +st.target.fyStart || 1};
function reparse(){
  const st = W.st, aoa = st.book.sheets[st.sheet].aoa;
  st.parsed = IMP.parse(aoa, st.hr, st.roles);
  st.accts = null; st.validation = null;
}
function buildAccounts(){
  const st = W.st; const co = st.target.id ? S.companies.find(c => c.id === st.target.id) : null;
  st.accts = IMP.consolidate(st.parsed).map(a => {
    const known = co && co.accounts[a.code];
    const c = known && known.fsKey ? {fsKey:known.fsKey, conf: known.conf === "manual" ? "manual" : "memory"} : BM.classify(a.code, a.name);
    return Object.assign(a, {fsKey:c.fsKey, conf:c.conf, exclude: !!a.summary});
  });
}
W.next = () => {
  const st = W.st;
  if (st.step === 2){ if (st.parsed.issues.some(i => i[0] === "error" && i[1] === "structure" && /column|عمود|Select|حدد/.test(i[2]))) return BM.toast(L("Select the account-code column and at least one amount column.","حدد عمود رقم الحساب وعموداً واحداً على الأقل للمبالغ."));
    if (!st.target.id && !(st.target.nameEn || st.target.nameAr)) return BM.toast(L("Enter the company name.","أدخل اسم الشركة."));
    buildAccounts(); st.step = 3; }
  else if (st.step === 3){ st.validation = IMP.validate({accts:st.accts, parsed:st.parsed, opts:st.opts}); st.step = 4; }
  BM.render(); window.scrollTo(0,0);
};
W.back = () => { W.st.step = Math.max(2, W.st.step - 1); BM.render(); };
W.reset = () => { W.st = null; if (W.stReturn && W.stageCancelWizard) W.stageCancelWizard(); BM.render(); };
W.map = (i, k, el) => { const a = W.st.accts[i]; if (!a) return; a.fsKey = k || null; a.conf = k ? "manual" : "none";
  const cell = el && el.closest("tr").querySelector(".cf"); if (cell){ const c = BM.CONF_LABEL[a.conf]; cell.innerHTML = ui.badge(c[2], L(c[0], c[1])); } };
W.excl = (i, on, el) => { const a = W.st.accts[i]; if (a) a.exclude = !on; if (el) el.closest("tr").style.opacity = on ? "" : ".55"; };
W.filter = f => { W.st.filter = f; W.st.page = 0; BM.render(); };
W.search = U.debounce(q => { W.st.q = q; W.st.page = 0; BM.render(); const el = U.$("#wq"); if (el){ el.focus(); el.setSelectionRange(q.length, q.length); } }, 250);
W.excludeSummaries = on => { W.st.accts.forEach(a => { if (a.summary) a.exclude = on; }); W.st.validation = IMP.validate({accts:W.st.accts, parsed:W.st.parsed, opts:W.st.opts}); BM.render(); };
W.commit = (force) => {
  const st = W.st, v = st.validation;
  if (v.errors && !force){
    return BM.confirm(L("This file has {n} error(s). The statements will show these problems (for example an unbalanced balance sheet) until you correct the file or the mapping. Import anyway?","هذا الملف يحتوي {n} خطأ/أخطاء. ستظهر هذه المشاكل في القوائم (مثل ميزانية غير متوازنة) حتى تصحح الملف أو التصنيف. هل تريد الاستيراد على أي حال؟",{n:v.errors}), L("Import anyway","استيراد على أي حال"), () => W.commit(true));
  }
  /* opened from the Inputs list: return the reviewed file to the list instead of importing */
  if (W.stReturn){ W.stageFromWizard(st); BM.toast(L("Saved to the list. Post the data when all files are ready.","حُفظ في القائمة. رحّل البيانات عندما تجهز كل الملفات.")); BM.render(); window.scrollTo(0, 0); return; }
  const job = {file:st.book.file, sheet:st.book.sheets[st.sheet].name, accts:st.accts, parsed:st.parsed, opts:st.opts, target:st.target, validation:v};
  const r = IMP.commit(job);
  S.dataset = "uploaded"; S.companyId = r.co.id; S.settings._dataset = "uploaded"; S.settings._companyId = r.co.id; BM.saveSettings();
  const F = BM.E.toFis(r.co, +st.opts.year, +st.opts.month);
  S.period = {type:BM.inputs.viewFor(r.co, F.fy) || (S.period.type === "custom" ? "ytd" : (S.period.type || "ytd")), year:F.fy, month:F.p};
  BM.fixPeriod();
  st.step = 5; st.result = {written:r.written, co:r.co, notes:job.notes || []};
  /* opened from a multi-file import: return to the remaining files */
  if (W.parked){ W.bulk = W.parked; W.parked = null; W.st = null; BM.toast(L("Imported. Continue with the remaining files.","تم الاستيراد. تابع مع باقي الملفات.")); }
  BM.render(); window.scrollTo(0,0);
};

/* sample trial balance so users can see the expected shape */
W.sample = () => {
  if (!BM.xlsxReady()) return;
  const rows = [["Account code","Account name","Debit","Credit"],
    ["1111","Bank of Palestine — current account",182500,""],["1201","Trade receivables",640200,""],["1301","Inventory",410000,""],
    ["1501","Furniture and equipment",260000,""],["1509","Accumulated depreciation","",95000],["2101","Trade payables","",318400],
    ["2301","Overdraft","",120000],["3101","Paid-in capital","",500000],["3301","Retained earnings","",281300],
    ["4101","Sales","",1450000],["5101","Cost of goods sold",1040000,""],["6101","Salaries and wages",142000,""],
    ["6201","Rent",36000,""],["6501","Depreciation",24000,""],["7201","Bank interest",10000,""]];
  const ws = XLSX.utils.aoa_to_sheet(rows); ws["!cols"] = [{wch:14},{wch:38},{wch:14},{wch:14}];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "TB Dec 2026");
  BM.saveFile("TRUST_sample_trial_balance.xlsx", new Blob([XLSX.write(wb, {bookType:"xlsx", type:"array"})], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
};

/* upload for a chosen period-end (Inputs page, per year) */
W.uploadAt = (y, m) => { W.mode = "tb"; W.forced = {y:+y, m:+m}; const el = document.getElementById("fileAt"); if (el){ el.value = ""; el.click(); } };
W.onFile = async (file) => {
  if (!file) return;
  if (!BM.xlsxReady()) return;
  if (file.size > 25 * 1024 * 1024) return BM.toast(L("The file is larger than 25 MB.","حجم الملف أكبر من 25 ميجابايت."));
  try { const book = await IMP.readWorkbook(file); if (!book.sheets.length) return BM.toast(L("The workbook has no data.","الملف لا يحتوي بيانات.")); if (W.mode === "ar" || W.mode === "ap") W.agStart(book); else start(book); }
  catch(e){ console.error(e); BM.toast(L("This file could not be read as Excel. Save it as .xlsx and try again.","تعذرت قراءة الملف كملف Excel. احفظه بصيغة xlsx وحاول مرة أخرى.")); }
};

const STEPS = [["Upload","رفع الملف"],["Columns & settings","الأعمدة والإعدادات"],["Account mapping","تصنيف الحسابات"],["Validate & import","التحقق والاستيراد"]];
function stepper(n){ return `<div class="steps">${STEPS.map((s, i) => `<div class="step ${i + 1 === n ? "on" : i + 1 < n ? "done" : ""}"><i>${i + 1 < n ? "✓" : i + 1}</i>${L(s[0], s[1])}</div>`).join("")}</div>`; }
const issueList = arr => arr.length ? arr.map(i => `<div class="issue ${i[0]}"><span class="ic">${i[0] === "error" ? "✖" : i[0] === "warning" ? "!" : "i"}</span><div>${U.esc(i[2])}</div></div>`).join("") : `<div class="muted small">${L("No issues.","لا توجد ملاحظات.")}</div>`;
const ynSel = (k, opts) => `<select class="in" id="o_${k}" onchange="BM.wz.setOpt('${k}',this.value)">${opts.map(o => `<option value="${o[0]}" ${String(W.st.opts[k]) === String(o[0]) ? "selected" : ""}>${L(o[1], o[2])}</option>`).join("")}</select>`;

W.mode = "tb";
W.setMode = m => { W.mode = m; W.st = null; W.ag = null; BM.render(); };
W.startAging = kind => { W.mode = kind; W.st = null; W.ag = null; };
W.modeSeg = modeSeg;
function modeSeg(){
  const b = (k, en, ar) => `<button type="button" class="${W.mode === k ? "on" : ""}" onclick="BM.wz.setMode('${k}')">${L(en, ar)}</button>`;
  return `<div class="row" style="justify-content:space-between"><div class="seg" role="group" aria-label="${L("What are you importing?","ماذا تستورد؟")}">${b("tb","Trial balance / budget","ميزان مراجعة / موازنة")}${b("ar","Receivables aging","أعمار الذمم المدينة")}${b("ap","Payables aging","أعمار الذمم الدائنة")}</div></div>`;
}
function step1(){
  /* the Inputs page: company, periods, then staged uploads posted with one button */
  W.mode = "tb";
  return (W.postDoneHtml ? W.postDoneHtml() : "") + BM.inputsHome("");
}

function step2(){
  const st = W.st, aoa = st.book.sheets[st.sheet].aoa, roles = st.roles, p = st.parsed;
  const ncol = roles.length, from = Math.max(0, st.hr - 1), to = Math.min(aoa.length, st.hr + 11);
  const roleSel = c => `<select class="in sm" aria-label="${L("Column role","دور العمود")}" onchange="BM.wz.setRole(${c},this.value)">${IMP.ROLES.map(r => `<option value="${r[0]}" ${roles[c] === r[0] ? "selected" : ""}>${L(r[1], r[2])}</option>`).join("")}</select>`;
  let prev = `<table class="preview"><thead><tr><th>#</th>${Array.from({length:ncol}, (_, c) => `<th>${roleSel(c)}</th>`).join("")}</tr></thead><tbody>`;
  for (let r = from; r < to; r++){
    const row = aoa[r] || [];
    prev += `<tr class="${r === st.hr ? "hdr" : ""}"><td class="muted mono">${r + 1}</td>${Array.from({length:ncol}, (_, c) => { const x = row[c]; const t = x instanceof Date ? x.toISOString().slice(0,10) : (x == null ? "" : String(x)); return `<td title="${U.esc(t)}">${U.esc(t)}</td>`; }).join("")}</tr>`;
  }
  prev += `</tbody></table>`;
  const has = r => roles.indexOf(r) >= 0, hasAny = rs => rs.some(has);
  const net = hasAny(["close_net","open_net","py_net","bud_net"]) || roles.some(r => /^m\d+$/.test(r));
  const t = st.target;
  const target = `<div class="form">
    <div class="field"><label for="tco">${L("Load into","تحميل إلى")}</label><select class="in" id="tco" onchange="BM.wz.setTarget('id',this.value)">
      <option value="" ${!t.id ? "selected" : ""}>${L("A new company","شركة جديدة")}</option>${S.companies.map(c => `<option value="${c.id}" ${t.id === c.id ? "selected" : ""}>${U.esc(U.nm(c.name))}</option>`).join("")}</select></div>
    ${t.id ? "" : `
    <div class="field"><label for="tne">${L("Company name (English)","اسم الشركة (إنجليزي)")}</label><input class="in" id="tne" value="${U.esc(t.nameEn)}" oninput="BM.wz.setTarget('nameEn',this.value)"></div>
    <div class="field"><label for="tna">${L("Company name (Arabic)","اسم الشركة (عربي)")}</label><input class="in" id="tna" dir="rtl" value="${U.esc(t.nameAr)}" oninput="BM.wz.setTarget('nameAr',this.value)"></div>
    <div class="field"><label for="tcu">${L("Currency of the figures","عملة الأرقام")}</label><select class="in" id="tcu" onchange="BM.wz.setTarget('currency',this.value)">${Object.keys(BM.CURRENCIES).map(c => `<option ${t.currency === c ? "selected" : ""}>${c}</option>`).join("")}</select></div>
    <div class="field"><label for="tin">${L("Industry","القطاع")}</label><select class="in" id="tin" onchange="BM.wz.setTarget('industry',this.value)">${BM.INDUSTRIES.map(i => `<option value="${i[0]}" ${t.industry === i[0] ? "selected" : ""}>${L(i[1], i[2])}</option>`).join("")}</select></div>
    <div class="field"><label for="tfy">${L("Financial year starts in","بداية السنة المالية")}</label><select class="in" id="tfy" onchange="BM.wz.setTarget('fyStart',+this.value)">${BM.MONTHS.map((m, i) => `<option value="${i + 1}" ${(+t.fyStart || 1) === i + 1 ? "selected" : ""}>${U.month(i + 1, 1)}</option>`).join("")}</select></div>`}
    ${t.id ? `<p class="small muted" style="margin:0">${L("Financial year starts in {m} (change it in Settings).","السنة المالية تبدأ في {m} (يمكن تغييرها من الإعدادات).",{m:BM.E.fyStartName(fco(st))})}</p>` : ""}
  </div>`;
  const years = []; for (let y = new Date().getFullYear() + 1; y >= 2015; y--) years.push([y, String(y), String(y)]);
  const settings = `<div class="form">
    <div class="field"><label for="o_scenario">${L("These figures are","هذه الأرقام")}</label>${ynSel("scenario", [["actual","Actual","فعلية"],["budget","Budget","موازنة"]])}</div>
    <div class="field"><label for="o_month">${L("Balances as at the end of","الأرصدة كما في نهاية")}</label>${ynSel("month", BM.MONTHS.map((m, i) => [i + 1, m[1], m[2]]))}</div>
    <div class="field"><label for="o_year">${L("Year of that month-end","سنة نهاية ذلك الشهر")}</label>${ynSel("year", years)}</div>
    ${net ? `<div class="field"><label for="o_sign">${L("Single-column amounts are","المبالغ في العمود الواحد")}</label>${ynSel("sign", [["dr","Debit positive, credit negative","المدين موجب والدائن سالب"],["cr","Credit positive, debit negative","الدائن موجب والمدين سالب"],["natural","All positive (sign from account type)","كلها موجبة (الإشارة من نوع الحساب)"]])}</div>` : ""}
    ${hasAny(["open_dr","open_cr","open_net"]) ? `<div class="field"><label for="o_openAt">${L("Opening balances are as at","الأرصدة الافتتاحية كما في")}</label>${ynSel("openAt", [["year","Start of the financial year","بداية السنة المالية"],["month","Start of the selected month","بداية الشهر المحدد"]])}</div>` : ""}
    ${hasAny(["py_dr","py_cr","py_net"]) ? `<div class="field"><label for="o_pyAt">${L("Prior-year column is as at","عمود السنة السابقة كما في")}</label>${ynSel("pyAt", [["yearend","End of the prior financial year","نهاية السنة المالية السابقة"],["same","Same month last year","نفس الشهر من السنة السابقة"]])}</div>` : ""}
    ${has("bud_net") ? `<div class="field"><label for="o_budAt">${L("Budget column covers","عمود الموازنة يغطي")}</label>${ynSel("budAt", [["annual","The full year","السنة كاملة"],["ytd","Year to date (same month)","منذ بداية السنة حتى نفس الشهر"]])}</div>` : ""}
  </div>
  <p class="small muted" style="margin:10px 0 0">${L("Income-statement accounts in a trial balance are year-to-date. A single month is calculated as this month's balance minus the previous month's.","حسابات قائمة الدخل في ميزان المراجعة تراكمية منذ بداية السنة. الشهر المنفرد = رصيد هذا الشهر − رصيد الشهر السابق.")}</p>`;
  const forcedNote = st.forced ? ui.banner("info", L("This file will be loaded as the trial balance at the end of {d}. You can change the date below.","سيُحمّل هذا الملف كميزان مراجعة في نهاية {d}. يمكنك تغيير التاريخ أدناه.",{d:U.month(st.forced.m, true) + " " + st.forced.y})) : "";
  return stepper(2) + forcedNote + `<div class="grid g2">${ui.card(L("Company","الشركة"), target)}${ui.card(L("Period and figures","الفترة والأرقام"), settings)}</div>` +
    ui.card(L("Columns","الأعمدة"), `<div class="row" style="margin-bottom:10px;gap:14px">
        <div class="field"><label for="wsheet">${L("Sheet","الورقة")}</label><select class="in" id="wsheet" onchange="BM.wz.pickSheet(this.value)">${st.book.sheets.map((s, i) => `<option value="${i}" ${i === st.sheet ? "selected" : ""}>${U.esc(s.name)} (${s.aoa.length})</option>`).join("")}</select></div>
        <div class="field"><label for="whr">${L("Header row","صف العناوين")}</label><input class="in" id="whr" type="number" min="1" style="width:90px" value="${st.hr + 1}" onchange="BM.wz.setHeader(this.value)"></div>
        <div class="small muted" style="flex:1;min-width:220px">${L("Each column's role was detected from its title. Change any that are wrong. The highlighted row is the header.","تم اكتشاف دور كل عمود من عنوانه. غيّر أي دور غير صحيح. الصف المظلل هو صف العناوين.")}</div></div>
      <div class="tw">${prev}</div>`, {sub:U.esc(st.book.file)}) +
    ui.card(L("Structure checks","فحص البنية"), issueList(p.issues) + `<div class="small muted" style="margin-top:6px">${L("{n} account rows read.","تمت قراءة {n} صف حساب.",{n:p.rows.filter(r => !r.total).length})}</div>`) +
    `<div class="row" style="justify-content:space-between"><button class="btn" onclick="BM.wz.reset()">${L("Start over","البدء من جديد")}</button><button class="btn pri" onclick="BM.wz.next()">${L("Next: map accounts","التالي: تصنيف الحسابات")} →</button></div>`;
}

function step3(){
  const st = W.st, A = st.accts, idx = st.parsed.idx;
  const val = a => { const x = IMP.values(a, idx, st.opts.sign, a.fsKey); return x.close != null ? x.close : x.bud != null ? x.bud : x.py != null ? x.py : x.open != null ? x.open : x.months ? x.months.reduce((s, v) => s + (v || 0), 0) : 0; };
  const f = st.filter, q = U.norm(st.q);
  const list = A.filter(a => (f === "all" || (f === "review" && !a.exclude && (a.conf === "code" || !a.fsKey)) || (f === "unmapped" && !a.fsKey) || (f === "summary" && a.summary) || (f === "mapped" && a.fsKey && a.conf !== "code"))
    && (!q || U.norm(a.code + " " + a.name).indexOf(q) >= 0));
  const per = 150, pages = Math.max(1, Math.ceil(list.length / per)); st.page = Math.min(st.page, pages - 1);
  const opts = sel => `<option value="">${L("— Unmapped —","— غير مصنف —")}</option>` + BM.FS_GROUPS.map(g => `<optgroup label="${L(g[0], g[1])}">${g[2].map(k => `<option value="${k}" ${sel === k ? "selected" : ""}>${U.fsLabel(k)}</option>`).join("")}</optgroup>`).join("");
  const n = {all:A.length, review:A.filter(a => !a.exclude && (a.conf === "code" || !a.fsKey)).length, unmapped:A.filter(a => !a.fsKey).length, summary:A.filter(a => a.summary).length, mapped:A.filter(a => a.fsKey && a.conf !== "code").length};
  const rows = list.slice(st.page * per, (st.page + 1) * per).map(a => {
    const ai = A.indexOf(a);
    const cl = BM.CONF_LABEL[a.conf] || BM.CONF_LABEL.none;
    return `<tr${a.exclude ? ` style="opacity:.55"` : ""}><td><input type="checkbox" aria-label="${L("Include","تضمين")}" ${a.exclude ? "" : "checked"} onchange="BM.wz.excl(${ai},this.checked,this)"></td>
      <td class="mono">${U.esc(a.code)}</td><td class="wrap">${U.esc(a.name)}${a.summary ? ` ${ui.badge("info", L("Summary row","حساب تجميعي"))}` : ""}</td>
      <td class="n">${U.num(val(a))}</td>
      <td><select class="in sm" aria-label="${L("Statement line","بند القائمة")}" onchange="BM.wz.map(${ai},this.value,this)">${opts(a.fsKey)}</select></td>
      <td class="cf">${ui.badge(cl[2], L(cl[0], cl[1]))}</td></tr>`;
  }).join("");
  const tab = (k, en, ar) => `<button class="${f === k ? "on" : ""}" onclick="BM.wz.filter('${k}')">${L(en, ar)} (${n[k]})</button>`;
  return stepper(3) + ui.card(L("Map each account to a statement line","صنّف كل حساب إلى بند في القوائم المالية"), `
    <div class="row" style="margin-bottom:10px;justify-content:space-between">
      <div class="seg">${tab("review","Needs review","يحتاج مراجعة")}${tab("unmapped","Unmapped","غير مصنف")}${tab("summary","Summary rows","حسابات تجميعية")}${tab("mapped","Mapped","مصنف")}${tab("all","All","الكل")}</div>
      <input class="in" id="wq" type="search" placeholder="${L("Search code or name","ابحث بالرقم أو الاسم")}" value="${U.esc(st.q)}" oninput="BM.wz.search(this.value)" style="min-width:200px"></div>
    <p class="small muted" style="margin:0 0 10px">${L("Suggestions come from your earlier confirmations, then account-name keywords (English and Arabic), then the first digit of the code. Code-only guesses need your review. Changes you make here are remembered for future uploads.","الاقتراحات تأتي من تأكيداتك السابقة، ثم الكلمات في اسم الحساب (عربي وإنجليزي)، ثم الرقم الأول من رقم الحساب. التخمين من الرقم فقط يحتاج مراجعتك. التعديلات هنا تُحفظ للاستيرادات القادمة.")}</p>
    <div class="tw tall"><table><thead><tr><th>${L("Use","استخدام")}</th><th>${L("Code","الرقم")}</th><th>${L("Account","الحساب")}</th><th class="n">${L("Balance (Dr +)","الرصيد (مدين +)")}</th><th>${L("Statement line","بند القائمة")}</th><th>${L("Source","المصدر")}</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="6" class="muted">${L("Nothing in this list.","لا يوجد شيء في هذه القائمة.")}</td></tr>`}</tbody></table></div>
    ${pages > 1 ? `<div class="row" style="margin-top:8px"><button class="btn sm" ${st.page ? "" : "disabled"} onclick="BM.wz.st.page--;BM.render()">‹</button><span class="small">${st.page + 1} / ${pages}</span><button class="btn sm" ${st.page < pages - 1 ? "" : "disabled"} onclick="BM.wz.st.page++;BM.render()">›</button></div>` : ""}`) +
    `<div class="row" style="justify-content:space-between"><button class="btn" onclick="BM.wz.back()">← ${L("Back","رجوع")}</button><button class="btn pri" onclick="BM.wz.next()">${L("Next: validate","التالي: التحقق")} →</button></div>`;
}

function step4(){
  const st = W.st, v = st.validation, sm = st.accts.filter(a => a.summary).length;
  const groups = {balance:["Balance","التوازن"], mapping:["Mapping","التصنيف"], structure:["Structure","البنية"], numbers:["Numbers","الأرقام"], duplicates:["Duplicates","التكرار"], nature:["Account nature","طبيعة الحسابات"]};
  const byG = {}; v.issues.forEach(i => (byG[i[1]] = byG[i[1]] || []).push(i));
  const plan = [];
  const o = st.opts, has = r => st.roles.indexOf(r) >= 0;
  const C = fco(st), F = BM.E.toFis(C, +o.year, +o.month);
  const P = (sc, fy, p, what) => `<li>${sc === "budget" ? L("Budget","موازنة") : L("Actual","فعلي")} — ${BM.E.pDate(fy, p, true, C)}: ${what}</li>`;
  if (st.parsed.hasClose) plan.push(P(o.scenario, F.fy, F.p, L("closing balances","الأرصدة الختامية")));
  if (has("open_dr") || has("open_cr") || has("open_net")) plan.push(P("actual", F.fy, o.openAt === "month" ? F.p - 1 : 0, L("opening balance sheet","الميزانية الافتتاحية")));
  if (has("py_dr") || has("py_cr") || has("py_net")) plan.push(P("actual", F.fy - 1, o.pyAt === "same" ? F.p : 12, L("prior-year trial balance","ميزان السنة السابقة")));
  if (has("bud_net")) plan.push(P("budget", F.fy, o.budAt === "ytd" ? F.p : 12, o.budAt === "ytd" ? L("year-to-date budget","موازنة منذ بداية السنة") : L("full-year budget (phased evenly by month when needed)","موازنة سنوية (توزع بالتساوي على الأشهر عند الحاجة)")));
  const ms = st.roles.filter(r => /^m\d+$/.test(r)).length; if (ms) plan.push(`<li>${o.scenario === "budget" ? L("Budget","موازنة") : L("Actual","فعلي")} — ${L("{n} month(s) from the monthly columns","{n} شهر/أشهر من الأعمدة الشهرية",{n:ms})}</li>`);
  return stepper(4) + `<div class="grid g2">
    ${ui.card(L("Result of the checks","نتيجة الفحص"), `<div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        <div class="kpi ${v.errors ? "s-bad" : "s-good"}"><div class="t">${L("Errors","أخطاء")}</div><div class="v">${v.errors}</div></div>
        <div class="kpi ${v.issues.filter(i => i[0] === "warning").length ? "s-warn" : ""}"><div class="t">${L("Warnings","تحذيرات")}</div><div class="v">${v.issues.filter(i => i[0] === "warning").length}</div></div>
        <div class="kpi"><div class="t">${L("Accounts","الحسابات")}</div><div class="v">${st.accts.filter(a => !a.exclude).length}</div></div></div>
      ${st.parsed.hasClose && o.scenario === "actual" ? `<dl class="dl" style="margin-top:12px"><dt>${L("Total debits","إجمالي المدين")}</dt><dd>${U.num(v.sums.closeDr, 2)}</dd><dt>${L("Total credits","إجمالي الدائن")}</dt><dd>${U.num(v.sums.closeCr, 2)}</dd><dt>${L("Difference","الفرق")}</dt><dd class="${Math.abs(v.sums.close) > 1 ? "neg" : "pos"}">${U.num(v.sums.close, 2)}</dd></dl>` : ""}
      ${sm ? `<label class="row small" style="margin-top:10px"><input type="checkbox" ${st.accts.filter(a => a.summary).every(a => a.exclude) ? "checked" : ""} onchange="BM.wz.excludeSummaries(this.checked)"> ${L("Exclude the {n} summary (parent) accounts","استبعاد {n} حساب/حسابات تجميعية",{n:sm})}</label>` : ""}`)}
    ${ui.card(L("What will be loaded","ما سيتم تحميله"), `<ul style="margin:0;padding-inline-start:18px;display:flex;flex-direction:column;gap:4px" class="small">${plan.join("")}</ul>
      <p class="small muted" style="margin:10px 0 0">${L("A trial balance already loaded for the same scenario and month is replaced.","ميزان المراجعة المحمّل سابقاً لنفس السيناريو والشهر سيُستبدل.")}</p>`)}</div>` +
    ui.card(L("Issues","الملاحظات"), Object.keys(groups).filter(g => byG[g]).map(g => `<div style="margin-bottom:8px"><div class="small" style="font-weight:600;color:var(--ink-2)">${L(groups[g][0], groups[g][1])}</div>${issueList(byG[g])}</div>`).join("") || issueList([])) +
    `<div class="row" style="justify-content:space-between"><button class="btn" onclick="BM.wz.back()">← ${L("Back to mapping","رجوع إلى التصنيف")}</button>
      <button class="btn ${v.errors ? "danger" : "ok"}" onclick="BM.wz.commit()">${W.stReturn ? L("Save to the list","حفظ في القائمة") : v.errors ? L("Review and import","مراجعة واستيراد") : L("Import","استيراد")} ✓</button></div>`;
}

function step5(){
  const st = W.st, r = st.result;
  return ui.banner("good", `✔ <b>${L("Import complete.","اكتمل الاستيراد.")}</b> ${L("{n} trial balance(s) loaded into {c}.","تم تحميل {n} ميزان/موازين مراجعة إلى {c}.",{n:r.written.length, c:U.esc(U.nm(r.co.name))})}`) +
    (r.notes.length ? ui.banner("warn", r.notes.map(U.esc).join("<br>")) : "") +
    ui.card(L("Loaded","ما تم تحميله"), `<ul style="margin:0;padding-inline-start:18px" class="small">${r.written.map(w => `<li>${w.sc === "budget" ? L("Budget","موازنة") : L("Actual","فعلي")} — ${U.month(w.m, 1)} ${w.y}${w.replaced ? ` <span class="muted">(${L("replaced","استُبدل")})</span>` : ""}</li>`).join("")}</ul>
      <div class="row" style="margin-top:12px"><a class="btn pri" href="#dashboard">${L("Open the dashboard","فتح لوحة المؤشرات")}</a><a class="btn" href="#quality">${L("Check data quality","فحص جودة البيانات")}</a><a class="btn" href="#mapping">${L("Review mapping","مراجعة التصنيف")}</a>
      <button class="btn" onclick="BM.wz.reset()">${L("Import another file","استيراد ملف آخر")}</button></div>`);
}

BM.PAGES.import = {render(){
  if (!BM.can("import")) return {html: ui.banner("warn", L("Your role ({r}) cannot import data. Change the role in Settings.","دورك ({r}) لا يسمح باستيراد البيانات. غيّر الدور من الإعدادات.",{r:U.nm(BM.ROLES[S.settings.role])}))};
  const st = W.st;
  if (W.ag) return {html: W.agStep2(), after(){}};
  const html = !st ? step1() : st.step === 2 ? step2() : st.step === 3 ? step3() : st.step === 4 ? step4() : step5();
  return {html, after(){
    if (W.dropWire) W.dropWire();
    const d = U.$("#drop"); if (!d) return;
    ["dragenter","dragover"].forEach(e => d.addEventListener(e, ev => { ev.preventDefault(); d.classList.add("hot"); }));
    ["dragleave","drop"].forEach(e => d.addEventListener(e, ev => { ev.preventDefault(); d.classList.remove("hot"); }));
    d.addEventListener("drop", ev => { const fs = ev.dataTransfer.files; if (!fs || !fs.length) return; if (W.mode === "tb") W.onFiles(fs); else W.onFile(fs[0]); });
  }};
}};
})();

/* ============================ aging import ============================ */
(function(){
const U = BM.U, S = BM.state, AG = BM.AG, ui = BM.ui, W = BM.wz;
function defaultAsOf(co){ const l = co && BM.E.latest(co); return l ? U.iso(BM.E.endDate(co, l.year, l.month)) : U.iso(new Date()); }
W.agStart = function(book){
  const co = S.dataset === "uploaded" ? BM.co() : S.companies[0];
  if (!co) return BM.toast(L("Import a trial balance first, then add aging to that company.","استورد ميزان مراجعة أولاً، ثم أضف الأعمار لتلك الشركة."));
  const best = book.sheets.reduce((b, sh, i) => sh.aoa.length > book.sheets[b].aoa.length ? i : b, 0);
  W.ag = {book, sheet:best, kind:W.mode, coId:co.id, asOf:defaultAsOf(co), terms:30};
  W.agSheet(best);
};
W.agSheet = i => { const a = W.ag; a.sheet = +i; const aoa = a.book.sheets[a.sheet].aoa; a.hr = BM.IMP.detectHeader(aoa); a.roles = AG.detectRoles(aoa, a.hr); agParse(); BM.render(); };
W.agHeader = v => { const a = W.ag, aoa = a.book.sheets[a.sheet].aoa; a.hr = Math.max(0, Math.min(aoa.length - 1, (+v || 1) - 1)); a.roles = AG.detectRoles(aoa, a.hr); agParse(); BM.render(); };
W.agRole = (c, r) => { const a = W.ag; if (r !== "ignore") a.roles = a.roles.map((x, i) => (x === r && i !== c) ? "ignore" : x); a.roles[c] = r; agParse(); BM.render(); };
W.agSet = (k, v) => { const a = W.ag; a[k] = v; if (k === "coId"){ const co = S.companies.find(c => c.id === v); a.asOf = defaultAsOf(co); } agParse(); BM.render(); };
W.agCancel = () => { W.ag = null; BM.render(); };
function agParse(){ const a = W.ag, d = U.parseDate(a.asOf); a.res = AG.parse(a.book.sheets[a.sheet].aoa, a.hr, a.roles, {asOf: d || new Date(), terms:a.terms}); a.badAsOf = !d; }
W.agCommit = () => {
  const a = W.ag, co = S.companies.find(c => c.id === a.coId); if (!co || a.res.errors || a.badAsOf) return;
  if (a.staged){ W.agingBack(a); W.ag = null; BM.render(); return; }
  co.aging = co.aging || {};
  co.aging[a.kind] = {asOf:a.asOf, rows:a.res.rows, mode:a.res.mode, source:a.book.file + " › " + a.book.sheets[a.sheet].name, at:new Date().toISOString()};
  co.imports.unshift({at:new Date().toISOString(), file:a.book.file, sheet:a.book.sheets[a.sheet].name, scenario:a.kind + "-aging", year:+a.asOf.slice(0,4), month:+a.asOf.slice(5,7), accounts:a.res.rows.length, issues:a.res.issues.filter(i => i[0] !== "info"), written:[]});
  BM.saveData(); S.dataset = "uploaded"; S.companyId = co.id; const kind = a.kind; W.ag = null; W.mode = "tb";
  BM.toast(L("Aging imported.","تم استيراد الأعمار.")); BM.go(kind);
};
W.agStep1 = function(){
  const ar = W.mode === "ar";
  return ui.card(ar ? L("Upload a receivables aging report","رفع تقرير أعمار الذمم المدينة") : L("Upload a payables aging report","رفع تقرير أعمار الذمم الدائنة"), `
    <label class="drop" id="drop" for="file"><span class="big">${L("Drop an Excel file here, or choose a file","اسحب ملف Excel هنا أو اختر ملفاً")}</span>
      <span class="btn pri">${L("Choose file","اختر ملفاً")}</span><input type="file" id="file" accept=".xlsx,.xlsm,.xls,.csv" hidden onchange="BM.wz.onFile(this.files[0])"></label>
    <div class="small" style="margin-top:12px"><b>${L("Accepted layouts","الأشكال المقبولة")}</b><ul style="margin:6px 0 0;padding-inline-start:18px;display:flex;flex-direction:column;gap:3px">
      <li>${L("Invoice list: {p} · amount outstanding · due date (or invoice date + credit terms)","قائمة فواتير: {p} · المبلغ المستحق · تاريخ الاستحقاق (أو تاريخ الفاتورة + مدة الائتمان)",{p: ar ? L("customer","العميل") : L("supplier","المورد")})}</li>
      <li>${L("Bucket report: {p} · Current · 1–30 · 31–60 · 61–90 · 91–120 · 120+","تقرير فئات: {p} · غير مستحق · 1–30 · 31–60 · 61–90 · 91–120 · أكثر من 120",{p: ar ? L("customer","العميل") : L("supplier","المورد")})}</li>
      <li>${L("The aging is attached to a company that already has a trial balance and is reconciled against it.","تُربط الأعمار بشركة لديها ميزان مراجعة وتُطابق معه.")}</li></ul></div>`);
};
W.agStep2 = function(){
  const a = W.ag, aoa = a.book.sheets[a.sheet].aoa, ncol = a.roles.length, from = Math.max(0, a.hr - 1), to = Math.min(aoa.length, a.hr + 11), r = a.res;
  const roleSel = c => `<select class="in sm" aria-label="${L("Column role","دور العمود")}" onchange="BM.wz.agRole(${c},this.value)">${AG.ROLES.map(x => `<option value="${x[0]}" ${a.roles[c] === x[0] ? "selected" : ""}>${L(x[1], x[2])}</option>`).join("")}</select>`;
  let prev = `<table class="preview"><thead><tr><th>#</th>${Array.from({length:ncol}, (_, c) => `<th>${roleSel(c)}</th>`).join("")}</tr></thead><tbody>`;
  for (let i = from; i < to; i++){ const row = aoa[i] || []; prev += `<tr class="${i === a.hr ? "hdr" : ""}"><td class="muted mono">${i + 1}</td>${Array.from({length:ncol}, (_, c) => { const x = row[c]; const t = x instanceof Date ? U.iso(x) : (x == null ? "" : String(x)); return `<td title="${U.esc(t)}">${U.esc(t)}</td>`; }).join("")}</tr>`; }
  prev += `</tbody></table>`;
  const s = r.rows.length ? AG.summary({rows:r.rows}) : null;
  const co = S.companies.find(c => c.id === a.coId), rec = s && co ? AG.reconcile(co, a.kind, {rows:r.rows, asOf:a.asOf}) : null;
  const sum = s ? `<table><tbody>${s.b.map((v, i) => `<tr><td>${AG.bucketLabel(i)}</td><td class="n">${U.num(v)}</td><td class="n">${U.pct(s.total ? v / s.total : null)}</td></tr>`).join("")}<tr class="t"><td>${L("Total","الإجمالي")}</td><td class="n">${U.num(s.total)}</td><td class="n"></td></tr></tbody></table>
     <p class="small" style="margin:8px 0 0">${L("{n} parties{d}.","{n} طرف{d}.",{n:s.parties, d: r.mode === "invoices" ? L(" from {x} invoices"," من {x} فاتورة",{x:r.docs}) : ""})}</p>
     ${rec && rec.tb != null ? (rec.ok ? ui.banner("good", L("Agrees with the trial balance at this date ({t}).","يطابق ميزان المراجعة في هذا التاريخ ({t}).",{t:U.numPlain(rec.tb)})) : ui.banner("warn", L("Differs from the trial balance at this date ({t}) by {x}.","يختلف عن ميزان المراجعة في هذا التاريخ ({t}) بمقدار {x}.",{t:U.numPlain(rec.tb), x:U.numPlain(rec.diff)}))) : ui.banner("info", L("No trial balance at this date to reconcile against.","لا يوجد ميزان مراجعة في هذا التاريخ للمطابقة."))}` : ui.empty(L("Nothing to summarise yet — check the column roles.","لا يوجد ما يُلخّص بعد — تحقق من أدوار الأعمدة."));
  const issues = r.issues.length ? r.issues.map(i => `<div class="issue ${i[0]}"><span class="ic">${i[0] === "error" ? "✖" : i[0] === "warning" ? "!" : "i"}</span><div>${U.esc(i[2])}</div></div>`).join("") : `<div class="muted small">${L("No issues.","لا توجد ملاحظات.")}</div>`;
  return (a.staged ? "" : W.modeSeg()) + `<div class="grid g2">` + ui.card(L("Settings","الإعدادات"), `<div class="form">
      <div class="field"><label for="agco">${L("Company","الشركة")}</label><select class="in" id="agco" onchange="BM.wz.agSet('coId',this.value)">${S.companies.map(c => `<option value="${c.id}" ${c.id === a.coId ? "selected" : ""}>${U.esc(U.nm(c.name))}</option>`).join("")}</select></div>
      <div class="field"><label for="agk">${L("Type","النوع")}</label><select class="in" id="agk" onchange="BM.wz.agSet('kind',this.value)"><option value="ar" ${a.kind === "ar" ? "selected" : ""}>${L("Receivables (customers)","الذمم المدينة (العملاء)")}</option><option value="ap" ${a.kind === "ap" ? "selected" : ""}>${L("Payables (suppliers)","الذمم الدائنة (الموردون)")}</option></select></div>
      <div class="field"><label for="agd">${L("Aging as at","الأعمار كما في")}</label><input class="in" id="agd" type="date" value="${a.asOf}" onchange="BM.wz.agSet('asOf',this.value)">${a.badAsOf ? `<span class="hint neg">${L("Enter a valid date.","أدخل تاريخاً صحيحاً.")}</span>` : ""}</div>
      ${r.mode === "invoices" ? `<div class="field"><label for="agt">${L("Credit terms when no due date (days)","مدة الائتمان عند غياب تاريخ الاستحقاق (يوم)")}</label><input class="in" id="agt" type="number" min="0" value="${a.terms}" onchange="BM.wz.agSet('terms',+this.value||0)"></div>` : ""}
    </div>`) + ui.card(L("Result","النتيجة"), sum) + `</div>` +
    ui.card(L("Columns","الأعمدة"), `<div class="row" style="margin-bottom:10px;gap:14px">
      <div class="field"><label for="agsh">${L("Sheet","الورقة")}</label><select class="in" id="agsh" onchange="BM.wz.agSheet(this.value)">${a.book.sheets.map((sh, i) => `<option value="${i}" ${i === a.sheet ? "selected" : ""}>${U.esc(sh.name)}</option>`).join("")}</select></div>
      <div class="field"><label for="aghr">${L("Header row","صف العناوين")}</label><input class="in" id="aghr" type="number" min="1" style="width:90px" value="${a.hr + 1}" onchange="BM.wz.agHeader(this.value)"></div></div>
      <div class="tw">${prev}</div>`, {sub:U.esc(a.book.file)}) +
    ui.card(L("Checks","الفحوصات"), issues) +
    `<div class="row" style="justify-content:space-between"><button class="btn" onclick="BM.wz.agCancel()">${L("Cancel","إلغاء")}</button>
      <button class="btn ok" ${r.errors || a.badAsOf || !r.rows.length ? "disabled" : ""} onclick="BM.wz.agCommit()">${a.staged ? L("Save to the list","حفظ في القائمة") : L("Import aging","استيراد الأعمار")} ✓</button></div>`;
};
})();
