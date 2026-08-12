-- 冷启动拨打记录表
-- 已于生产库执行，此文件为 schema 参考

create table if not exists public.call_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  called_at timestamptz not null default now(),
  outcome text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists call_attempts_user_called_at_idx
  on public.call_attempts (user_id, called_at desc);

create index if not exists call_attempts_user_lead_idx
  on public.call_attempts (user_id, lead_id);

alter table public.call_attempts enable row level security;

create policy call_attempts_select_own on public.call_attempts
  for select using (auth.uid() = user_id);

create policy call_attempts_insert_own on public.call_attempts
  for insert with check (auth.uid() = user_id);

create policy call_attempts_update_own on public.call_attempts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy call_attempts_delete_own on public.call_attempts
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.call_attempts to authenticated;

comment on table public.call_attempts is
  '冷启动拨打记录。计数口径永远是 count(*)：只记录"拨出去了"这一行为，不论是否接通、不论结果如何，被挂断同样计入。这是刻意设计——用户唯一能控制的是拨号本身，把奖励挂在可控行为上才能降低恐惧。任何按 outcome 过滤的计数都违背该设计。';

comment on column public.call_attempts.lead_id is
  '可为空。为空表示打卡面板上的裸计数（不关联具体线索），避免记录本身变成心理负担。on delete set null：删除线索绝不能让累计通话数倒退。';

comment on column public.call_attempts.outcome is
  '可为空，仅供事后复盘与分析，不参与任何计数或成就判定。';

comment on column public.call_attempts.called_at is
  '实际拨打时间。支持补录（可写入过去时间），故不使用 created_at 代替。';
