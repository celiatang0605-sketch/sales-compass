// Supabase-backed CRUD for expo_leads. Phase 3 canonical data layer.
// Pages should use this repository (or the useExpoLeads hook), NOT expoStore.

import { supabase } from "@/integrations/supabase/client";
import { toDateKey, todayKey } from "./date";
import {
  deriveHeadline,
  type ExpoLead,
  type ExpoPriority,
  type ExpoStatus,
} from "./expoMock";

type Row = {
  id: string;
  user_id: string;
  company_name: string | null;
  contact_name: string | null;
  contact_title: string | null;
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
  existing_vendor: string | null;
  priority: string;
  signals: string[] | null;
  score_reason: string | null;
  status: string;
  next_action: string | null;
  next_action_date: string | null;
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
};

function rowToLead(r: Row): ExpoLead {
  const raw = r.raw_note ?? "";
  return {
    id: r.id,
    company: r.company_name ?? "",
    contactName: r.contact_name ?? "",
    contactTitle: r.contact_title ?? undefined,
    phone: r.phone ?? undefined,
    wechat: r.wechat ?? undefined,
    email: r.email ?? undefined,
    priority: (r.priority as ExpoPriority) ?? "unrated",
    status: (r.status as ExpoStatus) ?? "to_organize",
    headline: deriveHeadline(raw),
    rawNote: raw,
    summary: r.conversation_summary ?? undefined,
    keyInfo: r.key_info ?? undefined,
    coreProblem: r.pain_points ?? undefined,
    currentNeed: r.needs ?? undefined,
    decisionRole: r.decision_role ?? undefined,
    budgetSignal: r.budget_signal ?? undefined,
    timeline: r.timing_signal ?? undefined,
    currentVendor: r.existing_vendor ?? undefined,
    priorityReason: r.score_reason ?? undefined,
    signals: r.signals ?? [],
    nextAction: r.next_action ?? "",
    nextActionDate: r.next_action_date ?? "",
    lastContactedAt: r.last_contact_at ? r.last_contact_at.slice(0, 10) : undefined,
    createdAt: (r.created_at ?? todayIso()).slice(0, 10),
  };
}

export interface NewLeadInput {
  company: string;
  rawNote: string;
  priority: ExpoPriority;
  status?: ExpoStatus;
  signals: string[];
  nextAction: string;
  nextActionDate: string;
}

export async function listLeads(): Promise<ExpoLead[]> {
  const { data, error } = await supabase
    .from("expo_leads")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Row[]).map(rowToLead);
}

export async function getLead(id: string): Promise<ExpoLead | null> {
  const { data, error } = await supabase
    .from("expo_leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToLead(data as Row) : null;
}

export async function createLead(input: NewLeadInput): Promise<ExpoLead> {
  const { data: userData, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;
  const uid = userData.user?.id;
  if (!uid) throw new Error("请先登录后再保存线索。");

  const row = {
    user_id: uid,
    company_name: input.company.trim() || null,
    raw_note: input.rawNote.trim() || null,
    priority: input.priority,
    status: input.status ?? "to_follow_up",
    signals: input.signals,
    next_action: input.nextAction.trim() || null,
    next_action_date: input.nextActionDate || null,
  };
  const { data, error } = await supabase
    .from("expo_leads")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return rowToLead(data as Row);
}

export async function updateLead(
  id: string,
  patch: Partial<NewLeadInput>,
): Promise<ExpoLead> {
  const update: Record<string, unknown> = {};
  if (patch.company !== undefined) update.company_name = patch.company.trim() || null;
  if (patch.rawNote !== undefined) update.raw_note = patch.rawNote.trim() || null;
  if (patch.priority !== undefined) update.priority = patch.priority;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.signals !== undefined) update.signals = patch.signals;
  if (patch.nextAction !== undefined) update.next_action = patch.nextAction.trim() || null;
  if (patch.nextActionDate !== undefined) update.next_action_date = patch.nextActionDate || null;

  const { data, error } = await supabase
    .from("expo_leads")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return rowToLead(data as Row);
}

export async function deleteLead(id: string): Promise<void> {
  const { error } = await supabase.from("expo_leads").delete().eq("id", id);
  if (error) throw error;
}

// Extract unique companies from user's own leads (for autocomplete).
export async function listUserCompanies(): Promise<string[]> {
  const { data, error } = await supabase
    .from("expo_leads")
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
