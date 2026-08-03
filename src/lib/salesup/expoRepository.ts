// Supabase-backed CRUD for leads. Phase 3 canonical data layer.
// Pages should use this repository (or the useLeads hook), NOT expoStore.

import { supabase } from "@/integrations/supabase/client";
import type { LeadRow, LeadUpdate } from "@/integrations/supabase/types";
import { toDateKey, todayKey } from "./date";
import { deriveHeadline, type Lead, type LeadPriority, type LeadStatus } from "./expoMock";
import type { CustomerSource } from "./customerTypes";
import {
  emptyLeadStageCounts,
  LEAD_STAGES,
  type LeadStage,
  type LeadStageAction,
  type LeadStageCounts,
  type LeadStatus as PoolLeadStatus,
} from "./leadTypes";

type Row = {
  id: string;
  user_id: string;
  source: string;
  source_date: string | null;
  source_detail: string | null;
  event_name: string | null;
  event_date: string | null;
  hall: string | null;
  booth: string | null;
  company_name: string | null;
  industry: string | null;
  company_size: string | null;
  hq_city: string | null;
  website: string | null;
  company_background: string | null;
  contact_name: string | null;
  contact_title: string | null;
  contact_department: string | null;
  phone: string | null;
  wechat: string | null;
  email: string | null;
  raw_note: string | null;
  conversation_summary: string | null;
  key_info: string | null;
  pain_points: string | null;
  needs: string | null;
  decision_role: string | null;
  budget_signal: string | null;
  timing_signal: string | null;
  current_vendor: string | null;
  priority: string;
  signals: string[] | null;
  score: number | null;
  score_reason: string | null;
  status: string;
  next_action: string | null;
  next_action_date: string | null;
  last_contact_at: string | null;
  ai_summary: string | null;
  missing_information: string | null;
  suggested_message: string | null;
  business_card_url: string | null;
  photo_urls: string[] | null;
  converted_customer_id: string | null;
  researched_at: string | null;
  called_at: string | null;
  wechat_added_at: string | null;
  intro_sent_at: string | null;
  needs_captured_at: string | null;
  exit_reason: string | null;
  exit_at: string | null;
  resume_on: string | null;
  lead_stage: LeadStage;
  created_at: string;
  updated_at: string;
};

/** 线索池读取模型，使用迁移后的 canonical status / generated lead_stage。 */
export type LeadPoolLead = Omit<Lead, "status"> & {
  status: PoolLeadStatus;
  leadStage: LeadStage;
  researchedAt: string | null;
  calledAt: string | null;
  wechatAddedAt: string | null;
  introSentAt: string | null;
  needsCapturedAt: string | null;
  exitReason: string | null;
  exitAt: string | null;
  resumeOn: string | null;
};

export interface LeadPool {
  leads: LeadPoolLead[];
  stageCounts: LeadStageCounts;
  needsOrganizeCount: number;
}

function rowToLead(r: Row): Lead {
  const raw = r.raw_note ?? "";
  return {
    id: r.id,
    source: r.source as CustomerSource,
    sourceDate: r.source_date ?? undefined,
    sourceDetail: r.source_detail ?? undefined,
    company: r.company_name ?? "",
    industry: r.industry ?? undefined,
    companySize: r.company_size ?? undefined,
    hqCity: r.hq_city ?? undefined,
    website: r.website ?? undefined,
    companyBackground: r.company_background ?? undefined,
    eventName: r.event_name ?? undefined,
    eventDate: r.event_date ?? undefined,
    hall: r.hall ?? undefined,
    booth: r.booth ?? undefined,
    contactName: r.contact_name ?? "",
    contactTitle: r.contact_title ?? undefined,
    contactDepartment: r.contact_department ?? undefined,
    phone: r.phone ?? undefined,
    wechat: r.wechat ?? undefined,
    email: r.email ?? undefined,
    priority: (r.priority as LeadPriority) ?? "unrated",
    status: (r.status as LeadStatus) ?? "to_organize",
    headline: deriveHeadline(raw),
    rawNote: raw,
    summary: r.conversation_summary ?? undefined,
    keyInfo: r.key_info ?? undefined,
    coreProblem: r.pain_points ?? undefined,
    currentNeed: r.needs ?? undefined,
    decisionRole: r.decision_role ?? undefined,
    budgetSignal: r.budget_signal ?? undefined,
    timeline: r.timing_signal ?? undefined,
    currentVendor: r.current_vendor ?? undefined,
    priorityReason: r.score_reason ?? undefined,
    score: r.score ?? undefined,
    signals: r.signals ?? [],
    aiSummary: r.ai_summary ?? undefined,
    missingInformation: r.missing_information ?? undefined,
    suggestedMessage: r.suggested_message ?? undefined,
    businessCardUrl: r.business_card_url ?? undefined,
    photoUrls: r.photo_urls ?? [],
    nextAction: r.next_action ?? "",
    nextActionDate: r.next_action_date ?? "",
    lastContactedAt: r.last_contact_at ? toDateKey(new Date(r.last_contact_at)) : undefined,
    createdAt: r.created_at ? toDateKey(new Date(r.created_at)) : todayKey(),
    convertedCustomerId: r.converted_customer_id ?? null,
  };
}

function rowToLeadPool(r: LeadRow): LeadPoolLead {
  return {
    ...rowToLead(r),
    status: r.status,
    leadStage: r.lead_stage,
    researchedAt: r.researched_at,
    calledAt: r.called_at,
    wechatAddedAt: r.wechat_added_at,
    introSentAt: r.intro_sent_at,
    needsCapturedAt: r.needs_captured_at,
    exitReason: r.exit_reason,
    exitAt: r.exit_at,
    resumeOn: r.resume_on,
  };
}

export interface NewLeadInput {
  source: CustomerSource;
  sourceDate?: string;
  sourceDetail?: string;
  company: string;
  companySize?: string;
  hqCity?: string;
  website?: string;
  contactDepartment?: string;
  eventName?: string;
  eventDate?: string;
  hall?: string;
  booth?: string;
  businessCardUrl?: string;
  rawNote: string;
  priority: LeadPriority;
  status?: LeadStatus;
  signals: string[];
  nextAction: string;
  nextActionDate: string;
}

// All editable fields for detail-page updates.
export interface UpdateLeadInput {
  source?: CustomerSource;
  sourceDate?: string;
  sourceDetail?: string;
  company?: string;
  industry?: string;
  companySize?: string;
  hqCity?: string;
  website?: string;
  companyBackground?: string;
  eventName?: string;
  eventDate?: string;
  hall?: string;
  booth?: string;
  businessCardUrl?: string;
  contactName?: string;
  contactTitle?: string;
  contactDepartment?: string;
  phone?: string;
  wechat?: string;
  email?: string;
  rawNote?: string;
  summary?: string;
  keyInfo?: string;
  coreProblem?: string;
  currentNeed?: string;
  decisionRole?: string;
  budgetSignal?: string;
  timeline?: string;
  currentVendor?: string;
  priorityReason?: string;
  priority?: LeadPriority;
  status?: LeadStatus;
  signals?: string[];
  nextAction?: string;
  nextActionDate?: string;
  lastContactedAt?: string; // YYYY-MM-DD or ""
}

// Fields → column mapping. Text fields: empty string ⇒ null.
const TEXT_MAP: Record<string, string> = {
  company: "company_name",
  sourceDetail: "source_detail",
  industry: "industry",
  companySize: "company_size",
  hqCity: "hq_city",
  website: "website",
  companyBackground: "company_background",
  eventName: "event_name",
  hall: "hall",
  booth: "booth",
  businessCardUrl: "business_card_url",
  contactName: "contact_name",
  contactTitle: "contact_title",
  contactDepartment: "contact_department",
  phone: "phone",
  wechat: "wechat",
  email: "email",
  rawNote: "raw_note",
  summary: "conversation_summary",
  keyInfo: "key_info",
  coreProblem: "pain_points",
  currentNeed: "needs",
  decisionRole: "decision_role",
  budgetSignal: "budget_signal",
  timeline: "timing_signal",
  currentVendor: "current_vendor",
  priorityReason: "score_reason",
};

export async function listLeads(): Promise<Lead[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Row[]).map(rowToLead);
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user?.id) throw new Error("请先登录后再操作线索。");
  return data.user.id;
}

/**
 * 读取线索池所需的全部数据。
 *
 * 活跃集合仅包括：to_follow_up，或到期（含今天）的 paused。lead_stage 不看
 * status，因此阶段计数只能由这里已过滤过的活跃集合计算，不能单独按 lead_stage
 * 查询，否则 converted / invalid 线索会混入。
 */
export async function getLeadPool(today = todayKey()): Promise<LeadPool> {
  const userId = await requireUserId();
  const activeFilter = `status.eq.to_follow_up,and(status.eq.paused,resume_on.lte.${today})`;
  const [activeResult, organizeResult] = await Promise.all([
    supabase
      .from("leads")
      .select("*")
      .eq("user_id", userId)
      .or(activeFilter)
      .order("created_at", { ascending: false }),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "to_organize"),
  ]);

  if (activeResult.error) throw activeResult.error;
  if (organizeResult.error) throw organizeResult.error;

  const rows = (activeResult.data ?? []) as LeadRow[];
  const stageCounts = emptyLeadStageCounts();
  for (const row of rows) {
    if (LEAD_STAGES.includes(row.lead_stage)) {
      stageCounts[row.lead_stage]++;
    }
  }

  return {
    leads: rows.map(rowToLeadPool),
    stageCounts,
    needsOrganizeCount: organizeResult.count ?? 0,
  };
}

export async function getLead(id: string): Promise<Lead | null> {
  const { data, error } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? rowToLead(data as Row) : null;
}

export async function createLead(input: NewLeadInput): Promise<Lead> {
  const { data: userData, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;
  const uid = userData.user?.id;
  if (!uid) throw new Error("请先登录后再保存线索。");

  const row = {
    user_id: uid,
    source: input.source,
    source_date: input.sourceDate || null,
    source_detail: input.sourceDetail?.trim() || null,
    company_name: input.company.trim() || null,
    company_size: input.companySize?.trim() || null,
    hq_city: input.hqCity?.trim() || null,
    website: input.website?.trim() || null,
    contact_department: input.contactDepartment?.trim() || null,
    event_name: input.eventName?.trim() || null,
    event_date: input.eventDate || null,
    hall: input.hall?.trim() || null,
    booth: input.booth?.trim() || null,
    business_card_url: input.businessCardUrl?.trim() || null,
    raw_note: input.rawNote.trim() || null,
    priority: input.priority,
    status: input.status ?? "to_follow_up",
    signals: input.signals,
    next_action: input.nextAction.trim() || null,
    next_action_date: input.nextActionDate || null,
  };
  const { data, error } = await supabase.from("leads").insert(row).select("*").single();
  if (error) throw error;
  return rowToLead(data as Row);
}

export async function updateLead(id: string, patch: UpdateLeadInput): Promise<Lead> {
  const update: Record<string, unknown> = {};

  for (const [k, col] of Object.entries(TEXT_MAP)) {
    const v = (patch as Record<string, unknown>)[k];
    if (v === undefined) continue;
    const s = typeof v === "string" ? v.trim() : "";
    update[col] = s.length > 0 ? s : null;
  }

  if (patch.priority !== undefined) update.priority = patch.priority;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.source !== undefined) update.source = patch.source;
  if (patch.sourceDate !== undefined) update.source_date = patch.sourceDate || null;
  if (patch.signals !== undefined) update.signals = patch.signals;
  if (patch.eventDate !== undefined) update.event_date = patch.eventDate || null;

  // next_action / next_action_date paired: no action ⇒ date must be null too.
  const na = patch.nextAction;
  const nd = patch.nextActionDate;
  if (na !== undefined || nd !== undefined) {
    const actionTrimmed = (na ?? "").trim();
    if (na !== undefined) {
      update.next_action = actionTrimmed || null;
    }
    if (nd !== undefined) {
      update.next_action_date = nd || null;
    }
    // If we're clearing action, also clear date to avoid orphan todos.
    if (na !== undefined && !actionTrimmed) {
      update.next_action_date = null;
    }
  }

  if (patch.lastContactedAt !== undefined) {
    update.last_contact_at = patch.lastContactedAt
      ? new Date(patch.lastContactedAt + "T00:00:00").toISOString()
      : null;
  }

  const { data, error } = await supabase
    .from("leads")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return rowToLead(data as Row);
}

export async function deleteLead(id: string): Promise<void> {
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) throw error;
}

const STAGE_ACTION_TIMESTAMP: Record<
  LeadStageAction,
  keyof Pick<
    LeadUpdate,
    "researched_at" | "called_at" | "wechat_added_at" | "intro_sent_at" | "needs_captured_at"
  >
> = {
  research: "researched_at",
  call: "called_at",
  add_wechat: "wechat_added_at",
  send_intro: "intro_sent_at",
  need_discovery: "needs_captured_at",
};

/**
 * 完成当前步骤并推进数据库生成的 lead_stage。
 * lead_stage 是 generated stored 列；此处特意只写动作时间戳。
 */
export async function advanceLeadStage(
  leadId: string,
  action: LeadStageAction,
): Promise<LeadPoolLead> {
  const userId = await requireUserId();
  const update: LeadUpdate = { [STAGE_ACTION_TIMESTAMP[action]]: new Date().toISOString() };
  const { data, error } = await supabase
    .from("leads")
    .update(update)
    .eq("user_id", userId)
    .eq("id", leadId)
    .select("*")
    .single();
  if (error) throw error;
  return rowToLeadPool(data as LeadRow);
}

export interface ExitLeadInput {
  type: "paused" | "invalid";
  reason?: string;
  resumeOn?: string;
}

function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** 退出线索池前先在应用层校验，给用户明确反馈而不是依赖数据库约束报错。 */
export async function exitLead(leadId: string, input: ExitLeadInput): Promise<LeadPoolLead> {
  const userId = await requireUserId();
  const exitAt = new Date().toISOString();
  let update: LeadUpdate;

  if (input.type === "paused") {
    if (!input.resumeOn || !isDateKey(input.resumeOn)) {
      throw new Error("暂不跟进时必须填写有效的恢复日期。");
    }
    update = {
      status: "paused",
      exit_at: exitAt,
      resume_on: input.resumeOn,
      exit_reason: null,
    };
  } else {
    const reason = input.reason?.trim();
    if (!reason) {
      throw new Error("无法推进时必须填写退出原因。");
    }
    update = {
      status: "invalid",
      exit_at: exitAt,
      exit_reason: reason,
      resume_on: null,
    };
  }

  const { data, error } = await supabase
    .from("leads")
    .update(update)
    .eq("user_id", userId)
    .eq("id", leadId)
    .select("*")
    .single();
  if (error) throw error;
  return rowToLeadPool(data as LeadRow);
}

export async function resumeLead(leadId: string): Promise<LeadPoolLead> {
  const userId = await requireUserId();
  const update: LeadUpdate = {
    status: "to_follow_up",
    exit_at: null,
    resume_on: null,
    exit_reason: null,
  };
  const { data, error } = await supabase
    .from("leads")
    .update(update)
    .eq("user_id", userId)
    .eq("id", leadId)
    .select("*")
    .single();
  if (error) throw error;
  return rowToLeadPool(data as LeadRow);
}

// Extract unique companies from user's own leads (for autocomplete).
export async function listUserCompanies(): Promise<string[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("company_name")
    .not("company_name", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of (data ?? []) as { company_name: string | null }[]) {
    const c = (r.company_name ?? "").trim();
    if (c && !seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  return out;
}

/**
 * 标记线索已转化：写入 converted_customer_id，并把状态改为 converted。
 * 由 customerRepository.convertLeadToCustomer 在创建客户成功后调用。
 */
export async function markLeadConverted(leadId: string, customerId: string): Promise<Lead> {
  // 是否已转客户必须查询 customers.lead_id（uq_customers_lead）；
  // converted_customer_id 只是回写的派生冗余，不能作为判断依据。
  const { data, error } = await supabase
    .from("leads")
    .update({ converted_customer_id: customerId, status: "converted" })
    .eq("id", leadId)
    .select("*")
    .single();
  if (error) throw error;
  return rowToLead(data as Row);
}
