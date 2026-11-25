/* =============================================================================
   ui/components.js — shared UI building blocks (HTML strings) and charts.
   ============================================================================= */
(function(){
const U = BM.U, ui = BM.ui = {};

ui.card = (title, body, o) => { o = o || {};
  return `<section class="card"${o.id ? ` id="${o.id}"` : ""}>${title ? `<div class="card-h"><h2>${title}</h2>${o.sub ? `<span class="sub">${o.sub}</span>` : ""}${o.act ? `<div class="act">${o.act}</div>` : ""}</div>` : ""}
  <div class="card-b${o.flush ? " flush" : ""}">${body}</div></section>`; };
ui.tableCard = (title, table, o) => ui.card(title, `<div class="tw${o && o.tall ? " tall" : ""}">${table}</div>`, Object.assign({flush:true}, o || {}));
ui.banner = (type, html) => `<div class="banner ${type}" role="${type === "bad" ? "alert" : "status"}">${html}</div>`;
ui.sec = t => `<div class="sec-h"><h2>${t}</h2></div>`;
ui.empty = (msg, act) => `<div class="empty"><div>${msg}</div>${act || ""}</div>`;
ui.badge = (cls, text) => `<span class="b b-${cls}">${text}</span>`;

/* status of a figure: actual | derived | estimated */
ui.statusTag = st => st === "derived" ? `<span class="st der" title="${L("Calculated from other loaded figures","محسوب من أرقام أخرى محمّلة")}">${L("Derived","مشتق")}</span>`
  : st === "estimated" ? `<span class="st est" title="${L("Approximation — exact data not loaded","تقريب — البيانات الدقيقة غير محمّلة")}">${L("Estimated","تقديري")}</span>` : "";

ui.LEVELS = {low:["good","Low","منخفض"], medium:["warn","Medium","متوسط"], high:["bad","High","مرتفع"], critical:["crit","Critical","حرج"]};
ui.level = lv => lv && ui.LEVELS[lv] ? ui.badge(ui.LEVELS[lv][0], L(ui.LEVELS[lv][1], ui.LEVELS[lv][2])) : `<span class="muted small">—</span>`;

/* variance status with materiality thresholds (master prompt §12)
   dir: +1 higher is better · −1 lower is better · 0 neutral */
ui.varStatus = (a, b, dir, unit) => {
  if (!U.has(a) || !U.has(b)) return {cls:"none", text:L("No comparison","لا مقارنة")};
  const v = a - b; if (!dir) return {cls:"mute", text:L("Neutral","محايد")};
  if (v * dir >= 0 || Math.abs(v) < 1e-9) return {cls:"good", text:L("Favourable","إيجابي")};
  const m = BM.state.settings.materiality, p = U.varPct(a, b);
  const pp = p == null ? Infinity : Math.abs(p) * 100;
  const amountOk = (unit && unit !== "money") ? true : Math.abs(v * BM.fxFactor()) >= (+m.minAmount || 0);
  if (pp >= m.materialPct && amountOk) return {cls:"bad", text:L("Material — unfavourable","جوهري — سلبي")};
  if (pp >= m.attentionPct && amountOk) return {cls:"warn", text:L("Needs attention","يحتاج متابعة")};
  return {cls:"mute", text:L("Within tolerance","ضمن الحد المقبول")};
};
ui.varBadge = s => s.cls === "none" ? `<span class="muted small">${s.text}</span>` : ui.badge(s.cls === "mute" ? "mute" : s.cls, s.text);
ui.arrow = (v, dir) => !U.has(v) || Math.abs(v) < 1e-9 ? "" : ((v * (dir || 1)) > 0 ? `<span class="pos">▲</span>` : `<span class="neg">▼</span>`);

/* comparison availability note for the current view */
ui.viewNotes = view => {
  const out = [], c = view.cmp, cur = view.cur;
  if (!cur.is) out.push(ui.banner("bad", `<b>${L("No actual data for this period.","لا توجد بيانات فعلية لهذه الفترة.")}</b> ${cur.e && cur.s > 1 ? L("A single month or quarter needs the trial balance of the month before it as well.","الشهر أو الربع المنفرد يحتاج أيضاً ميزان مراجعة الشهر الذي يسبقه.") : ""}`));
  if (!c.is) out.push(ui.banner("info", L("Comparison data ({b}) is not available for this period — comparison columns show N/A.","بيانات المقارنة ({b}) غير متوفرة لهذه الفترة — أعمدة المقارنة تظهر غير متوفر.",{b:view.label})));
  else if (c.is.status === "derived") out.push(ui.banner("info", `${ui.statusTag("derived")} ${U.esc(c.is.note || L("Comparison figures are derived.","أرقام المقارنة مشتقة."))}`));
  else if (c.is.status === "estimated") out.push(ui.banner("warn", `${ui.statusTag("estimated")} ${U.esc(c.is.note || "")}`));
  return out.join("");
};

/* ---------- toast & modal ---------- */
BM.toast = (msg, ms) => {
  let t = U.$("#toast"); if (!t){ t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role","status"); document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false; clearTimeout(t._t); t._t = setTimeout(() => t.hidden = true, ms || 2800);
};
BM.modal = html => {
  let m = U.$("#modal"); if (!m){ m = document.createElement("div"); m.id = "modal"; m.className = "modal"; document.body.appendChild(m);
    m.addEventListener("click", e => { if (e.target === m) BM.closeModal(); }); }
  m.innerHTML = `<div class="box" role="dialog" aria-modal="true">${html}</div>`; m.hidden = false;
};
BM.closeModal = () => { const m = U.$("#modal"); if (m) m.hidden = true; };
/* in-page confirmation (browser confirm() is not available everywhere) */
BM.confirm = (msg, okLabel, fn) => {
  BM._confirmFn = fn;
  BM.modal(`<h3>${L("Please confirm","يرجى التأكيد")}</h3><p style="margin:0">${msg}</p>
    <div class="row" style="justify-content:flex-end"><button class="btn" onclick="BM.closeModal()">${L("Cancel","إلغاء")}</button>
    <button class="btn danger" onclick="BM.closeModal();BM._confirmFn&&BM._confirmFn()">${okLabel}</button></div>`);
};

/* ---------- charts (Chart.js) ---------- */
const charts = {};
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
BM.charts = {
  clear(){ for (const k in charts){ try { charts[k].destroy(); } catch(e){} delete charts[k]; } },
  colors(){ return {c1:css("--chart-1"), c2:css("--chart-2"), c3:css("--chart-3"), c4:css("--chart-4"), grid:css("--chart-grid"), ink:css("--ink-3"), bad:css("--bad"), good:css("--good")}; },
  make(id, cfg){
    const el = document.getElementById(id);
    if (!el || typeof Chart === "undefined"){ if (el) el.parentElement.innerHTML = `<div class="empty small">${L("Charts could not load (offline?).","تعذر تحميل الرسوم البيانية (بدون اتصال؟).")}</div>`; return; }
    const C = BM.charts.colors();
    const pctAxis = cfg.pct;
    cfg.options = Object.assign({
      responsive:true, maintainAspectRatio:false, animation:{duration:250},
      interaction:{mode:"index", intersect:false},
      plugins:{legend:{position:"bottom", labels:{boxWidth:10, boxHeight:10, color:C.ink, font:{size:11, family:"IBM Plex Sans, IBM Plex Sans Arabic, sans-serif"}}},
        tooltip:{rtl:U.isAr(), callbacks:{label:c => " " + c.dataset.label + ": " + (c.raw == null ? L("N/A","غير متوفر") : pctAxis ? (c.raw*100).toFixed(1) + "%" : U.numPlain(c.raw * BM.fxFactor()))}}},
      scales:{
        x:{reverse:U.isAr(), grid:{display:false}, ticks:{color:C.ink, font:{size:10.5}}},
        y:{position:U.isAr() ? "right" : "left", grid:{color:C.grid}, border:{display:false},
           ticks:{color:C.ink, font:{size:10.5}, callback:v => pctAxis ? (v*100).toFixed(0) + "%" : BM.U.short(v / 1).replace(/<[^>]+>/g,"")}}
      }
    }, cfg.options || {});
    charts[id] = new Chart(el.getContext("2d"), cfg);
  }
};
})();
