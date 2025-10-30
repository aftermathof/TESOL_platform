import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let serviceClient: SupabaseClient | null = null;
let cachedUrl: string | null = null;
let cachedKey: string | null = null;

function readServiceCredentials() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return { url, key };
}

export function getSupabaseServiceClient(): SupabaseClient | null {
  const { url, key } = readServiceCredentials();

  if (!url || !key) {
    return null;
  }

  if (!serviceClient || cachedUrl !== url || cachedKey !== key) {
    serviceClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    cachedUrl = url;
    cachedKey = key;
  }

  return serviceClient;
}
