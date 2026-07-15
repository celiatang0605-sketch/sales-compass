// Client-side hook: subscribes to Supabase auth and exposes lead state.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listLeads } from "./expoRepository";
import type { ExpoLead } from "./expoMock";

export interface ExpoLeadsState {
  leads: ExpoLead[];
  loading: boolean;
  error: string | null;
  userId: string | null;
  refresh: () => Promise<void>;
}

export function useExpoLeads(): ExpoLeadsState {
  const [leads, setLeads] = useState<ExpoLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async (uid: string | null) => {
    if (!uid) {
      setLeads([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await listLeads();
      setLeads(list);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "读取展会线索失败";
      setError(msg);
      setLeads([]);
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

  return { leads, loading, error, userId, refresh };
}
