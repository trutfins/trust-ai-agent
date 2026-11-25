/* =============================================================================
   engine/classify.js — account mapping engine (master prompt §5).
   Order of evidence, strongest first:
     1. memory   — a mapping the user confirmed before (same code or same name)
     2. keyword  — English / Arabic keywords in the account name
     3. code     — the leading digit of the account code (LOW confidence:
                   charts of accounts differ, so these always need review)
   Anything else stays unmapped. Nothing is ever forced into a line silently.
   ============================================================================= */
(function(){
const N = BM.U.norm;

/* [fsKey, keywords...] — evaluated top to bottom; first match wins.
   Specific phrases come before general ones (e.g. "accumulated depreciation"
   before "depreciation", "cost of sales" before "sales"). */
const RULES = [
  ["fixed_assets", "accumulated depreciation","acc dep","مجمع الاستهلاك","مجمع الاهلاك","مخصص الاستهلاك","مخصص الاهلاك"],
  ["intangibles", "accumulated amortisation","accumulated amortization","مجمع الاطفاء","intangible","goodwill","software","licen","trademark","اصول غير ملموسه","الشهره","برمجيات","برامج","رخص","علامه تجاريه"],
  ["ar", "allowance for doubtful","doubtful debt","expected credit loss","ecl allowance","provision for doubtful","مخصص ديون مشكوك","مخصص الديون المشكوك","مخصص الخسائر الائتمانيه","مخصص ذمم"],
  ["prepayments", "prepaid","prepayment","advance to supplier","advances to supplier","مدفوعه مقدما","دفعات مقدمه للموردين","سلف موردين"],
  ["accrued", "accrued","accrual","مستحقه","مصاريف مستحقه","مصروفات مستحقه","رواتب مستحقه"],
  ["other_ca", "vat input","vat receivable","ضريبه القيمه المضافه مدخلات"],
  ["other_cl", "vat output","vat payable","tax payable","ضريبه القيمه المضافه مخرجات","ضريبه مستحقه","ضريبه دخل مستحقه"],
  ["other_ncl", "end of service provision","provision for end of service","مخصص نهايه الخدمه","مخصص تعويض نهايه الخدمه"],
  ["cogs", "cost of goods","cost of sales","cost of revenue","cogs","تكلفه البضاعه","تكلفه المبيعات","تكلفه الايرادات","كلفه المبيعات"],
  ["direct_materials", "direct material","raw material consumed","materials consumed","مواد مباشره","المواد الخام المستخدمه","مواد خام مستهلكه"],
  ["direct_labor", "direct labour","direct labor","production wages","اجور مباشره","عماله مباشره","اجور الانتاج"],
  ["other_direct", "freight in","customs","clearance","subcontract","direct cost","production overhead","factory","manufacturing overhead","تخليص","جمارك","شحن المشتريات","مقاول","تكاليف مباشره","تكاليف صناعيه","مصاريف المصنع"],
  ["depreciation", "depreciation","amortisation","amortization","استهلاك","اهلاك","اطفاء"],
  ["finance_income", "interest income","deposit income","finance income","فوائد دائنه","عوائد ودائع","ايرادات فوائد","ايرادات تمويل","فوائد الودائع","فوائد ودائع","interest on deposit","interest on bank deposit"],
  ["finance_costs", "interest expense","finance cost","financing cost","bank interest","loan interest","murabaha cost","فوائد مدينه","فوائد بنكيه","فوائد القروض","تكاليف تمويل","مصاريف تمويل","عمولات تمويل","تكلفه تمويل","فوائد","interest"],
  ["fx", "exchange","currency","فروقات عمله","فرق عمله","فروق عمله","فروقات صرف","فروق صرف","تقييم عملات"],
  ["taxes", "income tax expense","tax expense","corporate tax","ضريبه الدخل","مصروف الضريبه","مصروف ضريبه"],
  ["other_gl", "gain on","loss on","disposal","impairment","ارباح بيع","خسائر بيع","استبعاد","انخفاض القيمه","ارباح راسماليه"],
  ["sales", "sales return","sales discount","returns and allowances","مردودات المبيعات","خصم مسموح","خصومات المبيعات","مسموحات المبيعات"],
  ["service_rev", "service revenue","service income","consulting revenue","maintenance revenue","installation","ايرادات خدمات","ايرادات الخدمات","ايراد خدمات","ايرادات صيانه","ايرادات استشارات","ايرادات تركيب"],
  ["other_rev", "other income","miscellaneous income","sundry income","scrap sales","ايرادات اخرى","ايرادات متنوعه","ايرادات اخري","بيع خرده"],
  ["other_op_rev", "other operating revenue","commission income","rental income","ايرادات تشغيليه اخرى","ايرادات عمولات","ايرادات ايجار"],
  ["sales", "sales","revenue","turnover","مبيعات","المبيعات","ايرادات","ايراد"],
  ["salaries", "salar","wage","payroll","staff cost","employee benefit","end of service expense","bonus","overtime","social security","pension","medical insurance","رواتب","اجور","مكافات","مكافآت","بدلات","تامين صحي","ضمان اجتماعي","تعويض نهايه الخدمه مصروف"],
  ["rent", "rent","lease expense","ايجار","ايجارات"],
  ["utilities", "electric","water","utilit","fuel for","heating","كهرباء","مياه","ماء","محروقات التدفئه"],
  ["marketing", "marketing","advertis","promotion","exhibition","sponsorship","تسويق","دعايه","اعلان","اعلانات","معارض","ترويج"],
  ["transport", "transport","delivery","freight out","vehicle","fuel","travel","shipping","نقل","مواصلات","توصيل","سيارات","محروقات","سفر","شحن"],
  ["admin", "administrative","admin","general expense","professional fee","audit fee","legal","consult","communication","telephone","internet","stationery","office","insurance","bank charge","license fee","government fee","مصاريف اداريه","المصاريف الاداريه","مصروفات اداريه","اتعاب","تدقيق","قانونيه","استشارات","اتصالات","هاتف","انترنت","قرطاسيه","مكتبيه","تامين","عمولات بنكيه","رسوم"],
  ["st_loans", "overdraft","short term loan","short-term loan","current portion","revolving","murabaha","جاري مدين","سحب على المكشوف","قروض قصيره","قرض قصير","الجزء المتداول","مرابحه","تسهيلات"],
  ["cash", "petty cash","cash on hand","cash in hand","cash box","الصندوق","صندوق","نقديه","النقد","العهد النقديه","عهده"],
  ["bank", "bank","current account","deposit account","time deposit","بنك","مصرف","البنك","حساب جاري","وديعه","ودائع"],
  ["lt_loans", "long term loan","long-term loan","term loan","bond","sukuk","قروض طويله","قرض طويل","سندات","صكوك"],
  ["ar", "receivable","debtor","customer","cheques under collection","notes receivable","ذمم مدينه","مدينون","المدينون","عملاء","العملاء","شيكات برسم التحصيل","شيكات تحت التحصيل","اوراق قبض"],
  ["ap", "payable to supplier","trade payable","accounts payable","creditor","supplier","notes payable","post dated cheque","post-dated","ذمم دائنه","دائنون","الدائنون","موردين","الموردين","مورد","اوراق دفع","شيكات اجله","شيكات مؤجله"],
  ["inventory", "inventor","stock","goods in transit","raw material","finished goods","work in progress","مخزون","المخزون","بضاعه","بضاعه بالطريق","مواد خام","انتاج تام","انتاج تحت التشغيل"],
  ["prepayments", "prepaid","prepayment","advance to supplier","advances to supplier","مدفوعه مقدما","مصاريف مدفوعه مقدما","مصروفات مدفوعه مقدما","دفعات مقدمه للموردين","سلف موردين"],
  ["accrued", "accrued","accrual","مستحقه","مصاريف مستحقه","مصروفات مستحقه","رواتب مستحقه"],
  ["other_ncl", "end of service","indemnity","provision for employee","long term provision","مخصص نهايه الخدمه","تعويض نهايه الخدمه","مخصص تعويض"],
  ["other_cl", "vat output","vat payable","tax payable","income tax payable","customer advance","deferred revenue","unearned","dividends payable","ضريبه القيمه المضافه مخرجات","ضريبه مستحقه","ضريبه دخل مستحقه","دفعات مقدمه من العملاء","ايرادات مؤجله","ايرادات مقبوضه مقدما","توزيعات مستحقه","امانات"],
  ["other_ca", "vat input","vat receivable","employee advance","staff loan","refundable","other receivable","ضريبه القيمه المضافه مدخلات","سلف موظفين","سلف الموظفين","ذمم موظفين","تامينات مستردة","تامينات مسترده","ارصده مدينه اخرى"],
  ["capital", "share capital","paid in capital","paid-up","capital","راس المال","راس مال"],
  ["reserves", "reserve","احتياطي","احتياطيات"],
  ["retained", "retained earnings","accumulated profit","accumulated loss","ارباح مدوره","الارباح المدوره","ارباح محتجزه","ارباح مبقاه","خسائر متراكمه"],
  ["other_equity", "dividend","drawings","owner current","partner current","treasury","توزيعات","جاري الشركاء","جاري الشريك","مسحوبات","اسهم خزينه"],
  ["fixed_assets", "building","machinery","equipment","furniture","vehicles","motor vehicle","computer","land","leasehold","fixture","property plant","capital work","مباني","مبنى","الات","آلات","معدات","اثاث","سيارات","اجهزه","اراضي","ارض","تحسينات","مشاريع تحت التنفيذ","اصول ثابته","ممتلكات"],
  ["other_nca", "long term deposit","investment","guarantee deposit","استثمارات","ودائع طويله","تامينات طويله","استثمار"],
  ["other_opex", "miscellaneous","sundry","other expense","maintenance","repair","cleaning","security","hospitality","donation","مصاريف اخرى","متنوعه","مصروفات اخرى","صيانه","تصليح","نظافه","حراسه","ضيافه","تبرعات"]
];
const RN = RULES.map(r => [r[0], r.slice(1).map(N)]);

/* code-prefix guess (LOW confidence). Typical Palestinian / Jordanian chart:
   1 assets · 2 liabilities · 3 equity · 4 revenue · 5 cost of sales · 6+ expenses. */
const CODE_GUESS = {"1":"other_ca","2":"other_cl","3":"other_equity","4":"sales","5":"cogs","6":"other_opex","7":"other_opex","8":"other_opex","9":"other_gl"};

BM.classify = function(code, name){
  const c = String(code || "").trim(), n = N(name);
  const mem = BM.mapMemory || {byCode:{}, byName:{}};
  if (c && mem.byCode[c] && BM.FS[mem.byCode[c]]) return {fsKey: mem.byCode[c], conf:"memory"};
  if (n && mem.byName[n] && BM.FS[mem.byName[n]]) return {fsKey: mem.byName[n], conf:"memory"};
  const d = c.replace(/\D/g,"").charAt(0);
  if (n){
    /* collect every rule that matches, then let the code's leading digit pick
       between a balance-sheet and an income-statement reading
       ("Vehicles" under 1xxx is an asset; under 6xxx it is a running cost). */
    const hits = [];
    const nn = " " + n;
    /* Latin keywords must start a word ("rent" must not match "current");
       Arabic keywords may sit inside a word because of attached prefixes (ال، و، ب) */
    const hit = kw => /[a-z]/.test(kw) ? nn.indexOf(" " + kw) >= 0 : n.indexOf(kw) >= 0;
    for (const [k, kws] of RN) for (const kw of kws) if (kw && hit(kw)){ hits.push([k, kw]); break; }
    if (hits.length){
      const want = d === "1" || d === "2" || d === "3" ? "BS" : (d >= "4" && d <= "9" ? "PL" : null);
      const pick = (want && hits.find(h => BM.FS[h[0]][0] === want)) || hits[0];
      return {fsKey:pick[0], conf:"keyword", hit:pick[1]};
    }
  }
  if (d && CODE_GUESS[d]) return {fsKey: CODE_GUESS[d], conf:"code"};
  return {fsKey:null, conf:"none"};
};

/* remember a confirmed mapping so the next upload (any company) reuses it */
BM.rememberMapping = function(code, name, fsKey){
  BM.mapMemory = BM.mapMemory || {byCode:{}, byName:{}};
  if (!fsKey) return;
  if (code) BM.mapMemory.byCode[String(code).trim()] = fsKey;
  const n = N(name); if (n) BM.mapMemory.byName[n] = fsKey;
};

BM.CONF_LABEL = {
  manual:  ["Confirmed","مؤكد","good"],
  memory:  ["Remembered","محفوظ سابقاً","good"],
  keyword: ["Name match","مطابقة بالاسم","info"],
  code:    ["Code guess — review","تخمين من الرقم — يحتاج مراجعة","warn"],
  none:    ["Unmapped","غير مصنف","bad"]
};
})();
