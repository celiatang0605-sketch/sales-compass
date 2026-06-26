// Cloud sync layer for Sales Up.
// - Listens to Supabase auth state and tracks the current user id.
// - On sign-in, pulls time_blocks + reminders into the localStorage cache
//   (namespaced per user) and notifies the storage subscribers.
// - Mutations from storage.ts fire-and-forget upsert/delete calls here.
// - Exposes a one-shot migration that copies legacy (unnamespaced) local data
//   to the cloud for the current user.

import { supabase } from "@/integrations/supabase/client";
import type { TimeBlock, Reminder } from "./types";

const KEY_PREFIX = "salesup:v1:";

type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

// Re-export a minimal notify so storage can share the same registry.
export function _registerListener(key: string, l: Listener) {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(l);
  return () => set!.delete(l);
}
export function _notify(key: string) {
  listeners.get(key)?.forEach((l) => l());
}

let _userId: string | null = null;
let _initStarted = false;
const userListeners = new Set<(uid: string | null) => void>();

export function currentUserId(): string | null {
  return _userId;
}
export function onUserChange(cb: (uid: string | null) => void) {
  userListeners.add(cb);
  cb(_userId);
  return () => userListeners.delete(cb);
}

export function scopedKey(bare: string): string {
  return _userId ? `${KEY_PREFIX}${bare}:u:${_userId}` : `${KEY_PREFIX}${bare}`;
}

const ALL_KEYS = [
  "time_blocks",
  "reminders",
  "daily_reviews",
  "weekly_reviews",
  "monthly_reviews",
];

function setUserId(uid: string | null) {
  if (_userId === uid) return;
  _userId = uid;
  userListeners.forEach((l) => l(uid));
  // Notify all collections so subscribers re-read under the new scope.
  ALL_KEYS.forEach(_notify);
}

function writeScoped<T>(bare: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(scopedKey(bare), JSON.stringify(value));
  _notify(bare);
}

function readScoped<T>(bare: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(scopedKey(bare));
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// -------- Initialization --------

export function initSync() {
  if (_initStarted || typeof window === "undefined") return;
  _initStarted = true;

  supabase.auth.getSession().then(({ data }) => {
    const uid = data.session?.user.id ?? null;
    setUserId(uid);
    if (uid) pullAll(uid).catch((e) => console.error("[salesup] initial pull failed", e));
  });

  supabase.auth.onAuthStateChange((event, session) => {
    const uid = session?.user.id ?? null;
    setUserId(uid);
    if (uid && (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED")) {
      pullAll(uid).catch((e) => console.error("[salesup] pull failed", e));
    }
  });
}

// -------- Pull (cloud → local cache) --------

async function pullAll(uid: string) {
  const [tb, rm] = await Promise.all([
    supabase.from("time_blocks").select("*").eq("user_id", uid),
    supabase.from("reminders").select("*").eq("user_id", uid),
  ]);
  // On error (e.g. table missing), do NOT overwrite the local cache with [].
  if (tb.error) console.error("[salesup] time_blocks pull", tb.error);
  else writeScoped<TimeBlock[]>("time_blocks", (tb.data ?? []) as TimeBlock[]);
  if (rm.error) console.error("[salesup] reminders pull", rm.error);
  else writeScoped<Reminder[]>("reminders", (rm.data ?? []) as Reminder[]);
}

export async function refreshFromCloud() {
  if (!_userId) return;
  await pullAll(_userId);
}

// -------- Push (mutations) --------

function tbRow(b: TimeBlock, uid: string) {
  return {
    id: b.id,
    user_id: uid,
    date: b.date,
    start_slot: b.start_slot,
    end_slot: b.end_slot,
    work_type: b.work_type,
    title: b.title,
    customer: b.customer,
    summary: b.summary,
    key_info: b.key_info,
    next_action: b.next_action,
    next_action_date: b.next_action_date,
    problem_tags: b.problem_tags,
    notes: b.notes,
    value_level: b.value_level,
    customer_id: b.customer_id,
    opportunity_id: b.opportunity_id,
    created_at: b.created_at,
    updated_at: b.updated_at,
  };
}

function rmRow(r: Reminder, uid: string) {
  return {
    id: r.id,
    user_id: uid,
    title: r.title,
    type: r.type,
    frequency: r.frequency,
    related_date: r.related_date,
    customer: r.customer,
    related_block_id: r.related_block_id,
    priority: r.priority,
    status: r.status,
    note: r.note,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export function pushTimeBlock(b: TimeBlock) {
  if (!_userId) return;
  supabase
    .from("time_blocks")
    .upsert(tbRow(b, _userId))
    .then(({ error }) => {
      if (error) console.error("[salesup] upsert time_block", error);
    });
}

export function pushDeleteTimeBlock(id: string) {
  if (!_userId) return;
  supabase
    .from("time_blocks")
    .delete()
    .eq("id", id)
    .then(({ error }) => {
      if (error) console.error("[salesup] delete time_block", error);
    });
}

export function pushTimeBlocksBulk(blocks: TimeBlock[]) {
  if (!_userId || blocks.length === 0) return;
  supabase
    .from("time_blocks")
    .upsert(blocks.map((b) => tbRow(b, _userId!)))
    .then(({ error }) => {
      if (error) console.error("[salesup] bulk upsert time_blocks", error);
    });
}

export function pushDeleteTimeBlocksByDates(dates: string[]) {
  if (!_userId || dates.length === 0) return;
  supabase
    .from("time_blocks")
    .delete()
    .eq("user_id", _userId)
    .in("date", dates)
    .then(({ error }) => {
      if (error) console.error("[salesup] bulk delete time_blocks", error);
    });
}

export function pushReminder(r: Reminder) {
  if (!_userId) return;
  supabase
    .from("reminders")
    .upsert(rmRow(r, _userId))
    .then(({ error }) => {
      if (error) console.error("[salesup] upsert reminder", error);
    });
}

export function pushDeleteReminder(id: string) {
  if (!_userId) return;
  supabase
    .from("reminders")
    .delete()
    .eq("id", id)
    .then(({ error }) => {
      if (error) console.error("[salesup] delete reminder", error);
    });
}

// -------- One-shot localStorage → Cloud migration --------

export type MigrationResult = {
  blocks: number;
  reminders: number;
  errors: string[];
};

export async function migrateLocalToCloud(): Promise<MigrationResult> {
  const result: MigrationResult = { blocks: 0, reminders: 0, errors: [] };
  if (!_userId) {
    result.errors.push("尚未登录");
    return result;
  }
  const uid = _userId;

  // Read legacy unnamespaced data (the prototype's original keys).
  const legacyBlocksRaw = window.localStorage.getItem(`${KEY_PREFIX}time_blocks`);
  const legacyRemindersRaw = window.localStorage.getItem(`${KEY_PREFIX}reminders`);

  const legacyBlocks: TimeBlock[] = legacyBlocksRaw ? safeParse(legacyBlocksRaw, []) : [];
  const legacyReminders: Reminder[] = legacyRemindersRaw ? safeParse(legacyRemindersRaw, []) : [];

  // Ensure UUIDs (legacy ids were `${ts}-${rand}` — not valid UUIDs).
  const blocks = legacyBlocks.map((b) => ({ ...b, id: ensureUuid(b.id), user_id: uid }));
  const reminders = legacyReminders.map((r) => ({ ...r, id: ensureUuid(r.id), user_id: uid }));

  if (blocks.length > 0) {
    const { error } = await supabase.from("time_blocks").upsert(blocks.map((b) => tbRow(b, uid)));
    if (error) result.errors.push(`time_blocks: ${error.message}`);
    else result.blocks = blocks.length;
  }
  if (reminders.length > 0) {
    const { error } = await supabase.from("reminders").upsert(reminders.map((r) => rmRow(r, uid)));
    if (error) result.errors.push(`reminders: ${error.message}`);
    else result.reminders = reminders.length;
  }

  // Refresh from cloud so the scoped cache reflects authoritative data.
  await pullAll(uid);

  // Mark legacy data as migrated to avoid prompting again.
  window.localStorage.setItem(`${KEY_PREFIX}_migrated_at`, new Date().toISOString());

  return result;
}

export function hasLegacyLocalData(): boolean {
  if (typeof window === "undefined") return false;
  if (window.localStorage.getItem(`${KEY_PREFIX}_migrated_at`)) return false;
  const tb = window.localStorage.getItem(`${KEY_PREFIX}time_blocks`);
  const rm = window.localStorage.getItem(`${KEY_PREFIX}reminders`);
  return (
    (!!tb && safeParse<unknown[]>(tb, []).length > 0) ||
    (!!rm && safeParse<unknown[]>(rm, []).length > 0)
  );
}

function safeParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function ensureUuid(id: string): string {
  if (id && UUID_RE.test(id)) return id;
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, "0")}`;
}
