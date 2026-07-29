-- Phase 4: customers + stage_history for the 客户看板 / 商机跟进 module.
--
-- PREREQUISITE: db/expo_leads.sql must have been run first
--   (customers.expo_lead_id references public.expo_leads).
--
-- HOW TO RUN (this project uses an external Supabase, not Lovable Cloud):
--   1. Open Supabase Dashboard → SQL Editor → New query
--   2. Paste the contents of this file
--   3. Run
--
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS.
--
-- MODELLING NOTE (see docs/customer-board-spec.md):
--   This is the ONE-LAYER model: one row = one customer = one opportunity.
--   The opportunity-shaped columns are grouped together below so they can be
--   lifted into a separate `opportunities` table later without touching the
--   company/contact/source columns. Do NOT scatter new opportunity fields
--   outside that block.

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- === 来源层 ===============================================================
  source text not null default 'other'
    check (source in (
      'expo',               -- 展会建联
      'marketing_assigned', -- 市场部分配
      'list_claimed',       -- 客户名单认领
      'existing_upsell',    -- 老客转化
      'referral',           -- 老客推荐
      'self_developed',     -- 自主开发
      'other'
    )),
  source_detail text,        -- 展会名 / 分配人 / 名单批次 / 推荐人姓名
  source_date date,          -- 拿到这条线索的日期
  claim_expires_at date,     -- 名单认领有效期（仅 list_claimed 用）
  expo_lead_id uuid references public.expo_leads(id) on delete set null,

  -- === 公司层 ===============================================================
  company_name text not null,
  industry text,
  company_size text,
  overseas_markets text[] not null default '{}',  -- 出海目标市场
  hq_city text,
  website text,
  current_vendor text,                            -- 现有供应商（竞品情报）
  company_background text,

  -- === 人员层（主联系人） ====================================================
  contact_name text,
  contact_title text,
  contact_department text,
  decision_role text not null default 'unknown'
    check (decision_role in (
      'decision_maker',  -- 决策者
      'influencer',      -- 影响者
      'user',            -- 使用者
      'gatekeeper',      -- 采购门槛
      'champion',        -- 内线
      'unknown'
    )),
  phone text,
  wechat text,
  email text,
  contact_note text,                              -- 沟通偏好 / 性格观察
  -- 其他关键人：[{ name, title, decision_role, contact, note }]
  other_contacts jsonb not null default '[]'::jsonb,

  -- === 商机层（将来整体迁出到 opportunities） =================================
  product_lines text[] not null default '{}',     -- WiseMonitor / WiseBI / ...
  stage text not null default 'to_contact'
    check (stage in (
      'to_contact',            -- 待建联     0%
      'opportunity_confirmed', -- 机会确认   10%
      'need_confirmed',        -- 需求确认   20%
      'solution_confirmed',    -- 方案确认   40%
      'quote_confirmed',       -- 报价确认   50%
      'negotiation',           -- 商务谈判   60%
      'signing',               -- 签约过程   80%
      'signed'                 -- 已签合同   100%
    )),
  stage_changed_at timestamptz not null default now(),
  status text not null default 'active'
    check (status in ('active', 'won', 'lost', 'on_hold')),
  -- null = 用 stage 的默认赢率；非 null = 手动覆盖，必须同时写 reason
  win_rate integer check (win_rate is null or (win_rate >= 0 and win_rate <= 100)),
  win_rate_override_reason text,
  amount numeric(14, 2),
  currency text not null default 'CNY',
  expected_close_date date,
  next_action text,
  next_action_date date,
  last_contact_at timestamptz,
  loss_reason text,          -- status = 'lost' 时必填（应用层校验）
  on_hold_until date,        -- status = 'on_hold' 的唤醒日期
  -- === 商机层结束 ===========================================================

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 覆盖赢率必须给理由，否则这个字段就退化成第二个 stage
  constraint customers_win_rate_needs_reason check (
    win_rate is null
    or (win_rate_override_reason is not null and length(btrim(win_rate_override_reason)) > 0)
  )
);

grant select, insert, update, delete on public.customers to authenticated;
grant all on public.customers to service_role;

alter table public.customers enable row level security;

drop policy if exists "customers select own" on public.customers;
create policy "customers select own" on public.customers
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "customers insert own" on public.customers;
create policy "customers insert own" on public.customers
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "customers update own" on public.customers;
create policy "customers update own" on public.customers
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "customers delete own" on public.customers;
create policy "customers delete own" on public.customers
  for delete to authenticated using (auth.uid() = user_id);

create index if not exists idx_customers_user_created
  on public.customers (user_id, created_at desc);
create index if not exists idx_customers_user_stage
  on public.customers (user_id, stage);
create index if not exists idx_customers_user_status
  on public.customers (user_id, status);
create index if not exists idx_customers_user_source
  on public.customers (user_id, source);
create index if not exists idx_customers_user_next_action_date
  on public.customers (user_id, next_action_date);
-- 停滞排序：看板最重要的派生指标
create index if not exists idx_customers_user_stage_changed
  on public.customers (user_id, stage_changed_at);

create or replace function public.touch_customers_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

drop trigger if exists trg_customers_touch on public.customers;
create trigger trg_customers_touch
  before update on public.customers
  for each row execute function public.touch_customers_updated_at();

-- ---------------------------------------------------------------------------
-- stage_history — 阶段推进留痕（拖卡片时的确认框写这里）
-- ---------------------------------------------------------------------------

create table if not exists public.stage_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  -- 预留：拆成两层后回填，届时 customer_id 变为冗余
  opportunity_id uuid,

  from_stage text,           -- null = 建档时的初始阶段
  to_stage text not null,
  reason text,               -- 「因为什么推进？」
  -- 指向 time_blocks.id。不加外键：time_blocks 的 DDL 只在 Supabase 控制台，
  -- 且时间块可被删除，这里允许悬空。
  related_block_id uuid,

  changed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.stage_history to authenticated;
grant all on public.stage_history to service_role;

alter table public.stage_history enable row level security;

drop policy if exists "stage_history select own" on public.stage_history;
create policy "stage_history select own" on public.stage_history
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "stage_history insert own" on public.stage_history;
create policy "stage_history insert own" on public.stage_history
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "stage_history update own" on public.stage_history;
create policy "stage_history update own" on public.stage_history
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "stage_history delete own" on public.stage_history;
create policy "stage_history delete own" on public.stage_history
  for delete to authenticated using (auth.uid() = user_id);

create index if not exists idx_stage_history_customer
  on public.stage_history (customer_id, changed_at desc);
create index if not exists idx_stage_history_user_changed
  on public.stage_history (user_id, changed_at desc);

-- ---------------------------------------------------------------------------
-- expo_leads 回链：防止同一条线索被重复转化成客户
-- ---------------------------------------------------------------------------

alter table public.expo_leads
  add column if not exists converted_customer_id uuid
    references public.customers(id) on delete set null;

create index if not exists idx_expo_leads_converted
  on public.expo_leads (user_id, converted_customer_id);
