# إدارة الموقع — قاعدة البيانات

ترحيلات إضافية فقط (لا تعدّل جداول قائمة). لم تُطبَّق على الإنتاج.

- `migrations/20261126000000_site_admin_core.sql`: الصلاحيات (content_edit, content_publish, pricing_manage)، عناصر المحتوى بمسودة ونسخة منشورة، النسخ، سجل التعديلات، التحقق قبل النشر، الاستعادة، وتعديل الأسعار كإجراء مستقل.
- `migrations/20261126000100_site_admin_seed_tools.sql`: نقل الأدوات الأربع الحالية كمسودات غير منشورة، قابل لإعادة التشغيل دون تكرار.
- `tests/run.sh`: ينشئ قاعدة Postgres محلية مؤقتة بمحاكاة لـ Supabase، يطبّق الترحيلات مرتين، ثم يشغّل الاختبارات.

```bash
PSQL="sudo -u postgres psql" supabase/tests/run.sh
```

التراجع (قبل وجود محتوى منشور): `drop function` لدوال `site_*` ثم `drop table site_audit, site_item_versions, site_items, site_permissions`.
