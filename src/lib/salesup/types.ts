// Shared types for Sales Up. Schema mirrors planned Supabase tables so the
// localStorage layer can be swapped for real DB calls with minimal changes.

import type { WorkTypeId } from "./workTypes";

export type ValueLevel = "high" | "medium" | "low";

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
