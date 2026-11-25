/* =============================================================================
   engine/importer.js — intelligent Excel import (master prompt §4).
   Steps (the wizard UI drives them):
     1 readWorkbook()  → sheets as arrays of rows
     2 detectHeader() + detectRoles()  → which column holds what (editable)
     3 parse()         → account rows + structural issues
     4 classify (engine/classify.js), user reviews
     5 validate()      → balance checks, summary rows, nature checks
     6 commit()        → trial-balance snapshots on the company
   No column name is assumed: headers are read in English and Arabic and the
   user can re-assign every column before anything is processed.
   ============================================================================= */
(function(){
const U = BM.U, N = U.norm, IMP = BM.IMP = {};

/* ---------- column roles ---------- */
IMP.ROLES = [
  ["ignore","— Ignore —","— تجاهل —"],
  ["code","Account code","رقم الحساب"],
  ["name","Account name","اسم الحساب"],
  ["close_dr","Closing debit","الرصيد الختامي — مدين"],
  ["close_cr","Closing credit","الرصيد الختامي — دائن"],
  ["close_net","Closing balance (single column)","الرصيد الختامي (عمود واحد)"],
  ["open_dr","Opening debit","الرصيد الافتتاحي — مدين"],
  ["open_cr","Opening credit","الرصيد الافتتاحي — دائن"],
  ["open_net","Opening balance (single column)","الرصيد الافتتاحي (عمود واحد)"],
  ["mov_dr","Period movement — debit","حركة الفترة — مدين"],
  ["mov_cr","Period movement — credit","حركة الفترة — دائن"],
  ["py_dr","Prior year — debit","السنة السابقة — مدين"],
  ["py_cr","Prior year — credit","السنة السابقة — دائن"],
  ["py_net","Prior year — balance (single column)","السنة السابقة — رصيد (عمود واحد)"],
  ["bud_net","Budget (single column)","الموازنة (عمود واحد)"]
].concat(BM.MONTHS.map((m, i) => ["m" + (i+1), "Month: " + m[1], "شهر: " + m[2]]));
IMP.roleLabel = r => { const x = IMP.ROLES.find(z => z[0] === r); return x ? L(x[1], x[2]) : r; };

/* ---------- 1. read ---------- */
IMP.readWorkbook = function(file){
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), {type:"array", cellDates:true});
        const sheets = wb.SheetNames.map(n => ({name:n, aoa: XLSX.utils.sheet_to_json(wb.Sheets[n], {header:1, defval:"", raw:true, blankrows:false})}))
          .filter(s => s.aoa.length);
        res({file:file.name, sheets});
      } catch(err){ rej(err); }
    };
    fr.onerror = () => rej(fr.error);
    fr.readAsArrayBuffer(file);
  });
};

/* ---------- 2. header + column detection ---------- */
const KW = {
  name: ["name","description","account title","اسم","البيان","الوصف","اسم الحساب"],
  code: ["code","account no","acc no","account number","a c no","no","number","رقم","كود","الرقم","رمز"],
  dr: ["debit","dr","مدين","مدينه"],
  cr: ["credit","cr","دائن","دائنه"],
  py: ["prior year","previous year","last year","py","comparative","السنه السابقه","العام السابق","سنه سابقه","مقارن"],
  open: ["opening","open","beginning","begin","brought forward","b f","افتتاح","افتتاحي","اول المده","اول الفتره","رصيد سابق","مدور"],
  mov: ["movement","activity","transactions","during","turnover","حركه","الحركه","خلال الفتره","حركات"],
  close: ["closing","close","ending","end","balance","net","ختام","ختامي","اخر المده","الرصيد","رصيد","صافي"],
  bud: ["budget","plan","target","forecast","موازنه","الموازنه","مخطط","مستهدف","تقديري"]
};
const has = (h, list) => list.some(k => {
  const kk = N(k); if (kk.length <= 3) return (" " + h + " ").indexOf(" " + kk + " ") >= 0;
  return h.indexOf(kk) >= 0;
});
const MONTH_KW = [
  ["كانون الثاني",1],["كانون الاول",12],["تشرين الاول",10],["تشرين الثاني",11],["شباط",2],["اذار",3],["نيسان",4],["ايار",5],["حزيران",6],["تموز",7],["اب",8],["ايلول",9],
  ["يناير",1],["فبراير",2],["مارس",3],["ابريل",4],["مايو",5],["يونيو",6],["يوليو",7],["اغسطس",8],["سبتمبر",9],["اكتوبر",10],["نوفمبر",11],["ديسمبر",12],
  ["january",1],["february",2],["march",3],["april",4],["june",6],["july",7],["august",8],["september",9],["october",10],["november",11],["december",12],
  ["jan",1],["feb",2],["mar",3],["apr",4],["may",5],["jun",6],["jul",7],["aug",8],["sep",9],["sept",9],["oct",10],["nov",11],["dec",12]
];
function monthOf(h, raw){
  if (raw instanceof Date) return raw.getMonth() + 1;
  let m = h.match(/^(\d{4}) (\d{1,2})$/) || h.match(/^(\d{1,2}) (\d{4})$/);
  if (m){ const a = +m[1], b = +m[2]; const mm = a > 12 ? b : a; if (mm >= 1 && mm <= 12) return mm; }
  for (const [k, v] of MONTH_KW){ const kk = N(k); if ((" " + h + " ").indexOf(" " + kk + " ") >= 0 || (kk.length > 3 && h.indexOf(kk) >= 0)) return v; }
  return 0;
}
const textish = v => typeof v === "string" && /[a-z؀-ۿ]/i.test(v);

IMP.detectHeader = function(aoa){
  let best = 0, bestScore = -1;
  for (let i = 0; i < Math.min(aoa.length, 20); i++){
    const row = aoa[i] || [];
    let s = 0, txt = 0;
    row.forEach(c => {
      const h = N(c instanceof Date ? "" : c); if (!h) return;
      if (textish(String(c))) txt++;
      if (has(h, KW.code) || has(h, KW.name) || has(h, KW.dr) || has(h, KW.cr) || has(h, KW.close) || has(h, KW.bud) || monthOf(h, c)) s += 2;
    });
    s += txt * 0.5;
    if (s > bestScore){ bestScore = s; best = i; }
  }
  return best;
};

IMP.detectRoles = function(aoa, hr, fy){
  const head = aoa[hr] || [], body = aoa.slice(hr + 1, hr + 60);
  const ncol = Math.max(head.length, ...body.map(r => r.length));
  const roles = [];
  for (let c = 0; c < ncol; c++){
    const raw = head[c], h = N(raw instanceof Date ? "" : raw);
    const vals = body.map(r => r[c]).filter(v => v !== "" && v != null);
    const numShare = vals.length ? vals.filter(v => typeof v === "number" || !U.parseNum(v).bad).length / vals.length : 0;
    const codeLike = vals.length ? vals.filter(v => /^[\d.\-\/ ]{1,20}$/.test(String(v).trim())).length / vals.length : 0;
    let r = "ignore";
    const yr = (h.match(/\b(19|20)\d{2}\b/) || [])[0];
    const isDr = has(h, KW.dr), isCr = has(h, KW.cr);
    const mo = monthOf(h, raw);
    if (has(h, KW.name)) r = "name";
    else if (has(h, KW.code) && !isDr && !isCr) r = "code";
    else if (has(h, KW.bud)) r = "bud_net";
    else if (mo && !isDr && !isCr && !has(h, KW.open) && !has(h, KW.close)) r = "m" + mo;
    else if (has(h, KW.py) || (yr && fy && +yr === fy - 1)) r = isDr ? "py_dr" : isCr ? "py_cr" : "py_net";
    else if (has(h, KW.open)) r = isDr ? "open_dr" : isCr ? "open_cr" : "open_net";
    else if (has(h, KW.mov)) r = isDr ? "mov_dr" : isCr ? "mov_cr" : "ignore";
    else if (isDr) r = "close_dr";
    else if (isCr) r = "close_cr";
    else if (has(h, KW.close) || (yr && fy && +yr === fy)) r = "close_net";
    else if (h === "account" || h === "الحساب" || !h) r = codeLike > 0.7 ? "code" : (vals.length && numShare < 0.3 ? "name" : "ignore");
    roles.push(r);
  }
  /* fallbacks from the data when the header gave nothing */
  if (roles.indexOf("code") < 0){
    for (let c = 0; c < ncol; c++){ if (roles[c] !== "ignore") continue;
      const v = body.map(r => r[c]).filter(x => x !== "");
      if (v.length && v.filter(x => /^[\d.\-\/ ]{1,20}$/.test(String(x).trim())).length / v.length > 0.8){ roles[c] = "code"; break; } }
  }
  if (roles.indexOf("name") < 0){
    for (let c = 0; c < ncol; c++){ if (roles[c] !== "ignore") continue;
      const v = body.map(r => r[c]).filter(x => x !== "");
      if (v.length && v.filter(textish).length / v.length > 0.6){ roles[c] = "name"; break; } }
  }
  /* duplicates of single-use roles: keep the first */
  const seen = {};
  roles.forEach((r, i) => { if (r !== "ignore"){ if (seen[r]) roles[i] = "ignore"; else seen[r] = 1; } });
  return roles;
};

IMP.colName = (aoa, hr, c) => {
  const v = (aoa[hr] || [])[c];
  const t = v instanceof Date ? v.toISOString().slice(0,7) : String(v == null ? "" : v).trim();
  return t || (L("Column","العمود") + " " + XLSX.utils.encode_col(c));
};

/* ---------- 3. parse rows ---------- */
const TOTAL_RX = /^(total|totals|grand total|sub total|subtotal|الاجمالي|اجمالي|المجموع|مجموع|الاجماليات)(?=\s|$)/;
IMP.parse = function(aoa, hr, roles){
  const idx = {}; roles.forEach((r, c) => { if (r !== "ignore") idx[r] = c; });
  const issues = [], rows = [], badCells = [], neg = [], both = [];
  const numeric = Object.keys(idx).filter(r => r !== "code" && r !== "name");
  const cellRef = (r, c) => XLSX.utils.encode_cell({r, c});
  if (idx.code == null) issues.push(["error","structure",L("No account-code column selected.","لم يتم تحديد عمود رقم الحساب.")]);
  if (!numeric.length) issues.push(["error","structure",L("No amount column selected.","لم يتم تحديد أي عمود للمبالغ.")]);
  const hasClose = ["close_dr","close_cr","close_net"].some(r => idx[r] != null) || (["open_dr","open_cr","open_net"].some(r => idx[r] != null) && ["mov_dr","mov_cr"].some(r => idx[r] != null));
  let missingCode = 0, missingName = 0;
  for (let i = hr + 1; i < aoa.length; i++){
    const row = aoa[i] || [];
    let code = idx.code != null ? row[idx.code] : "";
    code = (typeof code === "number" ? String(code).replace(/\.0+$/,"") : String(code == null ? "" : code)).trim();
    const name = idx.name != null ? String(row[idx.name] == null ? "" : row[idx.name]).trim() : "";
    const v = {};
    let any = false;
    for (const r of numeric){
      const p = U.parseNum(row[idx[r]]);
      if (p.bad){ badCells.push(cellRef(i, idx[r]) + " “" + String(row[idx[r]]).slice(0,20) + "”"); }
      v[r] = p.v; if (p.v) any = true;
    }
    if (!code && !name && !any) continue;                              // empty row
    const nn = N(name), nc = N(code);
    if (TOTAL_RX.test(nn) || TOTAL_RX.test(nc)){ rows.push({code: code || ("TOTAL-" + i), name, v, row:i+1, total:true}); continue; }
    if (!code){ if (any){ missingCode++; } continue; }
    if (!name) missingName++;
    if ((v.close_dr && v.close_cr) || (v.open_dr && v.open_cr)) both.push(code);
    ["close_dr","close_cr","open_dr","open_cr","mov_dr","mov_cr","py_dr","py_cr"].forEach(r => { if (v[r] < 0) neg.push(code); });
    rows.push({code, name: name || code, v, row: i+1});
  }
  if (missingCode) issues.push(["error","structure",L("{n} row(s) have amounts but no account code — they are excluded.","{n} صف/صفوف تحتوي مبالغ دون رقم حساب — تم استبعادها.",{n:missingCode})]);
  if (missingName) issues.push(["warning","structure",L("{n} account(s) have no name — the code is used as the name.","{n} حساب/حسابات بدون اسم — استُخدم الرقم كاسم.",{n:missingName})]);
  if (badCells.length) issues.push(["error","numbers",L("{n} cell(s) contain text where a number was expected: ","{n} خلية/خلايا تحتوي نصاً بدل رقم: ",{n:badCells.length}) + badCells.slice(0,8).join(", ") + (badCells.length > 8 ? " …" : "")]);
  if (both.length) issues.push(["warning","numbers",L("{n} account(s) have both a debit and a credit balance in the same row — the net is used: ","{n} حساب/حسابات لها رصيد مدين ودائن في نفس الصف — استُخدم الصافي: ",{n:both.length}) + both.slice(0,8).join(", ")]);
  if (neg.length) issues.push(["warning","numbers",L("{n} negative value(s) in debit/credit columns: ","{n} قيمة سالبة في أعمدة المدين/الدائن: ",{n:neg.length}) + Array.from(new Set(neg)).slice(0,8).join(", ")]);
  const totals = rows.filter(r => r.total).length;
  if (totals) issues.push(["info","structure",L("{n} total row(s) detected and excluded.","تم اكتشاف {n} صف/صفوف إجمالي واستبعادها.",{n:totals})]);

  /* duplicates */
  const cnt = {}; rows.forEach(r => { if (!r.total) cnt[r.code] = (cnt[r.code] || 0) + 1; });
  const dups = Object.keys(cnt).filter(c => cnt[c] > 1);
  if (dups.length) issues.push(["warning","duplicates",L("{n} duplicated account code(s) — amounts are added together: ","{n} رقم حساب مكرر — تم جمع المبالغ: ",{n:dups.length}) + dups.slice(0,8).join(", ")]);
  if (!hasClose && !["bud_net","py_net","py_dr","py_cr"].some(r => idx[r] != null) && !Object.keys(idx).some(r => /^m\d+$/.test(r)))
    issues.push(["error","structure",L("Select closing balances (debit/credit or one balance column), or opening + movement columns.","حدد الأرصدة الختامية (مدين/دائن أو عمود رصيد واحد)، أو أعمدة الافتتاحي والحركة.")]);
  return {rows, issues, idx, dups, hasClose};
};

/* merge duplicates and detect summary (parent) rows */
IMP.consolidate = function(parsed){
  const by = new Map();
  parsed.rows.filter(r => !r.total).forEach(r => {
    const x = by.get(r.code);
    if (!x) by.set(r.code, {code:r.code, name:r.name, v:Object.assign({}, r.v)});
    else for (const k in r.v) x.v[k] = (x.v[k] || 0) + r.v[k];
  });
  const accts = Array.from(by.values());
  /* summary rows: a numeric code that is a prefix of other codes and whose
     closing amount equals the sum of those codes (within 1 unit) */
  const numericCodes = accts.every(a => /^[\d.\-]+$/.test(a.code));
  if (numericCodes && accts.length > 3){
    const codes = accts.map(a => a.code.replace(/[.\-]/g,""));
    accts.forEach((a, i) => {
      const c = codes[i]; const kids = [];
      codes.forEach((d, j) => { if (j !== i && d.length > c.length && d.indexOf(c) === 0) kids.push(j); });
      if (!kids.length) return;
      /* only immediate leaf children (codes that are not themselves parents) */
      const leaves = kids.filter(j => !codes.some((d, k) => k !== j && d.length > codes[j].length && d.indexOf(codes[j]) === 0));
      const net = x => (x.v.close_net || 0) + (x.v.close_dr || 0) - (x.v.close_cr || 0) + (x.v.open_net||0) + (x.v.open_dr||0) - (x.v.open_cr||0) + (x.v.mov_dr||0) - (x.v.mov_cr||0) + (x.v.bud_net||0) + (x.v.py_net||0) + (x.v.py_dr||0) - (x.v.py_cr||0);
      const s = leaves.reduce((t, j) => t + net(accts[j]), 0);
      a.parent = true;
      a.summary = Math.abs(net(a) - s) <= Math.max(1, Math.abs(s) * 1e-6) || Math.abs(net(a)) < 1e-9;
    });
  }
  return accts;
};

/* ---------- 5. signed values for one account ---------- */
/* sign: "dr" (debit positive), "cr" (credit positive), "natural" (positive in
   the account's normal direction — needs the mapping) */
IMP.values = function(a, idx, sign, fsKey){
  const has = r => idx[r] != null, v = a.v;
  const s1 = x => sign === "cr" ? -x : sign === "natural" ? (fsKey && BM.FS[fsKey][2] === "C" ? -x : x) : x;
  const out = {};
  if (has("close_net")) out.close = s1(v.close_net);
  else if (has("close_dr") || has("close_cr")) out.close = (v.close_dr || 0) - (v.close_cr || 0);
  if (has("open_net")) out.open = s1(v.open_net);
  else if (has("open_dr") || has("open_cr")) out.open = (v.open_dr || 0) - (v.open_cr || 0);
  if (out.close == null && out.open != null && (has("mov_dr") || has("mov_cr"))) out.close = out.open + (v.mov_dr || 0) - (v.mov_cr || 0);
  if (has("py_net")) out.py = s1(v.py_net);
  else if (has("py_dr") || has("py_cr")) out.py = (v.py_dr || 0) - (v.py_cr || 0);
  if (has("bud_net")) out.bud = s1(v.bud_net);
  const mm = []; let anyM = false;
  for (let m = 1; m <= 12; m++){ if (has("m" + m)){ mm[m] = s1(v["m" + m]); anyM = true; } }
  if (anyM) out.months = mm;
  return out;
};

/* ---------- 6. validate the whole job (after mapping) ---------- */
IMP.validate = function(job){
  const {accts, parsed, opts} = job, idx = parsed.idx, issues = parsed.issues.slice();
  const use = accts.filter(a => !a.exclude);
  const sums = {close:0, open:0, py:0, closeDr:0, closeCr:0, openDr:0, pyDr:0};
  const msum = new Array(13).fill(0), mAbs = new Array(13).fill(0);
  let anyM = false;
  use.forEach(a => {
    const x = IMP.values(a, idx, opts.sign, a.fsKey);
    if (x.close != null){ sums.close += x.close; if (x.close > 0) sums.closeDr += x.close; else sums.closeCr -= x.close; }
    if (x.open != null){ sums.open += x.open; if (x.open > 0) sums.openDr += x.open; }
    if (x.py != null){ sums.py += x.py; if (x.py > 0) sums.pyDr += x.py; }
    if (x.months){ anyM = true; for (let m = 1; m <= 12; m++) if (x.months[m] != null){ msum[m] += x.months[m]; mAbs[m] += Math.abs(x.months[m]); } }
  });
  const tol = t => Math.max(1, t * 1e-5);
  const balanced = {};
  const isBudget = opts.scenario === "budget";
  if (parsed.hasClose && !isBudget){
    balanced.close = Math.abs(sums.close) <= tol(sums.closeDr);
    issues.push(balanced.close
      ? ["info","balance",L("Trial balance balances: total debits {d} = total credits {c}.","ميزان المراجعة متوازن: إجمالي المدين {d} = إجمالي الدائن {c}.",{d:U.numPlain(sums.closeDr), c:U.numPlain(sums.closeCr)})]
      : ["error","balance",L("Trial balance does NOT balance. Debits {d}, credits {c}, difference {x}. Check for summary rows, missing accounts or wrong columns.","ميزان المراجعة غير متوازن. المدين {d}، الدائن {c}، الفرق {x}. تحقق من صفوف الإجمالي أو الحسابات الناقصة أو الأعمدة الخاطئة.",{d:U.numPlain(sums.closeDr), c:U.numPlain(sums.closeCr), x:U.numPlain(sums.close)})]);
  }
  if (idx.open_net != null || idx.open_dr != null){ balanced.open = Math.abs(sums.open) <= tol(sums.openDr);
    if (!balanced.open) issues.push(["error","balance",L("Opening balances do not balance (difference {x}).","الأرصدة الافتتاحية غير متوازنة (الفرق {x}).",{x:U.numPlain(sums.open)})]); }
  if (idx.py_net != null || idx.py_dr != null){ balanced.py = Math.abs(sums.py) <= tol(sums.pyDr);
    if (!balanced.py) issues.push(["error","balance",L("Prior-year column does not balance (difference {x}).","عمود السنة السابقة غير متوازن (الفرق {x}).",{x:U.numPlain(sums.py)})]); }
  if (anyM && !isBudget){ const bad = []; for (let m = 1; m <= 12; m++) if (Math.abs(msum[m]) > tol(mAbs[m]/2)) bad.push(U.month(m));
    if (bad.length) issues.push(["error","balance",L("Monthly movements do not net to zero in: ","الحركات الشهرية لا تساوي صفراً في: ") + bad.join(", ")]); }

  const unm = use.filter(a => !a.fsKey);
  if (unm.length) issues.push(["error","mapping",L("{n} account(s) are not mapped to a statement line. They will be shown as unmapped and the balance sheet will not balance until they are mapped.","{n} حساب/حسابات غير مصنفة. ستظهر كغير مصنفة ولن تتوازن الميزانية حتى يتم تصنيفها.",{n:unm.length})]);
  const low = use.filter(a => a.conf === "code");
  if (low.length) issues.push(["warning","mapping",L("{n} account(s) were classified only from their code number. Review them in step 3.","{n} حساب/حسابات صُنفت من رقمها فقط. راجعها في الخطوة 3.",{n:low.length})]);

  /* nature checks — balances against the account's normal side */
  const odd = [];
  use.forEach(a => {
    if (!a.fsKey) return;
    const x = IMP.values(a, idx, opts.sign, a.fsKey), v = x.close != null ? x.close : x.bud;
    if (!v) return;
    const side = BM.FS[a.fsKey][2], nm = N(a.name);
    const contra = /accumulated|allowance|provision|return|discount|مجمع|مخصص|مردود|خصم|drawing|dividend|مسحوب|توزيع|خسائر/.test(nm);
    if (!contra && ((side === "D" && v < -1) || (side === "C" && v > 1))) odd.push(a.code);
  });
  if (odd.length) issues.push(["warning","nature",L("{n} account(s) carry a balance opposite to their normal side (e.g. a revenue account with a debit balance): ","{n} حساب/حسابات برصيد عكس طبيعتها (مثل حساب إيراد برصيد مدين): ",{n:odd.length}) + odd.slice(0,10).join(", ")]);

  const sumN = accts.filter(a => a.summary).length;
  if (sumN) issues.push(["info","structure",L("{n} summary (parent) account(s) detected — their amounts equal the sum of their sub-accounts. {state}","تم اكتشاف {n} حساب/حسابات تجميعية (رئيسية) — مبالغها تساوي مجموع الحسابات الفرعية. {state}",{n:sumN, state: accts.filter(a=>a.summary && a.exclude).length === sumN ? L("They are excluded to avoid double counting.","تم استبعادها لتجنب الازدواج.") : L("Some are included — totals may be double counted.","بعضها مُضمّن — قد تتكرر المبالغ.")})]);

  const errors = issues.filter(i => i[0] === "error").length;
  return {issues, sums, balanced, errors};
};

/* ---------- 7. commit ---------- */
IMP.commit = function(job){
  const S = BM.state, {accts, parsed, opts} = job, idx = parsed.idx, now = new Date().toISOString();
  let co;
  if (job.target.id){ co = S.companies.find(c => c.id === job.target.id); }
  if (!co){
    co = {id:U.uid("co"), name:{en:job.target.nameEn || job.target.nameAr || "Company", ar:job.target.nameAr || job.target.nameEn || "شركة"},
      currency:job.target.currency || "ILS", industry:job.target.industry || "other", fyStart:+job.target.fyStart || 1, accounts:{}, snapshots:{}, imports:[], createdAt:now};
    S.companies.push(co);
  }
  /* accounts */
  accts.forEach(a => {
    const prev = co.accounts[a.code] || {};
    co.accounts[a.code] = {code:a.code, name:a.name || prev.name, fsKey:a.fsKey || null, conf:a.conf, excluded:!!a.exclude, summary:!!a.summary};
    if (a.conf === "manual") BM.rememberMapping(a.code, a.name, a.fsKey);
  });
  const isBS = k => k && BM.FS[k] && BM.FS[k][0] === "BS";
  const written = [];
  /* positions are given in fiscal coordinates and stored by calendar month end */
  const put = (sc, fy, p, bal, kind) => {
    const cal = BM.E.toCal(co, fy, p), y = cal.y, m = cal.m;
    const k = BM.E.key(sc, y, m), old = co.snapshots[k];
    let hasBS = false, hasPL = false;
    for (const c in bal){ const a = co.accounts[c]; if (!a || a.excluded || !bal[c]) continue; if (!a.fsKey || isBS(a.fsKey)) hasBS = true; else hasPL = true; }
    if (kind === "opening"){
      if (old && old.hasPL) return;                 // keep a full snapshot already loaded for that date
      hasPL = hasPL || false;
    } else { hasPL = true; }
    co.snapshots[k] = {scenario:sc, year:y, month:m, bal, hasBS: kind === "pl-only" ? false : hasBS, hasPL, kind:kind, source:job.file + " › " + job.sheet, at:now};
    written.push({sc, y, m, replaced: !!old, kind});
  };
  const sc = opts.scenario, y = +opts.year, m = +opts.month, F = BM.E.toFis(co, y, m);
  const vals = {}; accts.filter(a => !a.exclude).forEach(a => vals[a.code] = IMP.values(a, idx, opts.sign, a.fsKey));
  const col = f => { const b = {}; let any = false; for (const c in vals){ const v = vals[c][f]; if (v != null){ b[c] = v; any = true; } } return any ? b : null; };

  const close = col("close"); if (close) put(sc, F.fy, F.p, close, "closing");
  const open = col("open");   if (open) put("actual", F.fy, opts.openAt === "month" ? F.p - 1 : 0, open, "opening");
  const py = col("py");       if (py) put("actual", F.fy - 1, opts.pyAt === "same" ? F.p : 12, py, "closing");
  const bud = col("bud");     if (bud) put("budget", F.fy, opts.budAt === "ytd" ? F.p : 12, bud, "closing");
  /* monthly movement columns → cumulative month-end snapshots */
  const anyMonths = Object.values(vals).some(v => v.months);
  if (anyMonths){
    /* columns are calendar months; they are accumulated in financial-year order */
    const cm = k => BM.E.toCal(co, F.fy, k).m;
    let last = 0; for (let k = 1; k <= 12; k++) if (idx["m" + cm(k)] != null) last = k;
    const cum = {}; let bsMove = false;
    for (const c in vals){ cum[c] = isBS((co.accounts[c] || {}).fsKey) && open ? (open[c] || 0) : 0; }
    for (let k = 1; k <= last; k++){
      const b = {};
      for (const c in vals){
        const mv = vals[c].months ? (vals[c].months[cm(k)] || 0) : 0;
        if (mv && isBS((co.accounts[c] || {}).fsKey)) bsMove = true;
        cum[c] += mv; b[c] = cum[c];
      }
      put(sc, F.fy, k, b, open ? "closing" : "pl-only");
    }
    if (bsMove && !open) job.notes = (job.notes || []).concat([L("Balance-sheet accounts have monthly movements but no opening balances, so only the income statement was built from the monthly columns.","حسابات الميزانية لها حركات شهرية دون أرصدة افتتاحية، لذلك بُنيت قائمة الدخل فقط من الأعمدة الشهرية.")]);
  }
  co.imports.unshift({at:now, file:job.file, sheet:job.sheet, scenario:sc, year:y, month:m, accounts:accts.length,
    issues:job.validation.issues.filter(i => i[0] !== "info").map(i => i.slice()), written});
  co.imports = co.imports.slice(0, 30);
  BM.E.bump(co);
  BM.saveData();
  return {co, written};
};
})();
