// LocalStorage data layer for Sales Up.
//
// Designed to be swapped for Supabase later: all read/write helpers are
// keyed by user_id (currently null), use string IDs, and store ISO timestamps.
// Each collection exposes list/get/upsert/remove + a subscribe() hook for
// cross-component reactivity.

import { useEffect, useState, useCallback } from "react";
import type {
  TimeBlock,
  DailyReview,
  WeeklyReview,
  MonthlyReview,
  Reminder,
} from "./types";
import { uid, nowIso } from "./date";

const KEY_PREFIX = "salesup:v1:";

type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

function notify(key: string) {
  listeners.get(key)?.forEach((l) => l());
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_PREFIX + key, JSON.stringify(value));
  notify(key);
}

function useCollection<T>(key: string, fallback: T): T {
  const [state, setState] = useState<T>(() => read<T>(key, fallback));
  useEffect(() => {
    const listener = () => setState(read<T>(key, fallback));
    let set = listeners.get(key);
    if (!set) {
      set = new Set();
      listeners.set(key, set);
    }
    set.add(listener);
    listener();
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY_PREFIX + key) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      set?.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

// -------- Time blocks --------

const TB_KEY = "time_blocks";

export function useTimeBlocks(): TimeBlock[] {
  return useCollection<TimeBlock[]>(TB_KEY, []);
}

export function useTimeBlocksForDate(date: string): TimeBlock[] {
  const all = useTimeBlocks();
  return all.filter((b) => b.date === date).sort((a, b) => a.start_slot - b.start_slot);
}

export function useTimeBlocksForDates(dates: string[]): TimeBlock[] {
  const all = useTimeBlocks();
  const set = new Set(dates);
  return all
    .filter((b) => set.has(b.date))
    .sort((a, b) => (a.date === b.date ? a.start_slot - b.start_slot : a.date.localeCompare(b.date)));
}

export function upsertTimeBlock(block: Partial<TimeBlock> & Pick<TimeBlock, "date" | "start_slot" | "end_slot" | "work_type">): TimeBlock {
  const list = read<TimeBlock[]>(TB_KEY, []);
  const now = nowIso();
  let saved: TimeBlock;
  if (block.id) {
    const idx = list.findIndex((b) => b.id === block.id);
    if (idx >= 0) {
      saved = { ...list[idx], ...block, updated_at: now } as TimeBlock;
      list[idx] = saved;
    } else {
      saved = newBlock(block, now);
      list.push(saved);
    }
  } else {
    saved = newBlock(block, now);
    list.push(saved);
  }
  write(TB_KEY, list);
  return saved;
}

function newBlock(block: Partial<TimeBlock>, now: string): TimeBlock {
  return {
    id: uid(),
    user_id: null,
    date: block.date!,
    start_slot: block.start_slot!,
    end_slot: block.end_slot!,
    work_type: block.work_type!,
    title: block.title ?? "",
    customer: block.customer ?? "",
    summary: block.summary ?? "",
    key_info: block.key_info ?? "",
    next_action: block.next_action ?? "",
    next_action_date: block.next_action_date ?? "",
    problem_tags: block.problem_tags ?? [],
    notes: block.notes ?? "",
    value_level: block.value_level ?? "medium",
    customer_id: block.customer_id ?? null,
    opportunity_id: block.opportunity_id ?? null,
    created_at: now,
    updated_at: now,
  };
}

export function deleteTimeBlock(id: string) {
  const list = read<TimeBlock[]>(TB_KEY, []).filter((b) => b.id !== id);
  write(TB_KEY, list);
}

export function copyBlocksFromDate(fromDate: string, toDate: string): number {
  const list = read<TimeBlock[]>(TB_KEY, []);
  const source = list.filter((b) => b.date === fromDate);
  const now = nowIso();
  const copies: TimeBlock[] = source.map((b) => ({
    ...b,
    id: uid(),
    date: toDate,
    created_at: now,
    updated_at: now,
  }));
  // Replace existing blocks for target date
  const remaining = list.filter((b) => b.date !== toDate);
  write(TB_KEY, [...remaining, ...copies]);
  return copies.length;
}

export function copyBlocksFromWeek(fromWeekDays: string[], toWeekDays: string[]): number {
  if (fromWeekDays.length !== 7 || toWeekDays.length !== 7) return 0;
  const list = read<TimeBlock[]>(TB_KEY, []);
  const fromSet = new Set(fromWeekDays);
  const toSet = new Set(toWeekDays);
  const source = list.filter((b) => fromSet.has(b.date));
  const now = nowIso();
  const copies: TimeBlock[] = source.map((b) => {
    const idx = fromWeekDays.indexOf(b.date);
    return {
      ...b,
      id: uid(),
      date: toWeekDays[idx],
      created_at: now,
      updated_at: now,
    };
  });
  const remaining = list.filter((b) => !toSet.has(b.date));
  write(TB_KEY, [...remaining, ...copies]);
  return copies.length;
}



// -------- Daily review --------

const DR_KEY = "daily_reviews";

export function useDailyReview(date: string): DailyReview | undefined {
  const list = useCollection<DailyReview[]>(DR_KEY, []);
  return list.find((r) => r.date === date);
}

export function saveDailyReview(date: string, patch: Partial<DailyReview>) {
  const list = read<DailyReview[]>(DR_KEY, []);
  const now = nowIso();
  const idx = list.findIndex((r) => r.date === date);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...patch, updated_at: now };
  } else {
    list.push({
      id: uid(),
      user_id: null,
      date,
      top_customer_progress: "",
      biggest_blocker: "",
      tomorrow_priority: "",
      created_at: now,
      updated_at: now,
      ...patch,
    });
  }
  write(DR_KEY, list);
}

// -------- Weekly review --------

const WR_KEY = "weekly_reviews";

export function useWeeklyReview(weekKey: string): WeeklyReview | undefined {
  const list = useCollection<WeeklyReview[]>(WR_KEY, []);
  return list.find((r) => r.week_key === weekKey);
}

export function saveWeeklyReview(weekKey: string, patch: Partial<WeeklyReview>) {
  const list = read<WeeklyReview[]>(WR_KEY, []);
  const now = nowIso();
  const idx = list.findIndex((r) => r.week_key === weekKey);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...patch, updated_at: now };
  } else {
    list.push({
      id: uid(),
      user_id: null,
      week_key: weekKey,
      effective_actions: "",
      recurring_problems: "",
      lessons_learned: "",
      next_week_focus: "",
      created_at: now,
      updated_at: now,
      ...patch,
    });
  }
  write(WR_KEY, list);
}

// -------- Monthly review --------

const MR_KEY = "monthly_reviews";

export function useMonthlyReview(monthKey: string): MonthlyReview | undefined {
  const list = useCollection<MonthlyReview[]>(MR_KEY, []);
  return list.find((r) => r.month_key === monthKey);
}

export function saveMonthlyReview(monthKey: string, patch: Partial<MonthlyReview>) {
  const list = read<MonthlyReview[]>(MR_KEY, []);
  const now = nowIso();
  const idx = list.findIndex((r) => r.month_key === monthKey);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...patch, updated_at: now };
  } else {
    list.push({
      id: uid(),
      user_id: null,
      month_key: monthKey,
      capability_growth: "",
      main_blockers: "",
      next_month_focus: "",
      created_at: now,
      updated_at: now,
      ...patch,
    });
  }
  write(MR_KEY, list);
}

// -------- Reminders --------

const RM_KEY = "reminders";

export function useReminders(): Reminder[] {
  return useCollection<Reminder[]>(RM_KEY, []);
}

export function upsertReminder(reminder: Partial<Reminder> & Pick<Reminder, "title">): Reminder {
  const list = read<Reminder[]>(RM_KEY, []);
  const now = nowIso();
  let saved: Reminder;
  if (reminder.id) {
    const idx = list.findIndex((r) => r.id === reminder.id);
    if (idx >= 0) {
      saved = { ...list[idx], ...reminder, updated_at: now };
      list[idx] = saved;
    } else {
      saved = newReminder(reminder, now);
      list.push(saved);
    }
  } else {
    saved = newReminder(reminder, now);
    list.push(saved);
  }
  write(RM_KEY, list);
  return saved;
}

function newReminder(r: Partial<Reminder>, now: string): Reminder {
  return {
    id: uid(),
    user_id: null,
    title: r.title ?? "",
    type: r.type ?? "todo",
    frequency: r.frequency ?? "once",
    related_date: r.related_date ?? "",
    customer: r.customer ?? "",
    related_block_id: r.related_block_id ?? null,
    priority: r.priority ?? "medium",
    status: r.status ?? "pending",
    note: r.note ?? "",
    created_at: now,
    updated_at: now,
  };
}

export function deleteReminder(id: string) {
  const list = read<Reminder[]>(RM_KEY, []).filter((r) => r.id !== id);
  write(RM_KEY, list);
}

export function useToggleStatus() {
  return useCallback((id: string, status: Reminder["status"]) => {
    upsertReminder({ id, title: "", status });
  }, []);
}
