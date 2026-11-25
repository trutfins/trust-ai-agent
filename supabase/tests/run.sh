#!/usr/bin/env bash
# يشغّل ترحيلات «إدارة الموقع» واختباراتها على قاعدة Postgres محلية مؤقتة.
# الاستخدام: PGURL=postgres://... supabase/tests/run.sh   (افتراضيًا قاعدة trust_site_test محلية)
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=${TEST_DB:-trust_site_test}
PSQL=${PSQL:-psql}
$PSQL -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
$PSQL -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/tests/fixtures/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do
  $PSQL -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f"
  $PSQL -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f"   # مرّة ثانية: يجب أن يكون الترحيل قابلاً لإعادة التشغيل
done
$PSQL -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/site_admin.test.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  /  /'
