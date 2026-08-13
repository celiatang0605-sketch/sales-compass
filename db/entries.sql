begin;

do $$
begin
  create table if not exists public.entries (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    entry_type text not null,
    content text not null default '',
    entry_date date not null,
    quadrant text,
    focus_date date,
    due_date date,
    status text not null default 'open',
    customer_id uuid,
    opportunity_id uuid,
    related_block_id uuid,
    tags text[] not null default '{}',
    position double precision not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  if not exists (
    select 1 from pg_constraint where conname = 'entries_user_id_fkey'
  ) then
    alter table public.entries
      add constraint entries_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;

  alter table public.entries drop constraint if exists entries_entry_type_check;
  alter table public.entries add constraint entries_entry_type_check
    check (entry_type in ('progress','pitfall','note','todo','idea'));

  alter table public.entries drop constraint if exists entries_quadrant_check;
  alter table public.entries add constraint entries_quadrant_check
    check (quadrant is null or quadrant in ('q1','q2','q3','q4'));

  alter table public.entries drop constraint if exists entries_status_check;
  alter table public.entries add constraint entries_status_check
    check (status in ('open','done','dropped'));

  create index if not exists entries_user_date_idx
    on public.entries (user_id, entry_date desc);
  create index if not exists entries_user_status_due_idx
    on public.entries (user_id, status, due_date);
  create index if not exists entries_user_focus_idx
    on public.entries (user_id, focus_date)
    where focus_date is not null;
  create index if not exists entries_user_quadrant_pos_idx
    on public.entries (user_id, quadrant, position)
    where quadrant is not null;
  create index if not exists entries_user_customer_idx
    on public.entries (user_id, customer_id)
    where customer_id is not null;
  create index if not exists entries_user_opportunity_idx
    on public.entries (user_id, opportunity_id)
    where opportunity_id is not null;
  create index if not exists entries_tags_gin_idx
    on public.entries using gin (tags);

  execute 'alter table public.entries enable row level security';

  drop policy if exists entries_select_own on public.entries;
  create policy entries_select_own on public.entries
    for select using (auth.uid() = user_id);

  drop policy if exists entries_insert_own on public.entries;
  create policy entries_insert_own on public.entries
    for insert with check (auth.uid() = user_id);

  drop policy if exists entries_update_own on public.entries;
  create policy entries_update_own on public.entries
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

  drop policy if exists entries_delete_own on public.entries;
  create policy entries_delete_own on public.entries
    for delete using (auth.uid() = user_id);
end
$$;

commit;
