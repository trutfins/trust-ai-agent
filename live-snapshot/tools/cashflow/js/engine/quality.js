/* =============================================================================
   engine/quality.js — Data Quality Center (master prompt §25).
   Quality Score 0–100 = sum of five weighted components, each shown with its
   own evidence so the score can be traced:
     Trial balance balances        30
     Mapping completeness          25   (share of balances in mapped accounts)
     File structure                20   (codes, names, numbers, duplicates)
     Accounting consistency        15   (A = L + E, unexpected signs)
     Periods & comparatives        10   (budget, prior year, monthly continuity)
   ============================================================================= */
(function(){
const U = BM.U, E = BM.E;

BM.quality = function(co, fy){
  const issues = [], parts = [];
  const push = (sev, cat, msg) => issues.push({sev, cat, msg});
  const snaps = Object.values(co.snapshots);
  const actual = snaps.filter(s => s.scenario === "actual" && s.kind !== "pl-only");
  if (!snaps.length){
    return {score:0, parts:[], issues:[{sev:"error", cat:"periods", msg:L("No data loaded for this company.","لا توجد بيانات محمّلة لهذه الشركة.")}]};
  }

  /* 1. trial balance */
  let ok = 0;
  actual.forEach(s => {
    const a = E.agg(co, s), tol = Math.max(1, a.dr * 1e-5);
    if (Math.abs(a.tb) <= tol) ok++;
    else push("error","balance", L("{p}: debits and credits differ by {x}.","{p}: الفرق بين المدين والدائن {x}.",{p:U.month(s.month, true)+" "+s.year, x:U.numPlain(a.tb, 2)}));
  });
  const p1 = actual.length ? 30 * ok / actual.length : 0;
  parts.push({key:"tb", w:30, got:p1, en:"Trial balance balances", ar:"توازن ميزان المراجعة",
    detail: L("{a} of {b} actual trial balances balance","{a} من {b} موازين مراجعة فعلية متوازنة",{a:ok, b:actual.length})});

  /* 2. mapping — measured on the latest actual snapshot by absolute value */
  const latest = E.latest(co);
  const ref = (latest && E.snap(co, "actual", latest.year, latest.month)) || snaps[0];
  let tot = 0, mapped = 0, guessed = 0, unmappedCodes = [];
  for (const c in ref.bal){
    const a = co.accounts[c]; if (!a || a.excluded) continue;
    const v = Math.abs(ref.bal[c]); tot += v;
    if (a.fsKey){ mapped += v; if (a.conf === "code") guessed += v; } else if (ref.bal[c]) unmappedCodes.push(c);
  }
  const allAcc = Object.values(co.accounts).filter(a => !a.excluded);
  const nUn = allAcc.filter(a => !a.fsKey).length, nGuess = allAcc.filter(a => a.conf === "code").length;
  const share = tot ? (mapped - guessed * 0.5) / tot : 1;
  parts.push({key:"map", w:25, got:25 * Math.max(0, share), en:"Mapping completeness", ar:"اكتمال تصنيف الحسابات",
    detail: L("{a}% of balances mapped · {u} unmapped · {g} code guesses","{a}% من الأرصدة مصنفة · {u} غير مصنف · {g} تخمين من الرقم",{a:tot ? (100*mapped/tot).toFixed(1) : "100", u:nUn, g:nGuess})});
  if (nUn) push("error","mapping", L("{n} account(s) are unmapped: ","{n} حساب/حسابات غير مصنفة: ",{n:nUn}) + allAcc.filter(a => !a.fsKey).slice(0,12).map(a => a.code).join(", "));
  if (nGuess) push("warning","mapping", L("{n} account(s) were classified from the code number only and need review.","{n} حساب/حسابات صُنفت من الرقم فقط وتحتاج مراجعة.",{n:nGuess}));

  /* 3. structure — from the import logs */
  let p3 = 20;
  if (!co.demo){
    const seen = new Set();
    (co.imports || []).slice(0, 5).forEach(im => (im.issues || []).forEach(i => {
      if (["structure","numbers","duplicates"].indexOf(i[1]) < 0) return;
      const k = i[2]; if (seen.has(k)) return; seen.add(k);
      p3 -= i[0] === "error" ? 6 : 2;
      push(i[0], i[1], im.file + ": " + i[2]);
    }));
  }
  parts.push({key:"struct", w:20, got:Math.max(0, p3), en:"File structure", ar:"سلامة بنية الملف",
    detail: p3 >= 20 ? L("No missing codes, invalid numbers or duplicates","لا رموز ناقصة أو أرقام غير صالحة أو تكرار") : L("Issues found in the latest imports","توجد ملاحظات في آخر عمليات الاستيراد")});

  /* 4. accounting consistency */
  let p4 = 15;
  if (latest){
    const b = E.balanceSheet(co, "actual", latest.year, latest.month);
    if (b && Math.abs(b.diff) > 1){
      p4 -= 10;
      push("error","accounting", L("Balance sheet does not balance at {p}: assets − (liabilities + equity) = {x}{u}.","الميزانية غير متوازنة في {p}: الأصول − (الالتزامات + حقوق الملكية) = {x}{u}.",
        {p:E.pDate(latest.year, latest.month, false, co), x:U.numPlain(b.diff), u: b.unmappedN ? L(" — unmapped accounts hold {y}"," — الحسابات غير المصنفة تحمل {y}",{y:U.numPlain(b.unmapped)}) : ""}));
    }
    if (b){
      const neg = [];
      if (b.cash < -1) neg.push(L("cash on hand","النقد في الصندوق"));
      if (b.bank < -1) neg.push(L("bank balances (an overdraft may be mapped as bank)","أرصدة البنوك (قد يكون جاري مدين مصنفاً كبنك)"));
      if (b.ar < -1) neg.push(L("receivables","الذمم المدينة"));
      if (b.inventory < -1) neg.push(L("inventory","المخزون"));
      if (b.fixed_assets < -1) neg.push(L("fixed assets","الأصول الثابتة"));
      if (b.ap < -1) neg.push(L("payables (debit balance)","الذمم الدائنة (رصيد مدين)"));
      if (neg.length){ p4 -= Math.min(5, neg.length * 2); push("warning","accounting", L("Unexpected negative balance: ","رصيد سالب غير متوقع: ") + neg.join("، ")); }
    }
    const is = E.incomeStatement(E.plPeriod(co, "actual", latest.year, 1, latest.month));
    if (is && is.rev < 0){ p4 -= 3; push("warning","accounting", L("Revenue is negative year-to-date — check revenue mapping and sign convention.","الإيرادات سالبة منذ بداية السنة — تحقق من تصنيف الإيرادات واتجاه الإشارة.")); }
  }
  parts.push({key:"acct", w:15, got:Math.max(0, p4), en:"Accounting consistency", ar:"الاتساق المحاسبي",
    detail: p4 >= 15 ? L("Assets = Liabilities + Equity; no unexpected signs","الأصول = الالتزامات + حقوق الملكية؛ لا إشارات غير متوقعة") : L("See accounting issues below","راجع الملاحظات المحاسبية أدناه")});

  /* 5. periods and comparatives */
  let p5 = 0;
  const y = fy || (latest && latest.year);
  if (y){
    const fyOf = s => E.toFis(co, s.year, s.month).fy, yn = E.fyName(y, co), pyn = E.fyName(y - 1, co);
    const hasBud = snaps.some(s => s.scenario === "budget" && fyOf(s) === y);
    const hasPY = snaps.some(s => s.scenario === "actual" && fyOf(s) === y - 1 && s.hasPL);
    if (hasBud) p5 += 4; else push("warning","periods", L("No budget loaded for {y} — budget comparisons show N/A.","لا توجد موازنة محمّلة لسنة {y} — مقارنات الموازنة تظهر غير متوفر.",{y:yn}));
    if (hasPY) p5 += 4; else push("warning","periods", L("No prior-year ({y}) data loaded — prior-year comparisons show N/A.","لا توجد بيانات للسنة السابقة ({y}) — مقارنات السنة السابقة تظهر غير متوفر.",{y:pyn}));
    const am = (E.actualMonths(co)[y] || []);
    const gaps = []; for (let m = 1; m <= (am[am.length-1] || 0); m++) if (am.indexOf(m) < 0) gaps.push(E.pm(m, false, co));
    if (!gaps.length) p5 += 2; else push("warning","periods", L("Missing monthly trial balances in {y}: {m}. Single-month figures for the following month cannot be calculated.","موازين مراجعة شهرية ناقصة في {y}: {m}. لا يمكن احتساب أرقام الشهر التالي منفرداً.",{y:yn, m:gaps.join("، ")}));
    const hasOpen = !!E.balanceSheet(co, "actual", y, 0);
    if (!hasOpen) push("info","periods", L("No opening balance sheet for {y} ({p}). The cash flow for periods starting in {m} and averages use closing balances only.","لا توجد ميزانية افتتاحية لسنة {y} ({p}). التدفقات النقدية للفترات التي تبدأ في {m} والمتوسطات تستخدم الأرصدة الختامية فقط.",{y:yn, p:E.fyEndLabel(y - 1, co), m:E.fyStartName(co)}));
  }
  parts.push({key:"per", w:10, got:p5, en:"Periods & comparatives", ar:"الفترات وبيانات المقارنة",
    detail: L("Budget, prior year and monthly continuity","الموازنة والسنة السابقة واستمرارية الأشهر")});

  const score = Math.round(parts.reduce((s, p) => s + p.got, 0));
  const order = {error:0, warning:1, info:2};
  issues.sort((a, b) => order[a.sev] - order[b.sev]);
  return {score, parts, issues};
};
})();
