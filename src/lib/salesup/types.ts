// Shared types for Sales Up. Schema mirrors planned Supabase tables so the
// localStorage layer can be swapped for real DB calls with minimal changes.

import type { WorkTypeId } from "./workTypes";

export type ValueLevel = "high" | "medium" | "low";

export type EntryType = "progress" | "pitfall" | "note" | "todo" | "idea";
export type EntryQuadrant = "q1" | "q2" | "q3" | "q4";
export type EntryStatus = "open" | "done" | "dropped";
export type EntryWorkArea = "internal" | "learning" | "method";

export const ENTRY_TYPE_LABELS = {
  progress: "进展",
  pitfall: "踩坑",
  note: "注意",
  todo: "待办",
  idea: "想法",
} as const;

export const ENTRY_QUADRANT_LABELS = {
  q1: "重要且紧急",
  q2: "重要不紧急",
  q3: "紧急不重要",
  q4: "不重要不紧急",
} as const;

export const ENTRY_STATUS_LABELS = {
  open: "进行中",
  done: "已完成",
  dropped: "已放弃",
} as const;

export const ENTRY_WORK_AREA_LABELS = {
  internal: "内部流程",
  learning: "能力建设",
  method: "方法论复盘",
} as const;

export interface Entry {
  id: string;
  user_id: string | null;
  entry_type: EntryType;
  content: string;
  entry_date: string; // YYYY-MM-DD
  quadrant: EntryQuadrant | null;
  focus_date: string | null; // YYYY-MM-DD
  due_date: string | null; // YYYY-MM-DD
  status: EntryStatus;
  work_area: EntryWorkArea | null;
  customer_id: string | null;
  opportunity_id: string | null;
  related_block_id: string | null;
  tags: string[];
  position: number;
  created_at: string;
  updated_at: string;
}

export interface TimeBlock {
  id: string;
  user_id: string | null; // reserved for Supabase auth
  date: string; // YYYY-MM-DD (local)
  // Slot indices: 0 = 07:00, increments of 15 min. end_slot is EXCLUSIVE.
  // 7:00 -> 0, 24:00 -> 68. So valid range start_slot in [0, 67], end_slot in (start, 68].
  start_slot: number;
  end_slot: number;
  work_type: WorkTypeId;
  title: string;
  customer: string;
  summary: string;
  key_info: string;
  next_action: string;
  next_action_date: string; // YYYY-MM-DD or ""
  problem_tags: string[];
  notes: string;
  value_level: ValueLevel;
  // Reserved for stage-2 modules (customer board / opportunity tracking)
  customer_id: string | null;
  opportunity_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyReview {
  id: string;
  user_id: string | null;
  date: string; // YYYY-MM-DD
  top_customer_progress: string;
  biggest_blocker: string;
  tomorrow_priority: string;
  created_at: string;
  updated_at: string;
}

export interface WeeklyReview {
  id: string;
  user_id: string | null;
  week_key: string; // ISO week key e.g. 2026-W26
  effective_actions: string;
  recurring_problems: string;
  lessons_learned: string;
  next_week_focus: string;
  created_at: string;
  updated_at: string;
}

export interface MonthlyReview {
  id: string;
  user_id: string | null;
  month_key: string; // YYYY-MM
  capability_growth: string;
  main_blockers: string;
  next_month_focus: string;
  created_at: string;
  updated_at: string;
}

export type ReminderType = "todo" | "problem" | "note";
export type ReminderFrequency = "once" | "daily" | "weekly" | "monthly";
export type ReminderPriority = "high" | "medium" | "low";
export type ReminderStatus = "pending" | "in_progress" | "done";

export interface Reminder {
  id: string;
  user_id: string | null;
  title: string;
  type: ReminderType;
  frequency: ReminderFrequency;
  related_date: string; // YYYY-MM-DD or ""
  customer: string;
  related_block_id: string | null;
  priority: ReminderPriority;
  status: ReminderStatus;
  note: string;
  created_at: string;
  updated_at: string;
}
