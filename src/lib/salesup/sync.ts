// Cloud sync layer for Sales Up.
// - Listens to Supabase auth state and tracks the current user id.
// - On sign-in, pulls time_blocks + reminders into the localStorage cache
//   (namespaced per user) and notifies the storage subscribers.
// - Mutations from storage.ts fire-and-forget upsert/delete calls here.
// - Toasts on write success/failure so writes never fail silently.
// - Exposes a sync status store and a one-shot legacy migration.

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { TimeBlock, Reminder } from "./types";

const KEY_PREFIX = "salesup:v1:";

type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

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
let _userEmail: string | null = null;
let _initStarted = false;
const userListeners = new Set<(uid: string | null) => void>();

// -------- Sync status (data source: Supabase) --------

export type SyncStatus = "idle" | "syncing" | "saved" | "error";
export type SyncState = {
  source: "supabase" | "local";
  status: SyncStatus;
  lastError: string | null;
  lastSavedAt: number | null;
  email: string | null;
  inflight: number;
};

let _state: SyncState = {
  source: "local",
  status: "idle",
  lastError: null,
  lastSavedAt: null,
  email: null,
  inflight: 0,
};
const stateListeners = new Set<(s: SyncState) => void>();

function setState(patch: Partial<SyncState>) {
  _state = { ..._state, ...patch };
  stateListeners.forEach((l) => l(_state));
}
export function getSyncState(): SyncState {
  return _state;
}
export function onSyncState(cb: (s: SyncState) => void) {
  stateListeners.add(cb);
  cb(_state);
  return () => stateListeners.delete(cb);
}

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

function setUser(uid: string | null, email: string | null) {
  if (_userId === uid && _userEmail === email) return;
  _userId = uid;
  _userEmail = email;
  setState({ source: uid ? "supabase" : "local", email });
  userListeners.forEach((l) => l(uid));
  ALL_KEYS.forEach(_notify);
}

function writeScoped<T>(bare: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(scopedKey(bare), JSON.stringify(value));
  _notify(bare);
}

// -------- Initialization --------

export function initSync() {
  if (_initStarted || typeof window === "undefined") return;
  _initStarted = true;

  supabase.auth.getSession().then(({ data }) => {
    const u = data.session?.user ?? null;
    setUser(u?.id ?? null, u?.email ?? null);
    if (u) pullAll(u.id);
  });

  supabase.auth.onAuthStateChange((event, session) => {
    const u = session?.user ?? null;
    setUser(u?.id ?? null, u?.email ?? null);
    if (u && (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED")) {
      pullAll(u.id);
    }
  });
}

// -------- Pull (cloud → local cache) --------

async function pullAll(uid: string) {
  setState({ status: "syncing" });
  const [tb, rm] = await Promise.all([
    supabase.from("time_blocks").select("*").eq("user_id", uid),
    supabase.from("reminders").select("*").eq("user_id", uid),
  ]);
  const errors: string[] = [];
  if (tb.error) {
    errors.push(`time_blocks: ${tb.error.message}`);
    console.error("[salesup] time_blocks pull", tb.error);
  } else {
    writeScoped<TimeBlock[]>("time_blocks", (tb.data ?? []) as TimeBlock[]);
  }
  if (rm.error) {
    errors.push(`reminders: ${rm.error.message}`);
    console.error("[salesup] reminders pull", rm.error);
  } else {
    writeScoped<Reminder[]>("reminders", (rm.data ?? []) as Reminder[]);
  }
  if (errors.length > 0) {
    setState({ status: "error", lastError: errors.join("；") });
    toast.error("从 Supabase 读取失败", { description: errors.join("；") });
  } else {
    setState({ status: "saved", lastSavedAt: Date.now(), lastError: null });
  }
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
    next_action_date: b.next_action_date || null,
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
    related_date: r.related_date || null,
    customer: r.customer,
    related_block_id: r.related_block_id,
    priority: r.priority,
    status: r.status,
    note: r.note,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function beginWrite() {
  setState({ status: "syncing", inflight: _state.inflight + 1 });
}
function endWrite(error?: { message: string } | null, label?: string) {
  const inflight = Math.max(0, _state.inflight - 1);
  if (error) {
    setState({ inflight, status: "error", lastError: error.message });
    toast.error(`保存失败${label ? `（${label}）` : ""}`, { description: error.message });
  } else {
    setState({
      inflight,
      status: inflight === 0 ? "saved" : "syncing",
      lastSavedAt: Date.now(),
      lastError: null,
    });
  }
}

function notSignedInToast() {
  toast.message("当前未登录，数据暂存本地", {
    description: "登录后会自动同步到 Supabase。",
  });
}

export function pushTimeBlock(b: TimeBlock) {
  if (!_userId) {
    notSignedInToast();
    return;
  }
  beginWrite();
  supabase
    .from("time_blocks")
    .upsert(tbRow(b, _userId), { onConflict: "id" })
    .then(({ error }) => {
      if (error) console.error("[salesup] upsert time_block", error);
      endWrite(error, "时间块");
    });
}

export function pushDeleteTimeBlock(id: string) {
  if (!_userId) {
    notSignedInToast();
    return;
  }
  beginWrite();
  supabase
    .from("time_blocks")
    .delete()
    .eq("id", id)
    .then(({ error }) => {
      if (error) console.error("[salesup] delete time_block", error);
      endWrite(error, "删除时间块");
    });
}

export function pushTimeBlocksBulk(blocks: TimeBlock[]) {
  if (!_userId || blocks.length === 0) return;
  beginWrite();
  supabase
    .from("time_blocks")
    .upsert(blocks.map((b) => tbRow(b, _userId!)), { onConflict: "id" })
    .then(({ error }) => {
      if (error) console.error("[salesup] bulk upsert time_blocks", error);
      endWrite(error, "批量时间块");
    });
}

export function pushDeleteTimeBlocksByDates(dates: string[]) {
  if (!_userId || dates.length === 0) return;
  beginWrite();
  supabase
    .from("time_blocks")
    .delete()
    .eq("user_id", _userId)
    .in("date", dates)
    .then(({ error }) => {
      if (error) console.error("[salesup] bulk delete time_blocks", error);
      endWrite(error, "批量删除");
    });
}

export function pushReminder(r: Reminder) {
  if (!_userId) {
    notSignedInToast();
    return;
  }
  beginWrite();
  supabase
    .from("reminders")
    .upsert(rmRow(r, _userId), { onConflict: "id" })
    .then(({ error }) => {
      if (error) console.error("[salesup] upsert reminder", error);
      endWrite(error, "提醒");
    });
}

export function pushDeleteReminder(id: string) {
  if (!_userId) {
    notSignedInToast();
    return;
  }
  beginWrite();
  supabase
    .from("reminders")
    .delete()
    .eq("id", id)
    .then(({ error }) => {
      if (error) console.error("[salesup] delete reminder", error);
      endWrite(error, "删除提醒");
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

  const legacyBlocksRaw = window.localStorage.getItem(`${KEY_PREFIX}time_blocks`);
  const legacyRemindersRaw = window.localStorage.getItem(`${KEY_PREFIX}reminders`);

  const legacyBlocks: TimeBlock[] = legacyBlocksRaw ? safeParse(legacyBlocksRaw, []) : [];
  const legacyReminders: Reminder[] = legacyRemindersRaw ? safeParse(legacyRemindersRaw, []) : [];

  const blocks = legacyBlocks.map((b) => ({ ...b, id: ensureUuid(b.id), user_id: uid }));
  const reminders = legacyReminders.map((r) => ({ ...r, id: ensureUuid(r.id), user_id: uid }));

  if (blocks.length > 0) {
    const { error } = await supabase
      .from("time_blocks")
      .upsert(blocks.map((b) => tbRow(b, uid)), { onConflict: "id" });
    if (error) result.errors.push(`time_blocks: ${error.message}`);
    else result.blocks = blocks.length;
  }
  if (reminders.length > 0) {
    const { error } = await supabase
      .from("reminders")
      .upsert(reminders.map((r) => rmRow(r, uid)), { onConflict: "id" });
    if (error) result.errors.push(`reminders: ${error.message}`);
    else result.reminders = reminders.length;
  }

  await pullAll(uid);
  window.localStorage.setItem(`${KEY_PREFIX}_migrated_at`, new Date().toISOString());

  if (result.errors.length === 0) {
    toast.success(`已导入 ${result.blocks} 条时间块 / ${result.reminders} 条提醒`);
  } else {
    toast.error("导入存在错误", { description: result.errors.join("；") });
  }
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
