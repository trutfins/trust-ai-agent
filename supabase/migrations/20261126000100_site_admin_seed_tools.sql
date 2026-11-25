-- =====================================================================
-- نقل الأدوات الحالية إلى سجل «إدارة الموقع» كمسودات غير منشورة.
-- - يعاد تشغيله دون تكرار (on conflict do nothing) ولا يكتب فوق تعديلات المحررين.
-- - لا يُنشر شيء: الصفحات الحالية تبقى كما هي حتى ينشر مستخدم مخوّل.
-- - الأسماء والروابط مأخوذة من trust_services ومن الصفحات المنشورة في 2026-11-25.
--   تفاصيل الصفحات (لمن تناسب، المدخلات...) تُستكمل من HTML الحالي في المرحلة 3.
-- =====================================================================

insert into public.site_items(kind, key, draft)
select 'tool', s.code, jsonb_build_object(
  'service_code', s.code,
  'slug', m.slug,
  'legacy_path', m.legacy_path,
  'status', 'available',
  'icon', s.icon,
  'sort_order', m.sort_order,
  'ar', jsonb_build_object('name', s.name_ar, 'short', s.description_ar),
  'en', jsonb_build_object('name', m.en_name, 'short', ''),
  'links', jsonb_build_object('learn_more', m.legacy_path, 'try', m.try_url, 'login', m.login_url))
from public.trust_services s
join (values
  -- code,            slug,              legacy_path,        en_name,                      try_url,                    login_url,                                    sort
  ('ai_agent',        'ai-agent',        null,               'The Smart Financial Agent',  'https://ai.trustfins.org/', null,                                          0),
  ('credit_analysis', 'credit-analysis', '/credit-analysis', 'Financial & credit analysis', null,                      'https://analysis.trustfins.org/?lang=ar',     1),
  ('smart_cfo',       'smart-cfo',       '/smart-cfo',       'Smart CFO',                  null,                       'https://cashflow.trustfins.org/?lang=ar',     2),
  ('invoice_journal', 'invoice-journal', '/invoice-journal', 'Invoice-to-Journal',         null,                       'https://invoices.trustfins.org/',             3)
) as m(code, slug, legacy_path, en_name, try_url, login_url, sort_order) on m.code = s.code
on conflict (kind, key) do nothing;

-- ترتيب وأحجام بطاقات «الخدمات الرقمية» كما تظهر اليوم: الوكيل بطاقة مميّزة أولًا
insert into public.site_items(kind, key, draft)
values ('tool_layout', 'digital-services', jsonb_build_object(
  'order', jsonb_build_array('ai_agent','credit_analysis','smart_cfo','invoice_journal'),
  'sizes', jsonb_build_object('ai_agent','featured','credit_analysis','md','smart_cfo','md','invoice_journal','md')))
on conflict (kind, key) do nothing;
