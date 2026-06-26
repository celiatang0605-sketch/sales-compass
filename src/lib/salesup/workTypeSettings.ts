// Per-work-type user settings (custom colors) persisted to localStorage.
// Falls back to the CSS variable defined in styles.css when no override.

import { useEffect, useState } from "react";
import { WORK_TYPE_MAP, type WorkTypeId } from "./workTypes";

const KEY = "salesup:v1:workTypeSettings";

export interface WorkTypeSettings {
  colors: Partial<Record<WorkTypeId, string>>; // hex like "#aabbcc"
}

// Approximate hex defaults matching the oklch palette in styles.css.
// Used as the starting value in the color picker when no override exists.
export const DEFAULT_HEX: Record<WorkTypeId, string> = {
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

// 8 curated preset swatches for the color popover.
export const PRESET_SWATCHES: string[] = [
  "#7ab3e8", "#6bb3b8", "#8ac9a1", "#d9b26b",
  "#b294d6", "#d89b8a", "#6b73b8", "#b0b5c0",
];

const listeners = new Set<() => void>();

function read(): WorkTypeSettings {
  if (typeof window === "undefined") return { colors: {} };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { colors: {} };
    const parsed = JSON.parse(raw);
    return { colors: parsed.colors ?? {} };
  } catch {
    return { colors: {} };
  }
}

function write(s: WorkTypeSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
  listeners.forEach((l) => l());
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
    setColor(id: WorkTypeId, hex: string) {
      const next: WorkTypeSettings = { colors: { ...state.colors, [id]: hex } };
      write(next);
    },
    resetColor(id: WorkTypeId) {
      const colors = { ...state.colors };
      delete colors[id];
      write({ colors });
    },
  };
}

/** CSS background value for a work type (custom hex or default CSS var). */
export function colorOf(
  id: WorkTypeId,
  settings: WorkTypeSettings,
): string {
  const override = settings.colors[id];
  if (override) return override;
  const wt = WORK_TYPE_MAP[id];
  return wt ? `var(${wt.colorVar})` : "var(--muted)";
}

/** Best hex starting point for the picker (override → default hex). */
export function startingHexOf(
  id: WorkTypeId,
  settings: WorkTypeSettings,
): string {
  return settings.colors[id] ?? DEFAULT_HEX[id] ?? "#cccccc";
}

/** Returns "light" if a light text color reads better on this bg, else "dark". */
function brightnessLevel(hex: string): "light" | "dark" {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "dark";
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  // Perceived luminance (Rec. 709).
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.55 ? "dark" : "light";
}

// Defaults: most palette entries are L>=0.7 (light bg → dark text); only
// `review` (indigo, L≈0.58) needs light text.
const DEFAULT_TEXT_ON: Record<WorkTypeId, "light" | "dark"> = {
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

/** CSS color for text rendered on top of the work-type background. */
export function textOn(id: WorkTypeId, settings: WorkTypeSettings): string {
  const override = settings.colors[id];
  const level = override ? brightnessLevel(override) : DEFAULT_TEXT_ON[id];
  // Use slightly muted tones so text stays calm against the soft palette.
  return level === "light" ? "rgba(255,255,255,0.96)" : "rgba(20,22,30,0.88)";
}

/** Muted secondary text color (for customer / summary lines). */
export function subTextOn(id: WorkTypeId, settings: WorkTypeSettings): string {
  const override = settings.colors[id];
  const level = override ? brightnessLevel(override) : DEFAULT_TEXT_ON[id];
  return level === "light" ? "rgba(255,255,255,0.78)" : "rgba(20,22,30,0.62)";
}
