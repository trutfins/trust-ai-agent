/* =============================================================================
   core/gate.js — sign-in, access approval and account security (v3.10).
   The same procedures as the TRUST financial & credit analysis tool:
   • create an account (full name, e-mail, password of 8+ characters, consent),
     confirm the e-mail, then wait for TRUST to approve the access request;
   • sign in / forgot password (e-mailed link) / set a new password;
   • pending → "request under review", suspended → "access stopped";
   • approved accounts use the platform; the final report and exports need
     full access (activated by TRUST); TRUST admins manage requests.
   Approval, suspension and the admin rights are decided on the server
   (Supabase row-level security + analysis_tier / analysis_is_admin), not here.
   ============================================================================= */
(function(){
const U = BM.U, A = BM.auth;
const G = BM.gate = {view:"login", msg:"", err:"", busy:false, tier:null, status:null, checkedAt:0, email:""};
const WA = "https://wa.me/970599371188", CONTACT = "https://trustfins.org/contact";
const esc = U.esc;

function root(){ let r = document.getElementById("gate"); if (!r){ r = document.createElement("div"); r.id = "gate"; r.setAttribute("role","main"); document.body.appendChild(r); } return r; }
function show(on){ const app = document.querySelector(".app"); if (app) app.hidden = !!on; root().hidden = !on; }

const field = (id, label, type, extra) => `<label class="gf"><span>${label}</span><input class="in" id="${id}" type="${type}" ${extra || ""}></label>`;
function frame(title, sub, body){
  return `<div class="gbox"><div class="gbrand">${BM.logo(44)}<div><b dir="ltr">TRUST</b><span>${U.nm(BM.BRAND.product)}</span></div></div>
    <h1>${title}</h1>${sub ? `<p class="gsub">${sub}</p>` : ""}
    ${G.err ? `<div class="gmsg bad" role="alert">${G.err}</div>` : ""}${G.msg ? `<div class="gmsg ok" role="status">${G.msg}</div>` : ""}
    ${body}
    <p class="gfoot">${L("Your company files stay in this browser on this device and are lost if its data is cleared; keep your original files. AI commentary, if you switch it on, sends summary figures to TRUST's AI service. TRUST keeps only your account and access status.","تبقى ملفات شركتك في هذا المتصفح على هذا الجهاز وتُفقد إذا مُسحت بياناته؛ احتفظ بملفاتك الأصلية. التعليق بالذكاء الاصطناعي، إن فعّلته، يرسل أرقاماً ملخصة إلى خدمة TRUST. تحتفظ TRUST فقط بحسابك وحالة وصولك.")}
    <br><a class="glink" href="https://trustfins.org/">⌂ ${L("TRUST main site","الموقع الرئيسي")}</a> · <button class="glink" type="button" onclick="BM.gate.lang()">${U.isAr() ? "English" : "العربية"}</button></p></div>`;
}

function html(){
  const v = G.view, busy = G.busy ? "disabled" : "";
  if (v === "checking") return frame(L("Checking access…","جارٍ التحقق من صلاحية الوصول..."), "", `<div class="gspin" aria-hidden="true"></div>`);
  if (v === "login") return frame(L("Sign in","تسجيل الدخول"), L("Sign in with your TRUST account — the same account as the TRUST financial & credit analysis tool.","سجّل الدخول بحسابك في TRUST — نفس حساب نظام TRUST للتحليل المالي والائتماني."),
    `<form onsubmit="event.preventDefault();BM.gate.signIn()">${field("gEmail", L("E-mail","البريد الإلكتروني"), "email", `autocomplete="email" dir="ltr" required value="${esc(G.email)}"`)}
     ${field("gPass", L("Password","كلمة المرور"), "password", `autocomplete="current-password" dir="ltr" required`)}
     <button class="btn pri gbtn" ${busy}>${L("Sign in","دخول")}</button></form>
     <div class="glinks"><button class="glink" type="button" onclick="BM.gate.go('forgot')">${L("Forgot the password","نسيت كلمة المرور")}</button>
     <button class="glink" type="button" onclick="BM.gate.go('signup')">${L("No account: request access","ليس لدي حساب: طلب وصول جديد")}</button></div>`);
  if (v === "signup") return frame(L("Request access","طلب الوصول"), L("Create an account to request access. Access is activated after TRUST approves it.","أنشئ حساباً لطلب الوصول. يُفعَّل الوصول بعد موافقة إدارة TRUST."),
    `<form onsubmit="event.preventDefault();BM.gate.signUp()">${field("gName", L("Full name","الاسم الكامل"), "text", `autocomplete="name" required`)}
     ${field("gEmail", L("E-mail","البريد الإلكتروني"), "email", `autocomplete="email" dir="ltr" required value="${esc(G.email)}"`)}
     ${field("gPass", L("Password (8 characters or more)","كلمة المرور (8 أحرف فأكثر)"), "password", `autocomplete="new-password" dir="ltr" minlength="8" required`)}
     <label class="gchk"><input type="checkbox" id="gOk"> <span>${L("I agree that the summary figures I choose to send for AI commentary may be processed by an AI service (Anthropic) through TRUST. My files stay in my browser and TRUST does not store them on its servers.","أوافق على أن الأرقام الملخّصة التي أختار إرسالها للتعليق بالذكاء الاصطناعي قد تُعالَج بواسطة خدمة ذكاء اصطناعي (Anthropic) عبر TRUST. تبقى ملفاتي في متصفحي ولا تخزّنها TRUST على خوادمها.")}</span></label>
     <button class="btn pri gbtn" ${busy}>${L("Create account and request access","إنشاء حساب وطلب الوصول")}</button></form>
     <div class="glinks"><button class="glink" type="button" onclick="BM.gate.go('login')">${L("I have an account: sign in","لدي حساب: دخول")}</button></div>`);
  if (v === "forgot") return frame(L("Forgot the password","نسيت كلمة المرور"), L("Write your e-mail. If it is registered, a link to set a new password will reach you.","اكتب بريدك. إن كان البريد مسجلاً فسيصلك رابط لتعيين كلمة مرور جديدة."),
    `<form onsubmit="event.preventDefault();BM.gate.recover()">${field("gEmail", L("E-mail","البريد الإلكتروني"), "email", `autocomplete="email" dir="ltr" required value="${esc(G.email)}"`)}
     <button class="btn pri gbtn" ${busy}>${L("Send the link","إرسال الرابط")}</button></form>
     <div class="glinks"><button class="glink" type="button" onclick="BM.gate.go('login')">${L("Back to sign in","العودة إلى الدخول")}</button></div>`);
  if (v === "reset") return frame(L("Set a new password","تعيين كلمة مرور جديدة"), "",
    `<form onsubmit="event.preventDefault();BM.gate.reset()">${field("gPass", L("New password (8 characters or more)","كلمة المرور الجديدة (8 أحرف فأكثر)"), "password", `autocomplete="new-password" dir="ltr" minlength="8" required`)}
     ${field("gPass2", L("Repeat the new password","أعد كتابة كلمة المرور الجديدة"), "password", `autocomplete="new-password" dir="ltr" minlength="8" required`)}
     <button class="btn pri gbtn" ${busy}>${L("Save and continue","حفظ ومتابعة")}</button></form>`);
  const who = esc((A.user() || {}).email || "");
  const out = `<div class="glinks"><button class="glink" type="button" onclick="BM.gate.signOut()">${L("Sign out","تسجيل خروج")} (${who})</button></div>`;
  if (v === "pending") return frame(L("Your request is under review","طلبك قيد المراجعة"), L("An access request was recorded for your account ({e}). TRUST will activate access after approval; then press «Check again».","سُجّل طلب الوصول لحسابك ({e}). ستفعّل إدارة TRUST الوصول بعد الموافقة، ثم اضغط «تحقق مرة أخرى».",{e:who}),
    `<button class="btn pri gbtn" onclick="BM.gate.check()">${L("Check again","تحقق مرة أخرى")}</button>${contact()}${out}`);
  if (v === "suspended") return frame(L("Your access has been stopped","تم إيقاف وصولك"), L("For enquiries contact TRUST.","للاستفسار تواصل مع إدارة TRUST."), contact() + out);
  return frame(L("Could not verify","تعذر التحقق"), L("Your account status could not be checked right now. Reload the page and try again.","تعذر التحقق من حالة حسابك الآن. أعد تحميل الصفحة وحاول مرة أخرى."),
    `<button class="btn pri gbtn" onclick="BM.gate.check()">${L("Try again","حاول مرة أخرى")}</button>${out}`);
}
const contact = () => `<div class="gcontact"><a class="btn" href="${WA}" target="_blank" rel="noopener">${L("Contact us on WhatsApp","تواصل معنا عبر واتساب")}</a><a class="btn" href="${CONTACT}" target="_blank" rel="noopener">${L("Contact page","صفحة التواصل")}</a></div>`;

let KEEP = null;  /* what the user typed, put back after a repaint on the same screen */
function paint(){ root().innerHTML = html(); show(true);
  if (KEEP && KEEP._view === G.view) root().querySelectorAll("input").forEach(i => { if (i.id in KEEP){ if (i.type === "checkbox") i.checked = !!KEEP[i.id]; else if (!i.value) i.value = KEEP[i.id]; } }); const f = root().querySelector("input:not([type=checkbox])"); if (f && !f.value) setTimeout(() => f.focus(), 30); }
G.go = v => { KEEP = null; G.view = v; G.err = ""; G.msg = ""; const e = document.getElementById("gEmail"); if (e && e.value) G.email = e.value.trim(); paint(); };
G.lang = () => { BM.state.settings.lang = U.isAr() ? "en" : "ar"; BM.saveSettings(); document.documentElement.lang = BM.state.settings.lang; document.documentElement.dir = U.isAr() ? "rtl" : "ltr"; paint(); };
/* the form is read before the screen repaints (a repaint clears the inputs) */
let F = {};
const val = id => (id in F ? F[id] : ((document.getElementById(id) || {}).value || ""));
const busy = async (fn) => { F = {}; root().querySelectorAll("input").forEach(i => { F[i.id] = i.type === "checkbox" ? i.checked : i.value; });
  KEEP = Object.assign({_view:G.view}, F); G.busy = true; G.err = ""; G.msg = ""; paint();
  try { await fn(); } finally { F = {}; G.busy = false; if (!G.err) KEEP = null; if (G.view !== "granted") paint(); } };

/* plain-language messages — never the raw service text */
function why(e, ctx){
  const m = String(e && e.message || ""), c = e && e.code || "";
  if (/invalid/i.test(m) || c === "invalid_credentials") return L("Wrong sign-in details.","بيانات الدخول غير صحيحة.");
  if (/not confirmed/i.test(m) || c === "email_not_confirmed") return L("This e-mail is not confirmed yet. Open the confirmation message we sent, then sign in.","هذا البريد غير مؤكَّد بعد. افتح رسالة التأكيد المرسلة إليك ثم سجّل الدخول.");
  if (c === "user_already_exists" || /already registered/i.test(m)) return L("This e-mail is already registered with TRUST. Sign in with the same password, or press «Forgot the password».","هذا البريد مسجّل مسبقاً في TRUST. سجّل الدخول بكلمة المرور نفسها، أو اضغط «نسيت كلمة المرور».");
  if (c === "weak_password" || /password/i.test(m) && /short|weak|least/i.test(m)) return L("The password is too weak. Use 8 characters or more, mixing letters and numbers.","كلمة المرور ضعيفة. استخدم 8 أحرف فأكثر مع خليط من الحروف والأرقام.");
  if (c === "same_password" || /different from the old/i.test(m)) return L("The new password must be different from the current one.","يجب أن تختلف كلمة المرور الجديدة عن الحالية.");
  if (e && e.status === 429 || /rate|too many/i.test(m)) return L("Too many attempts. Wait a few minutes and try again.","محاولات كثيرة. انتظر بضع دقائق ثم حاول مجدداً.");
  if (/fetch|network|load failed/i.test(m)) return L("No connection to TRUST. Check the internet connection and try again.","لا يوجد اتصال بخدمة TRUST. تحقّق من الاتصال بالإنترنت وحاول مجدداً.");
  console.warn("auth", ctx, e);
  return ctx === "save" ? L("Could not save. Request a new link.","تعذر الحفظ. اطلب رابطاً جديداً.") : ctx === "send" ? L("Could not send — try again shortly.","تعذر الإرسال، حاول بعد قليل.") : L("Something went wrong — try again shortly.","حدث خطأ — حاول بعد قليل.");
}

G.signIn = () => busy(async () => { const e = val("gEmail").trim(), p = val("gPass"); G.email = e;
  if (!e || !p) { G.err = L("Complete the fields.","أكمل الحقول."); return; }
  try { await A.signIn(e, p); } catch(err){ G.err = why(err); return; }
  await G.check(); });
G.signUp = () => busy(async () => { const n = val("gName").trim(), e = val("gEmail").trim(), p = val("gPass"); G.email = e;
  if (!n || !e || !p) { G.err = L("Complete the fields.","أكمل الحقول."); return; }
  if (p.length < A.MIN_PW) { G.err = L("The password must be 8 characters or more.","كلمة المرور 8 أحرف على الأقل."); return; }
  if (!val("gOk")) { G.err = L("Agreement to the AI processing is needed to create the account.","يلزم الموافقة على معالجة البيانات بالذكاء الاصطناعي لإنشاء الحساب."); return; }
  let r; try { r = await A.signUp(e, p, n); } catch(err){ G.err = why(err); return; }
  if (r.confirm){ G.view = "login"; G.msg = L("Account created. Open your e-mail and confirm the address, then sign in.","تم إنشاء الحساب. افتح بريدك وأكّد العنوان ثم سجّل الدخول."); return; }
  await G.check(); });
G.recover = () => busy(async () => { const e = val("gEmail").trim(); G.email = e;
  if (!e) { G.err = L("Write your e-mail first.","اكتب بريدك أولاً."); return; }
  try { await A.recover(e); G.msg = L("If the e-mail is registered, a link to set a new password will reach you.","إن كان البريد مسجلاً فسيصلك رابط لتعيين كلمة مرور جديدة."); } catch(err){ G.err = why(err, "send"); } });
G.reset = () => busy(async () => { const p = val("gPass"), p2 = val("gPass2");
  if (p.length < A.MIN_PW) { G.err = L("The password must be 8 characters or more.","كلمة المرور 8 أحرف على الأقل."); return; }
  if (p !== p2) { G.err = L("The two passwords do not match.","كلمتا المرور غير متطابقتين."); return; }
  try { await A.setPassword(p); } catch(err){ G.err = why(err, "save"); return; }
  BM.toast && BM.toast(L("Password saved.","تم حفظ كلمة المرور.")); await G.check(); });
G.signOut = () => { A.signOut(); G.tier = null; G.status = null; G.view = "login"; G.err = ""; G.msg = ""; paint(); };

/* decide what this account may do; the server answers */
G.check = async () => {
  G.view = "checking"; G.err = ""; paint();
  try {
    if (!(await A.token())) { G.view = "login"; return paint(); }
    await A.me();
    const t = await A.tier(); G.tier = t || {};
    const row = t && t.admin ? (await A.access().catch(() => null)) : await A.ensureRequest();
    G.status = t && t.admin ? "approved" : (row && row.status) || "pending";
    G.checkedAt = Date.now();
    if (G.status === "approved") return G.grant();
    G.view = G.status === "suspended" || G.status === "rejected" ? "suspended" : "pending"; paint();
  } catch(err){ if (err && err.status === 401){ A.signOut(); G.view = "login"; G.err = L("Your session ended. Sign in again.","انتهت الجلسة. سجّل الدخول مجدداً."); return paint(); }
    console.warn("access check", err); G.view = "error"; paint(); }
};
G.grant = () => { G.view = "granted"; root().innerHTML = ""; show(false); BM.refreshNav && BM.refreshNav(); if (G.onGrant){ const f = G.onGrant; G.onGrant = null; f(); } else BM.render(); };
G.isAdmin = () => !!(G.tier && G.tier.admin);
G.full = () => !!(G.tier && (G.tier.full || G.tier.admin));
/* exports of a real company's final report need full access (demo data stays open) */
G.canExport = () => G.full() || !!(BM.co() && BM.co().demo);
G.locked = () => BM.modal(`<h3>${L("The final report for activated clients","التقرير النهائي للعملاء المفعّلين")}</h3>
  <p style="margin:0 0 12px">${L("The final report and exports are available to activated clients. We will be glad to hear from you to complete the service.","التقرير النهائي والتصدير متاحان للعملاء المفعّلين. يسعدنا تواصلك معنا لاستكمال الخدمة.")}</p>
  <div class="row" style="gap:8px;flex-wrap:wrap"><a class="btn pri" href="${WA}" target="_blank" rel="noopener">${L("Contact us on WhatsApp","تواصل معنا عبر واتساب")}</a><a class="btn" href="${CONTACT}" target="_blank" rel="noopener">${L("Contact page","صفحة التواصل")}</a><button class="btn" onclick="BM.closeModal()">${L("Close","إغلاق")}</button></div>`);

/* start: called by the app before the first page renders */
G.start = async (onGrant) => {
  G.onGrant = onGrant;
  const link = A.fromLink();
  if (link && link.error){ G.view = "login"; G.err = L("The link has expired or was already used. Request a new one.","انتهت صلاحية الرابط أو استُخدم مسبقاً. اطلب رابطاً جديداً."); return paint(); }
  if (link && link.type === "recovery"){ G.view = "reset"; return paint(); }
  if (!A.user()) { G.view = "login"; return paint(); }
  return G.check();
};
/* while the app is open: a signed-out or expired session, or a suspension, closes it */
G.guard = async () => {
  if (G.view !== "granted") return false;
  if (!A.user()) { G.view = "login"; G.msg = ""; G.err = L("Your session ended. Sign in again.","انتهت الجلسة. سجّل الدخول مجدداً."); paint(); return true; }
  if (Date.now() - G.checkedAt > 5 * 60 * 1000){ G.checkedAt = Date.now();
    const tok = await A.token(); if (!tok){ G.view = "login"; G.err = L("Your session ended. Sign in again.","انتهت الجلسة. سجّل الدخول مجدداً."); paint(); return true; }
    try { const t = await A.tier(); G.tier = t || G.tier; if (!G.isAdmin()){ const row = await A.access(); if (row && row.status !== "approved"){ G.status = row.status; G.view = row.status === "pending" ? "pending" : "suspended"; paint(); return true; } } } catch(e){}
  }
  return false;
};
})();
