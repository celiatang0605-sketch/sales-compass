// Phase 3 client-side helpers:
//   - Per-user draft (draft is intentionally local, not synced to Supabase).
//   - One-shot detection of Phase-2 leftover leads (for legacy migration UI).
//
// Real lead data lives in Supabase — see expoRepository.ts / useExpoLeads.

import { supabase } from "@/integrations/supabase/client";
import { createLead } from "./expoRepository";
import { MOCK_COMPANY_POOL, type ExpoPriority } from "./expoMock";

export const LEGACY_LS_KEY_LEADS = "salesup.expo.leads.v1";
const DRAFT_KEY_PREFIX = "salesup.expo.new.draft.v1";
const LEGACY_MIGRATED_FLAG = "salesup.expo.legacy.migrated.v1";

export interface ExpoDraft {
  company: string;
  raw: string;
  priority: ExpoPriority;
  signals: string[];
  nextAction: string;
  nextDate: string;
  updatedAt: number;
}

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// --- Draft (scoped per user) ---

function draftKey(userId: string | null | undefined): string {
  return userId ? `${DRAFT_KEY_PREFIX}:${userId}` : DRAFT_KEY_PREFIX;
}

function isDraftEmpty(d: ExpoDraft): boolean {
  return (
    !d.company?.trim() &&
    !d.raw?.trim() &&
    !d.nextAction?.trim() &&
    (!d.signals || d.signals.length === 0) &&
    (!d.priority || d.priority === "unrated")
  );
}

export function getDraft(userId: string | null | undefined): ExpoDraft | null {
  if (!isBrowser()) return null;
  const d = safeParse<ExpoDraft | null>(
    window.localStorage.getItem(draftKey(userId)),
    null,
  );
  if (!d) return null;
  return isDraftEmpty(d) ? null : d;
}

export function saveDraft(userId: string | null | undefined, d: ExpoDraft): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(draftKey(userId), JSON.stringify(d));
}

export function clearDraft(userId: string | null | undefined): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(draftKey(userId));
}

// --- Company autocomplete pool ---

export function searchCompanies(
  kw: string,
  history: string[],
  limit = 6,
): string[] {
  const k = kw.trim().toLowerCase();
  if (!k) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  // History first, then mock pool.
  for (const c of [...history, ...MOCK_COMPANY_POOL]) {
    const v = c.trim();
    if (!v || seen.has(v)) continue;
    if (v.toLowerCase().includes(k)) {
      seen.add(v);
      out.push(v);
      if (out.length >= limit) break;
    }
  }
  return out;
}

// --- Legacy Phase-2 leads (still in localStorage) ---

type LegacyLead = {
  company?: string;
  contactName?: string;
  rating?: string;
  status?: string;
  rawNote?: string;
  nextAction?: string;
  nextActionDate?: string;
  signals?: string[];
  createdAt?: string;
};

function migratedFlagKey(userId: string): string {
  return `${LEGACY_MIGRATED_FLAG}:${userId}`;
}

export function hasLegacyLocalLeads(userId: string | null | undefined): boolean {
  if (!isBrowser() || !userId) return false;
  if (window.localStorage.getItem(migratedFlagKey(userId))) return false;
  const raw = window.localStorage.getItem(LEGACY_LS_KEY_LEADS);
  const arr = safeParse<LegacyLead[]>(raw, []);
  return Array.isArray(arr) && arr.length > 0;
}

export function countLegacyLocalLeads(): number {
  if (!isBrowser()) return 0;
  const arr = safeParse<LegacyLead[]>(
    window.localStorage.getItem(LEGACY_LS_KEY_LEADS),
    [],
  );
  return Array.isArray(arr) ? arr.length : 0;
}

const LEGACY_PRIORITIES = new Set(["A", "B", "C", "D", "unrated"]);

export async function importLegacyLocalLeads(userId: string): Promise<{
  imported: number;
  failed: number;
}> {
  if (!isBrowser()) return { imported: 0, failed: 0 };
  const arr = safeParse<LegacyLead[]>(
    window.localStorage.getItem(LEGACY_LS_KEY_LEADS),
    [],
  );
  let imported = 0;
  let failed = 0;
  for (const l of arr) {
    try {
      const priority = (LEGACY_PRIORITIES.has(l.rating ?? "")
        ? l.rating
        : "unrated") as ExpoPriority;
      await createLead({
        company: l.company ?? "",
        rawNote: l.rawNote ?? "",
        priority,
        status: "to_organize",
        signals: Array.isArray(l.signals) ? l.signals : [],
        nextAction: l.nextAction ?? "",
        nextActionDate: l.nextActionDate ?? "",
      });
      imported++;
    } catch (e) {
      console.error("[expo] legacy import failed", e);
      failed++;
    }
  }
  if (failed === 0) {
    // Only remove the source data if everything imported cleanly.
    window.localStorage.removeItem(LEGACY_LS_KEY_LEADS);
  }
  window.localStorage.setItem(migratedFlagKey(userId), String(Date.now()));
  return { imported, failed };
}

// --- Current user id helper (small wrapper) ---

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}
