import { NextResponse } from "next/server";
import { getLearningModules } from "@/lib/dataService";

export async function GET() {
  const modules = await getLearningModules();
  return NextResponse.json({ modules });
}
