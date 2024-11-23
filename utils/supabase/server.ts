import { createServerClient } from "@supabase/ssr";
import type { cookies } from "next/headers";
import { env } from "process";

export const createClient = async (cookieStore: ReturnType<typeof cookies>) => {
  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.SUPABASE_SERVICE_KEY!,
    {
      cookies: {
        async getAll() {
          return (await cookieStore).getAll()
        },
        async setAll(cookiesToSet) {
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          cookiesToSet.forEach(async ({ name, value, options }) => (await cookieStore).set(name, value, options))
        },
      },
    },
  );
};
