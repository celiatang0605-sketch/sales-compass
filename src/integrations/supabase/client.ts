import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  (import.meta.env as any).SALESUP_SUPABASE_URL ||
  "https://skvgqaaiohviycidxnsb.supabase.co";

const SUPABASE_ANON_KEY = (import.meta.env as any).SALESUP_SUPABASE_ANON_KEY || "";

if (!SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    "[Sales Up] Supabase anon key is missing. Set SALESUP_SUPABASE_ANON_KEY in project secrets.",
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const SUPABASE_PROJECT_URL = SUPABASE_URL;
