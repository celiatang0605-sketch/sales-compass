// Client-side hook: subscribes to Supabase auth and exposes a customer's stage history.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listStageHistory,
  type StageHistoryEntry,
} from "./customerRepository";

export interface StageHistoryState {
  history: StageHistoryEntry[];
  loading: boolean;
  error: string | null;
  userId: string | null;
  refresh: () => Promise<void>;
}

export function useStageHistory(customerId: string): StageHistoryState {
  const [history, setHistory] = useState<StageHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(
    async (uid: string | null) => {
      if (!uid || !customerId) {
        setHistory([]);
        setLoading(false);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        setHistory(await listStageHistory(customerId));
      } catch (e) {
        setError(e instanceof Error ? e.message : "读取阶段历史失败");
        setHistory([]);
      } finally {
        setLoading(false);
      }
    },
    [customerId],
  );

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      const uid = data.user?.id ?? null;
      setUserId(uid);
      void load(uid);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      void load(uid);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [load]);

  const refresh = useCallback(async () => {
    await load(userId);
  }, [load, userId]);

  return { history, loading, error, userId, refresh };
}
