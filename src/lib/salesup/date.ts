// Date / slot helpers for Sales Up timeline.
// Day starts at 07:00 and runs to 24:00 in 15-minute slots.
// Slot index 0 = 07:00, slot 68 = 24:00 (exclusive end).

export const DAY_START_HOUR = 7;
export const DAY_END_HOUR = 24;
export const SLOT_MINUTES = 15;
export const SLOTS_PER_HOUR = 60 / SLOT_MINUTES;
export const TOTAL_SLOTS = (DAY_END_HOUR - DAY_START_HOUR) * SLOTS_PER_HOUR; // 68

export function slotToMinutes(slot: number): number {
  return DAY_START_HOUR * 60 + slot * SLOT_MINUTES;
}

export function slotToTimeString(slot: number): string {
  const m = slotToMinutes(slot);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function timeStringToSlot(t: string): number {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr ?? "0", 10);
  const m = parseInt(mStr ?? "0", 10);
  const totalMin = h * 60 + m;
  return Math.max(0, Math.min(TOTAL_SLOTS, (totalMin - DAY_START_HOUR * 60) / SLOT_MINUTES));
}

export function slotsDuration(startSlot: number, endSlot: number): number {
  return Math.max(0, endSlot - startSlot) * SLOT_MINUTES; // minutes
}

export function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}

// --- Date keys ---

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map((x) => parseInt(x, 10));
  return new Date(y, m - 1, d);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDays(key: string, n: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

export function formatDateLabel(key: string): string {
  const d = fromDateKey(key);
  const weekday = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 周${weekday}`;
}

// --- ISO week ---

export function getISOWeek(d: Date): { year: number; week: number } {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target.getTime() - firstThursday.getTime();
  const week = 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
  return { year: target.getFullYear(), week };
}

export function weekKeyOf(key: string): string {
  const { year, week } = getISOWeek(fromDateKey(key));
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function weekRangeOf(key: string): { start: string; end: string; days: string[] } {
  // ISO week: Monday -> Sunday
  const d = fromDateKey(key);
  const dayNr = (d.getDay() + 6) % 7; // 0=Mon
  const monday = new Date(d);
  monday.setDate(d.getDate() - dayNr);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    days.push(toDateKey(dd));
  }
  return { start: days[0], end: days[6], days };
}

// --- Month ---

export function monthKeyOf(key: string): string {
  return key.slice(0, 7); // YYYY-MM
}

export function monthDaysOf(key: string): string[] {
  const d = fromDateKey(key);
  const y = d.getFullYear();
  const m = d.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const days: string[] = [];
  for (let i = 1; i <= last; i++) {
    days.push(toDateKey(new Date(y, m, i)));
  }
  return days;
}

export function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // RFC4122 v4 fallback
  const r = (n: number) => Math.floor(Math.random() * n);
  const hex = (n: number) => r(16).toString(16).padStart(1, "0").repeat(n);
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${(8 + r(4)).toString(16)}${hex(3)}-${hex(12)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
