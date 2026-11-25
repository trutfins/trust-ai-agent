/* =============================================================================
   core/util.js — language helpers, number formatting and safe arithmetic.
   Every "not available" value is represented as null and rendered as N/A,
   never as zero (No Fabrication Policy, master prompt §32).
   ============================================================================= */
(function(){
const U = BM.U = {};

/* ---------- language ---------- */
U.isAr = () => BM.state && BM.state.settings.lang === "ar";
/* L(en, ar) — inline bilingual string. Optional params replace {name}. */
window.L = U.L = function(en, ar, p){
  let s = U.isAr() ? (ar == null ? en : ar) : en;
  if (p) for (const k in p) s = s.split("{"+k+"}").join(p[k]);
  return s;
};
U.nm = o => o ? (U.isAr() ? (o.ar || o.en) : (o.en || o.ar)) : "";
U.fsLabel = k => k && BM.FS[k] ? (U.isAr() ? BM.FS[k][4] : BM.FS[k][3]) : L("Unmapped","غير مصنف");
U.month = (m, long) => BM.MONTHS[m-1] ? (U.isAr() ? BM.MONTHS[m-1][2] : BM.MONTHS[m-1][long?1:0]) : "";

/* ---------- arithmetic (null-propagating) ---------- */
U.has = v => v !== null && v !== undefined && isFinite(v);
U.add = (...a) => a.some(v => !U.has(v)) ? null : a.reduce((s,v)=>s+v,0);
U.sub = (a,b) => (U.has(a) && U.has(b)) ? a-b : null;
/* div returns {v, why} so callers can explain an N/A */
U.div = (a, b, opt) => {
  opt = opt || {};
  if (!U.has(a) || !U.has(b)) return {v:null, why:L("Insufficient data","بيانات غير كافية")};
  if (b === 0) return {v:null, why:opt.zero || L("Denominator is zero","المقام يساوي صفراً")};
  if (b < 0 && opt.posDen) return {v:null, nm:true, why:opt.neg || L("Not meaningful — negative denominator","غير ذي دلالة — مقام سالب")};
  return {v:a/b};
};
U.varPct = (a, b) => (!U.has(a) || !U.has(b) || b === 0) ? null : (a-b)/Math.abs(b);
U.round = (v, d) => { const f = Math.pow(10, d||0); return Math.round(v*f)/f; };
U.near = (a, b, tol) => Math.abs(a-b) <= (tol == null ? 0.5 : tol);

/* ---------- formatting ---------- */
const NF = {};
function nf(d){ return NF[d] || (NF[d] = new Intl.NumberFormat("en-US",{minimumFractionDigits:d,maximumFractionDigits:d})); }
U.NA = () => `<span class="na" title="${L("Not available","غير متوفر")}">${L("N/A","غير متوفر")}</span>`;
/* numbers are wrapped in <bdi dir="ltr"> so signs, % and brackets keep their
   order inside Arabic (right-to-left) text */
const B = s => `<bdi dir="ltr">${s}</bdi>`;
U.num = (v, d) => {
  if (!U.has(v)) return U.NA();
  const s = nf(d||0).format(Math.abs(v));
  return B(v < 0 ? `(${s})` : s);
};
U.numPlain = (v, d) => !U.has(v) ? "" : (v<0?"(":"") + nf(d||0).format(Math.abs(v)) + (v<0?")":"");
/* money: applies the reporting-currency factor (1 unless a user-entered rate exists) */
U.money = (v, d) => U.num(U.has(v) ? v * BM.fxFactor() : v, d);
U.short = v => {
  if (!U.has(v)) return U.NA();
  v = v * BM.fxFactor();
  const a = Math.abs(v), sg = v < 0 ? "−" : "";
  if (a >= 1e9) return sg + (a/1e9).toFixed(2) + "B";
  if (a >= 1e6) return sg + (a/1e6).toFixed(2) + "M";
  if (a >= 1e3) return sg + (a/1e3).toFixed(0) + "K";
  return sg + a.toFixed(0);
};
U.pct = (v, d) => !U.has(v) ? U.NA() : B((v < 0 ? "−" : "") + Math.abs(v*100).toFixed(d==null?1:d) + "%");
U.pts = (v, d) => !U.has(v) ? U.NA() : B((v>=0?"+":"−") + Math.abs(v*100).toFixed(d==null?1:d) + (U.isAr()?" نقطة":" pts"));
U.x = v => !U.has(v) ? U.NA() : B((v < 0 ? "−" : "") + Math.abs(v).toFixed(2) + "×");
U.days = v => !U.has(v) ? U.NA() : B(Math.round(v) + (U.isAr()?" يوم":" days"));
U.fmtUnit = (unit, v) => unit==="pct" ? U.pct(v) : unit==="x" ? U.x(v) : unit==="days" ? U.days(v) : U.money(v);
U.fmtDelta = (unit, v) => !U.has(v) ? U.NA() : unit==="pct" ? U.pts(v) : unit==="x" ? B((v>=0?"+":"−")+Math.abs(v).toFixed(2)+"×")
  : unit==="days" ? B((v>=0?"+":"−")+Math.abs(Math.round(v))+(U.isAr()?" يوم":" d")) : B((v>=0?"+":"") + U.numPlain(v * BM.fxFactor()));

/* ---------- DOM / text ---------- */
U.esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
U.$ = (s, r) => (r||document).querySelector(s);
U.$$ = (s, r) => Array.from((r||document).querySelectorAll(s));
U.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(()=>fn(...a), ms); }; };
U.uid = p => (p||"id") + Date.now().toString(36) + Math.random().toString(36).slice(2,7);

/* Arabic-aware normalisation used by the classifier and column detector */
U.norm = s => String(s == null ? "" : s).toLowerCase()
  .replace(/[ً-ْـ]/g,"")            // harakat + tatweel
  .replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه")
  .replace(/[_\-–—/\\.,:;()\[\]{}"']/g," ").replace(/\s+/g," ").trim();

/* parse a cell into a date (UTC midnight). Accepts Excel dates, Excel serial
   numbers, ISO text (2026-06-30) and day-first text (30/06/2026). null = not a date */
U.parseDate = cell => {
  if (cell instanceof Date && !isNaN(cell)) return new Date(Date.UTC(cell.getFullYear(), cell.getMonth(), cell.getDate()));
  if (typeof cell === "number" && cell > 20000 && cell < 80000) return new Date(Date.UTC(1899, 11, 30) + cell * 864e5);
  const s = String(cell == null ? "" : cell).trim(); if (!s) return null;
  let m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/); if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/);
  if (m){ const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return new Date(Date.UTC(y, +m[2] - 1, +m[1])); }
  return null;
};
U.iso = d => d ? d.toISOString().slice(0, 10) : "";
U.monthEnd = (y, m) => new Date(Date.UTC(y, m, 0));

/* parse a cell into a number. Returns {v, bad} — bad=true means the cell has
   content that is not a number (counted by validation, never silently zero) */
U.parseNum = cell => {
  if (cell === null || cell === undefined || cell === "") return {v:0, empty:true};
  if (typeof cell === "number") return isFinite(cell) ? {v:cell} : {v:0, bad:true};
  let s = String(cell).trim();
  if (!s || s === "-" || s === "–") return {v:0, empty:true};
  s = s.replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))    // Arabic-Indic digits
       .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0))
       .replace(/٬/g,",").replace(/٫/g,".");
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1,-1); }
  if (/-$/.test(s)) { neg = true; s = s.slice(0,-1); }
  s = s.replace(/(ils|usd|jod|eur|nis|\$|€|₪)/gi,"").replace(/[,\s]/g,"");
  if (/^[+-]?\d*\.?\d+(e[+-]?\d+)?$/i.test(s)) { const v = parseFloat(s); return {v: neg ? -v : v}; }
  return {v:0, bad:true};
};
})();
