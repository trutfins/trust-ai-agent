/* TRUST — financial ratio calculator (runs in the browser).
   After each calculation it publishes the result as window.TRUST_LAST and a "trust:calc" event,
   so the page can offer to save it to the client's account. */
(() => {
  'use strict';
  const f = document.querySelector('#calcform');
  if (!f) return;
  const out = document.querySelector('#results');
  const fmt = new Intl.NumberFormat('ar', { maximumFractionDigits: 2 });

  f.addEventListener('reset', () => {
    out.classList.add('hidden'); out.replaceChildren();
    window.TRUST_LAST = null; document.dispatchEvent(new CustomEvent('trust:reset'));
  });

  const labelOf = el => { const l = f.querySelector('label[for=' + el.id + ']'); return l ? l.childNodes[0].textContent.trim() : el.name; };
  const NONNEG = ['currentAssets', 'inventory', 'currentLiabilities', 'assets', 'liabilities', 'revenue', 'cogs'];
  // Blocking problems: values that cannot be right for any business
  function checkInputs(v) {
    for (const k of NONNEG) if (v[k] < 0) return { field: k, msg: 'القيمة في حقل «' + labelOf(f.querySelector('[name=' + k + ']')) + '» لا يمكن أن تكون سالبة.' };
    if (v.inventory > v.currentAssets) return { field: 'inventory', msg: 'المخزون جزء من الأصول المتداولة، فلا يمكن أن يكون أكبر منها.' };
    if (v.currentAssets > v.assets) return { field: 'currentAssets', msg: 'الأصول المتداولة جزء من إجمالي الأصول، فلا يمكن أن تكون أكبر منه.' };
    if (v.currentLiabilities > v.liabilities) return { field: 'currentLiabilities', msg: 'الالتزامات المتداولة جزء من إجمالي الالتزامات، فلا يمكن أن تكون أكبر منه.' };
    if (v.assets === 0) return { field: 'assets', msg: 'إجمالي الأصول لا يمكن أن يكون صفراً لمشروع قائم.' };
    return null;
  }
  // Non-blocking warnings shown with the results
  function warningsFor(v) {
    const w = [];
    const gap = v.assets - (v.liabilities + v.equity);
    if (Math.abs(gap) > Math.max(1, v.assets * 0.01)) w.push('الميزانية غير متوازنة: إجمالي الأصول لا يساوي الالتزامات + حقوق الملكية (الفرق ' + fmt.format(gap) + '). راجع الأرقام قبل الاعتماد على النسب.');
    if (v.equity < 0) w.push('حقوق الملكية سالبة: المشروع في عجز متراكم، ونسب العائد على حقوق الملكية والمديونية إليها لا تُفسَّر بالطريقة المعتادة.');
    if (v.revenue === 0) w.push('المبيعات صفر، لذلك لا يمكن حساب الهوامش.');
    else if (v.cogs > v.revenue) w.push('تكلفة المبيعات أكبر من المبيعات: هامش مجمل الربح سالب.');
    if (v.revenue > 0 && v.netProfit > v.revenue) w.push('صافي الربح أكبر من المبيعات، وهذا غير معتاد. تأكد من الأرقام.');
    if (v.operatingProfit < v.netProfit && v.netProfit > 0 && v.operatingProfit >= 0) w.push('صافي الربح أكبر من الربح التشغيلي: يعني وجود إيرادات أخرى غير تشغيلية. تأكد أن هذا صحيح.');
    return w;
  }

  f.addEventListener('submit', e => {
    e.preventDefault();
    const errBox = document.querySelector('#calcErr');
    const say = (msg, el) => { if (errBox) errBox.textContent = msg; if (el) el.focus(); };
    say('');
    const v = {};
    for (const el of f.querySelectorAll('input[type=number]')) {
      const raw = el.value.trim();
      const n = raw === '' ? NaN : Number(raw);
      if (!Number.isFinite(n)) { say('أدخل قيمة رقمية في حقل «' + labelOf(el) + '» (يمكن كتابة 0).', el); return; }
      v[el.name] = n;
    }
    const issue = checkInputs(v);
    if (issue) { say(issue.msg, f.querySelector('[name=' + issue.field + ']')); return; }
    const div = (a, b) => b === 0 ? null : a / b;
    const metrics = [
      { key: 'currentRatio', label: 'نسبة التداول', value: div(v.currentAssets, v.currentLiabilities) },
      { key: 'quickRatio', label: 'النسبة السريعة', value: div(v.currentAssets - v.inventory, v.currentLiabilities) },
      { key: 'workingCapital', label: 'رأس المال العامل', value: v.currentAssets - v.currentLiabilities, money: true },
      { key: 'grossMargin', label: 'هامش مجمل الربح', value: div(v.revenue - v.cogs, v.revenue), percent: true },
      { key: 'operatingMargin', label: 'هامش الربح التشغيلي', value: div(v.operatingProfit, v.revenue), percent: true },
      { key: 'netMargin', label: 'هامش صافي الربح', value: div(v.netProfit, v.revenue), percent: true },
      { key: 'returnOnAssets', label: 'العائد على الأصول', value: div(v.netProfit, v.assets), percent: true },
      { key: 'returnOnEquity', label: 'العائد على حقوق الملكية', value: div(v.netProfit, v.equity), percent: true },
      { key: 'debtRatio', label: 'نسبة المديونية', value: div(v.liabilities, v.assets), percent: true },
      { key: 'debtToEquity', label: 'الالتزامات إلى حقوق الملكية', value: div(v.liabilities, v.equity) }
    ];

    out.replaceChildren();
    const h = document.createElement('h2'); h.textContent = 'نتائج التحليل'; out.append(h);
    const table = document.createElement('table');
    for (const m of metrics) {
      const tr = document.createElement('tr'), th = document.createElement('th'), td = document.createElement('td');
      th.textContent = m.label;
      td.textContent = m.value === null ? 'غير قابل للحساب (المقام صفر)' : m.percent ? fmt.format(m.value * 100) + '%' : fmt.format(m.value);
      tr.append(th, td); table.append(tr);
    }
    out.append(table);
    const warns = warningsFor(v);
    if (warns.length) {
      const box = document.createElement('div'); box.className = 'notice'; box.style.marginTop = '12px';
      const t = document.createElement('b'); t.textContent = 'تنبيهات على البيانات:'; box.append(t);
      const ul = document.createElement('ul'); ul.style.margin = '6px 0 0'; ul.style.paddingInlineStart = '20px';
      warns.forEach(x => { const li = document.createElement('li'); li.textContent = x; ul.append(li); });
      box.append(ul); out.append(box);
    }
    const note = document.createElement('p'); note.className = 'muted'; note.style.marginTop = '10px';
    note.textContent = 'تفسير المؤشرات يعتمد على القطاع وطبيعة النشاط؛ هذه قراءة أولية دون مراجعة اتساق القوائم أو تحليل تاريخي.';
    out.append(note);
    out.classList.remove('hidden');

    window.TRUST_LAST = { input: v, metrics, warnings: warningsFor(v) };
    document.dispatchEvent(new CustomEvent('trust:calc', { detail: window.TRUST_LAST }));
    if (out.scrollIntoView) out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
})();
