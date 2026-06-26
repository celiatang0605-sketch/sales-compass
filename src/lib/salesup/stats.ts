// Stats aggregation helpers for Sales Up reviews and timeline cards.

import type { TimeBlock } from "./types";
import { WORK_TYPE_MAP, type WorkTypeId } from "./workTypes";
import { SLOT_MINUTES } from "./date";

export interface DayStats {
  totalMinutes: number;
  customerProgressMinutes: number;
  internalCostMinutes: number;
  proposalMinutes: number;
  learningReviewMinutes: number;
  highValueMinutes: number;
  highValueRatio: number; // 0..1 of totalMinutes
  byType: Record<WorkTypeId, number>;
  meetingCustomerCount: number;
  visitCustomerCount: number;
  followupCustomerCount: number;
  problemTagCounts: Record<string, number>;
  nextActions: { text: string; date: string; blockId: string }[];
  notes: { text: string; blockId: string }[];
  summaries: { text: string; title: string; blockId: string }[];
}

function emptyStats(): DayStats {
  return {
    totalMinutes: 0,
    customerProgressMinutes: 0,
    internalCostMinutes: 0,
    proposalMinutes: 0,
    learningReviewMinutes: 0,
    highValueMinutes: 0,
    highValueRatio: 0,
    byType: Object.fromEntries(
      Object.keys(WORK_TYPE_MAP).map((k) => [k, 0]),
    ) as Record<WorkTypeId, number>,
    meetingCustomerCount: 0,
    visitCustomerCount: 0,
    followupCustomerCount: 0,
    problemTagCounts: {},
    nextActions: [],
    notes: [],
    summaries: [],
  };
}

export function computeStats(blocks: TimeBlock[]): DayStats {
  const s = emptyStats();
  for (const b of blocks) {
    const mins = Math.max(0, b.end_slot - b.start_slot) * SLOT_MINUTES;
    if (mins === 0) continue;
    s.totalMinutes += mins;
    const wt = WORK_TYPE_MAP[b.work_type];
    if (wt) {
      s.byType[b.work_type] = (s.byType[b.work_type] ?? 0) + mins;
      if (wt.categories.includes("customer_progress")) s.customerProgressMinutes += mins;
      if (wt.categories.includes("internal_cost")) s.internalCostMinutes += mins;
      if (wt.categories.includes("proposal")) s.proposalMinutes += mins;
      if (wt.categories.includes("learning_review")) s.learningReviewMinutes += mins;
    }
    if (b.value_level === "high") s.highValueMinutes += mins;
    if (b.work_type === "meeting_customer") s.meetingCustomerCount += 1;
    if (b.work_type === "visit_customer") s.visitCustomerCount += 1;
    if (b.work_type === "followup_customer") s.followupCustomerCount += 1;
    for (const tag of b.problem_tags ?? []) {
      if (!tag) continue;
      s.problemTagCounts[tag] = (s.problemTagCounts[tag] ?? 0) + 1;
    }
    if (b.next_action?.trim()) {
      s.nextActions.push({ text: b.next_action.trim(), date: b.next_action_date, blockId: b.id });
    }
    if (b.notes?.trim()) {
      s.notes.push({ text: b.notes.trim(), blockId: b.id });
    }
    if (b.summary?.trim()) {
      s.summaries.push({ text: b.summary.trim(), title: b.title || "", blockId: b.id });
    }
  }
  s.highValueRatio = s.totalMinutes > 0 ? s.highValueMinutes / s.totalMinutes : 0;
  return s;
}

export function topProblemTags(counts: Record<string, number>, limit = 5): { tag: string; count: number }[] {
  return Object.entries(counts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
