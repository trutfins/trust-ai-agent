-- نسخة مطابقة لبنية الجداول والدوال القائمة في الإنتاج التي تعتمد عليها «إدارة الموقع» (للمشروع التجريبي فقط).
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

