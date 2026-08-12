import { supabase } from "@/integrations/supabase/client";
import type { CallAttemptRow } from "@/integrations/supabase/types";
import { addDays, fromDateKey, todayKey, toDateKey, weekRangeOf } from "./date";

export interface CallAttempt {
  id: string;
  leadId: string | null;
  calledAt: string;
  outcome: string | null;
  note: string | null;
}

export interface TodayCall extends CallAttempt {
  companyName: string | null;
}

export interface CallStats {
  todayCount: number;
  totalCount: number;
  streakDays: number;
  todayCalls: TodayCall[];
  /** Local-date call totals used by the recent-weeks heatmap. */
  dailyCounts: Record<string, number>;
}

export interface LogCallInput {
  leadId?: string | null;
  note?: string;
  outcome?: string;
}

function rowToCallAttempt(row: CallAttemptRow): CallAttempt {
  return {
    id: row.id,
    leadId: row.lead_id,
    calledAt: row.called_at,
    outcome: row.outcome,
    note: row.note,
  };
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user?.id) throw new Error("请先登录后再记录拨打。");
  return data.user.id;
}

function dayStartIso(key: string): string {
  return fromDateKey(key).toISOString();
}

async function listTodayCallsForUser(userId: string, today = todayKey()): Promise<TodayCall[]> {
  const { data, error } = await supabase
    .from("call_attempts")
    .select("*")
    .eq("user_id", userId)
    .gte("called_at", dayStartIso(today))
    .lt("called_at", dayStartIso(addDays(today, 1)))
    .order("called_at", { ascending: false });
  if (error) throw error;

  const attempts = ((data ?? []) as CallAttemptRow[]).map(rowToCallAttempt);
  const leadIds = [
    ...new Set(attempts.flatMap((attempt) => (attempt.leadId ? [attempt.leadId] : []))),
  ];
  if (leadIds.length === 0) return attempts.map((attempt) => ({ ...attempt, companyName: null }));

  const { data: leads, error: leadsError } = await supabase
    .from("leads")
    .select("id, company_name")
    .eq("user_id", userId)
    .in("id", leadIds);
  if (leadsError) throw leadsError;

  const companyByLeadId = new Map(
    (leads ?? []).map((lead) => [lead.id, lead.company_name as string | null]),
  );
  return attempts.map((attempt) => ({
    ...attempt,
    companyName: attempt.leadId ? (companyByLeadId.get(attempt.leadId) ?? null) : null,
  }));
}

async function listAllCalledAt(userId: string): Promise<string[]> {
  const pageSize = 1000;
  const dates: string[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("call_attempts")
      .select("called_at")
      .eq("user_id", userId)
      .order("called_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data ?? [];
    dates.push(...rows.map((row) => row.called_at as string));
    if (rows.length < pageSize) return dates;
  }
}

function countByLocalDay(calledAt: string[]): Record<string, number> {
  return calledAt.reduce<Record<string, number>>((counts, value) => {
    const key = toDateKey(new Date(value));
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function consecutiveDays(dailyCounts: Record<string, number>, today = todayKey()): number {
  let days = 0;
  let day = today;
  while ((dailyCounts[day] ?? 0) > 0) {
    days++;
    day = addDays(day, -1);
  }
  return days;
}

export async function logCall(input: LogCallInput = {}): Promise<CallAttempt> {
  const userId = await requireUserId();
  const calledAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("call_attempts")
    .insert({
      user_id: userId,
      lead_id: input.leadId ?? null,
      called_at: calledAt,
      outcome: input.outcome?.trim() || null,
      note: input.note?.trim() || null,
    })
    .select("*")
    .single();
  if (error) throw error;

  if (input.leadId) {
    const { error: leadError } = await supabase
      .from("leads")
      .update({ last_contact_at: calledAt })
      .eq("user_id", userId)
      .eq("id", input.leadId);
    if (leadError) throw leadError;
  }

  return rowToCallAttempt(data as CallAttemptRow);
}

export async function deleteCallAttempt(id: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("call_attempts")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}

export async function listTodayCalls(): Promise<TodayCall[]> {
  const userId = await requireUserId();
  return listTodayCallsForUser(userId);
}

export async function getCallStats(): Promise<CallStats> {
  const userId = await requireUserId();
  const today = todayKey();
  const todayStart = dayStartIso(today);
  const tomorrowStart = dayStartIso(addDays(today, 1));
  const [todayResult, totalResult, todayCalls, allCalledAt] = await Promise.all([
    supabase
      .from("call_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("called_at", todayStart)
      .lt("called_at", tomorrowStart),
    supabase
      .from("call_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    listTodayCallsForUser(userId, today),
    listAllCalledAt(userId),
  ]);

  if (todayResult.error) throw todayResult.error;
  if (totalResult.error) throw totalResult.error;

  const dailyCounts = countByLocalDay(allCalledAt);
  const heatmapStart = addDays(weekRangeOf(today).start, -77);
  const heatmapCounts = Object.fromEntries(
    Object.entries(dailyCounts).filter(([key]) => key >= heatmapStart),
  );

  return {
    todayCount: todayResult.count ?? 0,
    totalCount: totalResult.count ?? 0,
    streakDays: consecutiveDays(dailyCounts, today),
    todayCalls,
    dailyCounts: heatmapCounts,
  };
}
