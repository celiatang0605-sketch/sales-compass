import { useEffect, useState } from "react";

const KEY = "salesup:v1:callSettings";
const DEFAULT_MILESTONES = [10, 50, 100, 300, 500] as const;
const DEFAULT_SETTINGS: CallSettings = {
  dailyGoal: 3,
  milestones: DEFAULT_MILESTONES,
};
const listeners = new Set<() => void>();

export interface CallSettings {
  dailyGoal: number;
  milestones: readonly number[];
}

function isDailyGoal(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 100;
}

function isMilestones(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item, index) =>
        typeof item === "number" &&
        Number.isInteger(item) &&
        item > 0 &&
        (index === 0 || item > value[index - 1]),
    )
  );
}

function read(): CallSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    return {
      dailyGoal: isDailyGoal(parsed?.dailyGoal) ? parsed.dailyGoal : DEFAULT_SETTINGS.dailyGoal,
      milestones: isMilestones(parsed?.milestones)
        ? parsed.milestones
        : DEFAULT_SETTINGS.milestones,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Future settings UI should write through this function to notify open pages. */
export function saveCallSettings(settings: CallSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(settings));
  listeners.forEach((listener) => listener());
}

/** Daily goal and milestones are local-only user preferences. */
export function useCallSettings(): CallSettings {
  const [settings, setSettings] = useState<CallSettings>(() => read());

  useEffect(() => {
    const listener = () => setSettings(read());
    listeners.add(listener);
    listener();
    const onStorage = (event: StorageEvent) => {
      if (event.key === KEY) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return settings;
}
