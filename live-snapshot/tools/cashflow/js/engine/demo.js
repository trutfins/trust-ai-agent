/* =============================================================================
   engine/demo.js — DEMO DATA, FOR ILLUSTRATION ONLY.
   Generates a deterministic, balanced set of monthly trial balances for an
   illustrative Palestinian trading company: actual 2024 and 2025, actual
   Jan–Sep 2026, budgets 2025 and 2026, and the opening balances at 31 Dec 2023.
   The output goes through the same statement engine as uploaded data, so
   demo mode also exercises the real pipeline. It is never stored and never
   mixed with uploaded companies.
   ============================================================================= */
(function(){
function rng(seed){ let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* chart of accounts: code, EN, AR, fsKey */
const COA = [
 ["1101","Cash on hand — head office","الصندوق — الإدارة العامة","cash"],
 ["1111","Bank of Palestine — current account ILS","بنك فلسطين — حساب جاري شيكل","bank"],
 ["1112","Arab Bank — current account USD","البنك العربي — حساب جاري دولار","bank"],
 ["1113","Quds Bank — current account JOD","بنك القدس — حساب جاري دينار","bank"],
 ["1201","Trade receivables","الذمم المدينة التجارية","ar"],
 ["1202","Cheques under collection","شيكات برسم التحصيل","ar"],
 ["1209","Allowance for expected credit losses","مخصص الخسائر الائتمانية المتوقعة","ar"],
 ["1301","Goods for resale","بضاعة بغرض البيع","inventory"],
 ["1302","Goods in transit","بضاعة بالطريق","inventory"],
 ["1401","Prepaid expenses","مصروفات مدفوعة مقدماً","prepayments"],
 ["1402","Advances to suppliers","دفعات مقدمة للموردين","prepayments"],
 ["1451","VAT input tax","ضريبة القيمة المضافة — مدخلات","other_ca"],
 ["1452","Employee advances","سلف الموظفين","other_ca"],
 ["1501","Buildings","مباني","fixed_assets"],
 ["1502","Warehouse equipment","معدات المستودعات","fixed_assets"],
 ["1503","Vehicles","سيارات","fixed_assets"],
 ["1504","Furniture and IT equipment","أثاث وأجهزة حاسوب","fixed_assets"],
 ["1509","Accumulated depreciation","مجمع الاستهلاك","fixed_assets"],
 ["1601","ERP software licence","رخصة برنامج تخطيط الموارد","intangibles"],
 ["1701","Long-term guarantee deposits","تأمينات طويلة الأجل","other_nca"],
 ["2101","Trade payables — suppliers","الذمم الدائنة — الموردون","ap"],
 ["2102","Post-dated cheques payable","شيكات آجلة الدفع","ap"],
 ["2201","Accrued expenses","مصروفات مستحقة","accrued"],
 ["2202","Accrued salaries","رواتب مستحقة","accrued"],
 ["2251","VAT output tax payable","ضريبة القيمة المضافة — مخرجات","other_cl"],
 ["2252","Income tax payable","ضريبة دخل مستحقة","other_cl"],
 ["2301","Overdraft — Bank of Palestine","جاري مدين — بنك فلسطين","st_loans"],
 ["2302","Short-term murabaha — Arab Bank","مرابحة قصيرة الأجل — البنك العربي","st_loans"],
 ["2401","Long-term loan — Quds Bank","قرض طويل الأجل — بنك القدس","lt_loans"],
 ["2501","End-of-service indemnity provision","مخصص تعويض نهاية الخدمة","other_ncl"],
 ["3101","Paid-in capital","رأس المال المدفوع","capital"],
 ["3201","Statutory reserve","الاحتياطي الإجباري","reserves"],
 ["3301","Retained earnings","الأرباح المدورة","retained"],
 ["3401","Dividends declared","توزيعات أرباح معلنة","other_equity"],
 ["4101","Sales — local market","المبيعات — السوق المحلي","sales"],
 ["4102","Sales — export","المبيعات — التصدير","sales"],
 ["4109","Sales returns and discounts","مردودات وخصومات المبيعات","sales"],
 ["4201","Installation and service revenue","إيرادات التركيب والخدمات","service_rev"],
 ["4301","Commission income","إيرادات العمولات","other_op_rev"],
 ["5101","Cost of goods sold","تكلفة البضاعة المباعة","cogs"],
 ["5102","Freight-in and customs clearance","الشحن والتخليص الجمركي للمشتريات","other_direct"],
 ["5103","Direct labour — installation","العمالة المباشرة — التركيب","direct_labor"],
 ["6101","Salaries and wages","الرواتب والأجور","salaries"],
 ["6102","Employee benefits and end-of-service","مزايا الموظفين ونهاية الخدمة","salaries"],
 ["6201","Rent — showroom and warehouse","إيجار المعرض والمستودع","rent"],
 ["6202","Electricity and water","الكهرباء والمياه","utilities"],
 ["6301","Advertising and promotion","الدعاية والإعلان","marketing"],
 ["6401","Transport and delivery","النقل والتوصيل","transport"],
 ["6501","Depreciation and amortisation","الاستهلاك والإطفاء","depreciation"],
 ["6601","Professional and audit fees","الأتعاب المهنية والتدقيق","admin"],
 ["6602","Telephone and internet","الهاتف والإنترنت","admin"],
 ["6603","Office supplies and printing","القرطاسية والمطبوعات","admin"],
 ["6604","Bank charges and commissions","العمولات البنكية","admin"],
 ["6901","Maintenance and other expenses","الصيانة ومصروفات أخرى","other_opex"],
 ["7101","Interest on bank deposits","فوائد الودائع البنكية","finance_income"],
 ["7201","Interest and finance costs","الفوائد وتكاليف التمويل","finance_costs"],
 ["7301","Foreign exchange differences","فروقات العملة","fx"],
 ["7501","Other income","إيرادات أخرى","other_rev"],
 ["8101","Income tax expense","مصروف ضريبة الدخل","taxes"]
];

const SEASON = [0.86, 0.88, 1.02, 1.08, 1.04, 0.96, 0.92, 0.98, 1.06, 1.08, 1.04, 1.08];

function run(state, year, months, p, rand, emit){
  for (let m = 1; m <= months; m++){
    if (m === 1){ state.reStart += state.npYear - state.divYear; state.npYear = 0; state.divYear = 0; state.ytd = {}; }
    const noise = 1 + (p.noise ? (rand() - 0.5) * p.noise : 0);
    const R = p.rev * SEASON[m - 1] * noise;
    const gm = p.gm(m) + (p.noise ? (rand() - 0.5) * 0.01 : 0);
    const C = R * (1 - gm);
    const flows = {
      "4101": -0.71*R, "4102": -0.13*R, "4109": 0.02*R, "4201": -0.15*R, "4301": -0.03*R,
      "5101": 0.86*C, "5102": 0.09*C, "5103": 0.05*C,
      "6101": p.sal, "6102": p.sal*0.14, "6201": 22000, "6202": 7600 + R*0.002,
      "6301": R*p.mkt, "6401": R*0.018, "6501": state.fa*0.10/12 + 2500,
      "6601": 9000, "6602": 3800, "6603": 2600, "6604": 2400 + R*0.0015, "6901": 6500 + R*0.002,
      "7101": -state.cash*0.012/12, "7201": state.st*0.075/12 + state.lt*0.065/12,
      "7301": (rand() - 0.5) * 9000, "7501": -1500 - rand()*2500
    };
    let pbt = 0; for (const k in flows) pbt -= flows[k];
    flows["8101"] = Math.max(0, pbt * 0.15);
    const np = pbt - flows["8101"];
    for (const k in flows) state.ytd[k] = (state.ytd[k] || 0) + flows[k];
    state.npYear += np;
    /* balance-sheet drivers */
    const dso = p.dso(m), dio = p.dio, dpo = p.dpo;
    state.ar = R * 12 * dso / 365; state.inv = C * 12 * dio / 365; state.ap = C * 12 * dpo / 365;
    state.prep = R * 0.30; state.oca = R * 0.07; state.acc = (p.sal * 1.14 + 24000) * 0.9; state.ocl = R * 0.09 + Math.max(0, pbt) * 0.15 * 2;
    state.fa += p.capex; state.accDep += flows["6501"] - 2500; state.intg = Math.max(0, state.intg - 2500);
    state.oncl += p.sal * 0.045; state.lt = Math.max(0, state.lt - p.ltRepay);
    if (p.divMonth === m){ state.divYear += p.div; }
    const equity = state.cap + state.res + state.reStart - state.divYear + state.npYear;
    const nonCash = state.ar + state.inv + state.prep + state.oca + (state.fa - state.accDep) + state.intg + state.onca;
    const liab = state.ap + state.acc + state.ocl + state.st + state.lt + state.oncl;
    state.cash = liab + equity - nonCash;
    /* revolving facility keeps a minimum cash buffer; draws and repayments flow through financing */
    const minCash = p.rev * 0.22;
    if (state.cash < minCash){ const d = minCash - state.cash; state.st += d; state.cash += d; }
    else if (state.st > 0 && state.cash > minCash * 2.2){ const r = Math.min(state.st, state.cash - minCash * 2.2); state.st -= r; state.cash -= r; }
    emit(year, m, snapshotOf(state));
  }
}
function snapshotOf(s){
  const b = {};
  b["1101"] = s.cash*0.04; b["1111"] = s.cash*0.52; b["1112"] = s.cash*0.30; b["1113"] = s.cash*0.14;
  b["1201"] = s.ar*0.88; b["1202"] = s.ar*0.17; b["1209"] = -s.ar*0.05;
  b["1301"] = s.inv*0.82; b["1302"] = s.inv*0.18; b["1401"] = s.prep*0.6; b["1402"] = s.prep*0.4;
  b["1451"] = s.oca*0.7; b["1452"] = s.oca*0.3;
  b["1501"] = s.fa*0.45; b["1502"] = s.fa*0.30; b["1503"] = s.fa*0.15; b["1504"] = s.fa*0.10; b["1509"] = -s.accDep;
  b["1601"] = s.intg; b["1701"] = s.onca;
  b["2101"] = -s.ap*0.75; b["2102"] = -s.ap*0.25; b["2201"] = -s.acc*0.55; b["2202"] = -s.acc*0.45;
  b["2251"] = -s.ocl*0.6; b["2252"] = -s.ocl*0.4; b["2301"] = -s.st*0.4; b["2302"] = -s.st*0.6;
  b["2401"] = -s.lt; b["2501"] = -s.oncl;
  b["3101"] = -s.cap; b["3201"] = -s.res; b["3301"] = -s.reStart; b["3401"] = s.divYear;
  for (const k in s.ytd) b[k] = s.ytd[k];
  for (const k in b) b[k] = Math.round(b[k] * 100) / 100;
  /* rounding residual (a few agorot) goes to cash on hand so every demo trial balance balances exactly */
  let t = 0; for (const k in b) t += b[k]; b["1101"] = Math.round((b["1101"] - t) * 100) / 100;
  return b;
}

BM.buildDemo = function(){
  const co = {id:"demo", demo:true, name:{en:"Demo Company (illustrative)", ar:"شركة تجريبية (للتوضيح)"},
    currency:"ILS", industry:"trading", accounts:{}, snapshots:{}, imports:[]};
  COA.forEach(a => co.accounts[a[0]] = {code:a[0], name:a[1], nameAr:a[2], fsKey:a[3], conf:"manual"});
  const put = (sc, kind) => (y, m, bal) => {
    co.snapshots[BM.E.key(sc, y, m)] = {scenario:sc, year:y, month:m, bal, hasBS:true, hasPL:kind !== "opening", kind, source:"demo", at:"demo"};
  };
  const s = {cash:0, ar:0, inv:0, prep:0, oca:0, fa:2400000, accDep:620000, intg:90000, onca:50000,
    ap:0, acc:0, ocl:0, st:350000, lt:1200000, oncl:210000, cap:2000000, res:300000, reStart:0, npYear:0, divYear:0, ytd:{}};
  /* opening position at 31 Dec 2023 — retained earnings is the balancing figure */
  const R0 = 1150000, R23 = 1020000;
  s.fa = 2280000; s.accDep = 560000; s.intg = 120000; s.st = 300000; s.lt = 1440000; s.oncl = 180000;
  s.ar = R23*12*68/365; s.inv = R23*0.71*12*60/365; s.ap = R23*0.71*12*58/365; s.prep = R23*0.3; s.oca = R23*0.07;
  s.acc = 95000; s.ocl = R23*0.09; s.cash = R23*0.32;
  const nonCash = s.ar + s.inv + s.prep + s.oca + (s.fa - s.accDep) + s.intg + s.onca;
  s.reStart = s.cash + nonCash - (s.ap + s.acc + s.ocl + s.st + s.lt + s.oncl) - s.cap - s.res;
  put("actual","opening")(2023, 12, snapshotOf(s));
  run(s, 2024, 12, {rev:1085000, gm:()=>0.298, sal:90000, mkt:0.022, dso:()=>69, dio:61, dpo:57, capex:24000, ltRepay:20000, divMonth:4, div:180000, noise:0.06}, rng(20241231), put("actual","closing"));
  run(JSON.parse(JSON.stringify(s)), 2025, 12, {rev:R0*1.04, gm:()=>0.30, sal:95000, mkt:0.024, dso:()=>68, dio:60, dpo:58, capex:28000, ltRepay:20000, divMonth:4, div:220000, noise:0}, rng(5), put("budget","closing"));
  const r = rng(20260930);
  run(s, 2025, 12, {rev:R0, gm:()=>0.292, sal:96000, mkt:0.024, dso:()=>72, dio:62, dpo:56, capex:28000, ltRepay:20000, divMonth:4, div:220000, noise:0.06}, r, put("actual","closing"));
  const budgetStart = JSON.parse(JSON.stringify(s));
  run(s, 2026, 9, {rev:R0*1.07, gm:m=>0.284 - m*0.0025, sal:104000, mkt:0.03, dso:m=>74 + m*1.6, dio:66, dpo:52, capex:31000, ltRepay:20000, divMonth:4, div:250000, noise:0.06}, r, put("actual","closing"));
  run(budgetStart, 2026, 12, {rev:R0*1.12, gm:()=>0.30, sal:101000, mkt:0.026, dso:()=>70, dio:60, dpo:58, capex:30000, ltRepay:20000, divMonth:4, div:250000, noise:0}, rng(7), put("budget","closing"));
  /* illustrative aging at 30 Sep 2026 — generic demo parties, buckets sum to the trial-balance balances */
  const bs = BM.E.balanceSheet(co, "actual", 2026, 9), r2 = rng(99), ytdRev = BM.E.incomeStatement(BM.E.plPeriod(co, "actual", 2026, 1, 9)).rev;
  const mk = (kind, total, n, w) => {
    const raw = Array.from({length:n}, (_, i) => Math.pow(0.78, i) * (0.8 + r2() * 0.4)), t = raw.reduce((a, b) => a + b, 0);
    return {asOf:"2026-09-30", mode:"buckets", source:"demo", at:"demo", rows: raw.map((v, i) => {
      const amt = total * v / t, b = w.map(x => x * (0.7 + r2() * 0.6)), s = b.reduce((a, c) => a + c, 0);
      return {party:(kind === "ar" ? L("Demo customer ","عميل تجريبي ") : L("Demo supplier ","مورد تجريبي ")) + String(i + 1).padStart(2, "0"), b:b.map(x => amt * x / s), total:amt};
    })};
  };
  co.aging = {ar: mk("ar", bs.ar, 18, [0.42,0.22,0.13,0.09,0.06,0.08]), ap: mk("ap", bs.ap, 12, [0.55,0.25,0.11,0.05,0.02,0.02])};
  /* fix rounding so the aging totals equal the trial balance exactly */
  ["ar","ap"].forEach(k => { const ag = co.aging[k], tot = k === "ar" ? bs.ar : bs.ap, s = ag.rows.reduce((a, r) => a + r.total, 0); ag.rows[0].b[0] += tot - s; ag.rows[0].total += tot - s; });
  co.ops = {headcount:{}, byCustomer:{label:L("Demo — year to date Sep 2026","تجريبي — منذ بداية السنة حتى سبتمبر 2026"), rows: co.aging.ar.rows.map((r, i) => [r.party, Math.round(ytdRev * r.total / bs.ar * (1 + (i % 3 - 1) * 0.08))])}};
  for (let y = 2023; y <= 2026; y++) for (let m = 1; m <= 12; m++){ if (y === 2023 && m < 12) continue; if (y === 2026 && m > 9) break; co.ops.headcount[y + "-" + m] = 31 + Math.round((y - 2025) * 12 * 0.25 + m * 0.25); }
  return co;
};
})();
