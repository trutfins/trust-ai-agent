/* =============================================================================
   engine/aging.js — receivables / payables aging (master prompt §10–§11).
   Two file layouts are understood:
     • invoice list: party · amount outstanding · due date (or invoice date +
       credit terms) → days overdue at the "as at" date → bucket
     • bucket report: party · Current · 1–30 · 31–60 · 61–90 · 91–120 · 120+
   Aging is never generated or estimated: without an aging file the AR/AP
   pages say the analysis cannot be calculated.
   ============================================================================= */
(function(){
const U = BM.U, N = U.norm, AG = BM.AG = {};
AG.BUCKETS = [["Current","غير مستحق"],["1–30","1–30"],["31–60","31–60"],["61–90","61–90"],["91–120","91–120"],["120+","أكثر من 120"]];
AG.bucketLabel = i => L(AG.BUCKETS[i][0], AG.BUCKETS[i][1]);
AG.ROLES = [["ignore","— Ignore —","— تجاهل —"],["party","Customer / supplier","العميل / المورد"],["doc","Document no.","رقم المستند"],
  ["inv_date","Invoice date","تاريخ الفاتورة"],["due_date","Due date","تاريخ الاستحقاق"],["amount","Amount outstanding","المبلغ المستحق"]]
  .concat(AG.BUCKETS.map((b, i) => ["b" + i, "Bucket: " + b[0], "فئة: " + b[1]]));

const B_RX = [[5,/(120\+|over 120|more than 120|> ?120|above 120|121|اكثر من 120|فوق 120|120 فاكثر)/],[4,/(91 120|90 120|^120 days|120 يوم)/],
  [3,/(61 90|60 90|^90 days|90 يوم)/],[2,/(31 60|30 60|^60 days|60 يوم)/],[1,/(1 30|0 30|^30 days|30 يوم)/],[0,/(current|not due|غير مستحق|لم يستحق|^جاري$)/]];
const has = (h, arr) => arr.some(k => h.indexOf(N(k)) >= 0);

AG.detectRoles = function(aoa, hr){
  const head = aoa[hr] || [], body = aoa.slice(hr + 1, hr + 40);
  const ncol = Math.max(head.length, ...body.map(r => r.length));
  const roles = [];
  for (let c = 0; c < ncol; c++){
    const h = N(head[c] instanceof Date ? "" : head[c]); let r = "ignore";
    const b = B_RX.find(x => x[1].test(h));
    if (b) r = "b" + b[0];
    else if (has(h, ["due","استحقاق"])) r = "due_date";
    else if (has(h, ["invoice date","bill date","doc date","تاريخ الفاتوره","تاريخ المستند"]) || h === "date" || h === "التاريخ") r = "inv_date";
    else if (has(h, ["invoice no","invoice number","document","doc no","bill no","reference","ref","رقم الفاتوره","المستند","مرجع"])) r = "doc";
    else if (has(h, ["customer","client","supplier","vendor","party","name","العميل","المورد","الاسم","اسم العميل","اسم المورد","الطرف"])) r = "party";
    else if (has(h, ["outstanding","balance","amount","open","due amount","المبلغ","الرصيد","المتبقي","القيمه"]) && !has(h, ["total","الاجمالي"])) r = "amount";
    roles.push(r);
  }
  const seen = {}; roles.forEach((r, i) => { if (r !== "ignore"){ if (seen[r]) roles[i] = "ignore"; else seen[r] = 1; } });
  return roles;
};

const TOTAL_RX = /^(total|totals|grand total|subtotal|الاجمالي|اجمالي|المجموع|مجموع)(?=\s|$)/;
AG.bucketOf = days => days <= 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : days <= 90 ? 3 : days <= 120 ? 4 : 5;

AG.parse = function(aoa, hr, roles, opts){
  const idx = {}; roles.forEach((r, c) => { if (r !== "ignore") idx[r] = c; });
  const issues = [], byParty = new Map();
  const bucketMode = [0,1,2,3,4,5].some(i => idx["b" + i] != null);
  const asOf = opts.asOf, terms = +opts.terms || 30;
  if (idx.party == null) issues.push(["error","structure",L("Select the customer / supplier column.","حدد عمود العميل / المورد.")]);
  if (!bucketMode && idx.amount == null) issues.push(["error","structure",L("Select an amount column, or the aging bucket columns.","حدد عمود المبلغ أو أعمدة فئات الأعمار.")]);
  if (!bucketMode && idx.amount != null && idx.due_date == null && idx.inv_date == null) issues.push(["error","structure",L("An invoice list needs a due date or an invoice date column.","قائمة الفواتير تحتاج عمود تاريخ الاستحقاق أو تاريخ الفاتورة.")]);
  let bad = 0, badDate = 0, noName = 0, neg = 0, future = 0, totals = 0, docs = 0;
  for (let i = hr + 1; i < aoa.length; i++){
    const row = aoa[i] || [];
    let party = idx.party != null ? String(row[idx.party] == null ? "" : row[idx.party]).trim() : "";
    if (TOTAL_RX.test(N(party))){ totals++; continue; }
    const b = [0,0,0,0,0,0]; let any = false;
    if (bucketMode){
      for (let k = 0; k < 6; k++) if (idx["b" + k] != null){ const p = U.parseNum(row[idx["b" + k]]); if (p.bad) bad++; b[k] = p.v; if (p.v) any = true; }
    } else if (idx.amount != null){
      const p = U.parseNum(row[idx.amount]); if (p.bad) bad++;
      if (!p.v) continue; any = true;
      let due = idx.due_date != null ? U.parseDate(row[idx.due_date]) : null;
      if (!due && idx.inv_date != null){ const d = U.parseDate(row[idx.inv_date]); if (d){ due = new Date(d.getTime() + terms * 864e5); } }
      if (!due){ badDate++; b[0] += p.v; }
      else {
        const days = Math.floor((asOf - due) / 864e5);
        if (idx.inv_date != null){ const d = U.parseDate(row[idx.inv_date]); if (d && d > asOf) future++; }
        b[AG.bucketOf(days)] += p.v;
      }
      docs++;
    }
    if (!any) continue;
    if (!party){ noName++; party = L("(no name)","(بدون اسم)"); }
    if (b.some(x => x < 0)) neg++;
    const key = N(party), x = byParty.get(key);
    if (x) b.forEach((v, k) => x.b[k] += v); else byParty.set(key, {party, b});
  }
  if (bad) issues.push(["error","numbers",L("{n} cell(s) contain text where an amount was expected.","{n} خلية/خلايا تحتوي نصاً بدل مبلغ.",{n:bad})]);
  if (badDate) issues.push(["warning","dates",L("{n} line(s) have no readable date and were treated as current (not yet due).","{n} سطر/أسطر بلا تاريخ مقروء واعتُبرت غير مستحقة.",{n:badDate})]);
  if (future) issues.push(["warning","dates",L("{n} invoice(s) are dated after the “as at” date.","{n} فاتورة/فواتير بتاريخ بعد تاريخ الأعمار.",{n:future})]);
  if (noName) issues.push(["warning","structure",L("{n} line(s) have no customer / supplier name.","{n} سطر/أسطر بدون اسم عميل / مورد.",{n:noName})]);
  if (neg) issues.push(["warning","numbers",L("{n} party balance(s) include negative amounts (credit notes or advances).","{n} رصيد/أرصدة تتضمن مبالغ سالبة (إشعارات دائنة أو دفعات مقدمة).",{n:neg})]);
  if (totals) issues.push(["info","structure",L("{n} total row(s) excluded.","تم استبعاد {n} صف/صفوف إجمالي.",{n:totals})]);
  const rows = Array.from(byParty.values()).map(r => Object.assign(r, {total: r.b.reduce((s, v) => s + v, 0)})).sort((a, b) => b.total - a.total);
  return {rows, issues, mode: bucketMode ? "buckets" : "invoices", docs, errors: issues.filter(i => i[0] === "error").length};
};

/* summary of a stored aging */
AG.summary = function(ag){
  if (!ag || !ag.rows || !ag.rows.length) return null;
  const b = [0,0,0,0,0,0]; ag.rows.forEach(r => r.b.forEach((v, k) => b[k] += v));
  const total = b.reduce((s, v) => s + v, 0), pos = ag.rows.filter(r => r.total > 0), posT = pos.reduce((s, r) => s + r.total, 0);
  const share = n => posT > 0 ? pos.slice(0, n).reduce((s, r) => s + r.total, 0) / posT : null;
  const hhi = posT > 0 ? pos.reduce((s, r) => s + Math.pow(r.total / posT, 2), 0) : null;
  return {b, total, overdue: total - b[0], over90: b[4] + b[5], over120: b[5],
    pOverdue: total ? (total - b[0]) / total : null, pOver90: total ? (b[4] + b[5]) / total : null,
    top1: share(1), top5: share(5), top10: share(10), hhi, parties: ag.rows.length, top: pos.slice(0, 10).map(r => ({party:r.party, total:r.total, share: posT ? r.total / posT : null}))};
};

/* compare the aging total with the trial-balance balance at the same month end */
AG.reconcile = function(co, kind, ag){
  const d = new Date(ag.asOf), y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
  const bs = BM.E.bsCal(co, "actual", y, m);
  if (!bs) return {tb:null};
  const tb = kind === "ar" ? bs.ar : bs.ap, s = AG.summary(ag);
  return {tb, aging: s.total, diff: s.total - tb, ok: Math.abs(s.total - tb) <= Math.max(1, Math.abs(tb) * 0.005)};
};

AG.concentrationLevel = s => !s || s.top1 == null ? null : (s.top1 >= 0.4 || s.top5 >= 0.8) ? "high" : (s.top1 >= 0.2 || s.top5 >= 0.6) ? "medium" : "low";
})();
