/* =============================================================================
   TRUST Financial — core/config.js
   Static configuration: account taxonomy, statement structure, currencies,
   navigation and defaults. No logic lives here.
   ============================================================================= */
window.BM = window.BM || {};

BM.VERSION = "3.10.5";
/* Brand — internal code namespace stays "BM" (short for the app core) */
BM.BRAND = {
  /* public product name: "TRUST | Smart CFO" / "TRUST | المدير المالي الذكي" (v3.9) */
  name: "TRUST | Smart CFO", nameAr: "TRUST | المدير المالي الذكي", product: {en:"Smart CFO", ar:"المدير المالي الذكي"},
  file: "TRUST_Smart_CFO", short: "TRUST",
  sub: {en:"From trial balance to smarter financial decisions", ar:"من ميزان المراجعة إلى قرارات مالية أذكى"},
  owner: {en:"Trust for Accounting & Financial Services", ar:"تراست للخدمات المحاسبية والمالية"},
  web: "trustfins.org", email: "info@trustfins.org",
  /* TRUST AI service — the same Cloudflare Worker used by the financial & credit
     analysis tool (analysis.trustfins.org): one key, one bill, one approval list */
  ai: "https://trust-ai.trutfins.workers.dev"
};
BM.PAGES = {};
/* where AI commentary requests go */
BM.aiMode = () => { const a = (BM.state && BM.state.settings && BM.state.settings.ai) || {}; return a.mode || (a.endpoint ? "custom" : "trust"); };
BM.aiEndpoint = () => { const a = BM.state.settings.ai || {}; return BM.aiMode() === "custom" ? (a.endpoint || "").trim() : BM.BRAND.ai; };
/* TRUST accounts (Supabase project "TRUST FINANCIAL"); the anon key is public by design */
BM.SUPA = {url:"https://jbeiipdxcyzdqarxzbyo.supabase.co", key:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiZWlpcGR4Y3l6ZHFhcnh6YnlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMzMxNDEsImV4cCI6MjEwODYwOTE0MX0.7NSf-MfeBXOislHX2Kvsu-sVmRF-380iOsN8XNto8jE"};
/* TRUST mark — the same mark as trustfins.org: navy tile with three bars
   (white tall, gold mid, gold short; brand navy #0E2238, gold #D9B46E) */
BM.logo = (size, cls) => `<svg class="${cls || "tlogo"}" width="${size}" height="${size}" viewBox="0 0 40 40" role="img" aria-label="TRUST"><rect width="40" height="40" rx="10" fill="#0E2238"/><rect x="9.5" y="9" width="5" height="22" rx="1" fill="#fff"/><rect x="17.5" y="16" width="5" height="15" rx="1" fill="#D9B46E"/><rect x="25.5" y="22" width="5" height="9" rx="1" fill="#D9B46E"/></svg>`;
/* name in the working language (lang: "ar" | "en"; defaults to the UI language) */
BM.brandName = (lang) => ((lang || (BM.state && BM.state.settings && BM.state.settings.lang)) === "ar" ? BM.BRAND.nameAr : BM.BRAND.name);

/* ---------------------------------------------------------------------------
   ACCOUNT TAXONOMY  (master prompt §5)
   key: [statement, group, normal side, EN label, AR label]
   statement: BS | PL
   group (BS): ca | nca | cl | ncl | eq
   group (PL): rev | cos | opex | dep | fin_inc | fin_cost | other | tax
   normal side: D (debit) | C (credit) — used for nature checks and for
   amounts entered "as positive numbers" (natural sign convention).
   --------------------------------------------------------------------------- */
BM.FS = {
  cash:            ["BS","ca","D","Cash on hand","النقد في الصندوق"],
  bank:            ["BS","ca","D","Bank balances","الأرصدة لدى البنوك"],
  ar:              ["BS","ca","D","Accounts receivable","الذمم المدينة"],
  inventory:       ["BS","ca","D","Inventory","المخزون"],
  prepayments:     ["BS","ca","D","Prepayments & advances","المصروفات المدفوعة مقدماً والدفعات المقدمة"],
  other_ca:        ["BS","ca","D","Other current assets","أصول متداولة أخرى"],
  fixed_assets:    ["BS","nca","D","Fixed assets (net)","الأصول الثابتة (بالصافي)"],
  intangibles:     ["BS","nca","D","Intangible assets","الأصول غير الملموسة"],
  other_nca:       ["BS","nca","D","Other non-current assets","أصول غير متداولة أخرى"],
  ap:              ["BS","cl","C","Accounts payable","الذمم الدائنة"],
  st_loans:        ["BS","cl","C","Short-term loans & overdrafts","القروض قصيرة الأجل والسحب على المكشوف"],
  accrued:         ["BS","cl","C","Accrued expenses","المصروفات المستحقة"],
  other_cl:        ["BS","cl","C","Other current liabilities","التزامات متداولة أخرى"],
  lt_loans:        ["BS","ncl","C","Long-term loans","القروض طويلة الأجل"],
  other_ncl:       ["BS","ncl","C","Other non-current liabilities","التزامات غير متداولة أخرى"],
  capital:         ["BS","eq","C","Paid-in capital","رأس المال المدفوع"],
  reserves:        ["BS","eq","C","Reserves","الاحتياطيات"],
  retained:        ["BS","eq","C","Retained earnings","الأرباح المدورة"],
  other_equity:    ["BS","eq","C","Other equity","حقوق ملكية أخرى"],
  sales:           ["PL","rev","C","Sales","المبيعات"],
  service_rev:     ["PL","rev","C","Service revenue","إيرادات الخدمات"],
  other_op_rev:    ["PL","rev","C","Other operating revenue","إيرادات تشغيلية أخرى"],
  cogs:            ["PL","cos","D","Cost of goods sold","تكلفة البضاعة المباعة"],
  direct_materials:["PL","cos","D","Direct materials","المواد المباشرة"],
  direct_labor:    ["PL","cos","D","Direct labour","العمالة المباشرة"],
  other_direct:    ["PL","cos","D","Other direct costs","تكاليف مباشرة أخرى"],
  salaries:        ["PL","opex","D","Salaries & benefits","الرواتب والمزايا"],
  rent:            ["PL","opex","D","Rent","الإيجارات"],
  utilities:       ["PL","opex","D","Utilities","المرافق (كهرباء ومياه)"],
  marketing:       ["PL","opex","D","Marketing","التسويق"],
  transport:       ["PL","opex","D","Transportation","النقل والمواصلات"],
  admin:           ["PL","opex","D","Administrative expenses","المصروفات الإدارية"],
  other_opex:      ["PL","opex","D","Other operating expenses","مصروفات تشغيلية أخرى"],
  depreciation:    ["PL","dep","D","Depreciation & amortisation","الاستهلاك والإطفاء"],
  finance_income:  ["PL","fin_inc","C","Finance income","إيرادات التمويل"],
  finance_costs:   ["PL","fin_cost","D","Finance costs","تكاليف التمويل"],
  fx:              ["PL","other","C","Foreign exchange gains / (losses)","فروقات العملة"],
  other_gl:        ["PL","other","C","Other gains / (losses)","أرباح / (خسائر) أخرى"],
  other_rev:       ["PL","other","C","Other revenue","إيرادات أخرى"],
  taxes:           ["PL","tax","D","Income tax","ضريبة الدخل"]
};
BM.FS_KEYS = Object.keys(BM.FS);
BM.FS_GROUPS = [
  ["Assets","الأصول",["cash","bank","ar","inventory","prepayments","other_ca","fixed_assets","intangibles","other_nca"]],
  ["Liabilities","الالتزامات",["ap","st_loans","accrued","other_cl","lt_loans","other_ncl"]],
  ["Equity","حقوق الملكية",["capital","reserves","retained","other_equity"]],
  ["Revenue","الإيرادات",["sales","service_rev","other_op_rev"]],
  ["Cost of sales","تكلفة المبيعات",["cogs","direct_materials","direct_labor","other_direct"]],
  ["Operating expenses","المصروفات التشغيلية",["salaries","rent","utilities","marketing","transport","depreciation","admin","other_opex"]],
  ["Other income / expenses","إيرادات ومصروفات أخرى",["finance_income","finance_costs","fx","other_gl","other_rev","taxes"]]
];

/* Industries (master prompt §14) — KPI definitions arrive in phase 3 */
BM.INDUSTRIES = [
  ["retail","Retail","التجزئة"],["manufacturing","Manufacturing","الصناعة"],["construction","Construction","المقاولات"],
  ["services","Services","الخدمات"],["trading","Trading","التجارة"],["hospitality","Hospitality","الضيافة والفنادق"],
  ["healthcare","Healthcare","الرعاية الصحية"],["automotive","Automotive","السيارات"],["financial","Financial services","الخدمات المالية"],
  ["technology","Technology","التكنولوجيا"],["agriculture","Agriculture & livestock","الزراعة والثروة الحيوانية"],["food","Food processing","الصناعات الغذائية"],
  ["pharma","Pharmaceuticals","الصناعات الدوائية"],["education","Education","التعليم"],["transport","Transport & logistics","النقل والخدمات اللوجستية"],
  ["realestate","Real estate","العقارات"],["telecom","Telecommunications","الاتصالات"],["energy","Energy & utilities","الطاقة والمرافق"],
  ["tourism","Tourism","السياحة"],["other","Other","أخرى"]
];

/* Currencies (master prompt §24). No automatic conversion — ever. */
BM.CURRENCIES = {
  USD:{en:"US Dollar",ar:"دولار أمريكي",sym:"USD",dec:0},
  ILS:{en:"Israeli Shekel",ar:"شيكل",sym:"ILS",dec:0},
  EUR:{en:"Euro",ar:"يورو",sym:"EUR",dec:0},
  JOD:{en:"Jordanian Dinar",ar:"دينار أردني",sym:"JOD",dec:0}
};

BM.ROLES = {
  admin:   {en:"Admin",ar:"مدير النظام", can:["import","map","settings","delete"]},
  manager: {en:"Finance Manager",ar:"المدير المالي", can:["import","map","settings"]},
  analyst: {en:"Financial Analyst",ar:"محلل مالي", can:["import","map"]},
  viewer:  {en:"Viewer",ar:"مشاهد", can:[]}
};

/* Navigation (master prompt §29) — order is fixed.
   phase: pages that are not built yet are shown but disabled, never dead links. */
BM.NAV = [
  ["import","✎"],["dashboard","▦"],["trend","⟋"],["income","▤"],["balance","▥"],["cashflow","≋"],["ratios","％"],
  ["workingcapital","⟳"],["ar","↘"],["ap","↗"],["trialbalance","☰"],["budget","◎"],
  ["prioryear","↺"],["industry","◇"],["operational","⚙"],["risk","⚠"],["commentary","✎"],
  ["execsummary","▣"],["reports","⎙"],["mapping","⇄"],["quality","✓"],
  ["access","⚿"],["settings","⚙"],["about","ⓘ"]
];

BM.DEFAULT_SETTINGS = {
  lang:"en", theme:"system", role:"admin",
  reportCurrency:null,            // null = company functional currency
  fiscalYear:null,                // null = latest year with data
  materiality:{attentionPct:5, materialPct:10, minAmount:0},
  risk:{minCurrentRatio:1.2, minQuickRatio:0.8, maxDebtToEquity:1.5, maxDSO:90, minInterestCover:3, maxDPO:120},
  ai:{enabled:false, mode:"trust", endpoint:""},   // mode: "trust" (TRUST server) | "custom"
  fx:{},                          // {"ILS>USD":{rate:0.27, date:"2026-09-30"}} — user-entered only
  exportPrefs:{includeCharts:true, paper:"A4"}
};

BM.MONTHS = [["Jan","January","يناير"],["Feb","February","فبراير"],["Mar","March","مارس"],["Apr","April","أبريل"],
  ["May","May","مايو"],["Jun","June","يونيو"],["Jul","July","يوليو"],["Aug","August","أغسطس"],
  ["Sep","September","سبتمبر"],["Oct","October","أكتوبر"],["Nov","November","نوفمبر"],["Dec","December","ديسمبر"]];
