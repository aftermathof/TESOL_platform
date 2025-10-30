import { NextResponse } from "next/server";
import { getProgressSnapshot } from "@/lib/dataService";

export async function GET() {
  const progress = await getProgressSnapshot();
  return NextResponse.json({ progress });
}
