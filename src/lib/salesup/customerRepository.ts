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
  expo_lead_id: string | null;
  company_name: string;
  industry: string | null;
  company_size: string | null;
  overseas_markets: string[] | null;
  hq_city: string | null;
  website: string | null;
  current_vendor: string | null;
  company_background: string | null;
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
  const amount =
    r.amount === null || r.amount === undefined ? null : Number(r.amount);
  return {
    id: r.id,
    userId: r.user_id,
    source: (r.source as CustomerSource) ?? "other",
    sourceDetail: r.source_detail,
    sourceDate: r.source_date,
    claimExpiresAt: r.claim_expires_at,
    expoLeadId: r.expo_lead_id,
    companyName: r.company_name ?? "",
    industry: r.industry,
    companySize: r.company_size,
    overseasMarkets: r.overseas_markets ?? [],
    hqCity: r.hq_city,
    website: r.website,
    currentVendor: r.current_vendor,
    companyBackground: r.company_background,
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
    stage: (r.stage as CustomerStage) ?? "to_contact",
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
  industry?: string;
  companySize?: string;
  overseasMarkets?: string[];
  hqCity?: string;
  website?: string;
  currentVendor?: string;
  companyBackground?: string;
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

export async function createCustomer(
  input: NewCustomerInput,
): Promise<Customer> {
  const uid = await requireUserId();
  const row: Record<string, unknown> = {
    user_id: uid,
    company_name: input.companyName.trim(),
    source: input.source ?? "other",
    decision_role: input.decisionRole ?? "unknown",
    overseas_markets: input.overseasMarkets ?? [],
    other_contacts: input.otherContacts ?? [],
    product_lines: input.productLines ?? [],
    stage: input.stage ?? "to_contact",
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

  const { data, error } = await supabase
    .from("customers")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return rowToCustomer(data as Row);
}

export async function updateCustomer(
  id: string,
  patch: UpdateCustomerInput,
): Promise<Customer> {
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
  if (patch.overseasMarkets !== undefined)
    update.overseas_markets = patch.overseasMarkets;
  if (patch.otherContacts !== undefined)
    update.other_contacts = patch.otherContacts;
  if (patch.productLines !== undefined) update.product_lines = patch.productLines;
  if (patch.stage !== undefined) update.stage = patch.stage;
  if (patch.stageChangedAt !== undefined)
    update.stage_changed_at = patch.stageChangedAt;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.winRate !== undefined) update.win_rate = patch.winRate;
  if (patch.amount !== undefined) update.amount = patch.amount;
  if (patch.currency !== undefined) update.currency = patch.currency || "CNY";
  if (patch.lastContactAt !== undefined)
    update.last_contact_at = patch.lastContactAt || null;

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
  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("user_id", uid)
    .eq("id", id);
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

export async function insertStageHistory(
  input: StageHistoryInput,
): Promise<void> {
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
