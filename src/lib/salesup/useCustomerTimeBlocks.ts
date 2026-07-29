// Client-side hook: subscribes to Supabase auth and exposes a customer's related time blocks.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listTimeBlocksForCustomer, type CustomerTimeBlock } from "./customerRepository";

export interface CustomerTimeBlocksState {
  blocks: CustomerTimeBlock[];
  loading: boolean;
  error: string | null;
  userId: string | null;
  refresh: () => Promise<void>;
}

export function useCustomerTimeBlocks(customerId: string): CustomerTimeBlocksState {
  const [blocks, setBlocks] = useState<CustomerTimeBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(
    async (uid: string | null) => {
      if (!uid || !customerId) {
        setBlocks([]);
        setLoading(false);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        setBlocks(await listTimeBlocksForCustomer(customerId));
      } catch (e) {
        setError(e instanceof Error ? e.message : "读取相关记录失败");
        setBlocks([]);
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

  return { blocks, loading, error, userId, refresh };
}
