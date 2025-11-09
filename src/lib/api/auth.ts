import { getSupabaseServiceClient } from "@/lib/supabaseServerClient";

export async function resolveUserIdFromRequest(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return null;
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.id) {
      return null;
    }
    return data.user.id;
  } catch {
    return null;
  }
}
