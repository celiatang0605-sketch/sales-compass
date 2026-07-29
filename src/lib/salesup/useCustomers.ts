// Client-side hook: subscribes to Supabase auth and exposes customer state.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listCustomers } from "./customerRepository";
import type { Customer } from "./customerTypes";

export interface CustomersState {
  customers: Customer[];
  loading: boolean;
  error: string | null;
  userId: string | null;
  refresh: () => Promise<void>;
}

export function useCustomers(): CustomersState {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async (uid: string | null) => {
    if (!uid) {
      setCustomers([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await listCustomers();
      setCustomers(list);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "读取客户数据失败";
      setError(msg);
      setCustomers([]);
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
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const uid = session?.user?.id ?? null;
      setUserId((prev) => {
        if (prev !== uid) void load(uid);
        return uid;
      });
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [load]);

  const refresh = useCallback(async () => {
    await load(userId);
  }, [load, userId]);

  return { customers, loading, error, userId, refresh };
}
