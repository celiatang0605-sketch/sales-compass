-- Phase 3: leads table for the 展会线索 module.
--
-- HOW TO RUN (this project uses an external Supabase, not Lovable Cloud):
--   1. Open Supabase Dashboard → SQL Editor → New query
--   2. Paste the contents of this file
--   3. Run
--
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS.

create table if not exists public.leads (
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
  current_vendor text,

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
  updated_at timestamptz not null default now(),
  converted_customer_id uuid,

  source text not null default 'other'
    check (source in (
      'expo', 'marketing_assigned', 'list_claimed', 'existing_upsell',
      'referral', 'self_developed', 'other'
    )),
  source_date date,
  source_detail text,
  hq_city text,
  company_size text,
  contact_department text,
  website text,

  researched_at timestamptz,
  called_at timestamptz,
  wechat_added_at timestamptz,
  intro_sent_at timestamptz,
  needs_captured_at timestamptz,

  exit_reason text,
  exit_at timestamptz,
  resume_on date,

  lead_stage text generated always as (
    CASE
      WHEN (needs_captured_at IS NOT NULL) THEN 'ready_to_convert'::text
      WHEN (intro_sent_at IS NOT NULL) THEN 'need_discovery'::text
      WHEN (wechat_added_at IS NOT NULL) THEN 'send_intro'::text
      WHEN (called_at IS NOT NULL) THEN 'add_wechat'::text
      WHEN (researched_at IS NOT NULL) THEN 'call'::text
      ELSE 'research'::text
    END
  ) stored
);

grant select, insert, update, delete on public.leads to authenticated;
grant all on public.leads to service_role;

alter table public.leads enable row level security;

drop policy if exists "leads select own" on public.leads;
create policy "leads select own" on public.leads
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "leads insert own" on public.leads;
create policy "leads insert own" on public.leads
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "leads update own" on public.leads;
create policy "leads update own" on public.leads
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "leads delete own" on public.leads;
create policy "leads delete own" on public.leads
  for delete to authenticated using (auth.uid() = user_id);

create index if not exists idx_leads_user_created
  on public.leads (user_id, created_at desc);
create index if not exists idx_leads_user_status
  on public.leads (user_id, status);
create index if not exists idx_leads_user_priority
  on public.leads (user_id, priority);
create index if not exists idx_leads_user_next_action_date
  on public.leads (user_id, next_action_date);

create or replace function public.touch_leads_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

drop trigger if exists trg_leads_touch on public.leads;
create trigger trg_leads_touch
  before update on public.leads
  for each row execute function public.touch_leads_updated_at();
