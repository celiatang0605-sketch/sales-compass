// Client-side hook: 某客户在指定日期下的时间块（用于阶段推进时关联记录）。
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listTimeBlocksForCustomerOnDate, type RelatedTimeBlock } from "./customerRepository";

export interface CustomerDayBlocksState {
  blocks: RelatedTimeBlock[];
  loading: boolean;
  error: string | null;
  userId: string | null;
  refresh: () => Promise<void>;
}

export function useCustomerDayBlocks(params: {
  date: string;
  customerId: string;
  companyName: string;
}): CustomerDayBlocksState {
  const { date, customerId, companyName } = params;
  const [blocks, setBlocks] = useState<RelatedTimeBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(
    async (uid: string | null) => {
      if (!uid || !customerId || !date) {
        setBlocks([]);
        setLoading(false);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        setBlocks(await listTimeBlocksForCustomerOnDate({ date, customerId, companyName }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "读取当天记录失败");
        setBlocks([]);
      } finally {
        setLoading(false);
      }
    },
    [date, customerId, companyName],
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

  return { blocks, loading, error, userId, refresh };
}
