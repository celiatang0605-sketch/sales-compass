import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  advanceLeadStage,
  exitLead,
  getLeadPool,
  rollbackLeadStage,
  resumeLead,
  type ExitLeadInput,
  type LeadPool,
  type LeadPoolLead,
} from "./leadRepository";
import type { LeadStageAction } from "./leadTypes";

export interface LeadPoolState {
  pool: LeadPool | null;
  loading: boolean;
  error: string | null;
  userId: string | null;
  refresh: () => Promise<void>;
  advance: (leadId: string, action: LeadStageAction) => Promise<LeadPoolLead>;
  rollback: (leadId: string, action: LeadStageAction) => Promise<LeadPoolLead>;
  exit: (leadId: string, input: ExitLeadInput) => Promise<LeadPoolLead>;
  resume: (leadId: string) => Promise<LeadPoolLead>;
}

function replaceActiveLead(pool: LeadPool, updated: LeadPoolLead): LeadPool {
  const current = pool.leads.find((lead) => lead.id === updated.id);
  if (!current) return pool;
  const stageCounts = { ...pool.stageCounts };
  if (current.leadStage !== updated.leadStage) {
    stageCounts[current.leadStage]--;
    stageCounts[updated.leadStage]++;
  }
  return {
    ...pool,
    leads: pool.leads.map((lead) => (lead.id === updated.id ? updated : lead)),
    stageCounts,
  };
}

function removeActiveLead(pool: LeadPool, leadId: string): LeadPool {
  const current = pool.leads.find((lead) => lead.id === leadId);
  if (!current) return pool;
  return {
    ...pool,
    leads: pool.leads.filter((lead) => lead.id !== leadId),
    stageCounts: {
      ...pool.stageCounts,
      [current.leadStage]: pool.stageCounts[current.leadStage] - 1,
    },
  };
}

/** 线索池的唯一 UI 数据入口；读写均复用 leadRepository。 */
export function useLeadPool(): LeadPoolState {
  const [pool, setPool] = useState<LeadPool | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async (uid: string | null) => {
    if (!uid) {
      setPool(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setPool(await getLeadPool());
    } catch (cause) {
      setPool(null);
      setError(cause instanceof Error ? cause.message : "读取线索池失败");
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

  const advance = useCallback(async (leadId: string, action: LeadStageAction) => {
    const updated = await advanceLeadStage(leadId, action);
    setPool((current) => (current ? replaceActiveLead(current, updated) : current));
    return updated;
  }, []);

  const rollback = useCallback(async (leadId: string, action: LeadStageAction) => {
    const updated = await rollbackLeadStage(leadId, action);
    setPool((current) => (current ? replaceActiveLead(current, updated) : current));
    return updated;
  }, []);

  const exit = useCallback(async (leadId: string, input: ExitLeadInput) => {
    const updated = await exitLead(leadId, input);
    setPool((current) => (current ? removeActiveLead(current, leadId) : current));
    return updated;
  }, []);

  const resume = useCallback(async (leadId: string) => {
    const updated = await resumeLead(leadId);
    setPool((current) => (current ? replaceActiveLead(current, updated) : current));
    return updated;
  }, []);

  return { pool, loading, error, userId, refresh, advance, rollback, exit, resume };
}
