import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listOpportunities } from "./opportunityRepository";
import type { OpportunityWithDetails } from "./opportunityTypes";

export interface OpportunitiesState {
  opportunities: OpportunityWithDetails[];
  loading: boolean;
  error: string | null;
  userId: string | null;
  refresh: () => Promise<void>;
}

/** 商机看板的数据入口；组件不直接访问 Supabase。 */
export function useOpportunities(): OpportunitiesState {
  const [opportunities, setOpportunities] = useState<OpportunityWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async (userId: string | null) => {
    if (!userId) {
      setOpportunities([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setOpportunities(await listOpportunities());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "读取商机数据失败");
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      const nextUserId = data.user?.id ?? null;
      setUserId(nextUserId);
      void load(nextUserId);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user?.id ?? null;
      setUserId((previous) => {
        if (previous !== nextUserId) void load(nextUserId);
        return nextUserId;
      });
    });
    return () => {
      alive = false;
      subscription.subscription.unsubscribe();
    };
  }, [load]);

  const refresh = useCallback(async () => {
    await load(userId);
  }, [load, userId]);

  return { opportunities, loading, error, userId, refresh };
}
