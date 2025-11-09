import { NextResponse } from "next/server";
import { resolveUserIdFromRequest } from "@/lib/api/auth";
import { claimCertificate } from "@/lib/certificates/server";

export async function POST(request: Request) {
  const userId = await resolveUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "未登录，无法领取证书" }, { status: 401 });
  }

  try {
    const certificate = await claimCertificate(userId);
    return NextResponse.json({ certificate });
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成证书失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
