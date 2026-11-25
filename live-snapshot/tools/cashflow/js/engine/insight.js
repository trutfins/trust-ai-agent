/* =============================================================================
   engine/insight.js — risk engine (§16), management commentary (§17, §18)
   and executive summary (§19).
   Principles
   • every statement is computed from loaded data; causes that the data cannot
     prove are written as hypotheses ("may indicate", "requires further
     investigation")
   • a risk without the data to assess it is listed as "insufficient data",
     never as low risk
   ============================================================================= */
(function(){
const U = BM.U, E = BM.E, AN = BM.AN, IN = BM.IN = {};
const LV = ["low","medium","high","critical"], rank = l => LV.indexOf(l);
const worst = (...ls) => ls.filter(Boolean).sort((a, b) => rank(b) - rank(a))[0] || null;
/* figures inside sentences are wrapped in Unicode isolates (LRI … PDI) so
   signs, % and brackets stay in order inside Arabic text, even as plain text */
const ISO = t => "\u2066" + t + "\u2069";
const P = v => U.has(v) ? ISO((v < 0 ? "−" : "") + Math.abs(v * 100).toFixed(1) + "%") : L("n/a","غ/م");
const Pp = v => U.has(v) ? ISO((v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(1)) + L(" pts"," نقطة") : L("n/a","غ/م");
const M = v => U.has(v) ? ISO(U.numPlain(v * BM.fxFactor()) + " " + BM.reportCurrency().code) : L("n/a","غ/م");
const X = v => U.has(v) ? ISO(v.toFixed(2) + "×") : L("n/a","غ/م");
const D = v => U.has(v) ? ISO(String(Math.round(v))) + L(" days"," يوماً") : L("n/a","غ/م");
IN.fmt = {P, Pp, M, X, D};
IN.LEVEL = {low:["good","LOW","منخفض"], medium:["warn","MEDIUM","متوسط"], high:["bad","HIGH","مرتفع"], critical:["crit","CRITICAL","حرج"]};
IN.levelBadge = l => l ? `<span class="b b-${IN.LEVEL[l][0]}">${L(IN.LEVEL[l][1], IN.LEVEL[l][2])}</span>` : `<span class="b b-mute">${L("Insufficient data","بيانات غير كافية")}</span>`;

/* everything the engines need for one view, computed once */
IN.context = function(view){
  const c = view.cur, R = BM.ratios(c), pr = AN.prior(view);
  const bud = view.basis === "budget" ? view.cmp : E.compareFrame(view.co, view.period, "budget");
  return {view, c, R, is:c.is, bs:c.bs, cf:c.cf && !c.cf.na ? c.cf : null, pr, PR:pr.R, pis:pr.f.is, pbs:pr.bs,
    bud, bis:bud.is, wc:AN.workingCapital(view), ar:AN.receivables(view), ap:AN.payables(view), op:AN.operational(view), t:BM.state.settings.risk};
};

/* ---------------------------- risk engine ---------------------------- */
IN.risks = function(x){
  const {R, is, bs, cf, pis, PR, t} = x, out = [];
  const add = (key, en, ar, level, evidence, impact, action, data) => out.push({key, en, ar, level, evidence, impact, action, data: data !== false && !!level});
  const daily = is && x.c.days ? is.rev / x.c.days : null, dailyCos = is && x.c.days ? is.cos / x.c.days : null;

  /* 1 liquidity */
  { const l = worst(R.cr.level, R.qr.level, R.cashr.level);
    const ev = [L("Current ratio {a} (minimum {m}), quick ratio {b}, cash ratio {c}.","النسبة المتداولة {a} (الحد الأدنى {m})، النسبة السريعة {b}، نسبة النقدية {c}.",{a:X(R.cr.v), m:t.minCurrentRatio, b:X(R.qr.v), c:X(R.cashr.v)})];
    const gap = bs && U.has(R.cr.v) && R.cr.v < t.minCurrentRatio ? t.minCurrentRatio * bs.tcl - bs.tca : null;
    add("liquidity","Liquidity risk","مخاطر السيولة", l, ev,
      gap > 0 ? L("Current assets are {g} short of the level needed for a {m} current ratio.","الأصول المتداولة تنقص {g} عن المستوى اللازم لنسبة متداولة {m}.",{g:M(gap), m:t.minCurrentRatio}) : L("No shortfall against the minimum current ratio.","لا عجز مقارنة بالحد الأدنى للنسبة المتداولة."),
      rank(l) >= 2 ? L("Prepare a 13-week cash forecast, accelerate collections, and agree facility headroom with the bank before obligations fall due.","إعداد توقع نقدي لـ13 أسبوعاً، وتسريع التحصيل، والاتفاق مع البنك على سقف تسهيلات قبل استحقاق الالتزامات.")
        : rank(l) === 1 ? L("Monitor cash weekly and keep the overdraft headroom available.","مراقبة النقد أسبوعياً والحفاظ على هامش السحب على المكشوف.") : L("Maintain current liquidity discipline.","الحفاظ على الانضباط الحالي في السيولة.")); }

  /* 2 profitability */
  { const ref = x.bis || pis, refName = x.bis ? L("budget","الموازنة") : L("prior year","السنة السابقة");
    const gap = is && ref ? is.np - ref.np : null, gp = is && ref && ref.np > 0 ? gap / ref.np : null;
    const l = worst(R.npm.level, R.opm.level, U.has(gp) ? (gp < -0.4 ? "high" : gp < -0.15 ? "medium" : "low") : null);
    add("profitability","Profitability risk","مخاطر الربحية", l,
      [L("Net margin {a}, operating margin {b}.","هامش صافي الربح {a}، الهامش التشغيلي {b}.",{a:P(R.npm.v), b:P(R.opm.v)}) + (U.has(gap) ? " " + L("Net profit {s} {r} by {g}.","صافي الربح {s} {r} بمقدار {g}.",{s: gap >= 0 ? L("above","أعلى من") : L("below","أقل من"), r:refName, g:M(Math.abs(gap))}) : "")],
      U.has(gap) && gap < 0 ? L("Profit shortfall of {g} against {r} for the period.","نقص في الربح بمقدار {g} مقارنة بـ{r} للفترة.",{g:M(-gap), r:refName}) : L("No profit shortfall against {r}.","لا نقص في الربح مقارنة بـ{r}.",{r:refName}),
      rank(l) >= 2 ? L("Review pricing, product and customer profitability, and the largest cost lines; set a recovery plan with monthly milestones.","مراجعة التسعير وربحية المنتجات والعملاء وأكبر بنود التكاليف؛ ووضع خطة تعافٍ بمراحل شهرية.")
        : L("Track margins monthly against budget.","متابعة الهوامش شهرياً مقارنة بالموازنة.")); }

  /* 3 leverage */
  { const l = worst(R.de.level, R.debtr.level);
    const over = bs && bs.te > 0 ? bs.debt - t.maxDebtToEquity * bs.te : null;
    add("leverage","Leverage risk","مخاطر الرافعة المالية", l,
      [L("Debt-to-equity {a} (limit {m}); liabilities are {b} of total assets.","الديون إلى حقوق الملكية {a} (الحد {m})؛ الالتزامات تمثل {b} من إجمالي الأصول.",{a:R.de.nm ? L("not meaningful (negative equity)","غير ذي دلالة (حقوق ملكية سالبة)") : X(R.de.v), m:t.maxDebtToEquity, b:P(R.debtr.v)})],
      over > 0 ? L("Borrowings are {g} above the debt-to-equity limit.","القروض تزيد {g} عن حد الديون إلى حقوق الملكية.",{g:M(over)}) : L("Borrowings are within the debt-to-equity limit.","القروض ضمن حد الديون إلى حقوق الملكية."),
      rank(l) >= 2 ? L("Avoid new borrowing, consider retaining profits or injecting equity, and review loan covenants.","تجنب اقتراض جديد، والنظر في احتجاز الأرباح أو زيادة رأس المال، ومراجعة شروط القروض.") : L("Keep borrowing in line with the agreed limit.","إبقاء الاقتراض ضمن الحد المتفق عليه.")); }

  /* 4 working capital */
  { const w = x.wc, map = {healthy:"low", stable:"low", pressure:"medium", high:"high"};
    let l = w.level ? map[w.level] : null; if (l === "medium" && w.reasons.length >= 3) l = "high"; if (U.has(R.cr.v) && R.cr.v < 0.8 && l) l = "critical";
    const owc = w.rows.find(r => r.key === "owc"), tied = owc && U.has(owc.chg) ? owc.chg : null;
    add("workingcapital","Working capital risk","مخاطر رأس المال العامل", l, w.reasons.length ? w.reasons : [L("Insufficient data","بيانات غير كافية")],
      U.has(tied) ? (tied > 0 ? L("{g} more cash is tied up in operating working capital than at the {n}.","{g} نقد إضافي محتجز في رأس المال العامل التشغيلي مقارنة بـ{n}.",{g:M(tied), n:w.priorNote}) : L("{g} less cash is tied up in operating working capital than at the {n}.","{g} نقد أقل محتجز في رأس المال العامل التشغيلي مقارنة بـ{n}.",{g:M(-tied), n:w.priorNote})) : L("Change against the prior year cannot be calculated.","لا يمكن احتساب التغير مقارنة بالسنة السابقة."),
      rank(l) >= 1 ? L("Set targets for DSO, inventory days and DPO; review credit terms, slow-moving stock and supplier terms.","تحديد مستهدفات لفترة التحصيل وأيام المخزون وفترة السداد؛ ومراجعة شروط الائتمان والمخزون الراكد وشروط الموردين.") : L("Maintain current working-capital discipline.","الحفاظ على الانضباط الحالي في رأس المال العامل.")); }

  /* 5 receivables */
  { const a = x.ar, s = a.aging; let l = R.dso.level;
    if (s && s.pOver90 != null) l = worst(l, s.pOver90 > 0.35 ? "critical" : s.pOver90 > 0.2 ? "high" : s.pOver90 > 0.1 ? "medium" : "low");
    if (U.has(a.growthPY) && U.has(a.revGrowth)){ const g = a.growthPY - a.revGrowth; l = worst(l, g > 0.3 ? "high" : g > 0.15 ? "medium" : null); }
    const ev = [L("DSO {d} (limit {m}); receivables equal {p} of annual revenue.","فترة التحصيل {d} (الحد {m})؛ الذمم المدينة تعادل {p} من الإيراد السنوي.",{d:D(a.dso), m:t.maxDSO, p:P(a.pctRev)})];
    if (U.has(a.growthPY) && U.has(a.revGrowth)) ev.push(L("Receivables grew {a} against revenue growth of {b}.","نمت الذمم المدينة {a} مقابل نمو الإيرادات {b}.",{a:P(a.growthPY), b:P(a.revGrowth)}));
    ev.push(s ? L("Aging: {o} overdue, {n} over 90 days.","الأعمار: {o} متأخر، {n} أكثر من 90 يوماً.",{o:P(s.pOverdue), n:P(s.pOver90)}) : L("No AR aging loaded — overdue analysis not possible.","لا يوجد تقرير أعمار للذمم المدينة — لا يمكن تحليل المتأخرات."));
    const excess = U.has(a.dso) && a.dso > t.maxDSO && daily ? (a.dso - t.maxDSO) * daily : null;
    add("receivables","Receivables risk","مخاطر الذمم المدينة", l, ev,
      excess > 0 ? L("About {g} of receivables sit above the level implied by the {m}-day limit.","حوالي {g} من الذمم المدينة يتجاوز المستوى المقابل لحد {m} يوماً.",{g:M(excess), m:t.maxDSO})
        : (U.has(a.growthPY) && U.has(a.revGrowth) && a.growthPY > a.revGrowth && x.pbs) ? L("Receivables are about {g} higher than if they had grown in line with revenue.","الذمم المدينة أعلى بحوالي {g} مما لو نمت بنفس نسبة الإيرادات.",{g:M(bs.ar - x.pbs.ar * (1 + a.revGrowth))})
        : L("Receivables are within the DSO limit.","الذمم المدينة ضمن حد فترة التحصيل."),
      rank(l) >= 2 ? L("Review the largest overdue accounts weekly, tighten credit limits, and consider guarantees or post-dated cheque policies for slow payers.","مراجعة أكبر الحسابات المتأخرة أسبوعياً، وتشديد حدود الائتمان، والنظر في الضمانات أو سياسة الشيكات المؤجلة للعملاء المتأخرين.")
        : rank(l) === 1 ? L("Follow up the largest overdue balances every month and check that credit terms are applied before new sales.","متابعة أكبر الأرصدة المتأخرة شهرياً والتأكد من تطبيق شروط الائتمان قبل المبيعات الجديدة.") : L("Keep monthly collection follow-up.","الاستمرار في متابعة التحصيل شهرياً.")); }

  /* 6 payables */
  { const a = x.ap; const l = a.pressureLevel;
    const over = U.has(a.dpo) && a.dpo > t.maxDPO && dailyCos ? (a.dpo - t.maxDPO) * dailyCos : null;
    add("payables","Payables risk","مخاطر الذمم الدائنة", l, a.pressure.length ? a.pressure : [L("DPO {d}; no payment-pressure indicator triggered.","فترة السداد {d}؛ لم يظهر أي مؤشر لضغط السداد.",{d:D(a.dpo)})],
      over > 0 ? L("About {g} of payables are beyond the {m}-day limit.","حوالي {g} من الذمم الدائنة تتجاوز حد {m} يوماً.",{g:M(over), m:t.maxDPO}) : L("Payables are within the DPO limit.","الذمم الدائنة ضمن حد فترة السداد."),
      rank(l) >= 2 ? L("Agree a payment schedule with key suppliers to protect supply and credit standing.","الاتفاق على جدول سداد مع الموردين الرئيسيين لحماية التوريد والسمعة الائتمانية.") : L("Keep paying suppliers within agreed terms.","الاستمرار في السداد للموردين ضمن الشروط المتفق عليها.")); }

  /* 7 revenue concentration */
  { const o = x.op, c = o.cust;
    const l = c ? (c.top1 >= 0.4 || c.top5 >= 0.8 ? "high" : c.top1 >= 0.2 || c.top5 >= 0.6 ? "medium" : "low") : null;
    add("concentration","Revenue concentration risk","مخاطر تركز الإيرادات", l,
      c ? [L("Largest customer {a}, top five {b} ({s}).","أكبر عميل {a}، أكبر خمسة {b} ({s}).",{a:P(c.top1), b:P(c.top5), s: o.custSrc === "derived" ? L("receivables proxy","تقريبي من الذمم") : L("revenue by customer","الإيراد حسب العميل")})] : [L("No customer-level data loaded (revenue by customer or AR aging).","لا توجد بيانات على مستوى العملاء (الإيراد حسب العميل أو أعمار الذمم).")],
      c && is ? L("Losing the largest customer would put about {g} of period revenue at risk.","فقدان أكبر عميل يعرّض حوالي {g} من إيرادات الفترة للخطر.",{g:M(c.top1 * is.rev)}) : L("Cannot be quantified without customer data.","لا يمكن تقديرها دون بيانات العملاء."),
      rank(l) >= 2 ? L("Diversify the customer base and review contract terms with the largest customers.","تنويع قاعدة العملاء ومراجعة شروط التعاقد مع أكبر العملاء.") : c ? L("Keep monitoring customer concentration quarterly.","متابعة تركز العملاء ربع سنوياً.") : L("Load revenue by customer on the Operational Analysis page.","حمّل الإيراد حسب العميل في صفحة التحليل التشغيلي."), !!c); }

  /* 8 margin compression */
  { const d = U.sub(R.gm.v, x.PR.gm.v);
    const l = !U.has(d) ? null : d < -0.06 ? "critical" : d < -0.03 ? "high" : d < -0.01 ? "medium" : "low";
    add("margin","Margin compression","انضغاط الهوامش", l, [L("Gross margin {a} against {b} in the prior year ({d}).","الهامش الإجمالي {a} مقابل {b} في السنة السابقة ({d}).",{a:P(R.gm.v), b:P(x.PR.gm.v), d:Pp(d)})],
      U.has(d) && d < 0 && is ? L("At this period's revenue, the lower margin costs about {g} of gross profit.","بإيرادات هذه الفترة، الهامش الأقل يكلف حوالي {g} من مجمل الربح.",{g:M(-d * is.rev)}) : L("No margin loss against the prior year.","لا خسارة في الهامش مقارنة بالسنة السابقة."),
      rank(l) >= 1 ? L("Review selling prices against purchase costs, discounts and product mix; renegotiate with the largest suppliers.","مراجعة أسعار البيع مقابل تكاليف الشراء والخصومات ومزيج المنتجات؛ وإعادة التفاوض مع أكبر الموردين.") : L("Keep monitoring gross margin monthly.","متابعة الهامش الإجمالي شهرياً.")); }

  /* 9 cost growth */
  { const g = is && pis && pis.opex ? U.varPct(is.opex, pis.opex) : null, rg = is && pis && pis.rev ? U.varPct(is.rev, pis.rev) : null, gap = U.has(g) && U.has(rg) ? g - rg : null;
    const l = !U.has(gap) ? null : gap > 0.15 ? "high" : gap > 0.05 ? "medium" : "low";
    const excess = U.has(gap) && gap > 0 ? is.opex - pis.opex * (1 + rg) : null;
    add("costs","Cost growth","نمو التكاليف", l, [L("Operating expenses {a} against revenue {b} versus the prior year.","المصروفات التشغيلية {a} مقابل الإيرادات {b} مقارنة بالسنة السابقة.",{a:P(g), b:P(rg)})],
      excess > 0 ? L("Operating expenses are about {g} higher than if they had grown in line with revenue.","المصروفات التشغيلية أعلى بحوالي {g} مما لو نمت بنفس نسبة الإيرادات.",{g:M(excess)}) : L("Costs grew no faster than revenue.","التكاليف لم تنمُ أسرع من الإيرادات."),
      rank(l) >= 1 ? L("Identify the fastest-growing cost lines, confirm they are needed, and set cost budgets by department.","تحديد أسرع بنود التكاليف نمواً، والتأكد من ضرورتها، ووضع موازنات تكاليف لكل قسم.") : L("Keep cost growth below revenue growth.","إبقاء نمو التكاليف دون نمو الإيرادات."), !!pis); }

  /* 10 debt service */
  { const ebitdaAnn = is && x.c.days ? is.ebitda * 365 / x.c.days : null, dE = bs && ebitdaAnn > 0 ? bs.debt / ebitdaAnn : null;
    const stShare = bs && bs.debt > 0 ? bs.st_loans / bs.debt : null;
    let l = R.icr.level; if (U.has(dE)) l = worst(l, dE > 5 ? "critical" : dE > 4 ? "high" : dE > 3 ? "medium" : "low");
    if (bs && bs.debt > 0 && ebitdaAnn != null && ebitdaAnn <= 0) l = "critical";
    if (!l && bs) l = bs.debt > 0 ? null : "low";
    add("debt","Debt service risk","مخاطر خدمة الدين", l,
      [L("Interest cover {a}; borrowings {b} times annualised EBITDA; {c} of borrowings are short-term.","تغطية الفوائد {a}؛ القروض {b} مرة من EBITDA السنوي؛ {c} من القروض قصيرة الأجل.",{a: U.has(R.icr.v) ? X(R.icr.v) : U.esc(R.icr.why || ""), b:U.has(dE) ? dE.toFixed(1) : L("n/a","غ/م"), c:P(stShare)})],
      is ? L("Finance costs for the period: {g}.","تكاليف التمويل للفترة: {g}.",{g:M(is.finance_costs)}) : L("Not available","غير متوفر"),
      rank(l) >= 2 ? L("Refinance short-term debt into longer tenors where possible and align repayments with operating cash flow.","إعادة تمويل الديون قصيرة الأجل بآجال أطول قدر الإمكان ومواءمة السداد مع التدفق النقدي التشغيلي.") : L("Keep repayments aligned with operating cash flow.","إبقاء الأقساط متوافقة مع التدفق النقدي التشغيلي.")); }

  /* 11 cash flow */
  { let l = null, ev = [];
    if (cf){ l = cf.cfo < 0 ? (U.has(R.cashr.v) && R.cashr.v < 0.1 ? "critical" : "high") : (is && is.np > 0 && cf.cfo / is.np < 0.5 ? "medium" : cf.fcf < 0 ? "medium" : "low");
      ev = [L("Operating cash flow {a} (derived) against net profit {b}; free cash flow {c}.","التدفق النقدي التشغيلي {a} (مشتق) مقابل صافي الربح {b}؛ التدفق النقدي الحر {c}.",{a:M(cf.cfo), b:M(is && is.np), c:M(cf.fcf)})];
      const big = [["dAR",L("receivables","الذمم المدينة")],["dInv",L("inventory","المخزون")],["dAP",L("payables","الذمم الدائنة")]].map(k => [k[1], cf[k[0]]]).sort((a, b) => a[1] - b[1])[0];
      if (big && big[1] < 0) ev.push(L("The largest cash absorption came from {k} ({v}).","أكبر استهلاك للنقد جاء من {k} ({v}).",{k:big[0], v:M(big[1])})); }
    else ev = [L("Cash flow cannot be derived without an opening balance sheet.","لا يمكن اشتقاق التدفق النقدي دون ميزانية افتتاحية.")];
    add("cashflow","Cash flow risk","مخاطر التدفق النقدي", l, ev,
      cf ? (cf.cfo < 0 ? L("Operations consumed {g} of cash in the period.","العمليات استهلكت {g} من النقد خلال الفترة.",{g:M(-cf.cfo)}) : L("Operations generated {g} of cash in the period.","العمليات ولّدت {g} من النقد خلال الفترة.",{g:M(cf.cfo)})) : L("Not available","غير متوفر"),
      rank(l) >= 2 ? L("Release cash from receivables and inventory first; defer non-essential capital spending until operating cash flow is positive.","تحرير النقد من الذمم والمخزون أولاً؛ وتأجيل الإنفاق الرأسمالي غير الضروري حتى يصبح التدفق التشغيلي موجباً.") : L("Keep monitoring the gap between profit and operating cash flow.","متابعة الفجوة بين الربح والتدفق النقدي التشغيلي."), !!cf); }
  return out.sort((a, b) => (b.data - a.data) || (rank(b.level) - rank(a.level)));
};

/* ---------------------------- commentary ---------------------------- */
IN.commentary = function(x){
  const {view, is, R, cf} = x, out = [];
  const basis = view.cmp.is ? view.cmp : null, bName = view.label, py = x.pis;
  const ref = basis ? basis.is : py;
  const refName = !basis ? L("the prior year","السنة السابقة") : view.basis === "budget" ? L("the budget","الموازنة") : view.basis === "py" ? L("the prior year","السنة السابقة")
    : (view.period.type === "ytd" || view.period.type === "year") ? L("the same period last year","نفس الفترة من السنة السابقة") : view.period.type === "ltm" ? L("the previous 12 months","الأشهر الاثني عشر السابقة") : L("the previous period","الفترة السابقة");
  const J = L(", ","، "), J2 = L("; ","؛ ");
  if (!is) return out;
  const pt = (sec, tone, what, why, impact, action) => out.push({sec, tone, what, why, impact, action});
  /* revenue */
  if (ref){
    const d = is.rev - ref.rev, p = U.varPct(is.rev, ref.rev);
    const mv = [["sales",L("sales","المبيعات")],["service_rev",L("service revenue","إيرادات الخدمات")],["other_op_rev",L("other operating revenue","الإيرادات التشغيلية الأخرى")]]
      .map(l => [l[1], is[l[0]] - (ref[l[0]] || 0)]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    let why = Math.abs(d) > 0 && mv[0] && Math.abs(mv[0][1]) > 0 ? L("Most of the movement is in {l} ({v}). ","معظم التغير في {l} ({v}). ",{l:mv[0][0], v:M(mv[0][1])}) : "";
    why += L("The trial balance does not show whether this reflects volume, pricing, new customers or one-off transactions; this requires further investigation with sales data.","ميزان المراجعة لا يبيّن إن كان ذلك ناتجاً عن الكمية أو السعر أو عملاء جدد أو عمليات غير متكررة؛ وهذا يتطلب مزيداً من التحقق من بيانات المبيعات.");
    pt("rev", d >= 0 ? "pos" : "neg",
      L("Revenue was {a}, {b} {dir} {r} ({c}).","بلغت الإيرادات {a}، {dir} {r} بنسبة {b} ({c}).",{a:M(is.rev), b:P(Math.abs(p)), dir: d >= 0 ? L("above","أعلى من") : L("below","أقل من"), r:refName, c:(d >= 0 ? "+" : "−") + M(Math.abs(d))}),
      why,
      L("At the current gross margin of {g}, this difference is worth about {v} of gross profit.","بالهامش الإجمالي الحالي {g}، يعادل هذا الفرق حوالي {v} من مجمل الربح.",{g:P(R.gm.v), v:M(d * (R.gm.v || 0))}),
      d >= 0 ? L("Confirm the growth is recurring and check that it converts into cash: receivables should not grow faster than revenue.","التأكد من أن النمو متكرر وأنه يتحول إلى نقد: يجب ألا تنمو الذمم المدينة أسرع من الإيرادات.")
        : L("Analyse the shortfall by customer and product, and review the sales pipeline for the coming months.","تحليل النقص حسب العميل والمنتج، ومراجعة فرص المبيعات للأشهر القادمة."));
  }
  /* gross margin */
  if (ref && ref.rev > 0 && is.rev > 0){
    const gm0 = ref.gp / ref.rev, d = R.gm.v - gm0;
    const costs = [["cogs",L("cost of goods sold","تكلفة البضاعة المباعة")],["direct_materials",L("direct materials","المواد المباشرة")],["direct_labor",L("direct labour","العمالة المباشرة")],["other_direct",L("other direct costs","التكاليف المباشرة الأخرى")]]
      .map(l => [l[1], is[l[0]] / is.rev - (ref[l[0]] || 0) / ref.rev]).sort((a, b) => b[1] - a[1]);
    pt("gm", d >= -0.002 ? "pos" : "neg",
      L("Gross margin was {a} against {b} for {r} ({d}).","بلغ الهامش الإجمالي {a} مقابل {b} في {r} ({d}).",{a:P(R.gm.v), b:P(gm0), r:refName, d:Pp(d)}),
      (Math.abs(d) > 0.002 && costs[0] && costs[0][1] > 0.002 && d < 0 ? L("{l} rose by {p} of revenue. ","{l} ارتفعت بمقدار {p} من الإيرادات. ",{l:costs[0][0], p:Pp(costs[0][1])}) : "") +
        (d < -0.002 ? L("This may indicate pricing pressure, higher purchase costs or a shift towards lower-margin products; the cause requires further investigation.","قد يشير ذلك إلى ضغط على الأسعار أو ارتفاع تكاليف الشراء أو تحول نحو منتجات أقل هامشاً؛ والسبب يتطلب مزيداً من التحقق.")
          : d > 0.002 ? L("This appears consistent with better pricing, lower purchase costs or a richer mix; confirm which before relying on it.","يبدو ذلك متسقاً مع تسعير أفضل أو تكاليف شراء أقل أو مزيج أفضل؛ يجب التأكد من السبب قبل الاعتماد عليه.") : L("Margin is broadly stable.","الهامش مستقر تقريباً.")),
      L("Each percentage point of margin is worth about {v} on this period's revenue.","كل نقطة مئوية من الهامش تعادل حوالي {v} على إيرادات هذه الفترة.",{v:M(is.rev * 0.01)}),
      d < -0.002 ? L("Review price lists, discounts and supplier costs for the main products.","مراجعة قوائم الأسعار والخصومات وتكاليف الموردين للمنتجات الرئيسية.") : L("Protect the margin in upcoming price and supplier negotiations.","حماية الهامش في مفاوضات الأسعار والموردين القادمة."));
  }
  /* operating expenses */
  if (ref){
    const keys = [["salaries",L("salaries","الرواتب")],["rent",L("rent","الإيجارات")],["utilities",L("utilities","المرافق")],["marketing",L("marketing","التسويق")],["transport",L("transport","النقل")],["admin",L("administrative expenses","المصروفات الإدارية")],["other_opex",L("other operating expenses","المصروفات التشغيلية الأخرى")]];
    const mv = keys.map(k => [k[1], is[k[0]] - (ref[k[0]] || 0)]).filter(m => Math.abs(m[1]) > 0.5).sort((a, b) => b[1] - a[1]);
    const d = is.opex - ref.opex, pc = U.varPct(is.opex, ref.opex), rp = U.varPct(is.rev, ref.rev);
    pt("opex", d <= 0 || (U.has(pc) && U.has(rp) && pc <= rp) ? "pos" : "neg",
      L("Operating expenses were {a}, {b} against {r}, while revenue moved {c}.","بلغت المصروفات التشغيلية {a}، بتغير {b} مقارنة بـ{r}، بينما تغيرت الإيرادات {c}.",{a:M(is.opex), b:P(pc), r:refName, c:P(rp)}),
      mv.length ? L("The largest increases: ","أكبر الزيادات: ") + mv.filter(m => m[1] > 0).slice(0, 3).map(m => m[0] + " +" + M(m[1])).join(J) + (mv.some(m => m[1] > 0) ? "." : L("none.","لا يوجد.")) : L("No significant line movements.","لا تغيرات جوهرية في البنود."),
      L("Operating expenses take {p} of revenue.","المصروفات التشغيلية تستهلك {p} من الإيرادات.",{p:P(is.rev ? is.opex / is.rev : null)}),
      U.has(pc) && U.has(rp) && pc > rp ? L("Confirm each growing cost line is linked to revenue generation; set department cost budgets.","التأكد من ارتباط كل بند تكلفة متزايد بتوليد الإيرادات؛ ووضع موازنات تكاليف للأقسام.") : L("Keep costs growing no faster than revenue.","إبقاء نمو التكاليف دون نمو الإيرادات."));
  }
  /* profit bridge */
  if (ref){
    const br = [[L("gross profit","مجمل الربح"), is.gp - ref.gp],[L("operating expenses","المصروفات التشغيلية"), -(is.opex - ref.opex)],[L("depreciation","الاستهلاك"), -(is.depreciation - ref.depreciation)],
      [L("finance income and costs","إيرادات وتكاليف التمويل"), (is.finance_income - ref.finance_income) - (is.finance_costs - ref.finance_costs)],[L("other items","بنود أخرى"), is.other - ref.other],[L("income tax","ضريبة الدخل"), -(is.taxes - ref.taxes)]];
    const d = is.np - ref.np;
    pt("np", d >= 0 ? "pos" : "neg",
      L("Net profit was {a} against {b} for {r} ({c}).","بلغ صافي الربح {a} مقابل {b} في {r} ({c}).",{a:M(is.np), b:M(ref.np), r:refName, c:(d >= 0 ? "+" : "−") + M(Math.abs(d))}),
      L("Profit bridge: ","جسر الربح: ") + br.filter(b => Math.abs(b[1]) > 0.5).map(b => b[0] + " " + (b[1] >= 0 ? "+" : "−") + M(Math.abs(b[1]))).join(J2) + ".",
      L("Net margin {a}; EBITDA margin {b}.","هامش صافي الربح {a}؛ هامش EBITDA {b}.",{a:P(R.npm.v), b:P(R.ebitdam.v)}),
      d < 0 ? L("Focus on the largest negative item in the bridge first.","التركيز أولاً على أكبر بند سلبي في جسر الربح.") : L("Check that the improvement is sustainable before adjusting forecasts.","التأكد من استدامة التحسن قبل تعديل التوقعات."));
  }
  /* cash */
  if (cf){
    const conv = is.np ? cf.cfo / is.np : null;
    const items = [[L("receivables","الذمم المدينة"), cf.dAR],[L("inventory","المخزون"), cf.dInv],[L("payables","الذمم الدائنة"), cf.dAP],[L("other working-capital items","بنود رأس المال العامل الأخرى"), cf.dPrep + cf.dOCA + cf.dAcc + cf.dOCL + cf.dONCL]].sort((a, b) => a[1] - b[1]);
    pt("cash", cf.cfo >= 0 && (conv == null || conv >= 0.7) ? "pos" : "neg",
      L("Operating cash flow (derived) was {a} against net profit of {b}; cash and bank moved by {c} to {d}.","بلغ التدفق النقدي التشغيلي (مشتق) {a} مقابل صافي ربح {b}؛ وتغير النقد والبنوك بمقدار {c} ليصل إلى {d}.",{a:M(cf.cfo), b:M(is.np), c:M(cf.dCash), d:M(cf.close)}),
      items[0][1] < 0 ? L("The largest use of cash in working capital was {k} ({v}).","أكبر استخدام للنقد في رأس المال العامل كان {k} ({v}).",{k:items[0][0], v:M(items[0][1])}) : L("Working capital released cash in the period.","رأس المال العامل حرّر نقداً خلال الفترة."),
      L("Cash conversion (operating cash flow ÷ net profit): {c}. Free cash flow: {f}.","التحويل النقدي (التدفق التشغيلي ÷ صافي الربح): {c}. التدفق النقدي الحر: {f}.",{c:U.has(conv) ? conv.toFixed(2) + "×" : L("n/a","غ/م"), f:M(cf.fcf)}),
      cf.cfo < is.np ? L("Profit is not fully converting to cash — prioritise collections and stock reduction.","الربح لا يتحول بالكامل إلى نقد — الأولوية للتحصيل وتخفيض المخزون.") : L("Cash generation supports the reported profit.","توليد النقد يدعم الربح المعلن."));
  }
  /* working capital and leverage */
  { const w = x.wc, r = w.rows.reduce((o, z) => (o[z.key] = z, o), {});
    if (U.has(r.ccc.cur)){
      pt("wc", w.level === "healthy" || w.level === "stable" ? "pos" : "neg",
        L("Cash conversion cycle {a} (DSO {b}, inventory days {c}, DPO {d}); working capital is assessed as {s}.","دورة التحول النقدي {a} (التحصيل {b}، المخزون {c}، السداد {d})؛ وتقييم رأس المال العامل: {s}.",{a:D(r.ccc.cur), b:D(r.dso.cur), c:D(r.dio.cur), d:D(r.dpo.cur), s: w.level ? L(AN.WC_LEVEL[w.level][1], AN.WC_LEVEL[w.level][2]).toLowerCase() : "—"}),
        w.reasons.join(" "),
        U.has(r.owc.chg) ? L("Operating working capital changed by {v} against the {n}.","تغير رأس المال العامل التشغيلي بمقدار {v} مقارنة بـ{n}.",{v:M(r.owc.chg), n:w.priorNote}) : L("Change against the prior year not available.","التغير مقارنة بالسنة السابقة غير متوفر."),
        w.level === "pressure" || w.level === "high" ? L("Set DSO and inventory-day targets and review them monthly.","وضع مستهدفات لفترة التحصيل وأيام المخزون ومراجعتها شهرياً.") : L("Maintain the current cycle.","الحفاظ على الدورة الحالية."));
    }
    if (x.bs){
      const dd = x.pbs ? x.bs.debt - x.pbs.debt : null;
      pt("lev", R.de.level === "low" || R.de.level === "medium" ? "pos" : "neg",
        L("Borrowings stand at {a}{c}; debt-to-equity is {b}.","القروض {a}{c}؛ ونسبة الديون إلى حقوق الملكية {b}.",{a:M(x.bs.debt), b: R.de.nm ? L("not meaningful (negative equity)","غير ذي دلالة (حقوق ملكية سالبة)") : X(R.de.v), c: U.has(dd) ? L(", a change of {v} against the {n}","، بتغير {v} مقارنة بـ{n}",{v:M(dd), n:x.pr.note}) : ""}),
        U.has(R.icr.v) ? L("Operating profit covers finance costs {v} times.","الربح التشغيلي يغطي تكاليف التمويل {v} مرة.",{v:R.icr.v.toFixed(1)}) : U.esc(R.icr.why || ""),
        L("Finance costs for the period: {v}.","تكاليف التمويل للفترة: {v}.",{v:M(is.finance_costs)}),
        R.de.level === "high" || R.de.level === "critical" ? L("Reduce reliance on borrowing and review the maturity profile.","تقليل الاعتماد على الاقتراض ومراجعة آجال الاستحقاق.") : L("Keep borrowing within the agreed limit.","إبقاء الاقتراض ضمن الحد المتفق عليه."));
    }
  }
  return out;
};
IN.SECTIONS = {rev:["Revenue","الإيرادات"], gm:["Gross margin","الهامش الإجمالي"], opex:["Operating expenses","المصروفات التشغيلية"], np:["Profitability","الربحية"], cash:["Cash flow","التدفق النقدي"], wc:["Working capital","رأس المال العامل"], lev:["Financing and leverage","التمويل والرافعة المالية"]};

/* AI commentary through the user's own backend — never with a key in the browser */
IN.aiPayload = function(x){
  const v = x.view, is = x.is, b = x.bs;
  return {company:BM.U.nm(v.co.name), period:E.periodLabel(v.period), currency:BM.reportCurrency().code, language:BM.state.settings.lang, comparison:v.label,
    incomeStatement: is ? {revenue:is.rev, grossProfit:is.gp, opex:is.opex, ebitda:is.ebitda, netProfit:is.np} : null,
    comparisonIncomeStatement: v.cmp.is ? {revenue:v.cmp.is.rev, grossProfit:v.cmp.is.gp, opex:v.cmp.is.opex, ebitda:v.cmp.is.ebitda, netProfit:v.cmp.is.np} : null,
    balanceSheet: b ? {totalAssets:b.ta, totalLiabilities:b.tl, equity:b.te, cash:b.cashAll, borrowings:b.debt} : null,
    cashFlowDerived: x.cf ? {operating:x.cf.cfo, investing:x.cf.cfi, financing:x.cf.cff, netChange:x.cf.net, basis:"derived (indirect method) from trial-balance movements — an estimate, not a bank cash book"} : null,
    ratios: Object.fromEntries(Object.entries(x.R).map(([k, r]) => [k, r.v])),
    risks: IN.risks(x).filter(r => r.data).map(r => ({risk:r.en, level:r.level, evidence:r.evidence.join(" ")})),
    localCommentary: IN.commentary(x).map(p => ({section:p.sec, what:p.what, why:p.why, impact:p.impact, action:p.action})),
    instructions:"Write management commentary using only these figures. Explain what happened, why (as hypotheses when not proven), the financial impact and recommended actions. Do not invent causes or numbers."};
};
/* the instruction sent to the TRUST AI service together with the figures */
IN.aiPrompt = function(payload){
  const ar = payload.language === "ar";
  return [
    "You are a senior financial analyst at TRUST (Trust for Accounting & Financial Services), Palestine, writing management commentary for a company's management.",
    "Use ONLY the figures in the JSON below. Never invent numbers, causes, benchmarks or events. When a cause cannot be proven from the figures, present it as a possibility that needs checking.",
    "Distinguish actual figures from derived or estimated ones (the derived cash flow is an estimate). If a figure needed for a point is missing or null, say the data is not available instead of guessing; never give a firm conclusion the data cannot support.",
    ar ? "Use exactly these numbered headings, in this order: 1. ملخص الأداء المالي  2. أهم نقاط القوة  3. أبرز المخاطر  4. مؤشرات تستدعي الانتباه  5. التفسير المالي للنتائج  6. إجراءات عملية مقترحة  7. أولويات التنفيذ  — then a final short line headed «حدود التحليل» stating the assumptions and data limits."
       : "Use exactly these numbered headings, in this order: 1. Financial performance summary  2. Key strengths  3. Main risks  4. Indicators that need attention  5. Financial interpretation of the results  6. Recommended practical actions  7. Implementation priorities  — then a final short line headed 'Limits of this analysis' stating the assumptions and data limits.",
    "Under 6 and 7 give 3–5 concrete actions, ranked by urgency and financial impact. Quote amounts with the currency given and write numbers with Western digits (0-9). Keep it under 650 words. Plain text, no tables, no markdown symbols (no #, *, **).",
    ar ? "Write in clear professional Arabic (Modern Standard Arabic)." : "Write in clear professional English.",
    "", "FIGURES (JSON):", JSON.stringify(payload)
  ].join("\n");
};
IN.callAI = async function(x){
  const s = BM.state.settings.ai;
  const url = BM.aiEndpoint();
  if (!s.enabled || !url) throw new Error(L("AI commentary is off or no endpoint is set (Settings).","التعليق بالذكاء الاصطناعي متوقف أو لا يوجد رابط (الإعدادات)."));
  const trust = BM.aiMode() === "trust", payload = IN.aiPayload(x), headers = {"Content-Type":"application/json"};
  let body = JSON.stringify(payload);
  if (trust){
    /* TRUST AI service (shared with the analysis tool): {prompt} in, {text} out, approved account required */
    const tok = await BM.auth.token(), code = BM.auth.code();
    if (tok) headers.Authorization = "Bearer " + tok; else if (code) headers["x-access-code"] = code;
    else throw new Error(L("Sign in with your TRUST account in Settings → AI commentary.","سجّل الدخول بحساب TRUST من الإعدادات ← التعليق بالذكاء الاصطناعي."));
    body = JSON.stringify({prompt:IN.aiPrompt(payload)});
  }
  let r;
  try { r = await fetch(url, {method:"POST", headers, body}); }
  catch(e){ throw new Error(L("The AI service could not be reached. It answers the platform when it is opened from its TRUST address (trustfins.org).","تعذر الوصول إلى خدمة الذكاء الاصطناعي. تستجيب الخدمة للمنصة عند فتحها من عنوانها على موقع TRUST (trustfins.org).")); }
  if (!r.ok){
    const j = await r.json().catch(() => null), e = j && j.error;
    if (r.status === 401) throw new Error(L("Your TRUST account is not approved for AI services yet, or the session ended. Sign in again in Settings, or ask TRUST to approve the account.","حسابك في TRUST غير معتمد لخدمات الذكاء الاصطناعي بعد، أو انتهت الجلسة. سجّل الدخول مجدداً من الإعدادات، أو اطلب من TRUST اعتماد الحساب."));
    if (r.status === 403) throw new Error(L("This address of the platform is not yet allowed by the TRUST AI service.","عنوان المنصة هذا غير مسموح بعد في خدمة TRUST للذكاء الاصطناعي."));
    if (r.status === 402) throw new Error(L("The free trial allowance of AI requests for this account is used up. Contact TRUST to activate full access.","انتهى رصيد الطلبات المجانية للذكاء الاصطناعي لهذا الحساب. تواصل مع TRUST لتفعيل الوصول الكامل."));
    if (r.status === 429) throw new Error(L("Usage limit reached for now — try again shortly.","تم بلوغ حد الاستخدام مؤقتاً — حاول بعد قليل."));
    console.warn("AI service", r.status, e);
    throw new Error(L("The AI service could not complete the request right now (code {s}). Try again in a few minutes; if it continues, contact TRUST.","تعذّر على خدمة الذكاء الاصطناعي إتمام الطلب الآن (الرمز {s}). حاول بعد دقائق، وإن استمر ذلك فتواصل مع TRUST.",{s:r.status}));
  }
  const j = await r.json().catch(() => null);
  const text = j && (j.text || j.commentary || (Array.isArray(j.sections) ? j.sections.map(s => (s.title ? s.title + "\n" : "") + s.text).join("\n\n") : null));
  if (!text) throw new Error(L("The endpoint did not return a 'text' field.","الخادم لم يرجع حقل 'text'."));
  return String(text);
};

/* ---------------------------- executive summary ---------------------------- */
const LV_SCORE = {low:1, medium:0.6, high:0.25, critical:0};
IN.summary = function(x){
  const risks = IN.risks(x), by = Object.fromEntries(risks.map(r => [r.key, r]));
  const comp = (keys) => { const ls = keys.map(k => by[k] && by[k].data ? LV_SCORE[by[k].level] : null).filter(v => v != null); return ls.length ? ls.reduce((a, b) => a + b, 0) / ls.length : null; };
  const is = x.is, bis = x.bis;
  const plan = is && bis && bis.np ? (is.np >= bis.np ? 1 : U.varPct(is.np, bis.np) > -0.1 ? 0.6 : U.varPct(is.np, bis.np) > -0.25 ? 0.25 : 0) : null;
  const parts = [
    ["Profitability","الربحية",25,comp(["profitability","margin"])],["Liquidity","السيولة",20,comp(["liquidity"])],
    ["Leverage & debt","الرافعة والديون",15,comp(["leverage","debt"])],["Working capital","رأس المال العامل",15,comp(["workingcapital","receivables","payables"])],
    ["Cash flow","التدفق النقدي",15,comp(["cashflow"])],["Delivery against budget","الأداء مقابل الموازنة",10,plan]];
  const used = parts.filter(p => p[3] != null), wsum = used.reduce((s, p) => s + p[2], 0);
  const score = wsum ? Math.round(used.reduce((s, p) => s + p[2] * p[3], 0) / wsum * 100) : null;
  /* positives and concerns — measured movements only */
  const R = x.R, PR = x.PR, pis = x.pis, items = [];
  const mv = (label, a, b, dir, kind, w) => { if (!U.has(a) || !U.has(b) || b === 0 && kind !== "pts") return; const d = kind === "pts" ? a - b : U.varPct(a, b); if (!U.has(d) || Math.abs(d) < (kind === "pts" ? 0.005 : 0.02)) return; items.push({label, d, good: d * dir > 0, w: Math.abs(d) * (w || 1), kind, a, b}); };
  if (is && pis){ mv(L("Revenue vs prior year","الإيرادات مقابل السنة السابقة"), is.rev, pis.rev, 1, "pct", 1.2); mv(L("Gross profit vs prior year","مجمل الربح مقابل السنة السابقة"), is.gp, pis.gp, 1, "pct"); mv(L("Net profit vs prior year","صافي الربح مقابل السنة السابقة"), is.np, pis.np, 1, "pct", 1.1); mv(L("Operating expenses vs prior year","المصروفات التشغيلية مقابل السنة السابقة"), is.opex, pis.opex, -1, "pct"); }
  if (is && bis){ mv(L("Revenue against budget","الإيرادات مقابل الموازنة"), is.rev, bis.rev, 1, "pct", 1.1); mv(L("Net profit against budget","صافي الربح مقابل الموازنة"), is.np, bis.np, 1, "pct", 1.1); }
  mv(L("Gross margin","الهامش الإجمالي"), R.gm.v, PR.gm.v, 1, "pts", 6); mv(L("Net margin","هامش صافي الربح"), R.npm.v, PR.npm.v, 1, "pts", 6);
  mv(L("Current ratio vs prior year","النسبة المتداولة مقابل السنة السابقة"), R.cr.v, PR.cr.v, 1, "pct"); mv(L("DSO vs prior year","فترة التحصيل مقابل السنة السابقة"), R.dso.v, PR.dso.v, -1, "pct"); mv(L("Cash conversion cycle vs prior year","دورة التحول النقدي مقابل السنة السابقة"), R.ccc.v, PR.ccc.v, -1, "pct");
  mv(L("Debt-to-equity vs prior year","الديون إلى حقوق الملكية مقابل السنة السابقة"), R.de.v, PR.de.v, -1, "pct", 0.8);
  if (x.cf){ if (x.cf.cfo > 0) items.push({label:L("Operating cash flow positive","التدفق النقدي التشغيلي موجب"), good:true, w:0.05, txt:M(x.cf.cfo)}); else items.push({label:L("Operating cash flow negative","التدفق النقدي التشغيلي سالب"), good:false, w:0.3, txt:M(x.cf.cfo)}); }
  const fmtItem = i => i.txt ? `${i.label}: ${i.txt}` : i.kind === "pts" ? `${i.label} ${P(i.b)} → ${P(i.a)} (${Pp(i.d)})` : `${i.label} ${ISO((i.d >= 0 ? "+" : "−") + Math.abs(i.d * 100).toFixed(1) + "%")}`;
  const positives = items.filter(i => i.good).sort((a, b) => b.w - a.w).slice(0, 5).map(fmtItem);
  const concerns = items.filter(i => !i.good).sort((a, b) => b.w - a.w).slice(0, 5).map(fmtItem);
  const top = risks.filter(r => r.data && rank(r.level) >= 1).slice(0, 5);
  const priorities = Array.from(new Set(top.map(r => r.action))).slice(0, 5);
  /* outlook — recent momentum only, never a forecast */
  const co = x.view.co, end = E.abs(x.view.period.year, x.view.period.month);
  const mo = []; for (let a = end - 5; a <= end; a++) mo.push(E.frameSpan(co, "actual", a, a));
  let outlook = null;
  if (mo.length >= 6 && mo.every(f => f.is)){
    const a = mo.slice(0, 3), b = mo.slice(3), s = (arr, k) => arr.reduce((t, f) => t + f.is[k], 0);
    const g = U.varPct(s(b, "rev"), s(a, "rev")), m1 = s(a, "gp") / s(a, "rev"), m2 = s(b, "gp") / s(b, "rev");
    const c1 = mo[2].bs && mo[2].bs.cashAll, c2 = mo[5].bs && mo[5].bs.cashAll;
    outlook = L("Over the last three months revenue averaged {r} a month, {g} against the three months before; gross margin moved from {m1} to {m2}; cash and bank moved from {c1} to {c2}. This describes recent momentum only and is not a forecast.","خلال الأشهر الثلاثة الأخيرة بلغ متوسط الإيرادات {r} شهرياً، بتغير {g} مقارنة بالأشهر الثلاثة التي سبقتها؛ وتحرك الهامش الإجمالي من {m1} إلى {m2}؛ وتحرك النقد والبنوك من {c1} إلى {c2}. هذا يصف الزخم الأخير فقط وليس توقعاً.",
      {r:M(s(b, "rev") / 3), g:P(g), m1:P(m1), m2:P(m2), c1:M(c1), c2:M(c2)});
  } else outlook = L("Not enough consecutive monthly data (six months needed) to describe recent momentum. No forecast is made.","لا توجد بيانات شهرية متتالية كافية (ستة أشهر) لوصف الزخم الأخير. لا يتم إعداد أي توقع.");
  return {score, parts, used:used.length, positives, concerns, risks:top, priorities, outlook, allRisks:risks};
};
IN.scoreBand = s => s == null ? null : s >= 80 ? ["good","Strong","قوي"] : s >= 60 ? ["info","Sound","جيد"] : s >= 40 ? ["warn","Under pressure","تحت الضغط"] : ["bad","Weak","ضعيف"];
})();
