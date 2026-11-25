/* =============================================================================
   engine/ratios.js — ratio engine (master prompt §8 and §31).
   Rules:
   • a ratio that cannot be computed returns v = null with a reason (why);
     it is shown as N/A, never as 0
   • a negative denominator (e.g. negative equity) gives "not meaningful"
   • flows (revenue, profit, cost of sales) are annualised with 365 / days
     in the period for return and turnover ratios
   • averages use (opening + closing) / 2; when the opening balance sheet is
     missing, the closing balance is used and the ratio is flagged
   ============================================================================= */
(function(){
const U = BM.U, E = BM.E;

BM.RATIO_DEFS = [
 // key, group, EN, AR, formula EN, formula AR, unit, direction (+1 higher is better)
 ["cr","liq","Current ratio","النسبة المتداولة","Current assets ÷ Current liabilities","الأصول المتداولة ÷ الالتزامات المتداولة","x",1],
 ["qr","liq","Quick ratio","النسبة السريعة","(Current assets − Inventory) ÷ Current liabilities","(الأصول المتداولة − المخزون) ÷ الالتزامات المتداولة","x",1],
 ["cashr","liq","Cash ratio","نسبة النقدية","Cash and bank ÷ Current liabilities","النقد والبنوك ÷ الالتزامات المتداولة","x",1],
 ["gm","prof","Gross margin","هامش الربح الإجمالي","Gross profit ÷ Revenue × 100","مجمل الربح ÷ الإيرادات × 100","pct",1],
 ["opm","prof","Operating margin","هامش الربح التشغيلي","Operating profit ÷ Revenue × 100","الربح التشغيلي ÷ الإيرادات × 100","pct",1],
 ["ebitdam","prof","EBITDA margin","هامش EBITDA","EBITDA ÷ Revenue × 100","EBITDA ÷ الإيرادات × 100","pct",1],
 ["npm","prof","Net profit margin","هامش صافي الربح","Net profit ÷ Revenue × 100","صافي الربح ÷ الإيرادات × 100","pct",1],
 ["roa","prof","Return on assets (ROA)","العائد على الأصول","Net profit (annualised) ÷ Average total assets","صافي الربح (سنوي) ÷ متوسط إجمالي الأصول","pct",1],
 ["roe","prof","Return on equity (ROE)","العائد على حقوق الملكية","Net profit (annualised) ÷ Average equity","صافي الربح (سنوي) ÷ متوسط حقوق الملكية","pct",1],
 ["debtr","lev","Debt ratio","نسبة المديونية","Total liabilities ÷ Total assets","إجمالي الالتزامات ÷ إجمالي الأصول","pct",-1],
 ["de","lev","Debt-to-equity","الديون إلى حقوق الملكية","Total borrowings ÷ Equity","إجمالي القروض ÷ حقوق الملكية","x",-1],
 ["icr","lev","Interest coverage","تغطية الفوائد","Operating profit ÷ Finance costs","الربح التشغيلي ÷ تكاليف التمويل","x",1],
 ["at","eff","Asset turnover","دوران الأصول","Revenue (annualised) ÷ Average total assets","الإيرادات (سنوية) ÷ متوسط الأصول","x",1],
 ["art","eff","Receivable turnover","دوران الذمم المدينة","Revenue (annualised) ÷ Average receivables","الإيرادات (سنوية) ÷ متوسط الذمم المدينة","x",1],
 ["it","eff","Inventory turnover","دوران المخزون","Cost of sales (annualised) ÷ Average inventory","تكلفة المبيعات (سنوية) ÷ متوسط المخزون","x",1],
 ["apt","eff","Payable turnover","دوران الذمم الدائنة","Cost of sales (annualised) ÷ Average payables","تكلفة المبيعات (سنوية) ÷ متوسط الذمم الدائنة","x",0],
 ["dso","wc","Days sales outstanding (DSO)","متوسط فترة التحصيل","Average receivables ÷ Revenue × Days","متوسط الذمم المدينة ÷ الإيرادات × عدد الأيام","days",-1],
 ["dpo","wc","Days payables outstanding (DPO)","متوسط فترة السداد","Average payables ÷ Cost of sales × Days","متوسط الذمم الدائنة ÷ تكلفة المبيعات × عدد الأيام","days",0],
 ["dio","wc","Inventory days","أيام المخزون","Average inventory ÷ Cost of sales × Days","متوسط المخزون ÷ تكلفة المبيعات × عدد الأيام","days",-1],
 ["ccc","wc","Cash conversion cycle","دورة التحول النقدي","DSO + Inventory days − DPO","فترة التحصيل + أيام المخزون − فترة السداد","days",-1]
];
BM.RATIO_GROUPS = {liq:["Liquidity","السيولة"],prof:["Profitability","الربحية"],lev:["Leverage","الرافعة المالية"],eff:["Efficiency","الكفاءة"],wc:["Working capital","رأس المال العامل"]};
BM.RATIO_BY = Object.fromEntries(BM.RATIO_DEFS.map(r => [r[0], r]));

BM.ratios = function(f){
  const is = f && f.is, b = f && f.bs, b0 = f && f.bs0, R = {};
  const days = f ? f.days : 0, ann = days ? 365 / days : null;
  const avg = k => {
    if (!b) return {v:null};
    if (!b0) return {v:b[k], closing:true};
    return {v:(b[k] + b0[k]) / 2};
  };
  const put = (k, d, extra) => { R[k] = Object.assign({v:d.v, why:d.why, nm:!!d.nm}, extra || {}); };
  const noIS = {v:null, why:L("Income statement not available for this period","قائمة الدخل غير متوفرة لهذه الفترة")};
  const noBS = {v:null, why:L("Balance sheet not available for this period","الميزانية غير متوفرة لهذه الفترة")};
  const revZ = L("Revenue is zero","الإيرادات صفر"), cosZ = L("Cost of sales is zero","تكلفة المبيعات صفر");

  /* liquidity */
  if (b){
    const clZ = {zero:L("No current liabilities","لا توجد التزامات متداولة")};
    put("cr", U.div(b.tca, b.tcl, clZ));
    put("qr", U.div(b.tca - b.inventory, b.tcl, clZ));
    put("cashr", U.div(b.cashAll, b.tcl, clZ));
    put("debtr", U.div(b.tl, b.ta));
    put("de", U.div(b.debt, b.te, {posDen:true, neg:L("Not meaningful — equity is negative","غير ذي دلالة — حقوق الملكية سالبة")}));
  } else ["cr","qr","cashr","debtr","de"].forEach(k => put(k, noBS));

  /* profitability */
  if (is){
    put("gm", U.div(is.gp, is.rev, {zero:revZ, posDen:true}));
    put("opm", U.div(is.ebit, is.rev, {zero:revZ, posDen:true}));
    put("ebitdam", U.div(is.ebitda, is.rev, {zero:revZ, posDen:true}));
    put("npm", U.div(is.np, is.rev, {zero:revZ, posDen:true}));
    put("icr", is.finance_costs > 0 ? U.div(is.ebit, is.finance_costs) : {v:null, why:L("No finance costs in this period","لا توجد تكاليف تمويل في هذه الفترة")});
  } else ["gm","opm","ebitdam","npm","icr"].forEach(k => put(k, noIS));

  /* returns and turnover — need both statements */
  const both = is && b;
  const turn = (num, k, opt) => {
    if (!both) return {v:null, why:(!is ? noIS : noBS).why};
    const a = avg(k); const d = U.div(num * ann, a.v, opt); if (a.closing && U.has(d.v)) d.closing = true; return d;
  };
  const withFlag = (k, d) => put(k, d, d.closing ? {closing:true} : null);
  withFlag("roa", turn(is ? is.np : 0, "ta", {posDen:true}));
  withFlag("roe", turn(is ? is.np : 0, "te", {posDen:true, neg:L("Not meaningful — equity is negative","غير ذي دلالة — حقوق الملكية سالبة")}));
  withFlag("at", turn(is ? is.rev : 0, "ta"));
  withFlag("art", turn(is ? is.rev : 0, "ar", {zero:L("No receivables","لا توجد ذمم مدينة")}));
  withFlag("it", turn(is ? is.cos : 0, "inventory", {zero:L("No inventory","لا يوجد مخزون")}));
  withFlag("apt", turn(is ? is.cos : 0, "ap", {zero:L("No payables","لا توجد ذمم دائنة")}));

  /* working-capital days */
  const daysOf = (k, den, zr) => {
    if (!both) return {v:null, why:(!is ? noIS : noBS).why};
    const a = avg(k); const d = U.div(a.v, den, {zero:zr, posDen:true});
    if (U.has(d.v)){ d.v = d.v * days; if (a.closing) d.closing = true; }
    return d;
  };
  withFlag("dso", daysOf("ar", is ? is.rev : 0, revZ));
  withFlag("dpo", daysOf("ap", is ? is.cos : 0, cosZ));
  withFlag("dio", daysOf("inventory", is ? is.cos : 0, cosZ));
  const ccc = U.add(R.dso.v, R.dio.v, U.has(R.dpo.v) ? -R.dpo.v : null);
  put("ccc", U.has(ccc) ? {v:ccc} : {v:null, why:L("Needs DSO, inventory days and DPO","يتطلب فترة التحصيل وأيام المخزون وفترة السداد")}, (R.dso.closing || R.dpo.closing) ? {closing:true} : null);

  for (const k in R){ R[k].level = BM.ratioRisk(k, R[k]); }
  return R;
};

/* risk level per ratio (master prompt §16 scale). null = no risk reading */
BM.ratioRisk = function(k, r){
  const t = BM.state.settings.risk, v = r.v;
  if (r.nm) return (k === "de" || k === "roe") ? "critical" : "high";
  if (!U.has(v)) return null;
  switch(k){
    case "cr":  return v < 0.8 ? "critical" : v < 1 ? "high" : v < t.minCurrentRatio ? "medium" : "low";
    case "qr":  return v < 0.4 ? "high" : v < t.minQuickRatio ? "medium" : "low";
    case "cashr": return v < 0.05 ? "high" : v < 0.15 ? "medium" : "low";
    case "gm":  return v < 0 ? "critical" : v < 0.1 ? "high" : v < 0.2 ? "medium" : "low";
    case "opm": case "ebitdam": return v < -0.05 ? "critical" : v < 0 ? "high" : v < 0.05 ? "medium" : "low";
    case "npm": return v < -0.05 ? "critical" : v < 0 ? "high" : v < 0.03 ? "medium" : "low";
    case "roa": return v < 0 ? "high" : v < 0.03 ? "medium" : "low";
    case "roe": return v < 0 ? "high" : v < 0.06 ? "medium" : "low";
    case "debtr": return v > 0.9 ? "critical" : v > 0.75 ? "high" : v > 0.6 ? "medium" : "low";
    case "de":  return v > t.maxDebtToEquity * 2 ? "critical" : v > t.maxDebtToEquity ? "high" : v > t.maxDebtToEquity * 0.7 ? "medium" : "low";
    case "icr": return v < 1 ? "critical" : v < 1.5 ? "high" : v < t.minInterestCover ? "medium" : "low";
    case "dso": return v > t.maxDSO * 1.5 ? "high" : v > t.maxDSO ? "medium" : "low";
    case "dpo": return v > t.maxDPO ? "high" : v > t.maxDPO * 0.8 ? "medium" : "low";
    case "dio": return v > 180 ? "high" : v > 120 ? "medium" : "low";
    case "ccc": return v > 150 ? "high" : v > 90 ? "medium" : "low";
    default: return null;
  }
};

/* plain-language reading of a ratio, based only on its value and movement */
BM.ratioReading = function(k, r, prev){
  const v = r.v;
  if (r.nm) return L("Equity is negative, so this ratio has no meaning. The company's liabilities exceed its assets.","حقوق الملكية سالبة، لذا لا معنى لهذه النسبة. التزامات الشركة تتجاوز أصولها.");
  if (!U.has(v)) return r.why || L("Insufficient data","بيانات غير كافية");
  const lv = r.level, mv = U.has(prev) ? v - prev : null, dir = (BM.RATIO_BY[k] || [])[7];
  let move = "";
  if (U.has(mv) && dir){
    const better = mv * dir > 0;
    if (Math.abs(mv) > (BM.RATIO_BY[k][6] === "pct" ? 0.005 : BM.RATIO_BY[k][6] === "days" ? 2 : 0.05))
      move = better ? L(" Improved against the prior year."," تحسنت مقارنة بالسنة السابقة.") : L(" Deteriorated against the prior year."," تراجعت مقارنة بالسنة السابقة.");
  }
  const base = {
    cr: lv === "low" ? L("Current assets cover short-term obligations with headroom.","الأصول المتداولة تغطي الالتزامات قصيرة الأجل بهامش مريح.")
      : lv === "medium" ? L("Short-term obligations are covered, with limited headroom.","الالتزامات قصيرة الأجل مغطاة لكن بهامش محدود.")
      : L("Current liabilities are close to or above current assets — short-term liquidity pressure.","الالتزامات المتداولة قريبة من الأصول المتداولة أو تتجاوزها — ضغط على السيولة قصيرة الأجل."),
    qr: lv === "low" ? L("Obligations can be met without relying on selling inventory.","يمكن الوفاء بالالتزامات دون الاعتماد على بيع المخزون.")
      : L("Meeting short-term obligations depends on converting inventory to cash.","الوفاء بالالتزامات قصيرة الأجل يعتمد على تحويل المخزون إلى نقد."),
    cashr: lv === "low" ? L("Cash holdings give a reasonable buffer.","النقد المتوفر يمنح هامش أمان معقول.") : L("Cash covers only a small part of current liabilities.","النقد يغطي جزءاً صغيراً من الالتزامات المتداولة."),
    gm: v < 0 ? L("Sales do not cover their direct cost.","المبيعات لا تغطي تكلفتها المباشرة.") : L("Share of revenue left after direct costs.","نسبة الإيراد المتبقية بعد التكاليف المباشرة."),
    opm: v < 0 ? L("Operations are loss-making before financing and tax.","العمليات تحقق خسارة قبل التمويل والضريبة.") : L("Profit earned from core operations per unit of revenue.","الربح من العمليات الأساسية لكل وحدة إيراد."),
    ebitdam: v < 0 ? L("Operating cash earnings are negative.","الأرباح التشغيلية النقدية سالبة.") : L("Operating earnings before depreciation, a proxy for operating cash generation.","الأرباح التشغيلية قبل الاستهلاك، مؤشر تقريبي لتوليد النقد التشغيلي."),
    npm: v < 0 ? L("The period closed with a net loss.","أغلقت الفترة بصافي خسارة.") : L("Share of revenue retained as net profit.","نسبة الإيراد المتبقية كصافي ربح."),
    roa: L("Annualised profit generated per unit of assets.","الربح السنوي المتولد لكل وحدة أصول."),
    roe: L("Annualised return to shareholders on their equity.","العائد السنوي للمساهمين على حقوقهم."),
    debtr: lv === "low" ? L("Assets are mostly funded by equity.","الأصول ممولة بمعظمها من حقوق الملكية.") : L("A large share of assets is funded by liabilities.","جزء كبير من الأصول ممول بالالتزامات."),
    de: lv === "low" ? L("Borrowing is moderate relative to equity.","الاقتراض معتدل مقارنة بحقوق الملكية.") : L("Borrowing is high relative to equity.","الاقتراض مرتفع مقارنة بحقوق الملكية."),
    icr: lv === "low" ? L("Operating profit covers finance costs comfortably.","الربح التشغيلي يغطي تكاليف التمويل بشكل مريح.") : L("Operating profit gives thin cover for finance costs.","الربح التشغيلي يغطي تكاليف التمويل بهامش ضيق."),
    at: L("Revenue generated per unit of assets.","الإيراد المتولد لكل وحدة أصول."),
    art: L("How many times receivables are collected in a year.","عدد مرات تحصيل الذمم المدينة في السنة."),
    it: L("How many times inventory is sold and replaced in a year.","عدد مرات بيع المخزون وتجديده في السنة."),
    apt: L("Measured on cost of sales, since purchases are not available in a trial balance.","محسوب على تكلفة المبيعات لعدم توفر المشتريات في ميزان المراجعة."),
    dso: lv === "low" ? L("Collection period is within the configured limit.","فترة التحصيل ضمن الحد المحدد.") : L("Customers take longer to pay than the configured limit.","العملاء يتأخرون في السداد أكثر من الحد المحدد."),
    dpo: lv === "high" ? L("Suppliers are paid slowly — this may indicate payment pressure.","السداد للموردين بطيء — قد يشير إلى ضغط في السداد.") : L("Average time taken to pay suppliers.","متوسط الوقت المستغرق للسداد للموردين."),
    dio: L("Average days inventory is held before sale.","متوسط أيام الاحتفاظ بالمخزون قبل البيع."),
    ccc: lv === "low" ? L("Cash is tied up in operations for a short time.","النقد محتجز في العمليات لفترة قصيرة.") : L("Cash is tied up in receivables and inventory for a long time.","النقد محتجز في الذمم والمخزون لفترة طويلة.")
  }[k] || "";
  return base + move + (r.closing ? L(" (closing balance used — opening not available)"," (استُخدم الرصيد الختامي — الافتتاحي غير متوفر)") : "");
};
})();
