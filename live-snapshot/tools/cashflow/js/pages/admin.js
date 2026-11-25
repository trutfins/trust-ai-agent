/* =============================================================================
   pages/admin.js — Settings (§26) and About (§27, §38, §39)
   ============================================================================= */
(function(){
const U = BM.U, S = BM.state, ui = BM.ui;
const A = BM.admin = {};
const set = (path, v) => { const ks = path.split("."); let o = S.settings; for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]]; o[ks[ks.length - 1]] = v; BM.saveSettings(); };
A.num = (path, v, min) => { const n = parseFloat(v); if (!isFinite(n) || (min != null && n < min)) return BM.toast(L("Enter a valid number.","أدخل رقماً صحيحاً.")); set(path, n); BM.toast(L("Saved.","تم الحفظ.")); };
A.val = (path, v, rerender) => { set(path, v); if (path === "theme") BM.applyTheme(); if (path === "lang"){ if (BM.applyLang) BM.applyLang(); else { document.documentElement.lang = v; document.documentElement.dir = v === "ar" ? "rtl" : "ltr"; } S.demo = BM.buildDemo(); } if (rerender) BM.render(); else BM.toast(L("Saved.","تم الحفظ.")); };
A.co = (k, v) => {
  const co = BM.co(); if (!co || co.demo) return;
  if (k === "nameEn") co.name.en = v; else if (k === "nameAr") co.name.ar = v; else co[k] = v;
  BM.saveData(); BM.render(); BM.toast(L("Company updated.","تم تحديث الشركة."));
};
/* the financial calendar re-reads every loaded trial balance, so it is confirmed first */
A.fyStart = (v, el) => {
  const co = BM.co(); if (!co || co.demo) return; v = +v; if (v === BM.E.fs(co)) return;
  BM.confirm(L("Income-statement balances in your trial balances must be cumulative from the first month of the financial year. Change the start to {m}? The loaded data is re-read with the new calendar; nothing is deleted.","يجب أن تكون أرصدة حسابات قائمة الدخل في موازين المراجعة تراكمية من أول شهر في السنة المالية. هل تريد تغيير البداية إلى {m}؟ ستُقرأ البيانات المحمّلة حسب التقويم الجديد ولن يُحذف شيء.",{m:U.month(v, true)}),
    L("Change","تغيير"), () => { co.fyStart = v; BM.E.bump(co); S.period.year = null; S.settings.fiscalYear = null; BM.saveSettings(); BM.fixPeriod(); BM.saveData(); BM.render(); BM.toast(L("Financial year updated.","تم تحديث السنة المالية.")); });
  if (el) el.value = BM.E.fs(co);
};
A.fx = (pair, field, v) => {
  const r = S.settings.fx[pair] || {rate:0, date:""};
  if (field === "rate"){ const n = parseFloat(v); if (v === "" ){ delete S.settings.fx[pair]; BM.saveSettings(); BM.render(); return; } if (!(n > 0)) return BM.toast(L("A rate must be greater than zero.","يجب أن يكون السعر أكبر من صفر.")); r.rate = n; }
  else r.date = v;
  S.settings.fx[pair] = r; BM.saveSettings(); BM.render();
};
A.logo = file => {
  if (!file) return; const co = BM.co(); if (!co || co.demo) return;
  if (file.size > 5e6) return BM.toast(L("Choose an image under 5 MB.","اختر صورة أصغر من 5 ميجابايت."));
  const fr = new FileReader();
  fr.onload = () => { const img = new Image(); img.onload = () => { const k = Math.min(1, 400 / Math.max(img.width, img.height)), c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      co.logo = c.toDataURL("image/png"); BM.saveData(); BM.render(); BM.toast(L("Logo saved.","تم حفظ الشعار.")); };
    img.onerror = () => BM.toast(L("This image could not be read.","تعذرت قراءة هذه الصورة.")); img.src = fr.result; };
  fr.readAsDataURL(file);
};
A.deleteCo = () => {
  const co = BM.co(); if (!co || co.demo || !BM.can("delete")) return;
  BM.confirm(L("Delete {c} and all its loaded trial balances from this browser? This cannot be undone.","حذف {c} وكل موازين المراجعة المحمّلة لها من هذا المتصفح؟ لا يمكن التراجع عن ذلك.",{c:U.esc(U.nm(co.name))}), L("Delete","حذف"), () => {
    S.companies = S.companies.filter(c => c.id !== co.id);
    if (S.companies.length){ S.companyId = S.companies[0].id; } else S.dataset = "demo";
    S.period.year = null; BM.fixPeriod(); BM.saveData(); BM.render(); BM.toast(L("Company deleted.","تم حذف الشركة."));
  });
};
A.backup = () => {
  const data = {app:BM.BRAND.name, version:BM.VERSION, exportedAt:new Date().toISOString(), settings:S.settings, companies:S.companies, mapMemory:BM.mapMemory};
  BM.saveFile("TRUST_Financial_backup_" + new Date().toISOString().slice(0,10) + ".json", new Blob([JSON.stringify(data)], {type:"application/json"}));
};
A.restore = file => {
  if (!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const d = JSON.parse(fr.result);
      if (!d || !Array.isArray(d.companies)) throw new Error("format");
      BM.confirm(L("Replace the companies in this browser with the {n} company(ies) in the backup?","استبدال الشركات في هذا المتصفح بـ {n} شركة/شركات من النسخة الاحتياطية؟",{n:d.companies.length}), L("Restore","استعادة"), () => {
        S.companies = d.companies; BM.mapMemory = d.mapMemory || {byCode:{}, byName:{}};
        if (d.settings) Object.assign(S.settings, d.settings);
        S.companies.forEach(c => BM.E.bump(c));
        S.dataset = S.companies.length ? "uploaded" : "demo"; S.companyId = S.companies[0] && S.companies[0].id; S.period.year = null; BM.fixPeriod();
        BM.saveSettings(); BM.saveData(); BM.render(); BM.toast(L("Backup restored.","تمت استعادة النسخة الاحتياطية."));
      });
    } catch(e){ BM.toast(L("This is not a valid backup file.","هذا ليس ملف نسخة احتياطية صالحاً.")); }
  };
  fr.readAsText(file);
};
A.clearAll = () => {
  if (!BM.can("delete")) return;
  BM.confirm(L("Delete ALL uploaded companies, mappings and settings from this browser?","حذف كل الشركات المحمّلة والتصنيفات والإعدادات من هذا المتصفح؟"), L("Delete everything","حذف الكل"), () => {
    S.companies = []; BM.mapMemory = {byCode:{}, byName:{}}; S.settings = JSON.parse(JSON.stringify(BM.DEFAULT_SETTINGS));
    S.dataset = "demo"; S.period.year = null; BM.fixPeriod(); BM.saveSettings(); BM.saveData(); BM.applyTheme(); BM.render(); BM.toast(L("All local data deleted.","تم حذف كل البيانات المحلية."));
  });
};

const field = (id, label, input, hint) => `<div class="field"><label for="${id}">${label}</label>${input}${hint ? `<span class="hint">${hint}</span>` : ""}</div>`;
const sel = (id, path, opts, cur, rerender) => `<select class="in" id="${id}" onchange="BM.admin.val('${path}',this.value,${rerender ? "true" : "false"})">${opts.map(o => `<option value="${o[0]}" ${String(cur) === String(o[0]) ? "selected" : ""}>${L(o[1], o[2])}</option>`).join("")}</select>`;
const numIn = (id, path, cur, step, min) => `<input class="in" id="${id}" type="number" step="${step || "any"}" ${min != null ? `min="${min}"` : ""} value="${cur}" onchange="BM.admin.num('${path}',this.value,${min == null ? "null" : min})">`;

/* TRUST account sign-in for the AI service */
A.signIn = async () => {
  const e = (U.$("#aiEmail") || {}).value, pw = (U.$("#aiPass") || {}).value;
  A.lastEmail = e || "";
  if (!e || !pw) return BM.toast(L("Enter the e-mail and password of your TRUST account.","أدخل البريد الإلكتروني وكلمة المرور لحساب TRUST."));
  A.authBusy = true; A.authErr = ""; BM.render();
  try { await BM.auth.signIn(e.trim(), pw); BM.toast(L("Signed in.","تم تسجيل الدخول.")); }
  catch(err){ const m = String(err && err.message || "");
    A.authErr = /invalid/i.test(m) ? L("Wrong e-mail or password.","البريد الإلكتروني أو كلمة المرور غير صحيحة.")
      : /not confirmed/i.test(m) ? L("This e-mail is not confirmed yet. Open the confirmation message sent to it, then sign in.","هذا البريد غير مؤكَّد بعد. افتح رسالة التأكيد المرسلة إليه ثم سجّل الدخول.")
      : /fetch|network|load failed/i.test(m) ? L("No connection to the TRUST sign-in service. Check the internet connection and try again.","لا يوجد اتصال بخدمة الدخول في TRUST. تحقّق من الاتصال بالإنترنت وحاول مجدداً.")
      : /429|rate/i.test(m) ? L("Too many attempts. Wait a few minutes and try again.","محاولات كثيرة. انتظر بضع دقائق ثم حاول مجدداً.")
      : L("Sign-in did not succeed. Try again, or contact TRUST at info@trustfins.org.","لم ينجح تسجيل الدخول. حاول مجدداً، أو تواصل مع TRUST على info@trustfins.org."); }
  A.authBusy = false; BM.render();
};
A.signOut = () => { BM.auth.signOut(); BM.render(); BM.toast(L("Signed out.","تم تسجيل الخروج.")); };
A.code = v => { BM.auth.setCode((v || "").trim()); BM.render(); };
function trustSignIn(){
  const u = BM.auth.user();
  const acct = u ? `<div class="row" style="gap:10px;margin-top:10px"><span class="b b-good">✓ ${L("Signed in","تم الدخول")}</span><span class="small" dir="ltr">${U.esc(u.email)}</span><button class="btn sm" onclick="BM.admin.signOut()">${L("Sign out","تسجيل الخروج")}</button></div>`
    : `<div class="form" style="margin-top:10px">
        <div class="field"><label for="aiEmail">${L("TRUST account e-mail","بريد حساب TRUST")}</label><input class="in" id="aiEmail" type="email" dir="ltr" autocomplete="username" value="${U.esc(A.lastEmail || "")}"></div>
        <div class="field"><label for="aiPass">${L("Password","كلمة المرور")}</label><input class="in" id="aiPass" type="password" dir="ltr" autocomplete="current-password" onkeydown="if(event.key==='Enter')BM.admin.signIn()"></div></div>
       <div class="row" style="gap:10px;margin-top:8px"><button class="btn pri" ${A.authBusy ? "disabled" : ""} onclick="BM.admin.signIn()">${A.authBusy ? L("Signing in…","جارٍ الدخول…") : L("Sign in","تسجيل الدخول")}</button>
       ${A.authErr ? `<span class="small neg">${U.esc(A.authErr)}</span>` : ""}</div>
       <p class="small muted" style="margin:6px 0 0">${L("Use the same account as the TRUST analysis tool. AI requests are answered only for accounts approved by TRUST. New account or approval: {s}. Forgot the password? Contact TRUST at info@trustfins.org.","استخدم نفس حساب أداة التحليل في TRUST. لا تُلبّى طلبات الذكاء الاصطناعي إلا للحسابات المعتمدة من TRUST. لحساب جديد أو للاعتماد: {s}. نسيت كلمة المرور؟ تواصل مع TRUST على info@trustfins.org.",{s:`<a href="https://analysis.trustfins.org" target="_blank" rel="noopener">analysis.trustfins.org</a>`})}</p>`;
  const code = `<details style="margin-top:8px"><summary class="small muted" style="cursor:pointer">${L("TRUST staff: emergency access code","لموظفي TRUST: رمز الدخول الاحتياطي")}</summary>
      <div class="row" style="gap:8px;margin-top:6px"><input class="in" id="aiCode" type="password" dir="ltr" style="max-width:220px" value="" placeholder="${BM.auth.code() ? "••••••" : ""}" autocomplete="off">
      <button class="btn sm" onclick="BM.admin.code(document.getElementById('aiCode').value)">${L("Use for this session","استخدامه لهذه الجلسة")}</button>${BM.auth.code() ? `<button class="btn sm" onclick="BM.admin.code('')">${L("Forget","نسيان")}</button>` : ""}</div></details>`;
  return acct + code;
}

/* account & security (v3.10) — same procedures as the TRUST analysis tool */
A.pw = async () => {
  const cur = (U.$("#pwCur") || {}).value || "", n1 = (U.$("#pwNew") || {}).value || "", n2 = (U.$("#pwNew2") || {}).value || "";
  A.pwErr = ""; A.pwOk = "";
  if (!cur || !n1 || !n2) A.pwErr = L("Complete the fields.","أكمل الحقول.");
  else if (n1.length < BM.auth.MIN_PW) A.pwErr = L("The new password must be 8 characters or more.","كلمة المرور الجديدة 8 أحرف على الأقل.");
  else if (n1 !== n2) A.pwErr = L("The two new passwords do not match.","كلمتا المرور الجديدتان غير متطابقتين.");
  else if (n1 === cur) A.pwErr = L("The new password must be different from the current one.","يجب أن تختلف كلمة المرور الجديدة عن الحالية.");
  if (A.pwErr) return BM.render();
  A.pwBusy = true; BM.render();
  try { await BM.auth.verifyPassword(cur); }
  catch(e){ A.pwBusy = false; A.pwErr = /invalid/i.test(e.message) ? L("The current password is not correct.","كلمة المرور الحالية غير صحيحة.") : L("Could not check the current password — try again shortly.","تعذر التحقق من كلمة المرور الحالية — حاول بعد قليل."); return BM.render(); }
  try { await BM.auth.setPassword(n1); A.pwOk = L("Password changed. Use the new password next time you sign in, here and in the TRUST analysis tool.","تم تغيير كلمة المرور. استخدم كلمة المرور الجديدة في الدخول القادم، هنا وفي نظام TRUST للتحليل."); }
  catch(e){ A.pwErr = e.code === "same_password" ? L("The new password must be different from the current one.","يجب أن تختلف كلمة المرور الجديدة عن الحالية.") : e.code === "weak_password" ? L("The password is too weak. Use 8 characters or more, mixing letters and numbers.","كلمة المرور ضعيفة. استخدم 8 أحرف فأكثر مع خليط من الحروف والأرقام.") : L("Could not save the new password — try again shortly.","تعذر حفظ كلمة المرور الجديدة — حاول بعد قليل."); }
  A.pwBusy = false; BM.render();
};
A.accountOut = () => BM.confirm(L("Sign out of your TRUST account on this device? Your company data stays in this browser.","تسجيل الخروج من حساب TRUST على هذا الجهاز؟ تبقى بيانات شركاتك في هذا المتصفح."), L("Sign out","تسجيل خروج"), () => BM.gate.signOut());
function accountCard(){
  const u = BM.auth.user() || {}, G = BM.gate;
  const lvl = G.isAdmin() ? `<span class="b b-info">${L("TRUST admin","مسؤول TRUST")}</span>` : G.full() ? `<span class="b b-good">${L("Full access","وصول كامل")}</span>` : `<span class="b b-warn">${L("Trial — final report and exports for activated clients","تجربة — التقرير النهائي والتصدير للعملاء المفعّلين")}</span>`;
  const f = (id, lab, ac) => `<div class="field"><label for="${id}">${lab}</label><input class="in" id="${id}" type="password" dir="ltr" autocomplete="${ac}" minlength="8"></div>`;
  return ui.card(L("Account and security","الحساب والأمان"), `<dl class="dl"><dt>${L("Signed in as","الحساب")}</dt><dd dir="ltr" style="text-align:start">${U.esc(u.email || "")}</dd><dt>${L("Access","الصلاحية")}</dt><dd>${lvl}</dd></dl>
    <h3 style="font-size:14px;margin:14px 0 8px">${L("Change password","تغيير كلمة المرور")}</h3>
    <form onsubmit="event.preventDefault();BM.admin.pw()"><div class="form">${f("pwCur", L("Current password","كلمة المرور الحالية"), "current-password")}${f("pwNew", L("New password (8 characters or more)","كلمة المرور الجديدة (8 أحرف فأكثر)"), "new-password")}${f("pwNew2", L("Repeat the new password","أعد كتابة كلمة المرور الجديدة"), "new-password")}</div>
    <div class="row" style="gap:10px;margin-top:10px;flex-wrap:wrap"><button class="btn pri" ${A.pwBusy ? "disabled" : ""}>${A.pwBusy ? L("Saving…","جارٍ الحفظ…") : L("Change password","تغيير كلمة المرور")}</button>
    <button class="btn" type="button" onclick="BM.admin.accountOut()">${L("Sign out","تسجيل خروج")}</button></div></form>
    ${A.pwErr ? `<p class="small neg" role="alert" style="margin:8px 0 0">${U.esc(A.pwErr)}</p>` : ""}${A.pwOk ? `<p class="small pos" role="status" style="margin:8px 0 0">${U.esc(A.pwOk)}</p>` : ""}
    <p class="small muted" style="margin:10px 0 0">${L("One TRUST account for the TRUST digital services: the same e-mail and password open the financial & credit analysis tool.","حساب TRUST واحد للخدمات الرقمية: البريد وكلمة المرور نفسهما يفتحان نظام التحليل المالي والائتماني.")}</p>`);
}

BM.PAGES.settings = {render(ctx){
  const co = ctx.co, st = S.settings, canSet = BM.can("settings");
  const m = st.materiality, r = st.risk;
  const years = co ? Object.keys(BM.E.actualMonths(co)).map(Number).sort((a, b) => b - a) : [];
  const coCard = !co ? "" : co.demo ? ui.card(L("Company","الشركة"), ui.banner("info", L("The demo company cannot be edited. Its figures are illustrative only.","لا يمكن تعديل الشركة التجريبية. أرقامها للتوضيح فقط.")))
    : ui.card(L("Company","الشركة"), `<div class="form">
      ${field("sNe", L("Name (English)","الاسم (إنجليزي)"), `<input class="in" id="sNe" value="${U.esc(co.name.en)}" ${canSet ? "" : "disabled"} onchange="BM.admin.co('nameEn',this.value)">`)}
      ${field("sNa", L("Name (Arabic)","الاسم (عربي)"), `<input class="in" id="sNa" dir="rtl" value="${U.esc(co.name.ar)}" ${canSet ? "" : "disabled"} onchange="BM.admin.co('nameAr',this.value)">`)}
      ${field("sInd", L("Industry","القطاع"), `<select class="in" id="sInd" ${canSet ? "" : "disabled"} onchange="BM.admin.co('industry',this.value)">${BM.INDUSTRIES.map(i => `<option value="${i[0]}" ${co.industry === i[0] ? "selected" : ""}>${L(i[1], i[2])}</option>`).join("")}</select>`, L("Used by Industry Analysis.","يُستخدم في التحليل القطاعي."))}
      ${field("sFYS", L("Financial year starts in","بداية السنة المالية"), `<select class="in" id="sFYS" ${canSet ? "" : "disabled"} onchange="BM.admin.fyStart(this.value,this)">${BM.MONTHS.map((x, i) => `<option value="${i + 1}" ${BM.E.fs(co) === i + 1 ? "selected" : ""}>${U.month(i + 1, true)}</option>`).join("")}</select>`, L("Any month. Quarters, year to date, full year and prior-year comparisons follow this calendar.","أي شهر. الأرباع ومنذ بداية السنة والسنة الكاملة ومقارنات السنة السابقة تتبع هذا التقويم."))}
      ${field("sCur", L("Currency of the loaded figures","عملة الأرقام المحمّلة"), `<select class="in" id="sCur" ${canSet ? "" : "disabled"} onchange="BM.admin.co('currency',this.value)">${Object.keys(BM.CURRENCIES).map(c => `<option ${co.currency === c ? "selected" : ""}>${c}</option>`).join("")}</select>`, L("Changing this relabels the figures. It does not convert them.","تغيير هذا يغير تسمية العملة فقط ولا يحوّل الأرقام."))}
      ${field("sLogo", L("Logo (shown on report covers)","الشعار (يظهر على غلاف التقارير)"), `<div class="row">${co.logo ? `<img src="${co.logo}" alt="" style="height:36px;max-width:120px;object-fit:contain;border:1px solid var(--line);border-radius:4px;background:#fff">` : ""}${canSet ? `<label class="btn sm">⤒ ${L("Upload","رفع")}<input id="sLogo" type="file" hidden accept="image/png,image/jpeg,image/svg+xml,image/webp" onchange="BM.admin.logo(this.files[0])"></label>${co.logo ? `<button class="btn sm" onclick="BM.admin.co('logo','')">${L("Remove","إزالة")}</button>` : ""}` : ""}</div>`)}
      </div>${BM.can("delete") ? `<div class="row" style="margin-top:12px"><button class="btn danger" onclick="BM.admin.deleteCo()">${L("Delete this company","حذف هذه الشركة")}</button></div>` : ""}`);
  const fc = co ? co.currency : "ILS";
  const fxRows = Object.keys(BM.CURRENCIES).filter(c => c !== fc).map(c => { const k = fc + ">" + c, x = st.fx[k] || {};
    return `<tr><td class="mono">1 ${fc} = </td><td><input class="in sm" style="width:120px" type="number" step="any" min="0" aria-label="${L("Rate","السعر")} ${c}" value="${x.rate || ""}" placeholder="${L("not set","غير محدد")}" ${canSet ? "" : "disabled"} onchange="BM.admin.fx('${k}','rate',this.value)"></td><td class="mono">${c}</td>
      <td><input class="in sm" type="date" aria-label="${L("Rate date","تاريخ السعر")}" value="${x.date || ""}" ${canSet ? "" : "disabled"} onchange="BM.admin.fx('${k}','date',this.value)"></td></tr>`; }).join("");
  const html = (canSet ? "" : ui.banner("warn", L("Your role can view settings but not change them.","دورك يسمح بعرض الإعدادات دون تعديلها."))) + accountCard() +
  `<div class="grid g2">` + coCard +
  ui.card(L("Display","العرض"), `<div class="form">
    ${field("sLang", L("Language","اللغة"), sel("sLang","lang",[["en","English","English"],["ar","العربية","العربية"]], st.lang, true))}
    ${field("sTheme", L("Theme","المظهر"), sel("sTheme","theme",[["system","Follow the device","حسب الجهاز"],["light","Light","فاتح"],["dark","Dark","داكن"]], st.theme, true))}
    ${field("sFY", L("Financial year to open","السنة المالية عند الفتح"), `<select class="in" id="sFY" onchange="BM.admin.val('fiscalYear',this.value||null,true)"><option value="">${L("Latest with data","أحدث سنة بها بيانات")}</option>${years.map(y => `<option value="${y}" ${+st.fiscalYear === y ? "selected" : ""}>${BM.E.fyName(y, co)}</option>`).join("")}</select>`, co ? L("This company's financial year runs {a} – {b}.","السنة المالية لهذه الشركة من {a} إلى {b}.",{a:BM.E.pm(1, true, co), b:BM.E.pm(12, true, co)}) : "")}
    </div>`) +
  ui.card(L("Reporting currency and exchange rates","عملة التقارير وأسعار الصرف"), `
    ${field("sRC", L("Report in","عرض التقارير بعملة"), `<select class="in" id="sRC" onchange="BM.admin.val('reportCurrency',this.value==='${fc}'?null:this.value,true)">${Object.keys(BM.CURRENCIES).map(c => `<option ${(st.reportCurrency || fc) === c ? "selected" : ""}>${c}</option>`).join("")}</select>`)}
    <p class="small muted" style="margin:10px 0 6px">${L("No live exchange-rate source is connected, so nothing is converted automatically. To report in another currency, enter the rate you want to use and its date:","لا يوجد مصدر مباشر لأسعار الصرف، لذلك لا يتم أي تحويل تلقائي. لعرض التقارير بعملة أخرى، أدخل السعر الذي تريد استخدامه وتاريخه:")}</p>
    <div class="tw"><table><tbody>${fxRows}</tbody></table></div>`) +
  ui.card(L("Materiality thresholds","حدود الأهمية النسبية"), `<div class="form">
    ${field("sAtt", L("Needs attention from (%)","يحتاج متابعة من (%)"), numIn("sAtt","materiality.attentionPct", m.attentionPct, 0.5, 0))}
    ${field("sMat", L("Material from (%)","جوهري من (%)"), numIn("sMat","materiality.materialPct", m.materialPct, 0.5, 0))}
    ${field("sMin", L("Minimum amount for material ({c})","الحد الأدنى للمبلغ الجوهري ({c})",{c:BM.reportCurrency().code}), numIn("sMin","materiality.minAmount", m.minAmount, 100, 0), L("0 = percentage only","0 = النسبة فقط"))}
    </div><p class="small muted" style="margin:10px 0 0">${L("Green = favourable · grey = unfavourable but below the attention threshold · orange = needs attention · red = material unfavourable variance.","أخضر = إيجابي · رمادي = سلبي لكن دون حد المتابعة · برتقالي = يحتاج متابعة · أحمر = انحراف سلبي جوهري.")}</p>`) +
  ui.card(L("Risk thresholds","حدود المخاطر"), `<div class="form">
    ${field("sCR", L("Minimum current ratio","الحد الأدنى للنسبة المتداولة"), numIn("sCR","risk.minCurrentRatio", r.minCurrentRatio, 0.1, 0))}
    ${field("sQR", L("Minimum quick ratio","الحد الأدنى للنسبة السريعة"), numIn("sQR","risk.minQuickRatio", r.minQuickRatio, 0.1, 0))}
    ${field("sDE", L("Maximum debt-to-equity","الحد الأعلى للديون إلى حقوق الملكية"), numIn("sDE","risk.maxDebtToEquity", r.maxDebtToEquity, 0.1, 0))}
    ${field("sIC", L("Minimum interest coverage","الحد الأدنى لتغطية الفوائد"), numIn("sIC","risk.minInterestCover", r.minInterestCover, 0.5, 0))}
    ${field("sDSO", L("Maximum DSO (days)","الحد الأعلى لفترة التحصيل (يوم)"), numIn("sDSO","risk.maxDSO", r.maxDSO, 1, 0))}
    ${field("sDPO", L("Maximum DPO (days)","الحد الأعلى لفترة السداد (يوم)"), numIn("sDPO","risk.maxDPO", r.maxDPO, 1, 0))}
    </div>`) +
  ui.card(L("Access role","الدور والصلاحيات"), `
    ${field("sRole", L("Role in this browser","الدور في هذا المتصفح"), sel("sRole","role", Object.keys(BM.ROLES).map(k => [k, BM.ROLES[k].en, BM.ROLES[k].ar]), st.role, true))}
    <table style="margin-top:10px"><thead><tr><th>${L("Role","الدور")}</th><th>${L("Import","استيراد")}</th><th>${L("Mapping","تصنيف")}</th><th>${L("Settings","إعدادات")}</th><th>${L("Delete","حذف")}</th></tr></thead><tbody>
    ${Object.keys(BM.ROLES).map(k => `<tr><td>${U.nm(BM.ROLES[k])}</td>${["import","map","settings","delete"].map(a => `<td>${BM.ROLES[k].can.indexOf(a) >= 0 ? "✓" : "—"}</td>`).join("")}</tr>`).join("")}</tbody></table>
    ${ui.banner("warn", L("Roles here only hide controls in this browser. They are not a security control — anyone with access to this browser can change the role. Real access control needs the production setup described in About.","الأدوار هنا تخفي عناصر التحكم في هذا المتصفح فقط وليست ضبطاً أمنياً — أي شخص يستخدم هذا المتصفح يمكنه تغيير الدور. الضبط الحقيقي للصلاحيات يحتاج إعداد الإنتاج الموضح في صفحة «حول المنصة»."))}`) +
  ui.card(L("AI commentary","التعليق بالذكاء الاصطناعي"), `
    <label class="row"><input type="checkbox" id="sAI" ${st.ai.enabled ? "checked" : ""} ${canSet ? "" : "disabled"} onchange="BM.admin.val('ai.enabled',this.checked)"> <span>${L("AI commentary: ON","التعليق بالذكاء الاصطناعي: مفعّل")}</span></label>
    ${field("sAIm", L("AI service","خدمة الذكاء الاصطناعي"), sel("sAIm","ai.mode",[["trust","TRUST AI service (trustfins.org)","خدمة TRUST للذكاء الاصطناعي (trustfins.org)"],["custom","Another server","خادم آخر"]], BM.aiMode(), true))}
    ${BM.aiMode() === "trust" ? trustSignIn()
      : field("sAIe", L("Server address (not an API key)","رابط الخادم (وليس مفتاح API)"), `<input class="in" id="sAIe" dir="ltr" placeholder="https://your-server.example/api/commentary" value="${U.esc(st.ai.endpoint || "")}" ${canSet ? "" : "disabled"} onchange="BM.admin.val('ai.endpoint',this.value.trim())">`)}
    <p class="small muted" style="margin:8px 0 0">${L("Management Commentary always works with the local rule-based engine. When this is ON, the structured figures (no ledgers) are sent to the TRUST AI service — the same service as the financial & credit analysis tool — which calls the AI provider with a key kept only on the server. API keys never go in this app.","التعليق الإداري يعمل دائماً بالمحرك المحلي القائم على القواعد. عند التفعيل تُرسل الأرقام المنظمة (دون دفاتر) إلى خدمة TRUST للذكاء الاصطناعي — نفس خدمة أداة التحليل المالي والائتماني — التي تتصل بمزود الذكاء الاصطناعي بمفتاح محفوظ على الخادم فقط. مفاتيح API لا توضع أبداً في هذا التطبيق.")}</p>`) +
  ui.card(L("Export preferences","تفضيلات التصدير"), `<div class="form">
    ${field("sEC", L("Charts in reports","الرسوم البيانية في التقارير"), sel("sEC","exportPrefs.includeCharts",[["true","Include","تضمين"],["false","Leave out","استبعاد"]], String(st.exportPrefs.includeCharts)))}
    ${field("sPap", L("Paper size","حجم الورق"), sel("sPap","exportPrefs.paper",[["A4","A4","A4"]], st.exportPrefs.paper))}
    </div><p class="small muted" style="margin:8px 0 0">${L("Used by the Report Studio and PDF / Excel export (phase 4).","تُستخدم في استوديو التقارير وتصدير PDF وExcel (المرحلة 4).")}</p>`) +
  ui.card(L("Data in this browser","البيانات في هذا المتصفح"), `
    <p class="small" style="margin:0 0 10px">${L("Companies, trial balances and mappings are stored only in this browser on this device. Keep a backup file if the data matters.","الشركات وموازين المراجعة والتصنيفات محفوظة في هذا المتصفح على هذا الجهاز فقط. احتفظ بنسخة احتياطية إذا كانت البيانات مهمة.")}</p>
    <div class="row"><button class="btn" onclick="BM.admin.backup()">⤓ ${L("Download backup","تنزيل نسخة احتياطية")}</button>
    ${canSet ? `<label class="btn">⤒ ${L("Restore backup","استعادة نسخة احتياطية")}<input type="file" hidden accept=".json" onchange="BM.admin.restore(this.files[0])"></label>` : ""}
    ${BM.can("delete") ? `<button class="btn danger" onclick="BM.admin.clearAll()">${L("Delete all local data","حذف كل البيانات المحلية")}</button>` : ""}</div>
    ${S.storageOk ? "" : ui.banner("warn", L("This browser is blocking storage. Data will be lost when the page closes — use Download backup.","هذا المتصفح يمنع التخزين. ستضيع البيانات عند إغلاق الصفحة — استخدم تنزيل نسخة احتياطية."))}`) +
  `</div>`;
  return {html};
}};

BM.PAGES.about = {render(){
    const html = `<div class="card"><div class="card-b" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
      ${BM.logo(56)}
      <div style="flex:1;min-width:220px"><h2 style="font-size:20px">${BM.brandName()}</h2>
      <div class="muted">${U.nm(BM.BRAND.sub)}</div>
      <div class="small muted" style="margin-top:4px">${U.esc(U.nm(BM.BRAND.owner))} · ${L("Version","الإصدار")} ${BM.VERSION}<br><span dir="ltr">${BM.BRAND.web} · ${BM.BRAND.email}</span></div></div></div></div>
  <div class="grid g2">
  ${ui.card(L("Modules","الوحدات"), `<table><tbody>${BM.NAV.map(([k], i) => `<tr><td class="mono muted">${String(i + 1).padStart(2,"0")}</td><td>${BM.pageName(k)}</td><td>${ui.badge("good", L("Working","يعمل"))}</td></tr>`).join("")}</tbody></table>`)}
  <div style="display:flex;flex-direction:column;gap:16px">
  ${ui.card(L("How figures are produced","كيف تُنتج الأرقام"), `<ul class="small" style="margin:0;padding-inline-start:18px;display:flex;flex-direction:column;gap:5px">
    <li>${L("Every figure comes from a trial balance you loaded, mapped to a statement line. Nothing is invented.","كل رقم يأتي من ميزان مراجعة حمّلته ومصنّف إلى بند في القوائم. لا يُختلق أي رقم.")}</li>
    <li>${L("Missing data shows as N/A, never as zero.","البيانات الناقصة تظهر «غير متوفر» وليس صفراً.")}</li>
    <li>${L("Each company has its own financial year, starting in any month. Quarters, year to date and prior-year comparisons follow it; the last 12 months and custom ranges can cross financial years.","لكل شركة سنة مالية خاصة تبدأ في أي شهر. الأرباع ومنذ بداية السنة ومقارنات السنة السابقة تتبعها؛ وآخر 12 شهراً والفترات المخصصة يمكن أن تمتد عبر سنتين ماليتين.")}</li>
    <li>${L("The full-year latest estimate (actual to date + remaining budget) and the run-rate are labelled estimates, not forecasts.","التقدير المحدث للسنة (الفعلي حتى تاريخه + الموازنة المتبقية) والمعدل الجاري مُعلَّمان كتقديرات وليسا توقعات.")}</li>
    <li>${L("Derived figures (single months, phased budgets, the cash flow) and estimated figures (pro-rated prior year) are labelled.","الأرقام المشتقة (الأشهر المنفردة، الموازنة الموزعة، التدفقات النقدية) والتقديرية (السنة السابقة بالتناسب) معلّمة بوضوح.")}</li>
    <li>${L("Out-of-balance trial balances and balance sheets are shown with their difference. They are never forced to balance.","موازين المراجعة والميزانيات غير المتوازنة تظهر مع فرقها ولا يتم إجبارها على التوازن.")}</li>
    <li>${L("No external industry benchmarks are used. No currency is converted without a rate you enter.","لا تُستخدم معايير قطاعية خارجية. لا تُحوّل أي عملة دون سعر تُدخله أنت.")}</li></ul>`)}
  ${ui.card(L("Security and production use","الأمان والاستخدام في بيئة الإنتاج"), `<p class="small" style="margin:0 0 8px">${L("This version runs entirely in your browser: no server, no login, data stored locally. That suits a single analyst on their own device. Browser-only security is not sufficient for shared or client data. A production (SaaS) version needs:","هذا الإصدار يعمل بالكامل داخل المتصفح: لا خادم ولا تسجيل دخول والبيانات محلية. هذا مناسب لمحلل واحد على جهازه. أمان المتصفح وحده غير كافٍ للبيانات المشتركة أو بيانات العملاء. نسخة الإنتاج تحتاج إلى:")}</p>
    <ul class="small" style="margin:0;padding-inline-start:18px;columns:2;column-gap:20px">${[["HTTPS","HTTPS"],["Authentication","المصادقة"],["Authorization and role permissions","التفويض وصلاحيات الأدوار"],["A backend API","واجهة برمجية خلفية"],["A secure, encrypted database","قاعدة بيانات آمنة ومشفرة"],["Secure file storage","تخزين آمن للملفات"],["Server-side validation and processing","تحقق ومعالجة على الخادم"],["Audit logging","سجل تدقيق"],["Backups","نسخ احتياطي"],["AI calls through the backend only","استدعاء الذكاء الاصطناعي عبر الخادم فقط"]].map(x => `<li>${L(x[0], x[1])}</li>`).join("")}</ul>`)}
  ${ui.card(L("Demo and production data","البيانات التجريبية وبيانات الإنتاج"), `<p class="small" style="margin:0">${L("The demo company is generated by the app for illustration and is always marked DEMO DATA — FOR ILLUSTRATION ONLY. It is never stored and never mixed with your uploaded companies. Switch between them with the Company selector.","الشركة التجريبية يولدها التطبيق للتوضيح وتظهر دائماً بعلامة «بيانات تجريبية — للتوضيح فقط». لا تُحفظ ولا تختلط بشركاتك المحمّلة. بدّل بينها من قائمة الشركة.")}</p>`)}
  </div></div>`;
  return {html};
}};
})();
