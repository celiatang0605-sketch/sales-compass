-- Phase 3: expo_leads table for the 展会线索 module.
--
-- HOW TO RUN (this project uses an external Supabase, not Lovable Cloud):
--   1. Open Supabase Dashboard → SQL Editor → New query
--   2. Paste the contents of this file
--   3. Run
--
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS.

create table if not exists public.expo_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  event_name text,
  event_date date,
  hall text,
  booth text,

  company_name text,
  industry text,
  company_background text,

  contact_name text,
  contact_title text,
  phone text,
  wechat text,
  email text,

  raw_note text,
  conversation_summary text,
  key_info text,
  pain_points text,
  needs text,

  decision_role text,
  budget_signal text,
  timing_signal text,
  existing_vendor text,

  priority text not null default 'unrated'
    check (priority in ('A','B','C','D','unrated')),
  signals text[] not null default '{}',
  score integer,
  score_reason text,

  status text not null default 'to_organize'
    check (status in (
      'to_organize','to_follow_up','contacted','waiting_reply',
      'replied','meeting_scheduled','converted','nurture','invalid'
    )),

  next_action text,
  next_action_date date,
  last_contact_at timestamptz,

  ai_summary text,
  missing_information text,
  suggested_message text,

  business_card_url text,
  photo_urls text[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.expo_leads to authenticated;
grant all on public.expo_leads to service_role;

alter table public.expo_leads enable row level security;

drop policy if exists "expo_leads select own" on public.expo_leads;
create policy "expo_leads select own" on public.expo_leads
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "expo_leads insert own" on public.expo_leads;
create policy "expo_leads insert own" on public.expo_leads
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "expo_leads update own" on public.expo_leads;
create policy "expo_leads update own" on public.expo_leads
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "expo_leads delete own" on public.expo_leads;
create policy "expo_leads delete own" on public.expo_leads
  for delete to authenticated using (auth.uid() = user_id);

create index if not exists idx_expo_leads_user_created
  on public.expo_leads (user_id, created_at desc);
create index if not exists idx_expo_leads_user_status
  on public.expo_leads (user_id, status);
create index if not exists idx_expo_leads_user_priority
  on public.expo_leads (user_id, priority);
create index if not exists idx_expo_leads_user_next_action_date
  on public.expo_leads (user_id, next_action_date);

create or replace function public.touch_expo_leads_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

drop trigger if exists trg_expo_leads_touch on public.expo_leads;
create trigger trg_expo_leads_touch
  before update on public.expo_leads
  for each row execute function public.touch_expo_leads_updated_at();
