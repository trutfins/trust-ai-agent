-- =====================================================================
-- TRUSTFINS — «إدارة الموقع»: الصلاحيات، المحتوى، المسودات، النشر، السجل
-- ترحيل إضافي فقط: لا يعدّل ولا يحذف أي جدول أو دالة قائمة.
-- يُعاد تشغيله بأمان (idempotent).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) صلاحيات الموقع (مستقلة عن staff_roles لأن مفتاحه user_id = دور واحد)
--    admin في staff_roles يملك كل الصلاحيات تلقائيًا.
-- ---------------------------------------------------------------------
create table if not exists public.site_permissions (
  user_id    uuid not null references auth.users(id) on delete cascade,
  perm       text not null check (perm in ('content_edit','content_publish','pricing_manage')),
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now(),
  primary key (user_id, perm)
);
alter table public.site_permissions enable row level security;

create or replace function public.site_can(p_perm text)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select auth.uid() is not null and (
    coalesce(public.analysis_is_admin(), false)
    or exists (select 1 from public.site_permissions sp
               where sp.user_id = auth.uid() and sp.perm = p_perm)
    -- الناشر يستطيع التحرير والمراجعة أيضًا
    or (p_perm = 'content_edit' and exists (select 1 from public.site_permissions sp
               where sp.user_id = auth.uid() and sp.perm = 'content_publish'))
  );
$$;

create or replace function public.site_require(p_perm text)
returns void language plpgsql stable security definer
set search_path = public, pg_temp as $$
begin
  if not public.site_can(p_perm) then
    raise exception 'site_permission_required:%', p_perm using errcode = '42501';
  end if;
end $$;

create or replace function public.site_my_permissions()
returns jsonb language sql stable security definer
set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'is_admin',        coalesce(public.analysis_is_admin(), false),
    'content_edit',    public.site_can('content_edit'),
    'content_publish', public.site_can('content_publish'),
    'pricing_manage',  public.site_can('pricing_manage'));
$$;

-- ---------------------------------------------------------------------
-- 2) عناصر المحتوى: مسودة + نسخة منشورة منفصلتان
-- ---------------------------------------------------------------------
create table if not exists public.site_items (
  id                uuid primary key default gen_random_uuid(),
  kind              text not null check (kind in (
                      'tool','tool_layout','page_section','banner','cta','nav','footer','contact',
                      'service','faq','article','report_sample','download')),
  key               text not null check (key ~ '^[a-z0-9][a-z0-9_\-/]{0,79}$'),
  draft             jsonb not null default '{}'::jsonb check (jsonb_typeof(draft) = 'object'),
  draft_updated_at  timestamptz not null default now(),
  draft_updated_by  uuid references auth.users(id),
  published         jsonb check (published is null or jsonb_typeof(published) = 'object'),
  published_version integer,
  published_at      timestamptz,
  published_by      uuid references auth.users(id),
  archived          boolean not null default false,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id),
  unique (kind, key)
);
alter table public.site_items enable row level security;

create table if not exists public.site_item_versions (
  item_id       uuid not null references public.site_items(id) on delete cascade,
  version       integer not null check (version >= 1),
  content       jsonb not null,
  published_at  timestamptz not null default now(),
  published_by  uuid references auth.users(id),
  restored_from integer,
  primary key (item_id, version)
);
alter table public.site_item_versions enable row level security;

create table if not exists public.site_audit (
  id      bigint generated always as identity primary key,
  item_id uuid,
  kind    text,
  key     text,
  action  text not null,
  actor   uuid,
  at      timestamptz not null default now(),
  detail  jsonb not null default '{}'::jsonb
);
alter table public.site_audit enable row level security;
create index if not exists site_audit_item_idx on public.site_audit(item_id, at desc);

-- الوصول للجداول عبر الدوال فقط
revoke all on public.site_permissions, public.site_items, public.site_item_versions, public.site_audit
  from anon, authenticated;

create or replace function public.site_log(p_item uuid, p_kind text, p_key text, p_action text, p_detail jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.site_audit(item_id, kind, key, action, actor, detail)
  values (p_item, p_kind, p_key, p_action, auth.uid(), coalesce(p_detail, '{}'::jsonb));
$$;
revoke all on function public.site_log(uuid,text,text,text,jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3) التحقق قبل النشر
-- ---------------------------------------------------------------------
create or replace function public.site_is_safe_url(p_url text)
returns boolean language sql immutable as $$
  select p_url is null or p_url = ''
      or p_url ~ '^/[^/]'                                    -- مسار داخلي
      or p_url ~ '^#'                                         -- مرساة
      or p_url ~ '^https://([a-z0-9-]+\.)*trustfins\.org(/|\?|#|$)'
      or p_url ~ '^https://wa\.me/'
      or p_url ~ '^mailto:'
      or p_url ~ '^tel:\+?[0-9]+$';
$$;

-- يمنع وضع الأسعار داخل محتوى تحريري: السعر له مصدر واحد هو trust_plans
create or replace function public.site_has_price_keys(p jsonb)
returns boolean language sql immutable as $$
  select exists (
    select 1 from jsonb_path_query(p, 'strict $.**') v
    where jsonb_typeof(v) = 'object'
      and exists (select 1 from jsonb_object_keys(v) k
                  where k ~ '^(price|prices|price_usd.*|currency|billing.*|entitlements?)$'));
$$;

create or replace function public.site_validate(p_kind text, p_content jsonb)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  errs text[] := '{}';
  l text; u text; st text;
begin
  if public.site_has_price_keys(p_content) then
    errs := array_append(errs, 'price_fields_not_allowed_in_content'::text);
  end if;

  if p_kind = 'tool' then
    st := p_content->>'status';
    if st is null or st not in ('available','beta','soon','hidden') then errs := array_append(errs, 'status_invalid'::text); end if;
    if coalesce(p_content->>'slug','') !~ '^[a-z0-9][a-z0-9\-]{1,60}$' then errs := array_append(errs, 'slug_invalid'::text); end if;
    if coalesce(btrim(p_content#>>'{ar,name}'),'') = '' then errs := array_append(errs, 'ar.name_required'::text); end if;
    if coalesce(btrim(p_content#>>'{ar,short}'),'') = '' then errs := array_append(errs, 'ar.short_required'::text); end if;
    -- الإنجليزية اختيارية؛ إن وُجد الاسم يجب الوصف
    if p_content ? 'en' and coalesce(btrim(p_content#>>'{en,name}'),'') <> ''
       and coalesce(btrim(p_content#>>'{en,short}'),'') = '' then errs := array_append(errs, 'en.short_required'::text); end if;
    foreach l in array array['learn_more','try','login'] loop
      u := p_content#>>array['links',l];
      if not public.site_is_safe_url(u) then errs := array_append(errs, ('links.'||l||'_not_allowed')::text); end if;
    end loop;
    if st in ('available','beta')
       and coalesce(p_content#>>'{links,try}','') = '' and coalesce(p_content#>>'{links,login}','') = '' then
      errs := array_append(errs, 'available_tool_needs_try_or_login'::text);
    end if;
    if st = 'soon' and (coalesce(p_content#>>'{links,try}','') <> '' or coalesce(p_content#>>'{links,login}','') <> '') then
      errs := array_append(errs, 'soon_tool_cannot_link_to_app'::text);
    end if;
    if p_content ? 'service_code' and p_content->>'service_code' is not null
       and not exists (select 1 from public.trust_services s where s.code = p_content->>'service_code') then
      errs := array_append(errs, 'service_code_unknown'::text);
    end if;
  elsif p_kind = 'tool_layout' then
    if jsonb_typeof(p_content->'order') is distinct from 'array' then errs := array_append(errs, 'order_required'::text); end if;
    if exists (select 1 from jsonb_each_text(coalesce(p_content->'sizes','{}'::jsonb)) e
               where e.value not in ('sm','md','lg','featured')) then errs := array_append(errs, 'size_invalid'::text); end if;
  else
    if coalesce(btrim(coalesce(p_content#>>'{ar,title}', p_content#>>'{ar,text}', p_content#>>'{ar,question}', p_content#>>'{ar,label}')),'') = ''
       and jsonb_typeof(p_content->'items') is distinct from 'array' then
      errs := array_append(errs, 'ar_content_required'::text);
    end if;
  end if;

  -- كل الروابط في أي مكان يجب أن تكون آمنة
  if exists (select 1 from jsonb_path_query(p_content, 'strict $.**') v
             where jsonb_typeof(v) = 'object' and v ? 'href'
               and not public.site_is_safe_url(v->>'href')) then
    errs := array_append(errs, 'href_not_allowed'::text);
  end if;

  return jsonb_build_object('ok', cardinality(errs) = 0, 'errors', to_jsonb(errs));
end $$;

-- ---------------------------------------------------------------------
-- 4) RPC: المسودة، النشر، الاستعادة، القوائم، السجل
-- ---------------------------------------------------------------------
create or replace function public.site_save_draft(p_kind text, p_key text, p_content jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.site_items%rowtype; v jsonb;
begin
  perform public.site_require('content_edit');
  if jsonb_typeof(p_content) is distinct from 'object' then raise exception 'invalid_content' using errcode='22023'; end if;
  if public.site_has_price_keys(p_content) then
    raise exception 'price_fields_not_allowed_in_content' using errcode='22023';
  end if;
  insert into public.site_items(kind, key, draft, draft_updated_by, created_by)
  values (p_kind, p_key, p_content, auth.uid(), auth.uid())
  on conflict (kind, key) do update
     set draft = excluded.draft, draft_updated_at = now(), draft_updated_by = auth.uid(), archived = false
  returning * into r;
  v := public.site_validate(p_kind, p_content);
  perform public.site_log(r.id, r.kind, r.key, 'save_draft', jsonb_build_object('valid', v->'ok'));
  return jsonb_build_object('id', r.id, 'validation', v);
end $$;

create or replace function public.site_publish(p_item uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.site_items%rowtype; v jsonb; n integer;
begin
  perform public.site_require('content_publish');
  select * into r from public.site_items where id = p_item for update;
  if not found then raise exception 'item_not_found' using errcode='22023'; end if;
  v := public.site_validate(r.kind, r.draft);
  if not (v->>'ok')::boolean then
    perform public.site_log(r.id, r.kind, r.key, 'publish_rejected', v);
    raise exception 'validation_failed:%', v->>'errors' using errcode='22023';
  end if;
  if r.published is not null and r.published = r.draft then
    return jsonb_build_object('id', r.id, 'version', r.published_version, 'unchanged', true);
  end if;
  select coalesce(max(version),0)+1 into n from public.site_item_versions where item_id = r.id;
  insert into public.site_item_versions(item_id, version, content, published_by) values (r.id, n, r.draft, auth.uid());
  update public.site_items set published = r.draft, published_version = n, published_at = now(), published_by = auth.uid()
   where id = r.id;
  perform public.site_log(r.id, r.kind, r.key, 'publish', jsonb_build_object('version', n));
  return jsonb_build_object('id', r.id, 'version', n);
end $$;

-- الاستعادة تنشر محتوى نسخة سابقة كنسخة جديدة (لا تمحو التاريخ) وتعيد المسودة إليها
create or replace function public.site_restore(p_item uuid, p_version integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.site_items%rowtype; c jsonb; n integer;
begin
  perform public.site_require('content_publish');
  select * into r from public.site_items where id = p_item for update;
  if not found then raise exception 'item_not_found' using errcode='22023'; end if;
  select content into c from public.site_item_versions where item_id = p_item and version = p_version;
  if c is null then raise exception 'version_not_found' using errcode='22023'; end if;
  select coalesce(max(version),0)+1 into n from public.site_item_versions where item_id = r.id;
  insert into public.site_item_versions(item_id, version, content, published_by, restored_from)
  values (r.id, n, c, auth.uid(), p_version);
  update public.site_items
     set published = c, published_version = n, published_at = now(), published_by = auth.uid(),
         draft = c, draft_updated_at = now(), draft_updated_by = auth.uid()
   where id = r.id;
  perform public.site_log(r.id, r.kind, r.key, 'restore', jsonb_build_object('from_version', p_version, 'version', n));
  return jsonb_build_object('id', r.id, 'version', n, 'restored_from', p_version);
end $$;

create or replace function public.site_unpublish(p_item uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.site_items%rowtype;
begin
  perform public.site_require('content_publish');
  update public.site_items set published = null, published_at = now(), published_by = auth.uid()
   where id = p_item returning * into r;
  if not found then raise exception 'item_not_found' using errcode='22023'; end if;
  perform public.site_log(r.id, r.kind, r.key, 'unpublish', '{}'::jsonb);
  return jsonb_build_object('id', r.id, 'published', false);
end $$;

-- قائمة الإدارة: الحالة والترتيب وآخر تعديل
create or replace function public.site_admin_list(p_kind text default null)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.site_require('content_edit');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', i.id, 'kind', i.kind, 'key', i.key,
      'draft', i.draft, 'published', i.published,
      'state', case when i.archived then 'archived'
                    when i.published is null then 'draft_only'
                    when i.published = i.draft then 'published'
                    else 'published_with_changes' end,
      'published_version', i.published_version, 'published_at', i.published_at,
      'draft_updated_at', i.draft_updated_at,
      'draft_updated_by', (select u.email from auth.users u where u.id = i.draft_updated_by),
      'validation', public.site_validate(i.kind, i.draft))
      order by i.kind, coalesce((i.draft->>'sort_order')::int, 1000), i.key)
    from public.site_items i where p_kind is null or i.kind = p_kind), '[]'::jsonb);
end $$;

create or replace function public.site_history(p_item uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.site_require('content_edit');
  return jsonb_build_object(
    'versions', coalesce((select jsonb_agg(jsonb_build_object('version', v.version, 'published_at', v.published_at,
        'published_by', (select u.email from auth.users u where u.id = v.published_by),
        'restored_from', v.restored_from) order by v.version desc)
      from public.site_item_versions v where v.item_id = p_item), '[]'::jsonb),
    'audit', coalesce((select jsonb_agg(jsonb_build_object('action', a.action, 'at', a.at,
        'actor', (select u.email from auth.users u where u.id = a.actor), 'detail', a.detail) order by a.at desc)
      from public.site_audit a where a.item_id = p_item), '[]'::jsonb));
end $$;

-- معاينة المسودة للمخوّلين
create or replace function public.site_preview(p_kind text, p_key text default null)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.site_require('content_edit');
  return coalesce((select jsonb_agg(jsonb_build_object('key', key, 'content', draft))
                     from public.site_items where kind = p_kind and not archived
                      and (p_key is null or key = p_key)), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------
-- 5) القراءة العامة: المنشور فقط، والأدوات المخفية لا تظهر
-- ---------------------------------------------------------------------
create or replace function public.site_public(p_kind text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('key', key, 'content', published)
           order by coalesce((published->>'sort_order')::int, 1000), key), '[]'::jsonb)
    from public.site_items
   where kind = p_kind and published is not null and not archived
     and not (kind = 'tool' and published->>'status' = 'hidden');
$$;

-- الأسعار المعروضة تُقرأ من المصدر الوحيد trust_plans
create or replace function public.site_public_plans()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'code', code, 'name_ar', name_ar, 'name_en', name_en, 'audience_ar', audience_ar,
           'price_usd_month', price_usd_month, 'price_usd_year', price_usd_year,
           'monthly_analyses', monthly_analyses, 'monthly_messages', monthly_messages,
           'max_companies', max_companies, 'services', services, 'features', features)
         order by sort_order), '[]'::jsonb)
    from public.trust_plans where active;
$$;

-- ---------------------------------------------------------------------
-- 6) الأسعار: إجراء مستقل بصلاحية pricing_manage
--    يعدّل العرض العام فقط؛ لا يلمس trust_user_plans ولا trust_service_entitlements.
-- ---------------------------------------------------------------------
create or replace function public.site_pricing_update(p_code text, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare before_row jsonb; after_row jsonb;
begin
  perform public.site_require('pricing_manage');
  if jsonb_typeof(p_patch) is distinct from 'object' or exists (select 1 from jsonb_object_keys(p_patch) k where k not in
     ('name_ar','name_en','audience_ar','price_usd_month','price_usd_year','monthly_analyses','monthly_messages',
      'max_companies','active','sort_order','features')) then
    raise exception 'invalid_patch' using errcode='22023';
  end if;
  select to_jsonb(p) into before_row from public.trust_plans p where code = p_code for update;
  if before_row is null then raise exception 'plan_not_found' using errcode='22023'; end if;
  update public.trust_plans set
    name_ar          = coalesce(p_patch->>'name_ar', name_ar),
    name_en          = coalesce(p_patch->>'name_en', name_en),
    audience_ar      = coalesce(p_patch->>'audience_ar', audience_ar),
    price_usd_month  = coalesce((p_patch->>'price_usd_month')::numeric, price_usd_month),
    price_usd_year   = coalesce((p_patch->>'price_usd_year')::numeric, price_usd_year),
    monthly_analyses = case when p_patch ? 'monthly_analyses' then (p_patch->>'monthly_analyses')::int else monthly_analyses end,
    monthly_messages = case when p_patch ? 'monthly_messages' then (p_patch->>'monthly_messages')::int else monthly_messages end,
    max_companies    = coalesce((p_patch->>'max_companies')::int, max_companies),
    active           = coalesce((p_patch->>'active')::boolean, active),
    sort_order       = coalesce((p_patch->>'sort_order')::int, sort_order),
    features         = coalesce(p_patch->'features', features),
    updated_at       = now()
  where code = p_code
  returning to_jsonb(trust_plans.*) into after_row;
  perform public.site_log(null, 'plan', p_code, 'pricing_update',
    jsonb_build_object('before', before_row, 'after', after_row));
  return after_row;
end $$;

-- إدارة صلاحيات الموقع (للمدير فقط)
create or replace function public.site_set_permission(p_user uuid, p_perm text, p_grant boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not coalesce(public.analysis_is_admin(), false) then
    raise exception 'site_permission_required:admin' using errcode='42501';
  end if;
  if p_grant then
    insert into public.site_permissions(user_id, perm, granted_by) values (p_user, p_perm, auth.uid())
    on conflict do nothing;
  else
    delete from public.site_permissions where user_id = p_user and perm = p_perm;
  end if;
  perform public.site_log(null, 'permission', p_perm, case when p_grant then 'grant' else 'revoke' end,
    jsonb_build_object('user', p_user));
  return jsonb_build_object('user', p_user, 'perm', p_perm, 'granted', p_grant);
end $$;

-- ---------------------------------------------------------------------
-- 7) الصلاحيات على الدوال
-- ---------------------------------------------------------------------
revoke all on function
  public.site_can(text), public.site_require(text), public.site_my_permissions(),
  public.site_validate(text,jsonb), public.site_save_draft(text,text,jsonb), public.site_publish(uuid),
  public.site_restore(uuid,integer), public.site_unpublish(uuid), public.site_admin_list(text),
  public.site_history(uuid), public.site_preview(text,text), public.site_public(text),
  public.site_public_plans(), public.site_pricing_update(text,jsonb), public.site_set_permission(uuid,text,boolean)
  from public;

grant execute on function public.site_public(text), public.site_public_plans() to anon, authenticated;
grant execute on function
  public.site_my_permissions(), public.site_validate(text,jsonb), public.site_save_draft(text,text,jsonb),
  public.site_publish(uuid), public.site_restore(uuid,integer), public.site_unpublish(uuid),
  public.site_admin_list(text), public.site_history(uuid), public.site_preview(text,text),
  public.site_pricing_update(text,jsonb), public.site_set_permission(uuid,text,boolean)
  to authenticated;
