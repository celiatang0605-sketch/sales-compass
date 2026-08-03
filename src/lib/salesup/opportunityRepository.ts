import { supabase } from "@/integrations/supabase/client";
import type { ContactRow, OpportunityRow } from "@/integrations/supabase/types";
import { rowToContact } from "./contactRepository";
import {
  getEffectiveWinRate,
  STAGE_ORDER,
  type CustomerSource,
  type CustomerStage,
  type CustomerStatus,
} from "./customerTypes";
import type {
  Opportunity,
  OpportunityCustomer,
  OpportunityStageSummaries,
  OpportunityWithDetails,
} from "./opportunityTypes";

type Row = OpportunityRow & { amount: number | string | null };
type CustomerProjection = {
  id: string;
  company_name: string;
  industry: string | null;
  hq_city: string | null;
  source: string;
};
type OpportunityQueryRow = Row & { customers: CustomerProjection | null };
type ContactLinkRow = {
  opportunity_id: string;
  contacts: ContactRow | ContactRow[] | null;
};

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user?.id) throw new Error("请先登录后再操作商机数据。");
  return data.user.id;
}

function rowToOpportunity(row: Row): Opportunity {
  const amount = row.amount === null || row.amount === undefined ? null : Number(row.amount);
  return {
    id: row.id,
    userId: row.user_id,
    customerId: row.customer_id,
    name: row.name,
    productLines: row.product_lines ?? [],
    stage: row.stage as CustomerStage,
    stageChangedAt: row.stage_changed_at,
    status: row.status as CustomerStatus,
    winRate: row.win_rate,
    winRateOverrideReason: row.win_rate_override_reason,
    amount: Number.isFinite(amount as number) ? (amount as number) : null,
    currency: row.currency ?? "CNY",
    expectedCloseDate: row.expected_close_date,
    nextAction: row.next_action,
    nextActionDate: row.next_action_date,
    lastContactAt: row.last_contact_at,
    painPoints: row.pain_points,
    needs: row.needs,
    keyInfo: row.key_info,
    lossReason: row.loss_reason,
    onHoldUntil: row.on_hold_until,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToCustomerProjection(row: CustomerProjection | null): OpportunityCustomer {
  if (!row) {
    throw new Error("商机关联的客户不存在或无权访问。");
  }
  return {
    id: row.id,
    companyName: row.company_name,
    industry: row.industry,
    hqCity: row.hq_city,
    source: row.source as CustomerSource,
  };
}

async function contactsForOpportunities(
  opportunityIds: string[],
  userId: string,
): Promise<Map<string, OpportunityWithDetails["contacts"]>> {
  const grouped = new Map<string, OpportunityWithDetails["contacts"]>();
  if (opportunityIds.length === 0) return grouped;

  // opportunity_contacts 本身没有 user_id。用关联商机的 user_id 作授权边界，并在嵌入
  // 联系人查询上再次显式过滤 user_id，避免把跨用户关联当成可信数据。
  const { data, error } = await supabase
    .from("opportunity_contacts")
    .select("opportunity_id, contacts!inner(*), opportunities!inner(user_id)")
    .in("opportunity_id", opportunityIds)
    .eq("opportunities.user_id", userId)
    .eq("contacts.user_id", userId);
  if (error) throw error;

  for (const row of (data ?? []) as unknown as ContactLinkRow[]) {
    if (!row.contacts) continue;
    const contacts = grouped.get(row.opportunity_id) ?? [];
    const linkedContacts = Array.isArray(row.contacts) ? row.contacts : [row.contacts];
    contacts.push(...linkedContacts.map(rowToContact));
    grouped.set(row.opportunity_id, contacts);
  }
  return grouped;
}

export interface OpportunityFilters {
  stage?: CustomerStage;
  status?: CustomerStatus;
  productLine?: string;
  source?: CustomerSource;
  search?: string;
}

export async function listOpportunities(
  filters: OpportunityFilters = {},
): Promise<OpportunityWithDetails[]> {
  const userId = await requireUserId();
  let query = supabase
    .from("opportunities")
    .select("*, customers!inner(id,company_name,industry,hq_city,source)")
    .eq("user_id", userId)
    .eq("customers.user_id", userId)
    .order("stage_changed_at", { ascending: true });
  if (filters.stage) query = query.eq("stage", filters.stage);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.productLine?.trim())
    query = query.contains("product_lines", [filters.productLine.trim()]);
  if (filters.source) query = query.eq("customers.source", filters.source);

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as OpportunityQueryRow[];
  const keyword = filters.search?.trim().toLowerCase();
  const matchedRows = keyword
    ? rows.filter((row) => {
        const customer = row.customers;
        return [row.name, customer?.company_name, customer?.industry, customer?.hq_city]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(keyword));
      })
    : rows;
  const contactsByOpportunity = await contactsForOpportunities(
    matchedRows.map((row) => row.id),
    userId,
  );

  return matchedRows.map((row) => ({
    ...rowToOpportunity(row),
    customer: rowToCustomerProjection(row.customers),
    contacts: contactsByOpportunity.get(row.id) ?? [],
  }));
}

export async function getOpportunity(id: string): Promise<OpportunityWithDetails | null> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("opportunities")
    .select("*, customers!inner(id,company_name,industry,hq_city,source)")
    .eq("user_id", userId)
    .eq("customers.user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as OpportunityQueryRow;
  const contactsByOpportunity = await contactsForOpportunities([row.id], userId);
  return {
    ...rowToOpportunity(row),
    customer: rowToCustomerProjection(row.customers),
    contacts: contactsByOpportunity.get(row.id) ?? [],
  };
}

export interface CreateOpportunityInput extends UpdateOpportunityInput {
  customerId: string;
  name: string;
}

export interface UpdateOpportunityInput {
  name?: string;
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
  painPoints?: string;
  needs?: string;
  keyInfo?: string;
  lossReason?: string;
  onHoldUntil?: string;
  notes?: string;
}

const TEXT_COLUMNS: Record<string, string> = {
  name: "name",
  winRateOverrideReason: "win_rate_override_reason",
  nextAction: "next_action",
  painPoints: "pain_points",
  needs: "needs",
  keyInfo: "key_info",
  lossReason: "loss_reason",
  notes: "notes",
};

const DATE_COLUMNS: Record<string, string> = {
  expectedCloseDate: "expected_close_date",
  nextActionDate: "next_action_date",
  lastContactAt: "last_contact_at",
  onHoldUntil: "on_hold_until",
};

function applyOpportunityPatch(input: UpdateOpportunityInput): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(TEXT_COLUMNS)) {
    const value = (input as Record<string, unknown>)[key];
    if (value === undefined) continue;
    const text = typeof value === "string" ? value.trim() : "";
    row[column] = text || null;
  }
  for (const [key, column] of Object.entries(DATE_COLUMNS)) {
    const value = (input as Record<string, unknown>)[key];
    if (value !== undefined) row[column] = value || null;
  }
  if (input.name !== undefined && !input.name.trim()) throw new Error("商机名称不能为空。");
  if (input.productLines !== undefined) row.product_lines = input.productLines;
  if (input.stage !== undefined) row.stage = input.stage;
  if (input.stageChangedAt !== undefined) row.stage_changed_at = input.stageChangedAt;
  if (input.status !== undefined) row.status = input.status;
  if (input.winRate !== undefined) row.win_rate = input.winRate;
  if (input.amount !== undefined) row.amount = input.amount;
  if (input.currency !== undefined) row.currency = input.currency.trim() || "CNY";
  return row;
}

export async function createOpportunity(input: CreateOpportunityInput): Promise<Opportunity> {
  const userId = await requireUserId();
  const name = input.name.trim();
  if (!name) throw new Error("商机名称不能为空。");

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id")
    .eq("user_id", userId)
    .eq("id", input.customerId)
    .maybeSingle();
  if (customerError) throw customerError;
  if (!customer) throw new Error("未找到可操作的客户。");

  const row = {
    user_id: userId,
    customer_id: input.customerId,
    name,
    product_lines: input.productLines ?? [],
    stage: input.stage ?? "opportunity_confirmed",
    stage_changed_at: input.stageChangedAt ?? new Date().toISOString(),
    status: input.status ?? "active",
    win_rate: input.winRate ?? null,
    win_rate_override_reason: input.winRateOverrideReason?.trim() || null,
    amount: input.amount ?? null,
    currency: input.currency?.trim() || "CNY",
    expected_close_date: input.expectedCloseDate || null,
    next_action: input.nextAction?.trim() || null,
    next_action_date: input.nextAction?.trim() ? input.nextActionDate || null : null,
    last_contact_at: input.lastContactAt || null,
    pain_points: input.painPoints?.trim() || null,
    needs: input.needs?.trim() || null,
    key_info: input.keyInfo?.trim() || null,
    loss_reason: input.lossReason?.trim() || null,
    on_hold_until: input.onHoldUntil || null,
    notes: input.notes?.trim() || null,
  };
  const { data, error } = await supabase.from("opportunities").insert(row).select("*").single();
  if (error) throw error;
  return rowToOpportunity(data as Row);
}

export async function updateOpportunity(
  id: string,
  patch: UpdateOpportunityInput,
): Promise<Opportunity> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("opportunities")
    .update(applyOpportunityPatch(patch))
    .eq("user_id", userId)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return rowToOpportunity(data as Row);
}

export async function deleteOpportunity(id: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("opportunities")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}

export async function advanceOpportunityStage(
  id: string,
  stage: CustomerStage,
): Promise<Opportunity> {
  return updateOpportunity(id, { stage, stageChangedAt: new Date().toISOString() });
}

export async function getOpportunityStageSummaries(
  filters: Omit<OpportunityFilters, "stage"> = {},
): Promise<OpportunityStageSummaries> {
  const opportunities = await listOpportunities(filters);
  const summaries = Object.fromEntries(
    STAGE_ORDER.map((stage) => [stage, { count: 0, amount: 0, weightedAmount: 0 }]),
  ) as OpportunityStageSummaries;
  for (const opportunity of opportunities) {
    const summary = summaries[opportunity.stage];
    summary.count += 1;
    if (opportunity.amount === null) continue;
    summary.amount += opportunity.amount;
    summary.weightedAmount += (opportunity.amount * getEffectiveWinRate(opportunity)) / 100;
  }
  return summaries;
}
