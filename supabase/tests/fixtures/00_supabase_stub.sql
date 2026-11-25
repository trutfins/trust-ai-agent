-- بيئة اختبار محلية تحاكي ما يلزم من Supabase والجداول القائمة في الإنتاج.
-- بيانات تجريبية فقط. تعريفات الجداول والدوال منسوخة من الإنتاج بتاريخ 2026-11-25.
create extension if not exists pgcrypto;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, public to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

create table if not exists public.staff_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','consultant','support')),
  granted_at timestamptz default now());
create table if not exists public.trust_services (
  code text primary key check (code in ('smart_cfo','credit_analysis','invoice_journal','ai_agent')),
  name_ar text, name_en text, enabled boolean, url text, description_ar text, icon text, sort_order int);
create table if not exists public.trust_plans (
  code text primary key, name_ar text, name_en text, audience_ar text,
  price_usd_month numeric check (price_usd_month >= 0), price_usd_year numeric check (price_usd_year >= 0),
  monthly_analyses int, lifetime_analyses int, monthly_messages int, cost_cap_usd numeric,
  max_companies int check (max_companies >= 1), modes text[], features jsonb check (jsonb_typeof(features)='object'),
  active boolean, sort_order int, updated_at timestamptz, services text[]);
create table if not exists public.trust_user_plans (user_id uuid, plan_code text, status text, billing text);

create or replace function public.analysis_is_admin() returns boolean language sql stable security definer
set search_path to 'public' as
$$ select exists (select 1 from public.staff_roles s where s.user_id = auth.uid() and s.role = 'admin'); $$;

insert into public.trust_services values
 ('credit_analysis','التحليل المالي والائتماني','Financial & credit analysis',true,'https://analysis.trustfins.org/','تحليل مالي وائتماني متقدم وتقارير CFO','📊',1),
 ('smart_cfo','المدير المالي الذكي','Smart CFO',true,'https://cashflow.trustfins.org/','إدارة ومتابعة التدفقات النقدية','💰',2),
 ('invoice_journal','محول الفواتير والقيود المحاسبية','Invoice-to-Journal Converter',true,'https://invoices.trustfins.org/','تحويل الفواتير إلى قيود محاسبية','🧾',3),
 ('ai_agent','الوكيل المالي الذكي','AI Financial Agent',true,'https://ai.trustfins.org/','مساعد مالي بالذكاء الاصطناعي','🤖',4)
on conflict do nothing;
insert into public.trust_plans(code,name_ar,name_en,price_usd_month,price_usd_year,max_companies,features,active,sort_order,services) values
 ('free','مجاني','Free',0,0,1,'{}',true,1,'{}'),
 ('basic','أساسي','Basic',15,150,1,'{}',true,2,'{smart_cfo}'),
 ('pro','مهني','Professional',29,290,5,'{}',true,3,'{smart_cfo,invoice_journal}'),
 ('credit','ائتمان ومؤسسات','Credit & Institutions',59,590,20,'{}',true,4,'{smart_cfo,invoice_journal,credit_analysis}')
on conflict do nothing;

-- حسابات تجريبية
insert into auth.users values
 ('00000000-0000-0000-0000-00000000000a','admin@test.local'),
 ('00000000-0000-0000-0000-0000000000e1','editor@test.local'),
 ('00000000-0000-0000-0000-0000000000b1','publisher@test.local'),
 ('00000000-0000-0000-0000-0000000000c1','pricing@test.local'),
 ('00000000-0000-0000-0000-0000000000d1','client@test.local')
on conflict do nothing;
insert into public.staff_roles(user_id, role) values ('00000000-0000-0000-0000-00000000000a','admin') on conflict do nothing;
insert into public.trust_user_plans values ('00000000-0000-0000-0000-0000000000d1','pro','active','monthly');
