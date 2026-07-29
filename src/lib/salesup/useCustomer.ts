// Client-side hook: subscribes to Supabase auth and exposes one customer.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCustomer } from "./customerRepository";
import type { Customer } from "./customerTypes";

export interface CustomerState {
  customer: Customer | null;
  loading: boolean;
  error: string | null;
  userId: string | null;
  setCustomer: (c: Customer) => void;
  refresh: () => Promise<void>;
}

export function useCustomer(id: string): CustomerState {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(
    async (uid: string | null) => {
      if (!uid) {
        setCustomer(null);
        setLoading(false);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const c = await getCustomer(id);
        setCustomer(c);
      } catch (e) {
        setError(e instanceof Error ? e.message : "读取客户数据失败");
        setCustomer(null);
      } finally {
        setLoading(false);
      }
    },
    [id],
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

  return { customer, loading, error, userId, setCustomer, refresh };
}
