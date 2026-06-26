import { createClient } from "@supabase/supabase-js";

// Publishable (anon) key — safe to ship in client code. RLS enforces data isolation.
const SUPABASE_URL = "https://skvgqaaiohviycidxnsb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-9gI_fg3xlAdBG1B_z839Q_zhupLW6L";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const SUPABASE_PROJECT_URL = SUPABASE_URL;
