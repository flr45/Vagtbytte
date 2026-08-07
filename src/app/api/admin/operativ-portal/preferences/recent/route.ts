import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canAccessOperationalPortal, getCurrentUser } from "@/lib/auth";
import { resolveOperationalTarget } from "@/lib/operativ-portal-personal";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  type: z.enum(["vehicle", "place", "item"]),
  id: z.string().uuid()
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Log ind for at fortsætte." }, { status: 401 });
  if (!canAccessOperationalPortal(user)) {
    return NextResponse.json({ error: "Du har ikke adgang til Operativ Portal." }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Senest sete-data er ugyldige." }, { status: 400 });

  const target = await resolveOperationalTarget(parsed.data.type, parsed.data.id);
  if (!target) return NextResponse.json({ error: "Indholdet blev ikke fundet." }, { status: 404 });

  await prisma.$executeRaw`
    INSERT INTO operational_recent (id, user_id, target_type, target_id, view_count, last_viewed_at)
    VALUES (${randomUUID()}::uuid, ${user.id}, ${parsed.data.type}, ${parsed.data.id}, 1, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id, target_type, target_id)
    DO UPDATE SET view_count = operational_recent.view_count + 1, last_viewed_at = CURRENT_TIMESTAMP
  `;

  return NextResponse.json({ ok: true });
}
