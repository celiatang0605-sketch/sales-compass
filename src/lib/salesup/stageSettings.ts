import { useEffect, useMemo, useState } from "react";
import {
  STAGE_ORDER,
  STAGE_STALE_DAYS,
  type CustomerStage,
  type StageStaleDays,
} from "./customerTypes";

const KEY = "salesup:v1:stageSettings";
const EMPTY: StageSettings = { staleDays: {} };
const listeners = new Set<() => void>();

export interface StageSettings {
  staleDays: Partial<Record<CustomerStage, number>>;
}

function isConfigurableStage(stage: CustomerStage): boolean {
  return STAGE_STALE_DAYS[stage] !== null;
}

function isValidStaleDays(days: unknown): days is number {
  return typeof days === "number" && Number.isInteger(days) && days >= 1 && days <= 365;
}

function read(): StageSettings {
  if (typeof window === "undefined") return EMPTY;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    const overrides: Partial<Record<CustomerStage, number>> = {};
    for (const stage of STAGE_ORDER) {
      const value = parsed?.staleDays?.[stage];
      if (
        isConfigurableStage(stage) &&
        isValidStaleDays(value) &&
        value !== STAGE_STALE_DAYS[stage]
      ) {
        overrides[stage] = value;
      }
    }
    return { staleDays: overrides };
  } catch {
    return EMPTY;
  }
}

function write(settings: StageSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(settings));
  listeners.forEach((listener) => listener());
}

function effectiveStaleDays(settings: StageSettings): StageStaleDays {
  return STAGE_ORDER.reduce<StageStaleDays>((thresholds, stage) => {
    thresholds[stage] = settings.staleDays[stage] ?? STAGE_STALE_DAYS[stage];
    return thresholds;
  }, {} as StageStaleDays);
}

export function useStageSettings() {
  const [settings, setSettings] = useState<StageSettings>(() => read());

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

  const staleDays = useMemo(() => effectiveStaleDays(settings), [settings]);
  const isCustomized = useMemo(
    () =>
      STAGE_ORDER.reduce<Record<CustomerStage, boolean>>(
        (result, stage) => {
          result[stage] = isConfigurableStage(stage) && settings.staleDays[stage] !== undefined;
          return result;
        },
        {} as Record<CustomerStage, boolean>,
      ),
    [settings],
  );

  return {
    staleDays,
    isCustomized,
    setStaleDays(stage: CustomerStage, days: number) {
      if (!isConfigurableStage(stage) || !isValidStaleDays(days)) return;
      if (days === STAGE_STALE_DAYS[stage]) {
        const staleDays = { ...settings.staleDays };
        delete staleDays[stage];
        write({ ...settings, staleDays });
        return;
      }
      write({ ...settings, staleDays: { ...settings.staleDays, [stage]: days } });
    },
    resetStaleDays(stage: CustomerStage) {
      if (!isConfigurableStage(stage)) return;
      const staleDays = { ...settings.staleDays };
      delete staleDays[stage];
      write({ ...settings, staleDays });
    },
    resetAll() {
      write(EMPTY);
    },
  };
}
