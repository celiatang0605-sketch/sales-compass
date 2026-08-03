// Supabase-backed CRUD for customers. 数据层唯一入口，组件不要直接调 supabase。
// RLS 已按 auth.uid() = user_id 隔离，这里再显式按 user_id 过滤一次。

import { supabase } from "@/integrations/supabase/client";
import type {
  Customer,
  CustomerSource,
  CustomerStage,
  CustomerStatus,
  DecisionRole,
  OtherContact,
} from "./customerTypes";

type Row = {
  id: string;
  user_id: string;
  source: string;
  source_detail: string | null;
  source_date: string | null;
  claim_expires_at: string | null;
  lead_id: string | null;
  company_name: string;
  industry: string | null;
  company_size: string | null;
  overseas_markets: string[] | null;
  hq_city: string | null;
  website: string | null;
  current_vendor: string | null;
  company_background: string | null;
  pain_points: string | null;
  needs: string | null;
  key_info: string | null;
  contact_name: string | null;
  contact_title: string | null;
  contact_department: string | null;
  decision_role: string | null;
  phone: string | null;
  wechat: string | null;
  email: string | null;
  contact_note: string | null;
  other_contacts: OtherContact[] | null;
  product_lines: string[] | null;
  stage: string;
  stage_changed_at: string;
  status: string;
  win_rate: number | null;
  win_rate_override_reason: string | null;
  amount: number | string | null;
  currency: string | null;
  expected_close_date: string | null;
  next_action: string | null;
  next_action_date: string | null;
  last_contact_at: string | null;
  loss_reason: string | null;
  on_hold_until: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function rowToCustomer(r: Row): Customer {
  const amount = r.amount === null || r.amount === undefined ? null : Number(r.amount);
  return {
    id: r.id,
    userId: r.user_id,
    source: (r.source as CustomerSource) ?? "other",
    sourceDetail: r.source_detail,
    sourceDate: r.source_date,
    claimExpiresAt: r.claim_expires_at,
    leadId: r.lead_id,
    companyName: r.company_name ?? "",
    industry: r.industry,
    companySize: r.company_size,
    overseasMarkets: r.overseas_markets ?? [],
    hqCity: r.hq_city,
    website: r.website,
    currentVendor: r.current_vendor,
    companyBackground: r.company_background,
    painPoints: r.pain_points,
    needs: r.needs,
    keyInfo: r.key_info,
    contactName: r.contact_name,
    contactTitle: r.contact_title,
    contactDepartment: r.contact_department,
    decisionRole: (r.decision_role as DecisionRole) ?? "unknown",
    phone: r.phone,
    wechat: r.wechat,
    email: r.email,
    contactNote: r.contact_note,
    otherContacts: Array.isArray(r.other_contacts) ? r.other_contacts : [],
    productLines: r.product_lines ?? [],
    stage: (r.stage as CustomerStage) ?? "opportunity_confirmed",
    stageChangedAt: r.stage_changed_at,
    status: (r.status as CustomerStatus) ?? "active",
    winRate: r.win_rate,
    winRateOverrideReason: r.win_rate_override_reason,
    amount: Number.isFinite(amount as number) ? (amount as number) : null,
    currency: r.currency ?? "CNY",
    expectedCloseDate: r.expected_close_date,
    nextAction: r.next_action,
    nextActionDate: r.next_action_date,
    lastContactAt: r.last_contact_at,
    lossReason: r.loss_reason,
    onHoldUntil: r.on_hold_until,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export interface NewCustomerInput extends UpdateCustomerInput {
  companyName: string;
}

export interface UpdateCustomerInput {
  companyName?: string;
  source?: CustomerSource;
  sourceDetail?: string;
  sourceDate?: string;
  claimExpiresAt?: string;
  leadId?: string;
  industry?: string;
  companySize?: string;
  overseasMarkets?: string[];
  hqCity?: string;
  website?: string;
  currentVendor?: string;
  companyBackground?: string;
  painPoints?: string;
  needs?: string;
  keyInfo?: string;
  contactName?: string;
  contactTitle?: string;
  contactDepartment?: string;
  decisionRole?: DecisionRole;
  phone?: string;
  wechat?: string;
  email?: string;
  contactNote?: string;
  otherContacts?: OtherContact[];
  productLines?: string[];
  stage?: CustomerStage;
  stageChangedAt?: string;
  status?: CustomerStatus;
  winRate?: number | null;
  winRateOverrideReason?: string;
  amount?: number | null;
  currency?: string;
  expectedCloseDate?: string;
  nextAction?: string;
  nextActionDate?: string;
  lastContactAt?: string;
  lossReason?: string;
  onHoldUntil?: string;
  notes?: string;
}

// 文本字段：空串 ⇒ null
const TEXT_MAP: Record<string, string> = {
  companyName: "company_name",
  sourceDetail: "source_detail",
  industry: "industry",
  companySize: "company_size",
  hqCity: "hq_city",
  website: "website",
  currentVendor: "current_vendor",
  companyBackground: "company_background",
  painPoints: "pain_points",
  needs: "needs",
  keyInfo: "key_info",
  contactName: "contact_name",
  contactTitle: "contact_title",
  contactDepartment: "contact_department",
  phone: "phone",
  wechat: "wechat",
  email: "email",
  contactNote: "contact_note",
  winRateOverrideReason: "win_rate_override_reason",
  lossReason: "loss_reason",
  notes: "notes",
};

// 日期字段：空串 ⇒ null
const DATE_MAP: Record<string, string> = {
  sourceDate: "source_date",
  claimExpiresAt: "claim_expires_at",
  expectedCloseDate: "expected_close_date",
  onHoldUntil: "on_hold_until",
};

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const uid = data.user?.id;
  if (!uid) throw new Error("请先登录后再操作客户数据。");
  return uid;
}

export async function listCustomers(): Promise<Customer[]> {
  const uid = await requireUserId();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("user_id", uid)
    .order("stage_changed_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Row[]).map(rowToCustomer);
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const uid = await requireUserId();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("user_id", uid)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToCustomer(data as Row) : null;
}

export async function createCustomer(input: NewCustomerInput): Promise<Customer> {
  const uid = await requireUserId();
  const row: Record<string, unknown> = {
    user_id: uid,
    company_name: input.companyName.trim(),
    source: input.source ?? "other",
    decision_role: input.decisionRole ?? "unknown",
    overseas_markets: input.overseasMarkets ?? [],
    other_contacts: input.otherContacts ?? [],
    product_lines: input.productLines ?? [],
    stage: input.stage ?? "opportunity_confirmed",
    status: input.status ?? "active",
    win_rate: input.winRate ?? null,
    amount: input.amount ?? null,
    currency: input.currency || "CNY",
    next_action: input.nextAction?.trim() || null,
    next_action_date: input.nextAction?.trim() ? input.nextActionDate || null : null,
  };
  for (const [k, col] of Object.entries(TEXT_MAP)) {
    const v = (input as unknown as Record<string, unknown>)[k];
    if (v === undefined) continue;
    const s = typeof v === "string" ? v.trim() : "";
    row[col] = s.length > 0 ? s : null;
  }
  row.company_name = input.companyName.trim();
  for (const [k, col] of Object.entries(DATE_MAP)) {
    const v = (input as unknown as Record<string, unknown>)[k];
    if (v === undefined) continue;
    row[col] = v ? v : null;
  }
  if (input.leadId) row.lead_id = input.leadId;

  const { data, error } = await supabase.from("customers").insert(row).select("*").single();
  if (error) throw error;
  return rowToCustomer(data as Row);
}

export async function updateCustomer(id: string, patch: UpdateCustomerInput): Promise<Customer> {
  const uid = await requireUserId();
  const update: Record<string, unknown> = {};

  for (const [k, col] of Object.entries(TEXT_MAP)) {
    const v = (patch as Record<string, unknown>)[k];
    if (v === undefined) continue;
    const s = typeof v === "string" ? v.trim() : "";
    update[col] = s.length > 0 ? s : null;
  }
  for (const [k, col] of Object.entries(DATE_MAP)) {
    const v = (patch as Record<string, unknown>)[k];
    if (v === undefined) continue;
    update[col] = v ? v : null;
  }

  if (patch.source !== undefined) update.source = patch.source;
  if (patch.decisionRole !== undefined) update.decision_role = patch.decisionRole;
  if (patch.overseasMarkets !== undefined) update.overseas_markets = patch.overseasMarkets;
  if (patch.otherContacts !== undefined) update.other_contacts = patch.otherContacts;
  if (patch.productLines !== undefined) update.product_lines = patch.productLines;
  if (patch.stage !== undefined) update.stage = patch.stage;
  if (patch.stageChangedAt !== undefined) update.stage_changed_at = patch.stageChangedAt;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.winRate !== undefined) update.win_rate = patch.winRate;
  if (patch.amount !== undefined) update.amount = patch.amount;
  if (patch.currency !== undefined) update.currency = patch.currency || "CNY";
  if (patch.lastContactAt !== undefined) update.last_contact_at = patch.lastContactAt || null;

  // next_action / next_action_date 成对：没有动作就不能留日期
  const na = patch.nextAction;
  const nd = patch.nextActionDate;
  if (na !== undefined || nd !== undefined) {
    const actionTrimmed = (na ?? "").trim();
    if (na !== undefined) update.next_action = actionTrimmed || null;
    if (nd !== undefined) update.next_action_date = nd || null;
    if (na !== undefined && !actionTrimmed) update.next_action_date = null;
  }

  const { data, error } = await supabase
    .from("customers")
    .update(update)
    .eq("user_id", uid)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return rowToCustomer(data as Row);
}

export async function deleteCustomer(id: string): Promise<void> {
  const uid = await requireUserId();
  const { error } = await supabase.from("customers").delete().eq("user_id", uid).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// stage_history
// ---------------------------------------------------------------------------

export interface StageHistoryInput {
  customerId: string;
  fromStage: CustomerStage | null;
  toStage: CustomerStage;
  reason?: string;
  relatedBlockId?: string | null;
}

export async function insertStageHistory(input: StageHistoryInput): Promise<void> {
  const uid = await requireUserId();
  const { error } = await supabase.from("stage_history").insert({
    user_id: uid,
    customer_id: input.customerId,
    from_stage: input.fromStage,
    to_stage: input.toStage,
    reason: input.reason?.trim() || null,
    related_block_id: input.relatedBlockId ?? null,
  });
  if (error) throw error;
}

export interface StageHistoryEntry {
  id: string;
  customerId: string;
  fromStage: CustomerStage | null;
  toStage: CustomerStage;
  reason: string | null;
  relatedBlockId: string | null;
  changedAt: string;
}

type StageHistoryRow = {
  id: string;
  customer_id: string;
  from_stage: string | null;
  to_stage: string;
  reason: string | null;
  related_block_id: string | null;
  changed_at: string | null;
  created_at?: string | null;
};

function rowToStageHistory(r: StageHistoryRow): StageHistoryEntry {
  return {
    id: r.id,
    customerId: r.customer_id,
    fromStage: (r.from_stage as CustomerStage) ?? null,
    toStage: r.to_stage as CustomerStage,
    reason: r.reason,
    relatedBlockId: r.related_block_id,
    changedAt: r.changed_at ?? r.created_at ?? "",
  };
}

/** 某客户的阶段历史，按 changed_at 倒序。 */
export async function listStageHistory(customerId: string): Promise<StageHistoryEntry[]> {
  const uid = await requireUserId();
  const { data, error } = await supabase
    .from("stage_history")
    .select("*")
    .eq("user_id", uid)
    .eq("customer_id", customerId)
    .order("changed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => rowToStageHistory(r as StageHistoryRow));
}

// ---------------------------------------------------------------------------
// 阶段推进
// ---------------------------------------------------------------------------

export interface ChangeStageInput {
  customerId: string;
  fromStage: CustomerStage;
  toStage: CustomerStage;
  reason?: string;
  relatedBlockId?: string | null;
  /** 目标阶段为 signed 时，是否同时把 status 置为 won。 */
  markWon?: boolean;
}

/** 更新阶段 + stage_changed_at，并写一条 stage_history。 */
export async function changeCustomerStage(input: ChangeStageInput): Promise<Customer> {
  const now = new Date().toISOString();
  const patch: UpdateCustomerInput = {
    stage: input.toStage,
    stageChangedAt: now,
  };
  if (input.markWon) patch.status = "won";
  const updated = await updateCustomer(input.customerId, patch);
  await insertStageHistory({
    customerId: input.customerId,
    fromStage: input.fromStage,
    toStage: input.toStage,
    reason: input.reason,
    relatedBlockId: input.relatedBlockId ?? null,
  });
  return updated;
}

// ---------------------------------------------------------------------------
// 关联时间块（只读，用于阶段推进时挑选当天记录）
// ---------------------------------------------------------------------------

export interface RelatedTimeBlock {
  id: string;
  date: string;
  startSlot: number;
  endSlot: number;
  title: string;
  customer: string;
  customerId: string | null;
}

type BlockRow = {
  id: string;
  date: string;
  start_slot: number;
  end_slot: number;
  title: string | null;
  customer: string | null;
  customer_id: string | null;
};

/**
 * 某一天、属于该客户的时间块：customer_id 命中，或 customer 自由文本包含公司名。
 * 过滤在客户端做，避免公司名里的逗号破坏 PostgREST 的 or() 语法。
 */
export async function listTimeBlocksForCustomerOnDate(params: {
  date: string;
  customerId: string;
  companyName: string;
}): Promise<RelatedTimeBlock[]> {
  const uid = await requireUserId();
  const { data, error } = await supabase
    .from("time_blocks")
    .select("id,date,start_slot,end_slot,title,customer,customer_id")
    .eq("user_id", uid)
    .eq("date", params.date)
    .order("start_slot", { ascending: true });
  if (error) throw error;
  const name = params.companyName.trim().toLowerCase();
  return (data ?? [])
    .map((r) => r as BlockRow)
    .filter((r) => {
      if (r.customer_id && r.customer_id === params.customerId) return true;
      if (!name) return false;
      const text = (r.customer ?? "").trim().toLowerCase();
      if (!text) return false;
      return text.includes(name) || name.includes(text);
    })
    .map((r) => ({
      id: r.id,
      date: r.date,
      startSlot: r.start_slot,
      endSlot: r.end_slot,
      title: r.title ?? "",
      customer: r.customer ?? "",
      customerId: r.customer_id,
    }));
}

// ---------------------------------------------------------------------------
// 线索 → 客户
// ---------------------------------------------------------------------------

export interface ConvertLeadInput extends NewCustomerInput {
  /**
   * leads.id。客户去重的唯一权威是 customers.lead_id 的 uq_customers_lead 索引；
   * leads.converted_customer_id 仅是派生冗余，不能用于判断是否已转客户。
   */
  leadId: string;
  /** 首条阶段历史中记录的准入确认结果。 */
  conversionReason: string;
}

/**
 * 由线索创建客户：
 * 1. 建 customers 行（继承线索来源，记录 lead_id）
 * 2. 写一条建档 stage_history
 * 3. 回写 leads.converted_customer_id 并把 status 置为 converted
 */
export async function convertLeadToCustomer(input: ConvertLeadInput): Promise<Customer> {
  if (!input.conversionReason.trim()) {
    throw new Error("转化时必须记录准入确认结果。");
  }
  const { markLeadConverted } = await import("./expoRepository");
  const customer = await createCustomer(input);
  await insertStageHistory({
    customerId: customer.id,
    fromStage: null,
    toStage: customer.stage,
    reason: input.conversionReason,
    relatedBlockId: null,
  });
  await markLeadConverted(input.leadId, customer.id);
  return customer;
}

// ---------------------------------------------------------------------------
// 客户的相关记录（time_blocks.customer_id 命中）
// ---------------------------------------------------------------------------

export interface CustomerTimeBlock extends RelatedTimeBlock {
  summary: string;
  workType: string;
}

type CustomerBlockRow = BlockRow & {
  summary: string | null;
  work_type: string | null;
};

/** 该客户关联的全部时间块，按日期倒序、同日按开始时间倒序。 */
export async function listTimeBlocksForCustomer(customerId: string): Promise<CustomerTimeBlock[]> {
  const uid = await requireUserId();
  const { data, error } = await supabase
    .from("time_blocks")
    .select("id,date,start_slot,end_slot,title,customer,customer_id,summary,work_type")
    .eq("user_id", uid)
    .eq("customer_id", customerId)
    .order("date", { ascending: false })
    .order("start_slot", { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .map((r) => r as CustomerBlockRow)
    .map((r) => ({
      id: r.id,
      date: r.date,
      startSlot: r.start_slot,
      endSlot: r.end_slot,
      title: r.title ?? "",
      customer: r.customer ?? "",
      customerId: r.customer_id,
      summary: r.summary ?? "",
      workType: r.work_type ?? "",
    }));
}
