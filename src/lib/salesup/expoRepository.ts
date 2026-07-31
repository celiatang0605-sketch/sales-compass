// Supabase-backed CRUD for leads. Phase 3 canonical data layer.
// Pages should use this repository (or the useLeads hook), NOT expoStore.

import { supabase } from "@/integrations/supabase/client";
import { toDateKey, todayKey } from "./date";
import { deriveHeadline, type Lead, type LeadPriority, type LeadStatus } from "./expoMock";
import type { CustomerSource } from "./customerTypes";

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
  created_at: string;
  updated_at: string;
};

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

export interface NewLeadInput {
  source?: CustomerSource;
  sourceDate?: string;
  sourceDetail?: string;
  company: string;
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
    source: input.source ?? "expo",
    source_date: input.sourceDate || null,
    source_detail: input.sourceDetail?.trim() || null,
    company_name: input.company.trim() || null,
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
  const { data, error } = await supabase
    .from("leads")
    .update({ converted_customer_id: customerId, status: "converted" })
    .eq("id", leadId)
    .select("*")
    .single();
  if (error) throw error;
  return rowToLead(data as Row);
}
