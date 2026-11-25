/* =============================================================================
   pages/access.js — إدارة الوصول (TRUST admins only, v3.10).
   The same requests table and decisions as the TRUST analysis tool: approve,
   suspend, give or cancel full access. The server allows these reads and writes
   only to TRUST admins (row-level security); the page is hidden for others.
   ============================================================================= */
(function(){
const U = BM.U, ui = BM.ui, A = BM.auth;
const AC = BM.access = {rows:null, err:"", busy:false};
AC.load = async () => { AC.busy = true; AC.err = ""; BM.render();
  try { AC.rows = await A.adminList(); } catch(e){ console.warn(e); AC.err = L("Could not load the requests.","تعذر تحميل الطلبات."); }
  AC.busy = false; BM.render(); };
AC.set = async (id, patch, label) => {
  try { await A.adminSet(id, patch); BM.toast(label); await AC.load(); }
  catch(e){ console.warn(e); BM.toast(L("The change was not saved.","لم يُحفظ التغيير.")); }
};
const ST = {pending:["Pending approval","بانتظار الموافقة","b-warn"], approved:["Approved","موافق عليه","b-good"], suspended:["Suspended","موقوف","b-bad"]};
BM.PAGES.access = {render(){
  if (!BM.gate.isAdmin()) return {html: ui.banner("warn", L("This page is for TRUST administrators.","هذه الصفحة لمسؤولي TRUST."))};
  if (!AC.rows && !AC.busy && !AC.err) setTimeout(AC.load, 0);
  const rows = AC.rows || [];
  const btn = (r, patch, txt, cls, done) => `<button class="btn sm ${cls || ""}" onclick='BM.access.set(${JSON.stringify(r.user_id)}, ${JSON.stringify(patch)}, ${JSON.stringify(done)})'>${txt}</button>`;
  const tr = r => { const st = ST[r.status] || [r.status, r.status, ""];
    const acts = (r.status !== "approved" ? btn(r, {status:"approved"}, L("Approve","موافقة"), "pri", L("Approved.","تمت الموافقة.")) : btn(r, {status:"suspended"}, L("Suspend","إيقاف"), "danger", L("Suspended.","تم الإيقاف.")))
      + (r.status === "approved" ? (r.full_access ? btn(r, {full_access:false}, L("Cancel full access","إلغاء الكامل"), "", L("Back to trial.","عاد إلى التجربة.")) : btn(r, {full_access:true}, L("Activate full access","تفعيل كامل"), "", L("Full access activated.","تم تفعيل الوصول الكامل."))) : "");
    return `<tr><td>${U.esc(r.full_name || "—")}</td><td dir="ltr" style="text-align:start">${U.esc(r.email || "")}</td><td><span class="b ${st[2]}">${L(st[0], st[1])}</span></td>
      <td>${r.full_access ? `<span class="b b-good">${L("Full","كامل")}</span>` : L("Trial","تجربة")}</td>
      <td class="small">${L("Free analysis: ","تحليل مجاني: ")}${r.free_runs_used || 0} · ${L("AI readings: ","قراءات: ")}${r.ai_calls || 0}</td>
      <td class="small" dir="ltr">${(r.requested_at || "").slice(0,10)}</td><td><div class="row" style="gap:6px;flex-wrap:wrap">${acts}</div></td></tr>`; };
  const html = ui.card(L("Access to the TRUST digital services","إدارة الوصول إلى النظام"),
    (AC.err ? ui.banner("bad", AC.err) : "") + (AC.busy && !AC.rows ? `<p class="muted">${L("Loading…","جارٍ التحميل...")}</p>` :
    rows.length ? `<div class="tw"><table><thead><tr><th>${L("Name","الاسم")}</th><th>${L("E-mail","البريد")}</th><th>${L("Status","الحالة")}</th><th>${L("Full access","الوصول الكامل")}</th><th>${L("Usage","الاستخدام")}</th><th>${L("Requested","تاريخ الطلب")}</th><th>${L("Action","إجراء")}</th></tr></thead><tbody>${rows.map(tr).join("")}</tbody></table></div>`
      : `<p class="muted">${L("No requests yet.","لا توجد طلبات بعد.")}</p>`) +
    `<div class="row" style="margin-top:10px"><button class="btn sm" onclick="BM.access.load()">↻ ${L("Refresh","تحديث")}</button></div>
     <p class="small muted" style="margin:10px 0 0">${L("These are the same accounts and decisions as the TRUST financial & credit analysis tool: approving or suspending here applies to both. «Full access» opens the final report and exports.","هذه نفس الحسابات والقرارات في نظام TRUST للتحليل المالي والائتماني: الموافقة أو الإيقاف هنا تسري على الاثنين. «الوصول الكامل» يفتح التقرير النهائي والتصدير.")}</p>`);
  return {html};
}};
})();
