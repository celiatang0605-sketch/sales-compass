// Types + labels + optional mock data for the 展会线索 module.
// Phase 3: MOCK_LEADS is kept for the company autocomplete pool ONLY.
// It must NOT be rendered as real leads on the /expo pages.

export type ExpoPriority = "A" | "B" | "C" | "D" | "unrated";

export type ExpoStatus =
  | "to_organize"
  | "to_follow_up"
  | "contacted"
  | "waiting_reply"
  | "replied"
  | "meeting_scheduled"
  | "converted"
  | "nurture"
  | "invalid";

export interface ExpoLead {
  id: string;
  company: string;
  contactName: string;
  contactTitle?: string;
  phone?: string;
  wechat?: string;
  email?: string;
  priority: ExpoPriority;
  status: ExpoStatus;
  headline: string; // derived from rawNote (UI only)
  nextAction: string;
  nextActionDate: string; // YYYY-MM-DD
  lastContactedAt?: string;
  rawNote: string;
  summary?: string;
  keyInfo?: string;
  coreProblem?: string;
  currentNeed?: string;
  decisionRole?: string;
  budgetSignal?: string;
  timeline?: string;
  currentVendor?: string;
  priorityReason?: string;
  signals?: string[];
  createdAt: string; // YYYY-MM-DD
}

export const STATUS_LABEL: Record<ExpoStatus, string> = {
  to_organize: "待整理",
  to_follow_up: "待跟进",
  contacted: "已联系",
  waiting_reply: "等待回复",
  replied: "已回复",
  meeting_scheduled: "已约会议",
  converted: "已转商机",
  nurture: "长期培育",
  invalid: "无效",
};

export const PRIORITY_LABEL: Record<ExpoPriority, string> = {
  A: "A 重点",
  B: "B 值得跟进",
  C: "C 普通线索",
  D: "D 暂不跟进",
  unrated: "待判断",
};

export const PRIORITY_STYLE: Record<ExpoPriority, string> = {
  A: "bg-primary/10 text-primary border-primary/20",
  B: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  C: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  D: "bg-muted text-muted-foreground border-border",
  unrated: "bg-secondary text-secondary-foreground border-border",
};

// Autocomplete-only pool (kept locally, never persisted).
export const MOCK_COMPANY_POOL: string[] = [
  "星海传媒集团",
  "云途科技",
  "北岸新能源",
  "锦华食品",
  "远景资本",
];

// Local-timezone today key (YYYY-MM-DD). Reuses date.ts helper.
import { todayKey } from "./date";

export function todayIso(): string {
  return todayKey();
}

export function isOverdue(dateStr: string, today = todayIso()): boolean {
  return !!dateStr && dateStr < today;
}

// Whether a lead is an active follow-up target for the "待跟进" stat.
// Rule: status === "to_follow_up", OR has a nextAction whose date is today or overdue.
// Excludes: to_organize, nurture, invalid, converted, and future-dated actions.
export function isActiveFollowup(
  lead: { status: ExpoStatus; nextAction?: string; nextActionDate?: string },
  today = todayIso(),
): boolean {
  if (lead.status === "to_follow_up") return true;
  if (lead.status === "nurture" || lead.status === "invalid" || lead.status === "converted") {
    return false;
  }
  const action = (lead.nextAction ?? "").trim();
  const date = (lead.nextActionDate ?? "").trim();
  return !!action && !!date && date <= today;
}

export function deriveHeadline(rawNote: string): string {
  const t = rawNote.trim();
  if (!t) return "现场快速记录";
  return t.length > 60 ? t.slice(0, 60) + "…" : t;
}
