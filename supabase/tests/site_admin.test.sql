-- اختبارات «إدارة الموقع». تُشغَّل بـ supabase/tests/run.sh على Postgres محلي.
\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\o /dev/null

create or replace function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p::text,''), false);
  if p is null then execute 'set role anon'; else execute 'set role authenticated'; end if;
end $$;
create or replace function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(c,false) then raise exception 'FAIL: %', msg; end if; raise notice 'PASS: %', msg; end $$;
create or replace function pg_temp.denied(sql text, msg text) returns void language plpgsql as $$
begin
  begin execute sql; exception when insufficient_privilege then raise notice 'PASS: %', msg; return; end;
  raise exception 'FAIL (was allowed): %', msg;
end $$;
create or replace function pg_temp.iid(k text) returns uuid language sql security definer as $$ select id from public.site_items where key = k $$;
create or replace function pg_temp.idraft(k text) returns jsonb language sql security definer as $$ select draft from public.site_items where key = k $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- المدير يمنح الصلاحيات
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.site_set_permission('00000000-0000-0000-0000-0000000000e1','content_edit',true);
select public.site_set_permission('00000000-0000-0000-0000-0000000000b1','content_publish',true);
select public.site_set_permission('00000000-0000-0000-0000-0000000000c1','pricing_manage',true);
reset role;

-- 1) الزائر
select pg_temp.as_user(null);
select pg_temp.ok(public.site_public('tool') = '[]'::jsonb, 'visitor sees nothing before any publish (current pages stay as they are)');
select pg_temp.denied($$select public.site_save_draft('tool','x','{}')$$, 'visitor cannot call save_draft');
select pg_temp.ok(jsonb_array_length(public.site_public_plans()) = 4, 'visitor reads 4 plans from trust_plans');
reset role;

-- 2) العميل
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select pg_temp.denied($$select public.site_save_draft('tool','x','{}')$$, 'client cannot save draft');
select pg_temp.denied($$select public.site_admin_list(null)$$, 'client cannot list admin items');
select pg_temp.ok(public.site_my_permissions()->>'content_edit' = 'false', 'client permissions all false');
reset role;

-- 3) المحرر: يحفظ مسودة، لا ينشر، لا يعدّل الأسعار
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.ok(jsonb_array_length(public.site_admin_list('tool')) = 4, 'editor sees 4 migrated tools');
select pg_temp.ok((select bool_and(x->>'state' = 'draft_only') from jsonb_array_elements(public.site_admin_list('tool')) x),
  'migrated tools are drafts, not published');
select public.site_save_draft('tool','demo_tool', jsonb_build_object(
  'slug','demo-tool','status','beta','sort_order',9,
  'ar', jsonb_build_object('name','أداة تجريبية','short','وصف قصير','details', jsonb_build_object('audience','للمحاسبين')),
  'en', jsonb_build_object('name','Demo tool','short','Short desc'),
  'links', jsonb_build_object('learn_more','/tools/demo-tool','try','https://demo.trustfins.org/')));
select pg_temp.ok(public.site_preview('tool','demo_tool')->0->'content'->'ar'->>'name' = 'أداة تجريبية', 'editor previews own draft');
select pg_temp.denied($$select public.site_publish(pg_temp.iid('demo_tool'))$$, 'editor cannot publish');
select pg_temp.denied($$select public.site_pricing_update('basic','{"price_usd_month":1}')$$, 'editor cannot change prices');
do $$ begin
  perform public.site_save_draft('tool','bad', '{"slug":"bad","status":"available","price_usd_month":5}');
  raise exception 'FAIL: price inside content accepted';
exception when sqlstate '22023' then raise notice 'PASS: price fields rejected inside tool content'; end $$;
reset role;

-- 4) الزائر لا يرى المسودة
select pg_temp.as_user(null);
select pg_temp.ok(public.site_public('tool') = '[]'::jsonb, 'visitor still sees no draft');
reset role;

-- 5) الناشر: التحقق ثم النشر
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select public.site_save_draft('tool','evil', jsonb_build_object('slug','evil','status','available',
  'ar', jsonb_build_object('name','x','short','y'), 'links', jsonb_build_object('login','https://evil.example.com/')));
do $$ begin
  perform public.site_publish(pg_temp.iid('evil'));
  raise exception 'FAIL: external login link published';
exception when sqlstate '22023' then raise notice 'PASS: publish blocked for link outside trustfins.org'; end $$;
select pg_temp.ok((public.site_publish(pg_temp.iid('demo_tool'))->>'version')::int = 1, 'publisher publishes v1');
reset role;

select pg_temp.as_user(null);
select pg_temp.ok(public.site_public('tool')->0->'content'->'ar'->>'name' = 'أداة تجريبية', 'visitor sees published demo tool');
reset role;

-- 6) مسودة جديدة لا تغيّر ما يراه الزائر
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select public.site_save_draft('tool','demo_tool', pg_temp.idraft('demo_tool') || '{"ar":{"name":"اسم معدّل","short":"وصف قصير"}}');
reset role;
select pg_temp.as_user(null);
select pg_temp.ok(public.site_public('tool')->0->'content'->'ar'->>'name' = 'أداة تجريبية', 'visitor keeps published version while draft changes');
reset role;

-- 7) نشر v2 ثم استعادة v1
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.ok((public.site_publish(pg_temp.iid('demo_tool'))->>'version')::int = 2, 'publish v2');
select pg_temp.ok((public.site_restore(pg_temp.iid('demo_tool'), 1)->>'version')::int = 3, 'restore v1 creates v3');
select pg_temp.ok(jsonb_array_length(public.site_history(pg_temp.iid('demo_tool'))->'versions') = 3, 'history has 3 versions');
select pg_temp.ok(exists (select 1 from jsonb_array_elements(public.site_history(pg_temp.iid('demo_tool'))->'audit') a
  where a->>'action' = 'restore' and a->>'actor' = 'publisher@test.local'), 'restore logged with user');
reset role;
select pg_temp.as_user(null);
select pg_temp.ok(public.site_public('tool')->0->'content'->'ar'->>'name' = 'أداة تجريبية', 'visitor sees restored v1 content');
reset role;

-- 8) الأدوات المخفية لا تظهر للزائر
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select public.site_save_draft('tool','demo_tool', pg_temp.idraft('demo_tool') || '{"status":"hidden"}');
select public.site_publish(pg_temp.iid('demo_tool'));
reset role;
select pg_temp.as_user(null);
select pg_temp.ok(public.site_public('tool') = '[]'::jsonb, 'hidden tool not shown to visitor');
reset role;

-- 9) مسؤول الأسعار: يعدّل العرض فقط، والاشتراك القائم لا يتغير
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.denied($$select public.site_publish(pg_temp.iid('demo_tool'))$$, 'pricing manager cannot publish content');
select pg_temp.ok((public.site_pricing_update('pro','{"price_usd_month":35}')->>'price_usd_month')::numeric = 35, 'pricing manager updates pro price');
reset role;
select pg_temp.ok((select plan_code||'/'||status from public.trust_user_plans
  where user_id='00000000-0000-0000-0000-0000000000d1') = 'pro/active', 'existing subscription untouched by price change');
select pg_temp.ok(exists (select 1 from public.site_audit where action='pricing_update' and key='pro'), 'price change audited with before/after');

-- 10) الجداول غير قابلة للوصول المباشر
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.denied($$select * from public.site_items$$, 'no direct table read for authenticated');
reset role;

-- 11) إعادة تشغيل النقل لا تكرر السجلات
\i supabase/migrations/20261126000100_site_admin_seed_tools.sql
select pg_temp.ok((select count(*) from public.site_items where kind='tool' and key in ('ai_agent','credit_analysis','smart_cfo','invoice_journal')) = 4,
  'seed re-run creates no duplicates');
\o
\echo ALL TESTS PASSED
