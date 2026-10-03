-- Shared Supabase schema for bankv1 and good.
-- Applies once to the dedicated project bank-good-shared.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  role text not null default 'user' check (role in ('admin', 'user')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_modules (
  module_key text primary key,
  app_code text not null check (app_code in ('bankv1', 'good')),
  label_ar text not null,
  label_en text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.module_access (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  module_key text not null references public.app_modules(module_key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, module_key)
);

create table if not exists public.bank_records (
  id uuid primary key default gen_random_uuid(),
  module_key text not null references public.app_modules(module_key),
  record_type text not null check (record_type in ('profile', 'statement', 'snapshot', 'history')),
  external_id bigint,
  created_by uuid references public.profiles(id) on delete set null,
  status text not null default 'draft',
  title text,
  customer_name text,
  account_number text,
  statement_reference text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bank_imports (
  id uuid primary key default gen_random_uuid(),
  module_key text not null references public.app_modules(module_key),
  created_by uuid references public.profiles(id) on delete set null,
  original_filename text not null,
  sheet_name text,
  column_map jsonb not null default '{}'::jsonb,
  accepted_rows integer not null default 0,
  rejected_rows integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  module_key text not null references public.app_modules(module_key),
  record_id uuid references public.bank_records(id) on delete cascade,
  import_id uuid references public.bank_imports(id) on delete set null,
  transaction_date date,
  description text not null,
  transaction_side text not null,
  debit numeric(18,2) not null default 0,
  credit numeric(18,2) not null default 0,
  running_balance numeric(18,2),
  external_reference text,
  operation_number text not null,
  is_rejected boolean not null default false,
  rejection_reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.memory_values (
  id uuid primary key default gen_random_uuid(),
  app_code text not null check (app_code in ('bankv1', 'good')),
  module_key text not null references public.app_modules(module_key),
  field_key text not null,
  value_text text not null,
  label_ar text,
  label_en text,
  usage_count integer not null default 1,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_key, field_key, value_text)
);

create table if not exists public.work_letter_companies (
  id text primary key,
  name_ar text not null,
  name_en text not null,
  short_name text,
  activity_ar text,
  activity_en text,
  settings jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_letters (
  id uuid primary key default gen_random_uuid(),
  module_key text not null default 'good_work_letters' references public.app_modules(module_key),
  company_id text references public.work_letter_companies(id) on delete set null,
  language text not null check (language in ('ar', 'en')),
  created_by uuid references public.profiles(id) on delete set null,
  status text not null default 'draft',
  employee_name text,
  reference text,
  internal_no text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conduct_certificates (
  id uuid primary key default gen_random_uuid(),
  module_key text not null default 'good_conduct_certificates' references public.app_modules(module_key),
  created_by uuid references public.profiles(id) on delete set null,
  status text not null default 'draft',
  full_name_ar text,
  full_name_en text,
  reference_no text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  app_code text not null check (app_code in ('bankv1', 'good')),
  module_key text references public.app_modules(module_key),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.health_check (
  id boolean primary key default true check (id = true),
  service text not null default 'bank-good-shared',
  status text not null default 'ok' check (status = 'ok'),
  schema_version text not null default '001_shared_bank_good_schema',
  updated_at timestamptz not null default now()
);

insert into public.app_modules (module_key, app_code, label_ar, label_en)
values
  ('bank_kuraimi', 'bankv1', 'بنك الكريمي', 'Al Kuraimi Bank'),
  ('bank_tadhamon', 'bankv1', 'بنك التضامن', 'Tadhamon Bank'),
  ('bank_yemeni_commercial', 'bankv1', 'البنك اليمني التجاري', 'Yemen Commercial Bank'),
  ('good_work_letters', 'good', 'خطابات العمل', 'Work Letters'),
  ('good_conduct_certificates', 'good', 'حسن سيرة وسلوك', 'Good Conduct Certificates')
on conflict (module_key) do update set
  app_code = excluded.app_code,
  label_ar = excluded.label_ar,
  label_en = excluded.label_en,
  is_active = true;

insert into public.health_check (id, service, status, schema_version)
values (true, 'bank-good-shared', 'ok', '001_shared_bank_good_schema')
on conflict (id) do update set updated_at = now();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists bank_records_set_updated_at on public.bank_records;
create trigger bank_records_set_updated_at before update on public.bank_records for each row execute function public.set_updated_at();
drop trigger if exists memory_values_set_updated_at on public.memory_values;
create trigger memory_values_set_updated_at before update on public.memory_values for each row execute function public.set_updated_at();
drop trigger if exists work_letter_companies_set_updated_at on public.work_letter_companies;
create trigger work_letter_companies_set_updated_at before update on public.work_letter_companies for each row execute function public.set_updated_at();
drop trigger if exists work_letters_set_updated_at on public.work_letters;
create trigger work_letters_set_updated_at before update on public.work_letters for each row execute function public.set_updated_at();
drop trigger if exists conduct_certificates_set_updated_at on public.conduct_certificates;
create trigger conduct_certificates_set_updated_at before update on public.conduct_certificates for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email), new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and is_active);
$$;

create or replace function public.can_access_module(p_module_key text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.module_access
    where profile_id = auth.uid() and module_key = p_module_key
  );
$$;

alter table public.profiles enable row level security;
alter table public.app_modules enable row level security;
alter table public.module_access enable row level security;
alter table public.bank_records enable row level security;
alter table public.bank_imports enable row level security;
alter table public.bank_transactions enable row level security;
alter table public.memory_values enable row level security;
alter table public.work_letter_companies enable row level security;
alter table public.work_letters enable row level security;
alter table public.conduct_certificates enable row level security;
alter table public.audit_log enable row level security;
alter table public.health_check enable row level security;

drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin on public.profiles for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

drop policy if exists modules_select_authenticated on public.app_modules;
create policy modules_select_authenticated on public.app_modules for select to authenticated using (is_active);

drop policy if exists module_access_select_self_or_admin on public.module_access;
create policy module_access_select_self_or_admin on public.module_access for select to authenticated using (profile_id = auth.uid() or public.is_admin());
drop policy if exists module_access_admin_write on public.module_access;
create policy module_access_admin_write on public.module_access for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Bank records and transactions are scoped by module and creator; admins can manage all assigned modules.
drop policy if exists bank_records_access on public.bank_records;
create policy bank_records_access on public.bank_records for all to authenticated using (public.can_access_module(module_key) and (created_by = auth.uid() or public.is_admin())) with check (public.can_access_module(module_key) and (created_by = auth.uid() or public.is_admin()));
drop policy if exists bank_imports_access on public.bank_imports;
create policy bank_imports_access on public.bank_imports for all to authenticated using (public.can_access_module(module_key) and (created_by = auth.uid() or public.is_admin())) with check (public.can_access_module(module_key) and (created_by = auth.uid() or public.is_admin()));
drop policy if exists bank_transactions_access on public.bank_transactions;
create policy bank_transactions_access on public.bank_transactions for all to authenticated using (public.can_access_module(module_key) and (created_by = auth.uid() or public.is_admin())) with check (public.can_access_module(module_key) and (created_by = auth.uid() or public.is_admin()));

-- Reusable values are readable by assigned users and editable by admins only.
drop policy if exists memory_values_select on public.memory_values;
create policy memory_values_select on public.memory_values for select to authenticated using (public.can_access_module(module_key));
drop policy if exists memory_values_admin_write on public.memory_values;
create policy memory_values_admin_write on public.memory_values for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists companies_select on public.work_letter_companies;
create policy companies_select on public.work_letter_companies for select to authenticated using (public.can_access_module('good_work_letters'));
drop policy if exists companies_admin_write on public.work_letter_companies;
create policy companies_admin_write on public.work_letter_companies for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists work_letters_access on public.work_letters;
create policy work_letters_access on public.work_letters for all to authenticated using (public.can_access_module(module_key) and (created_by = auth.uid() or public.is_admin())) with check (public.can_access_module(module_key) and (created_by = auth.uid() or public.is_admin()));
drop policy if exists conduct_access on public.conduct_certificates;
create policy conduct_access on public.conduct_certificates for all to authenticated using (public.can_access_module(module_key) and (created_by = auth.uid() or public.is_admin())) with check (public.can_access_module(module_key) and (created_by = auth.uid() or public.is_admin()));

drop policy if exists audit_admin_only on public.audit_log;
create policy audit_admin_only on public.audit_log for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists health_public_read on public.health_check;
create policy health_public_read on public.health_check for select to anon, authenticated using (true);

grant select on public.health_check to anon, authenticated;

grant usage, select on all sequences in schema public to authenticated;

create index if not exists bank_records_module_updated_idx on public.bank_records (module_key, updated_at desc);
create index if not exists bank_transactions_record_idx on public.bank_transactions (record_id, created_at);
create index if not exists memory_values_lookup_idx on public.memory_values (module_key, field_key, usage_count desc);
create index if not exists work_letters_scope_idx on public.work_letters (module_key, company_id, language, updated_at desc);
create index if not exists conduct_scope_idx on public.conduct_certificates (module_key, updated_at desc);
