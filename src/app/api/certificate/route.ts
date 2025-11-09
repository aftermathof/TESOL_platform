import { NextResponse } from "next/server";
import { resolveUserIdFromRequest } from "@/lib/api/auth";
import { getCertificateSnapshot } from "@/lib/certificates/server";

export async function GET(request: Request) {
  const userId = await resolveUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "未登录，无法获取证书信息" }, { status: 401 });
  }
  try {
    const snapshot = await getCertificateSnapshot(userId);
    return NextResponse.json(snapshot);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "获取证书信息失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
