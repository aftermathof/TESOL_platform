import { NextResponse } from "next/server";
import { getProgressSnapshot } from "@/lib/dataService";
import { getSupabaseServiceClient } from "@/lib/supabaseServerClient";

export async function GET(request: Request) {
  const userId = await resolveUserId(request);
  const progress = await getProgressSnapshot(userId);
  return NextResponse.json({ progress });
}

async function resolveUserId(request: Request): Promise<string | null> {
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
