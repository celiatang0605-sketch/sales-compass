import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteCallAttempt,
  getCallStats,
  logCall,
  type CallAttempt,
  type CallStats,
  type LogCallInput,
} from "./callRepository";

export interface CallTrackerState {
  stats: CallStats | null;
  loading: boolean;
  error: string | null;
  userId: string | null;
  refresh: () => Promise<void>;
  logCall: (input?: LogCallInput) => Promise<CallAttempt>;
  undoCall: (id: string) => Promise<void>;
}

/** 拨打打卡的唯一 UI 数据入口；读写均复用 callRepository。 */
export function useCallTracker(): CallTrackerState {
  const [stats, setStats] = useState<CallStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async (uid: string | null) => {
    if (!uid) {
      setStats(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setStats(await getCallStats());
    } catch (cause) {
      setStats(null);
      setError(cause instanceof Error ? cause.message : "读取拨打记录失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      const uid = data.user?.id ?? null;
      setUserId(uid);
      void load(uid);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      void load(uid);
    });
    return () => {
      alive = false;
      subscription.subscription.unsubscribe();
    };
  }, [load]);

  const refresh = useCallback(async () => {
    await load(userId);
  }, [load, userId]);

  const recordCall = useCallback(
    async (input: LogCallInput = {}) => {
      const attempt = await logCall(input);
      await refresh();
      return attempt;
    },
    [refresh],
  );

  const undoCall = useCallback(
    async (id: string) => {
      await deleteCallAttempt(id);
      await refresh();
    },
    [refresh],
  );

  return { stats, loading, error, userId, refresh, logCall: recordCall, undoCall };
}
