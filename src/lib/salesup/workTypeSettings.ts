// Per-work-type user settings persisted to localStorage.
//
// Supports:
// - Custom color and label overrides for built-in work types
// - User-added custom work types (id = "custom:<slug>")
// - Hiding built-in work types (soft-delete: not removed, just hidden from UI)
// - User-added custom stat categories (id = "cc:<slug>")
//
// Note: settings are localStorage-only for now; blocks referencing a
// custom type on a different device will fall back to the "other" category
// and a neutral color until the settings are also synced.

import { useEffect, useState } from "react";
import {
  WORK_TYPE_MAP,
  WORK_TYPES,
  type BuiltinWorkTypeId,
  type StatCategory,
  type WorkType,
  type WorkTypeId,
} from "./workTypes";

const KEY = "salesup:v1:workTypeSettings";

export interface CustomWorkType {
  id: string; // "custom:xxx"
  label: string;
  color: string; // hex "#rrggbb"
  category: string; // built-in StatCategory or custom category id ("cc:xxx")
  description?: string;
}

export interface CustomCategory {
  id: string; // "cc:xxx"
  label: string;
}

export interface WorkTypeSettings {
  colors: Partial<Record<BuiltinWorkTypeId, string>>; // built-in color overrides
  labels: Partial<Record<BuiltinWorkTypeId, string>>; // built-in label overrides
  customTypes: CustomWorkType[];
  hiddenBuiltins: BuiltinWorkTypeId[];
  customCategories: CustomCategory[];
}

// Approximate hex defaults matching the oklch palette in styles.css.
export const DEFAULT_HEX: Record<BuiltinWorkTypeId, string> = {
  meeting_customer: "#7ab3e8",
  visit_customer: "#6bb3b8",
  followup_customer: "#8ac9a1",
  proposal: "#d9b26b",
  research: "#b294d6",
  internal_meeting: "#b0b5c0",
  learning: "#d89b8a",
  admin: "#c8cbd3",
  review: "#6b73b8",
  buffer: "#e0dac8",
};

export const PRESET_SWATCHES: string[] = [
  "#7ab3e8", "#6bb3b8", "#8ac9a1", "#d9b26b",
  "#b294d6", "#d89b8a", "#6b73b8", "#b0b5c0",
  "#e0dac8", "#c8cbd3", "#d89b8a", "#7bc4a8",
];

// Built-in stat categories with default labels (Chinese).
export const BUILTIN_CATEGORY_LABELS: Record<StatCategory, string> = {
  customer_progress: "客户推进",
  internal_cost: "内部消耗",
  proposal: "方案准备",
  learning_review: "学习复盘",
  other: "其它",
};

const EMPTY: WorkTypeSettings = {
  colors: {},
  labels: {},
  customTypes: [],
  hiddenBuiltins: [],
  customCategories: [],
};

const listeners = new Set<() => void>();

function read(): WorkTypeSettings {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return {
      colors: parsed.colors ?? {},
      labels: parsed.labels ?? {},
      customTypes: Array.isArray(parsed.customTypes) ? parsed.customTypes : [],
      hiddenBuiltins: Array.isArray(parsed.hiddenBuiltins) ? parsed.hiddenBuiltins : [],
      customCategories: Array.isArray(parsed.customCategories) ? parsed.customCategories : [],
    };
  } catch {
    return EMPTY;
  }
}

function write(s: WorkTypeSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
  listeners.forEach((l) => l());
}

function slug(): string {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
}

export function useWorkTypeSettings() {
  const [state, setState] = useState<WorkTypeSettings>(() => read());
  useEffect(() => {
    const l = () => setState(read());
    listeners.add(l);
    l();
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) l();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(l);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return {
    settings: state,
    // Built-in overrides
    setColor(id: BuiltinWorkTypeId, hex: string) {
      write({ ...state, colors: { ...state.colors, [id]: hex } });
    },
    resetColor(id: BuiltinWorkTypeId) {
      const colors = { ...state.colors };
      delete colors[id];
      write({ ...state, colors });
    },
    setLabel(id: BuiltinWorkTypeId, label: string) {
      const trimmed = label.trim();
      const labels = { ...state.labels };
      if (!trimmed || trimmed === WORK_TYPE_MAP[id]?.label) {
        delete labels[id];
      } else {
        labels[id] = trimmed;
      }
      write({ ...state, labels });
    },
    // Hide / show built-in types (soft delete)
    hideBuiltin(id: BuiltinWorkTypeId) {
      if (state.hiddenBuiltins.includes(id)) return;
      write({ ...state, hiddenBuiltins: [...state.hiddenBuiltins, id] });
    },
    unhideBuiltin(id: BuiltinWorkTypeId) {
      write({ ...state, hiddenBuiltins: state.hiddenBuiltins.filter((x) => x !== id) });
    },
    // Custom work types
    addCustomType(input: { label: string; color: string; category: string; description?: string }): CustomWorkType {
      const t: CustomWorkType = {
        id: `custom:${slug()}`,
        label: input.label.trim() || "未命名类型",
        color: input.color,
        category: input.category,
        description: input.description?.trim() || undefined,
      };
      write({ ...state, customTypes: [...state.customTypes, t] });
      return t;
    },
    updateCustomType(id: string, patch: Partial<Omit<CustomWorkType, "id">>) {
      write({
        ...state,
        customTypes: state.customTypes.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      });
    },
    removeCustomType(id: string) {
      write({ ...state, customTypes: state.customTypes.filter((t) => t.id !== id) });
    },
    // Custom stat categories
    addCustomCategory(label: string): CustomCategory {
      const c: CustomCategory = { id: `cc:${slug()}`, label: label.trim() || "未命名分类" };
      write({ ...state, customCategories: [...state.customCategories, c] });
      return c;
    },
    removeCustomCategory(id: string) {
      // Also move any custom types using this category to "other".
      write({
        ...state,
        customCategories: state.customCategories.filter((c) => c.id !== id),
        customTypes: state.customTypes.map((t) => (t.category === id ? { ...t, category: "other" } : t)),
      });
    },
  };
}

// -------- Read-side helpers (settings-aware) --------

/** Effective view of a work type, whether built-in or custom. */
export interface EffectiveWorkType {
  id: string;
  label: string;
  colorCss: string; // "var(...)" or "#xxxxxx"
  category: string; // built-in StatCategory id or custom "cc:xxx"
  description?: string;
  isCustom: boolean;
  hex?: string; // set for custom or overridden built-in
  colorVar?: string; // set for pure built-in without override
}

function builtinCategory(wt: WorkType): string {
  // Built-in types can belong to multiple categories; we use the first
  // non-"proposal" category as the primary category for aggregation purposes
  // (proposal is a bonus sub-tag on the "proposal" work type).
  const primary = wt.categories.find((c) => c !== "proposal") ?? wt.categories[0];
  return primary;
}

export function resolveWorkType(
  id: string | null | undefined,
  settings: WorkTypeSettings,
): EffectiveWorkType | undefined {
  if (!id) return undefined;
  const custom = settings.customTypes.find((t) => t.id === id);
  if (custom) {
    return {
      id: custom.id,
      label: custom.label,
      colorCss: custom.color,
      hex: custom.color,
      category: custom.category,
      description: custom.description,
      isCustom: true,
    };
  }
  const wt = WORK_TYPE_MAP[id];
  if (!wt) return undefined;
  const overrideHex = settings.colors[wt.id];
  const overrideLabel = settings.labels[wt.id];
  return {
    id: wt.id,
    label: overrideLabel || wt.label,
    colorCss: overrideHex ? overrideHex : `var(${wt.colorVar})`,
    hex: overrideHex,
    colorVar: overrideHex ? undefined : wt.colorVar,
    category: builtinCategory(wt),
    description: wt.description,
    isCustom: false,
  };
}

/** All effective work types (visible built-in + custom), in stable order. */
export function getEffectiveWorkTypes(settings: WorkTypeSettings): EffectiveWorkType[] {
  const list: EffectiveWorkType[] = [];
  for (const wt of WORK_TYPES) {
    if (settings.hiddenBuiltins.includes(wt.id)) continue;
    list.push(resolveWorkType(wt.id, settings)!);
  }
  for (const c of settings.customTypes) {
    list.push(resolveWorkType(c.id, settings)!);
  }
  return list;
}

/** All effective stat categories with labels. */
export function getEffectiveCategories(
  settings: WorkTypeSettings,
): { id: string; label: string; isCustom: boolean }[] {
  const builtins = (Object.keys(BUILTIN_CATEGORY_LABELS) as StatCategory[]).map((id) => ({
    id,
    label: BUILTIN_CATEGORY_LABELS[id],
    isCustom: false,
  }));
  const customs = settings.customCategories.map((c) => ({ id: c.id, label: c.label, isCustom: true }));
  return [...builtins, ...customs];
}

export function categoryLabel(id: string, settings: WorkTypeSettings): string {
  if (id in BUILTIN_CATEGORY_LABELS) return BUILTIN_CATEGORY_LABELS[id as StatCategory];
  return settings.customCategories.find((c) => c.id === id)?.label ?? id;
}

/** Is this work type considered customer-related (built-in customer types OR any type mapped to customer_progress)? */
export function isCustomerRelated(id: string, settings: WorkTypeSettings): boolean {
  const eff = resolveWorkType(id, settings);
  if (!eff) return false;
  return eff.category === "customer_progress";
}

// -------- Legacy helpers kept for compatibility with existing callers --------

/** CSS background value for a work type (custom hex or default CSS var). */
export function colorOf(id: WorkTypeId, settings: WorkTypeSettings): string {
  return resolveWorkType(id, settings)?.colorCss ?? "var(--muted)";
}

/** Display label for a work type. */
export function labelOf(id: WorkTypeId, settings: WorkTypeSettings): string {
  return resolveWorkType(id, settings)?.label ?? id;
}

export function startingHexOf(id: BuiltinWorkTypeId, settings: WorkTypeSettings): string {
  return settings.colors[id] ?? DEFAULT_HEX[id] ?? "#cccccc";
}

function brightnessLevel(hex: string): "light" | "dark" {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "dark";
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.55 ? "dark" : "light";
}

const DEFAULT_TEXT_ON: Record<BuiltinWorkTypeId, "light" | "dark"> = {
  meeting_customer: "dark",
  visit_customer: "dark",
  followup_customer: "dark",
  proposal: "dark",
  research: "dark",
  internal_meeting: "dark",
  learning: "dark",
  admin: "dark",
  review: "light",
  buffer: "dark",
};

function levelFor(id: WorkTypeId, settings: WorkTypeSettings): "light" | "dark" {
  const eff = resolveWorkType(id, settings);
  if (eff?.hex) return brightnessLevel(eff.hex);
  return DEFAULT_TEXT_ON[id as BuiltinWorkTypeId] ?? "dark";
}

export function textOn(id: WorkTypeId, settings: WorkTypeSettings): string {
  return levelFor(id, settings) === "light" ? "rgba(255,255,255,0.96)" : "rgba(20,22,30,0.88)";
}

export function subTextOn(id: WorkTypeId, settings: WorkTypeSettings): string {
  return levelFor(id, settings) === "light" ? "rgba(255,255,255,0.78)" : "rgba(20,22,30,0.62)";
}
