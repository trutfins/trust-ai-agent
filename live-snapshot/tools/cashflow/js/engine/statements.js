/* =============================================================================
   engine/statements.js — period engine and financial statements.

   DATA MODEL
   A company holds trial-balance SNAPSHOTS:
     co.snapshots["actual|2026|9"] = { scenario, year, month, bal:{code: net},
                                        hasBS, hasPL, kind, source, at }
   • net is debit-positive (Dr +, Cr −)
   • balance-sheet accounts hold the closing balance at month end
   • income-statement accounts hold the YEAR-TO-DATE balance (as every
     accounting system prints a trial balance)
   • scenarios: "actual" and "budget". The prior year is simply actual data
     of year − 1, so the same engine serves every comparison.

   DERIVED FIGURES
   • a single month / quarter = YTD(end) − YTD(start − 1)
   • budget given only as a full-year figure → phased evenly   (status "derived")
   • prior-year period not loaded but full prior year loaded → pro-rated
                                                               (status "estimated")
   • cash flow is always derived from balance-sheet movements  (status "derived")
   Nothing is ever balanced with a plug: a trial balance that does not balance,
   or an unmapped account, shows up as a visible difference.
   ============================================================================= */
(function(){
const U = BM.U, E = BM.E = {};
const cache = new Map();          // co.id → {ver, agg:{snapKey: aggregate}}

E.key = (sc, y, m) => sc + "|" + y + "|" + m;

/* ---------- fiscal calendar ----------
   Snapshots are stored by CALENDAR month-end (as printed on the trial balance).
   The engine works in FISCAL coordinates: fy = the calendar year in which the
   financial year starts, p = period 1…12 counted from the company's first
   month (co.fyStart, 1 = January … 12 = December). With fyStart = 1 the two
   systems coincide. An absolute index a = fy × 12 + p − 1 lets spans cross
   financial years (last twelve months, custom ranges). */
E.fs = co => { const v = +((co || BM.co() || {}).fyStart) || 1; return v >= 1 && v <= 12 ? v : 1; };
E.toCal = (co, fy, p) => { const i = E.fs(co) - 1 + p - 1; return {y: fy + Math.floor(i / 12), m: ((i % 12) + 12) % 12 + 1}; };
E.toFis = (co, y, m) => { const s = E.fs(co); return {fy: m >= s ? y : y - 1, p: ((m - s + 12) % 12) + 1}; };
E.abs = (fy, p) => fy * 12 + p - 1;
E.fp = a => ({fy: Math.floor(a / 12), p: ((a % 12) + 12) % 12 + 1});
E.snap = (co, sc, fy, p) => { const c = E.toCal(co, fy, p); return co.snapshots[E.key(sc, c.y, c.m)] || null; };
E.calKey = (co, fy, p) => { const c = E.toCal(co, fy, p); return c.y + "-" + c.m; };
E.endDate = (co, fy, p) => { const c = E.toCal(co, fy, p); return U.monthEnd(c.y, c.m); };
/* labels */
E.pm = (p, long, co) => U.month(E.toCal(co, 2000, p).m, long);                       // month name of fiscal period p
E.pDate = (fy, p, long, co) => { const c = E.toCal(co, fy, p); return U.month(c.m, long) + " " + c.y; };
E.fyName = (fy, co) => E.fs(co) === 1 ? String(fy) : fy + "/" + String((fy + 1) % 100).padStart(2, "0");
E.fyLabel = (fy, co) => (U.isAr() ? "السنة المالية " : "FY ") + E.fyName(fy, co);
E.dayLabel = (fy, p, co) => { const c = E.toCal(co, fy, p); return U.monthEnd(c.y, c.m).getUTCDate() + " " + U.month(c.m, true) + " " + c.y; };
E.fyEndLabel = (fy, co) => E.dayLabel(fy, 12, co);                                    // e.g. 31 Dec 2025 / 31 Mar 2026
E.fyStartName = co => U.month(E.fs(co), true);

/* call after any mapping change: clears cached totals and re-derives which
   statements each snapshot can feed (a re-mapped account may move between
   balance sheet and income statement) */
E.bump = co => {
  co.mapVer = (co.mapVer || 0) + 1;
  for (const id in co.snapshots){
    const s = co.snapshots[id]; if (s.kind === "pl-only") continue;
    let bs = false, pl = false;
    for (const c in s.bal){ const a = co.accounts[c]; if (!a || a.excluded || !s.bal[c]) continue; if (!a.fsKey || BM.FS[a.fsKey][0] === "BS") bs = true; else pl = true; }
    s.hasBS = bs;
    if (s.kind === "opening") s.hasPL = pl;
  }
};

/* Sum a snapshot by statement line. Excluded (summary) accounts are skipped. */
E.agg = function(co, s){
  let c = cache.get(co.id);
  if (!c || c.ver !== (co.mapVer || 0)){ c = {ver: co.mapVer || 0, agg:{}}; cache.set(co.id, c); }
  const id = E.key(s.scenario, s.year, s.month) + "|" + (s.at || "");
  if (c.agg[id]) return c.agg[id];
  const k = {}; BM.FS_KEYS.forEach(f => k[f] = 0);
  let un = 0, unN = 0, tb = 0, dr = 0, cr = 0;
  for (const code in s.bal){
    const a = co.accounts[code], v = s.bal[code];
    if (a && a.excluded) continue;
    tb += v; if (v > 0) dr += v; else cr -= v;
    if (a && a.fsKey && BM.FS[a.fsKey]) k[a.fsKey] += v; else { un += v; if (v) unN++; }
  }
  return (c.agg[id] = {k, un, unN, tb, dr, cr});
};

/* ---------- periods ----------
   period = {type, year, month[, fromYear, fromMonth]} in fiscal coordinates.
   types: month · quarter (fiscal) · ytd · year · ltm (last twelve months) · custom */
E.TYPES = [["month","Month","شهر"],["quarter","Quarter","ربع سنة"],["half","Half-year","نصف سنة"],["ytd","Year to date","منذ بداية السنة"],["year","Full year","سنة كاملة"],
  ["ltm","Last 12 months","آخر 12 شهراً"],["custom","Custom range","فترة مخصصة"]];
E.span = p => {
  const a = E.abs(p.year, p.month);
  if (p.type === "month") return [a, a];
  if (p.type === "quarter") return [a - 2, a];
  if (p.type === "half") return [a - 5, a];
  if (p.type === "year") return [E.abs(p.year, 1), E.abs(p.year, 12)];
  if (p.type === "ltm") return [a - 11, a];
  if (p.type === "custom" && p.fromYear != null){ const f = E.abs(p.fromYear, p.fromMonth); return [Math.min(f, a), a]; }
  return [E.abs(p.year, 1), a];                      // ytd
};
/* [first, last] fiscal period inside the end year (kept for single-year callers) */
E.range = p => { const [a1, a2] = E.span(p), A = E.fp(a1), B = E.fp(a2); return [A.fy === B.fy ? A.p : 1, B.p]; };
E.spanDays = (co, a1, a2) => { const A = E.fp(a1), B = E.fp(a2), c1 = E.toCal(co, A.fy, A.p), c2 = E.toCal(co, B.fy, B.p);
  return Math.round((Date.UTC(c2.y, c2.m, 1) - Date.UTC(c1.y, c1.m - 1, 1)) / 864e5); };
E.days = (y, s, e, co) => E.spanDays(co, E.abs(y, s), E.abs(y, e));
E.periodLabel = (p, short, co) => {
  const [a1, a2] = E.span(p), A = E.fp(a1), B = E.fp(a2), ar = U.isAr();
  if (p.type === "month") return E.pDate(B.fy, B.p, !short, co);
  if (p.type === "quarter") return (ar ? "الربع " : "Q") + Math.ceil(B.p / 3) + " " + (E.fs(co) === 1 ? B.fy : (ar ? "س.م " : "FY ") + E.fyName(B.fy, co));
  if (p.type === "half") return (ar ? (B.p <= 6 ? "النصف الأول " : "النصف الثاني ") : "H" + Math.ceil(B.p / 6) + " ") + (E.fs(co) === 1 ? B.fy : (ar ? "س.م " : "FY ") + E.fyName(B.fy, co));
  if (p.type === "year") return E.fyLabel(B.fy, co);
  if (p.type === "ltm") return (ar ? "آخر 12 شهراً حتى " : "LTM ") + E.pDate(B.fy, B.p, false, co);
  if (p.type === "custom") return (ar ? "من " : "") + E.pDate(A.fy, A.p, false, co) + (ar ? " إلى " : " – ") + E.pDate(B.fy, B.p, false, co);
  return (ar ? "منذ بداية السنة حتى " : "YTD ") + E.pDate(B.fy, B.p, false, co);
};
/* fiscal periods with an actual income-statement snapshot, per fiscal year */
E.actualMonths = co => {
  const out = {};
  for (const id in co.snapshots){ const s = co.snapshots[id]; if (s.scenario !== "actual" || !s.hasPL) continue;
    const f = E.toFis(co, s.year, s.month); (out[f.fy] = out[f.fy] || []).push(f.p); }
  for (const y in out) out[y].sort((a, b) => a - b);
  return out;
};
E.latest = co => {
  const am = E.actualMonths(co), ys = Object.keys(am).map(Number).sort((a, b) => b - a);
  if (!ys.length) return null;
  return {year: ys[0], month: am[ys[0]][am[ys[0]].length - 1]};
};

/* ---------- income-statement balances ---------- */
const ZERO = () => { const k = {}; BM.FS_KEYS.forEach(f => k[f] = 0); return k; };

/* cumulative (YTD) P&L at a month end. Returns {k, status, note} or null */
E.plCum = function(co, sc, y, m){
  if (m === 0) return {k: ZERO(), status: "actual"};
  const s = E.snap(co, sc, y, m);
  if (s && s.hasPL) return {k: E.agg(co, s).k, status: s.kind === "phased" ? "derived" : "actual"};
  /* budget with only a full-year figure → straight-line phasing */
  if (sc === "budget"){
    const fy = E.snap(co, sc, y, 12);
    if (fy && fy.hasPL){
      const a = E.agg(co, fy).k, k = {};
      for (const f in a) k[f] = BM.FS[f][0] === "PL" ? a[f] * m / 12 : 0;
      return {k, status: "derived", note: L("Annual budget phased evenly across months","الموازنة السنوية موزعة بالتساوي على الأشهر")};
    }
  }
  return null;
};
E.plPeriod = function(co, sc, y, s, e, opt){
  opt = opt || {};
  const a = E.plCum(co, sc, y, e), b = E.plCum(co, sc, y, s - 1);
  if (a && b){
    const k = {}; for (const f in a.k) k[f] = BM.FS[f][0] === "PL" ? a.k[f] - (b.k[f] || 0) : 0;
    const st = (a.status !== "actual" || b.status !== "actual") ? "derived" : "actual";
    return {k, status: st, note: a.note || b.note};
  }
  if (opt.estimate && sc === "actual" && !(s === 1 && e === 12)){
    const fy = E.plCum(co, sc, y, 12);
    if (fy && fy.status === "actual"){
      const f = (e - s + 1) / 12, k = {};
      for (const x in fy.k) k[x] = fy.k[x] * f;
      return {k, status: "estimated", note: L("Pro-rated from the full-year figure — monthly data not loaded","محسوب بالتناسب من رقم السنة الكاملة — البيانات الشهرية غير محمّلة")};
    }
  }
  return null;
};

/* ---------- statements ---------- */
const neg = v => -v;
E.incomeStatement = function(pl){
  if (!pl) return null;
  const k = pl.k, r = {};
  r.sales = neg(k.sales); r.service_rev = neg(k.service_rev); r.other_op_rev = neg(k.other_op_rev);
  r.rev = r.sales + r.service_rev + r.other_op_rev;
  ["cogs","direct_materials","direct_labor","other_direct"].forEach(f => r[f] = k[f]);
  r.cos = r.cogs + r.direct_materials + r.direct_labor + r.other_direct;
  r.gp = r.rev - r.cos;
  ["salaries","rent","utilities","marketing","transport","admin","other_opex"].forEach(f => r[f] = k[f]);
  r.opex = r.salaries + r.rent + r.utilities + r.marketing + r.transport + r.admin + r.other_opex;
  r.ebitda = r.gp - r.opex;
  r.depreciation = k.depreciation;
  r.ebit = r.ebitda - r.depreciation;
  r.finance_income = neg(k.finance_income); r.finance_costs = k.finance_costs;
  r.fx = neg(k.fx); r.other_gl = neg(k.other_gl); r.other_rev = neg(k.other_rev);
  r.other = r.fx + r.other_gl + r.other_rev;
  r.pbt = r.ebit + r.finance_income - r.finance_costs + r.other;
  r.taxes = k.taxes;
  r.np = r.pbt - r.taxes;
  r.status = pl.status; r.note = pl.note;
  return r;
};

/* balance sheet at a month end (m = 0 → prior year end) */
E.balanceSheet = function(co, sc, y, m){
  const s = E.snap(co, sc, y, m);
  if (!s || !s.hasBS) return null;
  const a = E.agg(co, s), k = a.k, b = {};
  ["cash","bank","ar","inventory","prepayments","other_ca","fixed_assets","intangibles","other_nca"].forEach(f => b[f] = k[f]);
  ["ap","st_loans","accrued","other_cl","lt_loans","other_ncl","capital","reserves","retained","other_equity"].forEach(f => b[f] = -k[f]);
  /* current-year earnings: the YTD result still sitting in the P&L accounts
     of a pre-closing trial balance (zero in a post-closing opening balance) */
  let cye = 0; for (const f in k) if (BM.FS[f][0] === "PL") cye -= k[f];
  b.cye = cye;
  b.cashAll = b.cash + b.bank;
  b.tca = b.cash + b.bank + b.ar + b.inventory + b.prepayments + b.other_ca;
  b.tnca = b.fixed_assets + b.intangibles + b.other_nca;
  b.ta = b.tca + b.tnca;
  b.tcl = b.ap + b.st_loans + b.accrued + b.other_cl;
  b.tncl = b.lt_loans + b.other_ncl;
  b.tl = b.tcl + b.tncl;
  b.te = b.capital + b.reserves + b.retained + b.other_equity + b.cye;
  b.tle = b.tl + b.te;
  b.debt = b.st_loans + b.lt_loans;
  b.wc = b.tca - b.tcl;
  b.owc = b.ar + b.inventory - b.ap;                  // operating working capital
  b.diff = b.ta - b.tle;                              // must be 0
  b.unmapped = a.un; b.unmappedN = a.unN; b.tbDiff = a.tb;
  b.year = s.year; b.month = s.month; b.kind = s.kind; b.fy = y; b.p = m;
  return b;
};
/* balance sheet at a CALENDAR month end (aging dates, snapshot lists) */
E.bsCal = (co, sc, y, m) => { const f = E.toFis(co, y, m); return E.balanceSheet(co, sc, f.fy, f.p); };

/* cash flow — ALWAYS derived (indirect method) from two balance sheets */
E.cashFlow = function(is, b1, b0){
  if (!is) return {na: L("Income statement not available for this period","قائمة الدخل غير متوفرة لهذه الفترة")};
  if (!b1) return {na: L("Closing balance sheet not available","الميزانية الختامية غير متوفرة")};
  if (!b0) return {na: L("Opening balance sheet not available — load the trial balance of the previous month-end or opening balances","الميزانية الافتتاحية غير متوفرة — حمّل ميزان المراجعة لنهاية الشهر السابق أو الأرصدة الافتتاحية")};
  const d = f => b1[f] - b0[f], c = {};
  c.np = is.np; c.dep = is.depreciation;
  c.dAR = -d("ar"); c.dInv = -d("inventory"); c.dPrep = -d("prepayments"); c.dOCA = -d("other_ca");
  c.dAP = d("ap"); c.dAcc = d("accrued"); c.dOCL = d("other_cl"); c.dONCL = d("other_ncl");
  c.wc = c.dAR + c.dInv + c.dPrep + c.dOCA + c.dAP + c.dAcc + c.dOCL + c.dONCL;
  c.cfo = c.np + c.dep + c.wc;
  /* capex is inferred: movement in net fixed + intangible assets + D&A charged */
  c.capex = d("fixed_assets") + d("intangibles") + c.dep;
  c.dONCA = -d("other_nca");
  c.cfi = -c.capex + c.dONCA;
  c.dST = d("st_loans"); c.dLT = d("lt_loans");
  c.eqMove = d("te") - is.np;                          // capital injections, dividends, other equity
  c.cff = c.dST + c.dLT + c.eqMove;
  c.net = c.cfo + c.cfi + c.cff;
  c.open = b0.cashAll; c.close = b1.cashAll; c.dCash = c.close - c.open;
  c.unrec = c.dCash - c.net;                          // ≠ 0 only when a balance sheet does not balance
  c.fcf = c.cfo - c.capex;
  return c;
};

/* ---------- comparison bases ---------- */
E.BASES = {
  budget: () => L("Budget","الموازنة"),
  py:     () => L("Prior year","السنة السابقة"),
  prev:   () => L("Previous period","الفترة السابقة")
};

/* combine the income-statement balances of several financial-year segments */
E.plSpan = function(co, sc, a1, a2, opt){
  const A = E.fp(a1), B = E.fp(a2);
  if (A.fy === B.fy) return E.plPeriod(co, sc, A.fy, A.p, B.p, opt);
  const k = ZERO(), notes = []; let status = "actual";
  for (let fy = A.fy; fy <= B.fy; fy++){
    const seg = E.plPeriod(co, sc, fy, fy === A.fy ? A.p : 1, fy === B.fy ? B.p : 12, opt);
    if (!seg) return null;
    for (const f in seg.k) k[f] += seg.k[f] || 0;
    if (seg.status === "estimated") status = "estimated"; else if (seg.status === "derived" && status === "actual") status = "derived";
    if (seg.note && notes.indexOf(seg.note) < 0) notes.push(seg.note);
  }
  return {k, status, note: notes.join(" · ") || undefined};
};

/* a full "view" of one span: statements + derived cash flow */
E.frameSpan = function(co, sc, a1, a2, opt){
  opt = opt || {};
  const A = E.fp(a1), B = E.fp(a2);
  const is = E.incomeStatement(E.plSpan(co, sc, a1, a2, opt));
  let bs = E.balanceSheet(co, sc, B.fy, B.p), bsNote = null;
  if (!bs && opt.bsFallbackYearEnd){ bs = E.balanceSheet(co, sc, B.fy, 12); if (bs) bsNote = L("Balance sheet at year end","الميزانية في نهاية السنة"); }
  let bs0 = E.balanceSheet(co, sc, A.fy, A.p - 1), bs0Note = null;
  /* a budget normally starts from the actual closing position of the month
     before it, so that position is used when no budget opening is loaded */
  if (!bs0 && sc === "budget"){ bs0 = E.balanceSheet(co, "actual", A.fy, A.p - 1); if (bs0) bs0Note = L("Budget opening position taken from actual balances","الوضع الافتتاحي للموازنة مأخوذ من الأرصدة الفعلية"); }
  return {sc, y: B.fy, s: A.fy === B.fy ? A.p : null, e: B.p, a1, a2, days: E.spanDays(co, a1, a2), is, bs, bs0, bsNote, bs0Note, cf: E.cashFlow(is, bs, bs0)};
};
E.frame = (co, sc, y, s, e, opt) => E.frameSpan(co, sc, E.abs(y, s), E.abs(y, e), opt);

E.compareFrame = function(co, period, basis){
  const [a1, a2] = E.span(period), n = a2 - a1 + 1;
  if (basis === "budget") return E.frameSpan(co, "budget", a1, a2);
  if (basis === "py") return E.frameSpan(co, "actual", a1 - 12, a2 - 12, {estimate: true, bsFallbackYearEnd: true});
  /* previous period of the same length; YTD / year / LTM → same period last year */
  if (period.type === "month" || period.type === "quarter" || period.type === "half" || period.type === "custom") return E.frameSpan(co, "actual", a1 - n, a2 - n, {estimate: period.type === "custom"});
  return E.frameSpan(co, "actual", a1 - 12, a2 - 12, {estimate: true});
};
E.basisLabel = function(period, basis){
  if (basis === "prev" && (period.type === "ytd" || period.type === "year")) return L("Same period last year","نفس الفترة من السنة السابقة");
  if (basis === "prev" && period.type === "ltm") return L("Previous 12 months","الأشهر الاثنا عشر السابقة");
  return E.BASES[basis]();
};

/* main entry used by every page */
E.view = function(co, period, basis){
  const [a1, a2] = E.span(period);
  const cur = E.frameSpan(co, "actual", a1, a2);
  const cmp = E.compareFrame(co, period, basis || "budget");
  return {co, period, basis, cur, cmp, label: E.basisLabel(period, basis)};
};

/* monthly series for charts (single-month figures of one financial year) */
E.monthly = function(co, sc, y){
  const out = [];
  for (let m = 1; m <= 12; m++){
    const f = E.frame(co, sc, y, m, m);
    out.push({m, is: f.is, bs: f.bs, f});
  }
  return out;
};

/* ---------- multi-year trend ----------
   One column per financial year: the full year when month 12 is loaded,
   otherwise year to date (flagged partial). */
E.years = function(co, max){
  const am = E.actualMonths(co), ys = Object.keys(am).map(Number).sort((a, b) => a - b).slice(-(max || 5));
  return ys.map(fy => { const last = am[fy][am[fy].length - 1], f = E.frame(co, "actual", fy, 1, last);
    return {fy, last, full: last === 12, f, R: BM.ratios ? BM.ratios(f) : null}; });
};
E.cagr = (first, last, n) => (U.has(first) && U.has(last) && first > 0 && last > 0 && n > 0) ? Math.pow(last / first, 1 / n) - 1 : null;

/* ---------- full-year outlook ----------
   latest estimate = actual year to date + budget for the remaining months
   run-rate        = actual year to date × 12 ÷ months elapsed
   Both are ESTIMATES and are labelled as such; no other assumption is made. */
const IS_NUM = ["sales","service_rev","other_op_rev","rev","cogs","direct_materials","direct_labor","other_direct","cos","gp","salaries","rent","utilities","marketing","transport","admin","other_opex","opex","ebitda","depreciation","ebit","finance_income","finance_costs","fx","other_gl","other_rev","other","pbt","taxes","np"];
const isAdd = (a, b) => { const r = {}; IS_NUM.forEach(f => r[f] = (a[f] || 0) + (b[f] || 0)); return r; };
const isScale = (a, x) => { const r = {}; IS_NUM.forEach(f => r[f] = (a[f] || 0) * x); return r; };
E.outlookFY = function(co, fy, p){
  const ytd = E.incomeStatement(E.plPeriod(co, "actual", fy, 1, p));
  const bud = E.incomeStatement(E.plPeriod(co, "budget", fy, 1, 12));
  const rem = p < 12 ? E.incomeStatement(E.plPeriod(co, "budget", fy, p + 1, 12)) : null;
  const py = E.incomeStatement(E.plPeriod(co, "actual", fy - 1, 1, 12));
  const le = ytd ? (p === 12 ? ytd : rem ? isAdd(ytd, rem) : null) : null;
  const rr = ytd ? (p === 12 ? ytd : isScale(ytd, 12 / p)) : null;
  return {fy, p, ytd, bud, rem, py, le, rr, remStatus: rem && rem.status, budStatus: bud && bud.status};
};
})();
