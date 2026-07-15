// Phase 2 临时前端数据层：使用 localStorage 存储用户新增的展会线索与未提交草稿。
// Phase 3 接入 Supabase 时，本文件整体会被替换为真实数据源，UI 侧只需切换 import。

import { MOCK_LEADS, todayIso, type ExpoLead, type ExpoRating, type ExpoStatus } from "./expoMock";

export const LS_KEY_LEADS = "salesup.expo.leads.v1";
export const LS_KEY_DRAFT = "salesup.expo.new.draft.v1";

export interface ExpoDraft {
  company: string;
  raw: string;
  rating: ExpoRating;
  signals: string[];
  nextAction: string;
  nextDate: string;
  updatedAt: number;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getUserLeads(): ExpoLead[] {
  if (!isBrowser()) return [];
  return safeParse<ExpoLead[]>(window.localStorage.getItem(LS_KEY_LEADS), []);
}

export function addUserLead(lead: ExpoLead): void {
  if (!isBrowser()) return;
  const all = getUserLeads();
  all.unshift(lead);
  window.localStorage.setItem(LS_KEY_LEADS, JSON.stringify(all));
}

export function getAllLeads(): ExpoLead[] {
  const user = getUserLeads();
  const merged = [...user, ...MOCK_LEADS];
  return merged.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function findAnyLead(id: string): ExpoLead | undefined {
  return getAllLeads().find((l) => l.id === id);
}

export function getDraft(): ExpoDraft | null {
  if (!isBrowser()) return null;
  const d = safeParse<ExpoDraft | null>(window.localStorage.getItem(LS_KEY_DRAFT), null);
  if (!d) return null;
  const empty =
    !d.company?.trim() &&
    !d.raw?.trim() &&
    !d.nextAction?.trim() &&
    (!d.signals || d.signals.length === 0) &&
    (!d.rating || d.rating === "unrated");
  return empty ? null : d;
}

export function saveDraft(d: ExpoDraft): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(LS_KEY_DRAFT, JSON.stringify(d));
}

export function clearDraft(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(LS_KEY_DRAFT);
}

export interface TodayCounts {
  total: number;
  A: number;
  toOrganize: number;
}

export function todayCounts(): TodayCounts {
  const today = todayIso();
  const all = getAllLeads();
  const todays = all.filter((l) => l.createdAt === today);
  return {
    total: todays.length,
    A: todays.filter((l) => l.rating === "A").length,
    toOrganize: todays.filter((l) => l.status === "to_organize").length,
  };
}

export function newLeadId(): string {
  return `lead-local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// A tiny in-memory autocomplete pool for on-site company search.
// Supabase 接入后此列表将替换为真实企业搜索接口。
const EXTRA_COMPANY_POOL = [
  "奥克斯集团",
  "奥迪中国",
  "百度智能云",
  "宝洁大中华区",
  "比亚迪",
  "波士顿咨询",
  "达能中国",
  "戴森中国",
  "钉钉",
  "东方甄选",
  "飞书",
  "格力电器",
  "海尔集团",
  "华为消费者业务",
  "京东零售",
  "菊乐乳业",
  "联想集团",
  "美团外卖",
  "蔚来汽车",
  "小红书",
  "小米集团",
  "旭辉集团",
  "腾讯广告",
  "字节跳动商业化",
];

export function searchCompanies(kw: string, limit = 6): string[] {
  const k = kw.trim().toLowerCase();
  if (!k) return [];
  const pool = new Set<string>([
    ...MOCK_LEADS.map((l) => l.company),
    ...EXTRA_COMPANY_POOL,
    ...getUserLeads().map((l) => l.company),
  ]);
  return Array.from(pool)
    .filter((c) => c.toLowerCase().includes(k))
    .slice(0, limit);
}

export type { ExpoLead, ExpoRating, ExpoStatus };
