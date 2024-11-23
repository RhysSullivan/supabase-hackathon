import { createClient } from "@supabase/supabase-js";
import { env } from "../../src/env";

export const createAdminClient = () =>
  createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
