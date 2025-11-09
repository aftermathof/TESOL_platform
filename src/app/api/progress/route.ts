import { NextResponse } from "next/server";
import { getProgressSnapshot } from "@/lib/dataService";
import { resolveUserIdFromRequest } from "@/lib/api/auth";

export async function GET(request: Request) {
  const userId = await resolveUserIdFromRequest(request);
  const progress = await getProgressSnapshot(userId);
  return NextResponse.json({ progress });
}
