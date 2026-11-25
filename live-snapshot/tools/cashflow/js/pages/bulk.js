/* =============================================================================
   pages/bulk.js — staged uploads on the Inputs page, posted in one step
   Every file is read, its date found (title rows, file name, sheet name),
   its columns detected and its accounts mapped exactly as in the single-file
   wizard. The files are listed in date order for a quick check — date and
   type can be corrected per file — then imported together, oldest first.
   A file that needs closer attention can be opened in the full wizard.
   ============================================================================= */
(function(){
const U = BM.U, S = BM.state, ui = BM.ui, IMP = BM.IMP, E = BM.E, W = BM.wz;
const ym = (y, m) => y * 12 + m - 1;

function bestSheet(book){ return book.sheets.reduce((b, s, i) => s.aoa.length > book.sheets[b].aoa.length ? i : b, 0); }

/* read one workbook and prepare it like steps 2–4 of the wizard */
function prepare(book, co){
  const si = bestSheet(book), sh = book.sheets[si], aoa = sh.aoa, hr0 = IMP.detectHeader(aoa);
  const titles = aoa.slice(0, hr0).map(r => r.filter(x => typeof x === "string").join(" ")).join(" ");
  const g1 = W.guessYM(titles), g2 = W.guessYM(book.file + " " + sh.name);
  let y = g1.y || g2.y, m = g1.m || g2.m, dateNote = "";
  if (y && !m){ const fe = E.toCal(co, E.toFis(co, y, E.fs(co)).fy, 12); m = fe.m; if (fe.y !== y) y = fe.y; dateNote = "assumed"; }
  const it = {book, file:book.file, sheet:si, hr:hr0, y:y || null, m:m || null, dateNote: y ? dateNote : "missing",
    scenario: /budget|موازن/i.test(book.file + " " + sh.name) ? "budget" : "actual", include:true};
  analyse(it, co);
  return it;
}
function analyse(it, co){
  const aoa = it.book.sheets[it.sheet].aoa;
  it.roles = IMP.detectRoles(aoa, it.hr, it.y || 0);
  it.parsed = IMP.parse(aoa, it.hr, it.roles);
  it.structErr = it.parsed.issues.some(i => i[0] === "error" && i[1] === "structure");
  it.accts = it.structErr ? [] : IMP.consolidate(it.parsed).map(a => {
    const known = co.accounts[a.code];
    const c = known && known.fsKey ? {fsKey:known.fsKey, conf: known.conf === "manual" ? "manual" : "memory"} : BM.classify(a.code, a.name);
    return Object.assign(a, {fsKey:c.fsKey, conf:c.conf, exclude: !!a.summary});
  });
  it.monthly = it.roles.some(r => /^m\d+$/.test(r));
  revalidate(it);
}
function opts(it){ return {scenario:it.scenario, year:it.y, month:it.m, sign:"dr", openAt:"year", pyAt:"yearend", budAt:"annual"}; }
function revalidate(it){
  it.validation = it.structErr ? {issues:[], errors:1, sums:{}} : IMP.validate({accts:it.accts, parsed:it.parsed, opts:opts(it)});
  const use = it.accts.filter(a => !a.exclude);
  it.unmapped = use.filter(a => !a.fsKey).length;
  it.guess = use.filter(a => a.conf === "code").length;
}

/* ---------------------------------------------------------------------------
   STAGING — nothing is written to the company until "Post data" is pressed.
   W.stage = { coId, tbs:[items], ar:agingItem|null, ap:agingItem|null, bad:[] }
   Order on the page and when posting: 1 trial balances · 2 AR aging · 3 AP aging.
   --------------------------------------------------------------------------- */
W._opts = opts;
const curCo = () => (S.dataset === "uploaded" ? BM.co() : null);
function stage(){
  const co = curCo(); if (!co) return null;
  if (!W.stage || W.stage.coId !== co.id) W.stage = {coId:co.id, tbs:[], ar:null, ap:null, bad:[]};
  return W.stage;
}
W.stageOf = stage;
function sortTBs(st){ st.tbs.sort((a, c) => (a.scenario === c.scenario ? 0 : a.scenario === "actual" ? -1 : 1) || ((a.y ? ym(a.y, a.m) : 1e9) - (c.y ? ym(c.y, c.m) : 1e9)) || a.file.localeCompare(c.file)); }
async function readBooks(files, st){
  const out = [];
  for (const f of files){
    if (f.size > 25 * 1024 * 1024){ st.bad.push(f.name); continue; }
    try { const book = await IMP.readWorkbook(f); if (!book.sheets.length){ st.bad.push(f.name); continue; } out.push(book); }
    catch(e){ console.error(e); st.bad.push(f.name); }
  }
  return out;
}

/* 1 · trial balances (any number, any order) */
W.onFiles = async (list, forced) => {
  const files = Array.from(list || []); if (!files.length) return;
  if (!BM.xlsxReady()) return;
  const co = curCo(); if (!co) return BM.toast(L("Save the company inputs first.","احفظ مدخلات الشركة أولاً."));
  const st = stage(); W.postDone = null; st.bad = [];
  if (files.length > 1) BM.toast(L("Reading {n} files…","جارٍ قراءة {n} ملفات…",{n:files.length}));
  for (const book of await readBooks(files, st)){
    const it = prepare(book, co);
    if (forced && files.length === 1){ it.y = forced.y; it.m = forced.m; it.dateNote = ""; it.scenario = "actual"; analyse(it, co); }
    st.tbs.push(it);
  }
  sortTBs(st); BM.render();
};
W.onFile = f => W.onFiles([f]);
W.uploadAt = (y, m) => { W.forcedAt = {y:+y, m:+m}; const el = document.getElementById("fileAt"); if (el){ el.value = ""; el.click(); } };
W.onFileAt = f => { const at = W.forcedAt; W.forcedAt = null; W.onFiles([f], at); };

/* 2–3 · aging reports: one per type (the latest is the one analysed) */
W.onAging = async (kind, list) => {
  const files = Array.from(list || []); if (!files.length || !BM.xlsxReady()) return;
  const co = curCo(); if (!co) return BM.toast(L("Save the company inputs first.","احفظ مدخلات الشركة أولاً."));
  const st = stage(); W.postDone = null;
  const books = await readBooks([files[files.length - 1]], st); if (!books.length) return BM.render();
  const book = books[0], si = bestSheet(book), aoa = book.sheets[si].aoa, hr = IMP.detectHeader(aoa);
  const it = {kind, book, sheet:si, hr, roles:BM.AG.detectRoles(aoa, hr), asOf:defaultAsOf(co, st), terms:30};
  agParse(it); st[kind] = it; BM.render();
};
function defaultAsOf(co, st){
  const acts = st.tbs.filter(t => t.include && t.scenario === "actual" && t.y);
  if (acts.length){ const t = acts[acts.length - 1]; return U.iso(U.monthEnd(t.y, t.m)); }
  const l = E.latest(co); return l ? U.iso(E.endDate(co, l.year, l.month)) : U.iso(new Date());
}
function agParse(it){ const d = U.parseDate(it.asOf); it.res = BM.AG.parse(it.book.sheets[it.sheet].aoa, it.hr, it.roles, {asOf:d || new Date(), terms:it.terms}); it.badAsOf = !d; }
W.agingSet = (kind, k, v) => { const it = stage()[kind]; if (!it) return; it[k] = k === "terms" ? (+v || 0) : v; agParse(it); BM.render(); };
W.agingRemove = kind => { stage()[kind] = null; BM.render(); };
/* review an aging file's columns in the existing screen; "Save" returns it here */
W.agingReview = kind => { const it = stage()[kind]; if (!it) return; W.ag = {book:it.book, sheet:it.sheet, kind, coId:stage().coId, asOf:it.asOf, terms:it.terms, staged:true}; W.agSheet(it.sheet); };
W.agingBack = a => { const st = stage(); st[a.kind] = {kind:a.kind, book:a.book, sheet:a.sheet, hr:a.hr, roles:a.roles, asOf:a.asOf, terms:a.terms, res:a.res, badAsOf:a.badAsOf, reviewed:true}; };

/* trial-balance rows */
W.bulkSet = (i, k, v) => {
  const st = stage(), it = st && st.tbs[i]; if (!it) return; const co = curCo();
  if (k === "y" || k === "m"){ it[k] = +v; if (it.y && !it.m) it.m = E.toCal(co, E.toFis(co, it.y, E.fs(co)).fy, 12).m; it.dateNote = ""; analyse(it, co); }
  else if (k === "scenario"){ it.scenario = v; revalidate(it); }
  else if (k === "include") it.include = !!v;
  sortTBs(st); BM.render();
};
W.bulkRemove = i => { stage().tbs.splice(i, 1); BM.render(); };
W.stageClear = () => { const st = stage(); if (st){ st.tbs = []; st.ar = null; st.ap = null; st.bad = []; } BM.render(); };
/* review one trial balance in the full wizard; its last step returns it to the list */
W.bulkOpen = i => {
  const st = stage(), it = st.tbs[i]; if (!it) return;
  st.tbs.splice(i, 1); W.stOrig = it; W.stReturn = true;
  W.forced = it.y ? {y:it.y, m:it.m} : null; W.mode = "tb";
  W.startBook(it.book); if (W.st && it.scenario === "budget") W.st.opts.scenario = "budget";
  BM.render(); window.scrollTo(0, 0);
};
/* called by the wizard instead of importing when it was opened from the list */
W.stageFromWizard = (wst) => {
  const st = stage(), o = wst.opts;
  st.tbs.push({book:wst.book, file:wst.book.file, sheet:wst.sheet, hr:wst.hr, roles:wst.roles, parsed:wst.parsed, accts:wst.accts, validation:wst.validation,
    y:+o.year, m:+o.month, scenario:o.scenario, include:true, reviewed:true, opts:Object.assign({}, o), structErr:false, dateNote:"",
    monthly:wst.roles.some(r => /^m\d+$/.test(r)), unmapped:wst.accts.filter(a => !a.exclude && !a.fsKey).length, guess:wst.accts.filter(a => !a.exclude && a.conf === "code").length});
  sortTBs(st); W.stReturn = false; W.stOrig = null; W.st = null;
};
W.stageCancelWizard = () => { if (W.stOrig){ stage().tbs.push(W.stOrig); sortTBs(stage()); } W.stOrig = null; W.stReturn = false; };

/* duplicates: two included files with the same type and date */
function dupKeys(st){
  const seen = {}, dup = {};
  st.tbs.forEach(it => { if (!it.include || !it.y) return; const k = it.scenario + "|" + it.y + "|" + it.m; if (seen[k]) dup[k] = 1; seen[k] = 1; });
  return dup;
}

/* ---------- POST: trial balances (oldest first) → AR aging → AP aging ---------- */
W.post = (force) => {
  const st = stage(), co = curCo(); if (!st || !co) return;
  const list = st.tbs.filter(it => it.include);
  if (!list.length && !st.ar && !st.ap) return BM.toast(L("Nothing to post yet — add files first.","لا يوجد ما يُرحّل بعد — أضف الملفات أولاً."));
  if (list.some(it => it.structErr || !it.y)) return BM.toast(L("Set the date (or review) every trial balance marked in red, or untick it.","حدّد التاريخ (أو راجع) كل ميزان معلّم بالأحمر، أو ألغِ تحديده."));
  const agBad = ["ar","ap"].filter(k => st[k] && (st[k].res.errors || st[k].badAsOf || !st[k].res.rows.length));
  if (agBad.length) return BM.toast(L("Review the aging file marked in red (columns or date), or remove it.","راجع ملف الأعمار المعلّم بالأحمر (الأعمدة أو التاريخ) أو أزله."));
  const errs = list.reduce((s, it) => s + (it.validation.errors || 0), 0);
  if (errs && !force) return BM.confirm(L("{n} error(s) were found in the trial balances (see the list). The statements will show them until the files or the mapping are corrected. Post anyway?","وُجد {n} خطأ/أخطاء في موازين المراجعة (انظر القائمة). ستظهر في القوائم حتى تُصحح الملفات أو التصنيف. هل تريد الترحيل على أي حال؟",{n:errs}), L("Post anyway","ترحيل على أي حال"), () => W.post(true));
  const done = {tbs:[], aging:[]};
  list.forEach(it => {
    const job = {file:it.file, sheet:it.book.sheets[it.sheet].name, accts:it.accts, parsed:it.parsed, opts:it.opts || opts(it), target:{id:co.id}, validation:it.validation};
    const r = IMP.commit(job); done.tbs.push({file:it.file, written:r.written, notes:job.notes || []});
  });
  ["ar","ap"].forEach(kind => {
    const a = st[kind]; if (!a) return;
    co.aging = co.aging || {};
    co.aging[kind] = {asOf:a.asOf, rows:a.res.rows, mode:a.res.mode, source:a.book.file + " › " + a.book.sheets[a.sheet].name, at:new Date().toISOString()};
    co.imports.unshift({at:new Date().toISOString(), file:a.book.file, sheet:a.book.sheets[a.sheet].name, scenario:kind + "-aging", year:+a.asOf.slice(0,4), month:+a.asOf.slice(5,7), accounts:a.res.rows.length, issues:a.res.issues.filter(i => i[0] !== "info"), written:[]});
    done.aging.push({kind, file:a.book.file, asOf:a.asOf, rec:BM.AG.reconcile(co, kind, {rows:a.res.rows, asOf:a.asOf})});
  });
  /* v3.10.5 — an actual trial balance after the end of the historical period extends that period,
     so it shows in the coverage table; the forecast period then starts the month after. */
  const inp = co.inputs, lastA = list.filter(it => it.scenario === "actual" && it.y).reduce((mx, it) => Math.max(mx, ym(it.y, it.m)), -1);
  if (inp && inp.hist && lastA > ym(inp.hist.ty, inp.hist.tm)){
    inp.hist.ty = Math.floor(lastA / 12); inp.hist.tm = lastA % 12 + 1;
    const n = lastA + 1;
    if (inp.fc && ym(inp.fc.fy, inp.fc.fm) <= lastA){ inp.fc.fy = Math.floor(n / 12); inp.fc.fm = n % 12 + 1; if (ym(inp.fc.ty, inp.fc.tm) < n){ inp.fc.ty = Math.floor((n + 11) / 12); inp.fc.tm = (n + 11) % 12 + 1; } }
    done.histExt = {y:inp.hist.ty, m:inp.hist.tm};
  }
  done.budgets = list.filter(it => it.scenario === "budget").length;
  BM.saveData();
  const acts = list.filter(it => it.scenario === "actual"), last = acts[acts.length - 1] || list[list.length - 1];
  S.dataset = "uploaded"; S.companyId = co.id; S.settings._dataset = "uploaded"; S.settings._companyId = co.id; BM.saveSettings();
  if (last){ const F = E.toFis(co, last.y, last.m); S.period = {type:(BM.inputs.viewFor && BM.inputs.viewFor(co, F.fy)) || "ytd", year:F.fy, month:F.p}; }
  BM.fixPeriod();
  W.stage = null; W.postDone = done; BM.render(); window.scrollTo(0, 0);
};

/* ---------- view ---------- */
const MON = (id, v, i) => `<select class="in sm" id="${id}" aria-label="${L("Month","الشهر")}" onchange="BM.wz.bulkSet(${i},'m',this.value)">${v ? "" : `<option value="">—</option>`}${BM.MONTHS.map((x, k) => `<option value="${k + 1}" ${v === k + 1 ? "selected" : ""}>${U.month(k + 1, true)}</option>`).join("")}</select>`;
const YR = (id, v, i) => { const now = new Date().getFullYear(), o = []; for (let y = now + 1; y >= 2000; y--) o.push(y);
  return `<select class="in sm" id="${id}" aria-label="${L("Year","السنة")}" onchange="BM.wz.bulkSet(${i},'y',this.value)">${v ? "" : `<option value="">—</option>`}${o.map(y => `<option ${v === y ? "selected" : ""}>${y}</option>`).join("")}</select>`; };
const drop = (id, input, big, sub, btn) => `<label class="drop" id="${id}" for="${id}In"><span class="big">${big}</span>${sub ? `<span class="small muted">${sub}</span>` : ""}<span class="btn pri">${btn}</span>${input}</label>`;

/* staged chips in the year plan: which period-ends are waiting to be posted */
W.stagedAt = (y, m) => { const st = W.stage; return !!(st && st.coId === (curCo() || {}).id && st.tbs.some(t => t.include && t.scenario === "actual" && t.y === y && t.m === m)); };

function tbTable(st){
  if (!st.tbs.length) return "";
  const dup = dupKeys(st);
  const rows = st.tbs.map((it, i) => {
    const v = it.validation, warn = v.issues ? v.issues.filter(x => x[0] === "warning").length : 0, isDup = it.include && dup[it.scenario + "|" + it.y + "|" + it.m];
    let status;
    if (it.structErr) status = ui.badge("bad", L("Columns not recognised — review","الأعمدة غير معروفة — راجع"));
    else if (!it.y) status = ui.badge("bad", L("Date not found — choose it","التاريخ غير معروف — اختره"));
    else if (v.errors) status = ui.badge("bad", L("{n} error(s)","{n} خطأ",{n:v.errors}));
    else if (isDup) status = ui.badge("warn", L("Same date as another file","نفس تاريخ ملف آخر"));
    else if (it.unmapped || it.guess || warn) status = ui.badge("warn", L("Check","للمراجعة"));
    else status = ui.badge("good", it.reviewed ? L("Reviewed","تمت مراجعته") : L("Ready","جاهز"));
    const detail = [it.dateNote === "assumed" ? L("Month not found — financial year-end assumed","الشهر غير موجود — افتُرضت نهاية السنة المالية") : "",
      it.monthly ? L("Monthly columns — 12 trial balances","أعمدة شهرية — 12 ميزاناً") : "",
      it.unmapped ? L("{n} unmapped","{n} غير مصنف",{n:it.unmapped}) : "", it.guess ? L("{n} code guesses","{n} تخمين من الرقم",{n:it.guess}) : "",
      v.issues ? v.issues.filter(x => x[0] === "error").map(x => x[2]).join(" ") : ""].filter(Boolean).map(U.esc).join(" · ");
    return `<tr${it.include ? "" : ` style="opacity:.5"`}><td><input type="checkbox" aria-label="${L("Include","تضمين")}" ${it.include ? "checked" : ""} onchange="BM.wz.bulkSet(${i},'include',this.checked)"></td>
      <td class="wrap small"><b>${U.esc(it.file)}</b><div class="muted">${U.esc(it.book.sheets[it.sheet].name)} · ${L("{n} accounts","{n} حساب",{n:it.accts.length})}</div></td>
      <td><div class="row" style="gap:4px;flex-wrap:nowrap">${MON("bm" + i, it.m, i)}${YR("by" + i, it.y, i)}</div></td>
      <td><select class="in sm" aria-label="${L("Type","النوع")}" onchange="BM.wz.bulkSet(${i},'scenario',this.value)"><option value="actual" ${it.scenario === "actual" ? "selected" : ""}>${L("Actual","فعلي")}</option><option value="budget" ${it.scenario === "budget" ? "selected" : ""}>${L("Budget","موازنة")}</option></select></td>
      <td>${status}${detail ? `<div class="small muted wrap" style="margin-top:3px">${detail}</div>` : ""}</td>
      <td><div class="row" style="gap:4px"><button class="btn sm" onclick="BM.wz.bulkOpen(${i})">${L("Review","مراجعة")}</button><button class="btn sm danger" aria-label="${L("Remove","إزالة")}" onclick="BM.wz.bulkRemove(${i})">✕</button></div></td></tr>`;
  }).join("");
  return `<div class="tw" style="margin-top:12px"><table class="stg"><thead><tr><th></th><th>${L("File","الملف")}</th><th>${L("Balances as at the end of","الأرصدة كما في نهاية")}</th><th>${L("Type","النوع")}</th><th>${L("Status","الحالة")}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function agingRow(kind, it, co){
  if (!it) return "";
  const r = it.res, s = r.rows.length ? BM.AG.summary({rows:r.rows}) : null;
  const status = r.errors || !r.rows.length ? ui.badge("bad", L("Columns not recognised — review","الأعمدة غير معروفة — راجع")) : it.badAsOf ? ui.badge("bad", L("Enter a valid date","أدخل تاريخاً صحيحاً")) : ui.badge("good", it.reviewed ? L("Reviewed","تمت مراجعته") : L("Ready","جاهز"));
  return `<div class="tw" style="margin-top:12px"><table class="stg"><thead><tr><th>${L("File","الملف")}</th><th>${L("Aging as at","الأعمار كما في")}</th><th class="n">${kind === "ar" ? L("Customers","العملاء") : L("Suppliers","الموردون")}</th><th class="n">${L("Total","الإجمالي")}</th><th>${L("Status","الحالة")}</th><th></th></tr></thead><tbody>
    <tr><td class="wrap small"><b>${U.esc(it.book.file)}</b><div class="muted">${U.esc(it.book.sheets[it.sheet].name)}</div></td>
    <td><input class="in sm" type="date" id="${kind}AsOf" value="${it.asOf}" onchange="BM.wz.agingSet('${kind}','asOf',this.value)"></td>
    <td class="n">${s ? s.parties : "—"}</td><td class="n">${s ? U.num(s.total) : "—"}</td><td>${status}</td>
    <td><div class="row" style="gap:4px"><button class="btn sm" onclick="BM.wz.agingReview('${kind}')">${L("Review","مراجعة")}</button><button class="btn sm danger" aria-label="${L("Remove","إزالة")}" onclick="BM.wz.agingRemove('${kind}')">✕</button></div></td></tr></tbody></table></div>
    <p class="small muted" style="margin:6px 0 0">${L("It is reconciled with the trial balance at the same date when the data is posted.","تتم مطابقته مع ميزان المراجعة في نفس التاريخ عند ترحيل البيانات.")}</p>`;
}

/* the upload area of the Inputs page: three ordered steps and one Post button */
W.stagingHtml = function(coverageHtml){
  const co = curCo(), st = stage(); if (!co || !st) return "";
  const nTB = st.tbs.filter(t => t.include).length;
  const step = (n, title, body, done) => `<div class="card stp${done ? " ok" : ""}"><div class="card-h"><h3><span class="stn">${n}</span>${title}</h3></div><div class="card-b">${body}</div></div>`;
  const tb = drop("dzTB", `<input type="file" id="dzTBIn" accept=".xlsx,.xlsm,.xls,.csv" multiple hidden onchange="BM.wz.onFiles(this.files)">`,
      L("Drop all available trial balances here, or choose files","اسحب كل موازين المراجعة المتوفرة هنا، أو اختر الملفات"),
      L("One or many files, in any order (budget files too). Each is dated from its title, file or sheet name and the list is sorted by date.","ملف واحد أو عدة ملفات وبأي ترتيب (وملفات الموازنة أيضاً). يُحدد تاريخ كل ملف من عنوانه أو اسم الملف أو الورقة، وتُرتب القائمة حسب التاريخ."),
      L("Choose files","اختر الملفات")) + tbTable(st) + (coverageHtml ? `<div style="margin-top:14px">${coverageHtml}</div>` : "") +
    `<input type="file" id="fileAt" accept=".xlsx,.xlsm,.xls,.csv" hidden onchange="BM.wz.onFileAt(this.files[0])">
     <div class="row small" style="margin-top:8px;gap:10px"><button class="btn sm" onclick="BM.wz.sample()">⤓ ${L("Download a sample trial balance","تنزيل نموذج ميزان مراجعة")}</button></div>`;
  const ag = kind => (st[kind] ? "" : drop("dz" + kind, `<input type="file" id="dz${kind}In" accept=".xlsx,.xlsm,.xls,.csv" hidden onchange="BM.wz.onAging('${kind}',this.files)">`,
      kind === "ar" ? L("Drop the receivables aging report here, or choose a file","اسحب تقرير أعمار الذمم المدينة هنا، أو اختر ملفاً") : L("Drop the payables aging report here, or choose a file","اسحب تقرير أعمار الذمم الدائنة هنا، أو اختر ملفاً"),
      L("Only the latest period is needed. Invoice list (party · amount · due date) or buckets (Current · 1–30 · … · 120+).","تكفي آخر فترة فقط. قائمة فواتير (الطرف · المبلغ · تاريخ الاستحقاق) أو فئات (غير مستحق · 1–30 · … · أكثر من 120)."),
      L("Choose file","اختر ملفاً"))) + agingRow(kind, st[kind], co);
  const parts = [nTB ? L("{n} trial balance file(s)","{n} ملف/ملفات ميزان مراجعة",{n:nTB}) : "", st.ar ? L("receivables aging","أعمار الذمم المدينة") : "", st.ap ? L("payables aging","أعمار الذمم الدائنة") : ""].filter(Boolean);
  return (st.bad.length ? ui.banner("warn", L("Could not be read as Excel: ","تعذرت قراءتها كملفات Excel: ") + st.bad.map(U.esc).join("، ")) : "") +
    step(1, L("Trial balances","موازين المراجعة"), tb, nTB) +
    step(2, L("Receivables aging (optional)","أعمار الذمم المدينة (اختياري)"), ag("ar"), !!st.ar) +
    step(3, L("Payables aging (optional)","أعمار الذمم الدائنة (اختياري)"), ag("ap"), !!st.ap) +
    `<div class="card post"><div class="card-b row" style="justify-content:space-between;gap:12px">
      <div><b>${L("Post data","ترحيل البيانات")}</b><div class="small muted">${parts.length ? L("Ready to post: ","جاهز للترحيل: ") + parts.join(" · ") : L("Nothing is written to the company until you press the button. Add the files above first.","لا يُكتب أي شيء في ملف الشركة قبل الضغط على الزر. أضف الملفات أعلاه أولاً.")}</div></div>
      <div class="row" style="gap:8px">${parts.length ? `<button class="btn" onclick="BM.wz.stageClear()">${L("Clear list","مسح القائمة")}</button>` : ""}<button class="btn ok big" id="postBtn" ${parts.length ? "" : "disabled"} onclick="BM.wz.post()">⇪ ${L("Post data","رحّل البيانات")}</button></div></div></div>`;
};
W.dropWire = () => {
  [["dzTB", fs => W.onFiles(fs)], ["dzar", fs => W.onAging("ar", fs)], ["dzap", fs => W.onAging("ap", fs)]].forEach(([id, fn]) => {
    const d = U.$("#" + id); if (!d) return;
    ["dragenter","dragover"].forEach(e => d.addEventListener(e, ev => { ev.preventDefault(); d.classList.add("hot"); }));
    ["dragleave","drop"].forEach(e => d.addEventListener(e, ev => { ev.preventDefault(); d.classList.remove("hot"); }));
    d.addEventListener("drop", ev => { const f = ev.dataTransfer.files; if (f && f.length) fn(f); });
  });
};

/* result shown at the top of the Inputs page after posting */
W.postDoneHtml = function(){
  const d = W.postDone; if (!d) return "";
  const rows = d.tbs.map(x => `<tr><td class="wrap small">${U.esc(x.file)}</td><td class="small">${x.written.map(w => `${w.sc === "budget" ? L("Budget","موازنة") : L("Actual","فعلي")} ${U.month(w.m)} ${w.y}${w.replaced ? ` <span class="muted">(${L("replaced","استُبدل")})</span>` : ""}`).join(" · ")}${x.notes.length ? `<div class="neg">${x.notes.map(U.esc).join(" ")}</div>` : ""}</td></tr>`)
    .concat(d.aging.map(a => `<tr><td class="wrap small">${U.esc(a.file)}</td><td class="small">${a.kind === "ar" ? L("Receivables aging","أعمار الذمم المدينة") : L("Payables aging","أعمار الذمم الدائنة")} — ${a.asOf} · ${a.rec && a.rec.tb != null ? (a.rec.ok ? `<span class="pos">${L("agrees with the trial balance ({t})","يطابق ميزان المراجعة ({t})",{t:U.numPlain(a.rec.tb)})}</span>` : `<span class="neg">${L("differs from the trial balance by {x}","يختلف عن ميزان المراجعة بمقدار {x}",{x:U.numPlain(a.rec.diff)})}</span>`) : `<span class="muted">${L("no trial balance at this date","لا يوجد ميزان في هذا التاريخ")}</span>`}</td></tr>`)).join("");
  return ui.banner("good", `✔ <b>${L("Data posted: {a} trial balance file(s){b}.","تم ترحيل البيانات: {a} ملف/ملفات ميزان مراجعة{b}.",{a:d.tbs.length, b:d.aging.length ? L(" and {n} aging report(s)"," و{n} تقرير/تقارير أعمار",{n:d.aging.length}) : ""})}</b> <a href="#dashboard" style="color:inherit">${L("Open the dashboard","فتح لوحة المؤشرات")}</a> · <a href="#quality" style="color:inherit">${L("Check data quality","فحص جودة البيانات")}</a> <button class="btn sm" style="margin-inline-start:auto" onclick="BM.wz.postDone=null;BM.render()">✕</button>`) +
    (d.histExt ? ui.banner("info", L("The historical data period now ends in {d}, so the new trial balances appear in the table below. You can change it in the company inputs.","أصبحت فترة البيانات التاريخية تنتهي في {d} لتظهر الموازين الجديدة في الجدول أدناه. يمكنك تعديلها من مدخلات الشركة.",{d:U.month(d.histExt.m, true) + " " + d.histExt.y})) : "") +
    (d.budgets ? ui.banner("info", L("Budget files are not listed in the coverage table. They are used when you choose «Compare with: Budget» in the Analysis view card.","ملفات الموازنة لا تظهر في جدول التغطية، وتُستخدم عند اختيار «المقارنة مع: الموازنة» في بطاقة «عرض التحليل».")) : "") +
    `<details class="card" style="margin-bottom:14px" open><summary class="card-h" style="cursor:pointer;padding:12px 16px">${L("What was posted","ما تم ترحيله")}</summary><div class="tw"><table><thead><tr><th>${L("File","الملف")}</th><th>${L("Result","النتيجة")}</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
};
})();
