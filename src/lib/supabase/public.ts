import { createClient } from "@supabase/supabase-js";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

/**
 * Cookie-less Supabase client for public, read-only data. It never reads or
 * writes cookies, so it is safe to use inside cached or shared server code.
 */
export function createPublicClient() {
  return createClient(supabaseUrl(), supabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
