import { NextResponse } from "next/server";
import { getCertificateInfo } from "@/lib/dataService";

export async function GET() {
  const certificate = await getCertificateInfo();
  return NextResponse.json({ certificate });
}
