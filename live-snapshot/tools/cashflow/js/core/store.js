/* =============================================================================
   core/store.js — application state and local persistence.
   Settings → localStorage. Companies (accounts, mappings, trial-balance
   snapshots) and the mapping memory → IndexedDB. Everything stays in this
   browser; nothing is sent anywhere. Every storage call is guarded so the
   app still runs when storage is blocked (private window, sandbox).
   ============================================================================= */
(function(){
const S = BM.state = {
  settings: JSON.parse(JSON.stringify(BM.DEFAULT_SETTINGS)),
  companies: [],          // uploaded companies (persisted)
  demo: null,             // demo company (regenerated, never persisted)
  companyId: null,
  dataset: "demo",        // "demo" | "uploaded"
  period: {type:"ytd", year:null, month:null},
  compare: "budget",      // budget | py | prev
  page: "import",
  storageOk: true
};

const LS_KEY = "bm-fip-settings-v2";
const DB_NAME = "bm-fip", DB_STORE = "kv";

function merge(base, over){
  for (const k in over){
    if (over[k] && typeof over[k] === "object" && !Array.isArray(over[k]) && base[k] && typeof base[k] === "object")
      merge(base[k], over[k]);
    else base[k] = over[k];
  }
  return base;
}

BM.loadSettings = function(){
  try { const raw = localStorage.getItem(LS_KEY); if (raw) merge(S.settings, JSON.parse(raw)); }
  catch(e){ S.storageOk = false; }
};
BM.saveSettings = function(){
  try { localStorage.setItem(LS_KEY, JSON.stringify(S.settings)); } catch(e){ S.storageOk = false; }
};

/* ---- IndexedDB (promise wrapper) ---- */
let dbp = null;
function db(){
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    try {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(DB_STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    } catch(e){ rej(e); }
  });
  return dbp;
}
function idb(mode, fn){
  return db().then(d => new Promise((res, rej) => {
    const tx = d.transaction(DB_STORE, mode), st = tx.objectStore(DB_STORE), out = fn(st);
    tx.oncomplete = () => res(out && out.result);
    tx.onerror = () => rej(tx.error);
  }));
}
BM.idbGet = k => idb("readonly", st => st.get(k)).catch(() => { S.storageOk = false; return null; });
BM.idbSet = (k, v) => idb("readwrite", st => st.put(v, k)).catch(() => { S.storageOk = false; });

BM.loadData = async function(){
  const [cos, mem] = await Promise.all([BM.idbGet("companies"), BM.idbGet("mapMemory")]);
  S.companies = Array.isArray(cos) ? cos : [];
  BM.mapMemory = mem && typeof mem === "object" ? mem : {byCode:{}, byName:{}};
};
BM.saveData = BM.U.debounce(function(){
  BM.idbSet("companies", S.companies);
  BM.idbSet("mapMemory", BM.mapMemory);
}, 400);

/* ---- accessors ---- */
BM.co = function(){
  if (S.dataset === "demo" || !S.companies.length) return S.demo;
  return S.companies.find(c => c.id === S.companyId) || S.companies[0];
};
BM.can = function(action){ const r = BM.ROLES[S.settings.role] || BM.ROLES.viewer; return r.can.indexOf(action) >= 0; };

/* ---- reporting currency ----
   Functional currency = the company's own. Conversion happens ONLY when the
   user has entered a rate in Settings. Otherwise figures stay in the
   functional currency and the shell shows "Conversion rate unavailable". */
BM.reportCurrency = function(){
  const co = BM.co(); const fc = co ? co.currency : "ILS";
  const rc = S.settings.reportCurrency || fc;
  if (rc === fc) return {code:fc, factor:1, converted:false};
  const r = S.settings.fx[fc + ">" + rc];
  if (r && r.rate > 0) return {code:rc, factor:r.rate, converted:true, rate:r.rate, date:r.date, from:fc};
  return {code:fc, factor:1, converted:false, unavailable:rc};
};
BM.fxFactor = () => BM.reportCurrency().factor;
})();
