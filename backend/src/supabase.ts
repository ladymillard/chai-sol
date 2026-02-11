import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn(
    "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — falling back to in-memory storage"
  );
}

export const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

export function isSupabaseEnabled(): boolean {
  return supabase !== null;
}
