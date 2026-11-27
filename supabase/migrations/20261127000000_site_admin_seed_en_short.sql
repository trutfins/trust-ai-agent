-- =====================================================================
-- يملأ الوصف الإنجليزي القصير للأدوات المنقولة التي بقيت فارغة.
-- الترحيل 20261126000100 ترك en.short = '' فيفشل النشر (en.short_required).
-- يعدّل المسودات الفارغة فقط ولا يكتب فوق تعديلات المحررين. آمن للتكرار.
-- ملاحظة: النصوص الإنجليزية ترجمة مباشرة للأوصاف العربية الحالية، وتحتاج مراجعة المالك.
-- =====================================================================

update public.site_items i
   set draft = jsonb_set(i.draft, '{en,short}', to_jsonb(v.short_en), true)
  from (values
    ('ai_agent',        'AI-powered financial assistant'),
    ('credit_analysis', 'Advanced financial and credit analysis, with CFO reports'),
    ('smart_cfo',       'Cash flow management and tracking'),
    ('invoice_journal', 'Convert invoices into accounting journal entries')
  ) as v(key, short_en)
 where i.kind = 'tool' and i.key = v.key
   and coalesce(i.draft->'en'->>'short', '') = '';
