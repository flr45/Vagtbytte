import { NextResponse } from "next/server";
import { healthStatus } from "@/lib/health";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const result = await healthStatus(() => prisma.$queryRaw`SELECT 1`);
  return NextResponse.json(result.body, { status: result.status });
}
