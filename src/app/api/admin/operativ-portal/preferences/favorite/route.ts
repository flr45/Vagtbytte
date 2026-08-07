import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canAccessOperationalPortal, getCurrentUser } from "@/lib/auth";
import {
  isOperationalFavorite,
  resolveOperationalTarget,
  type OperationalTargetType
} from "@/lib/operativ-portal-personal";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  type: z.enum(["vehicle", "place", "item"]),
  id: z.string().uuid(),
  favorite: z.boolean().optional()
});

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Log ind for at fortsætte." }, { status: 401 });
  if (!canAccessOperationalPortal(user)) return NextResponse.json({ error: "Du har ikke adgang til Operativ Portal." }, { status: 403 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const id = url.searchParams.get("id") ?? "";
  if (!isTargetType(type) || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Favoritten er ugyldig." }, { status: 400 });
  const target = await resolveOperationalTarget(type, id);
  if (!target) return NextResponse.json({ error: "Indholdet blev ikke fundet." }, { status: 404 });
  return NextResponse.json({ favorite: await isOperationalFavorite(user.id, type, id), title: target.title });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Log ind for at fortsætte." }, { status: 401 });
  if (!canAccessOperationalPortal(user)) {
    return NextResponse.json({ error: "Du har ikke adgang til Operativ Portal." }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Favoritten er ugyldig." }, { status: 400 });

  const target = await resolveOperationalTarget(parsed.data.type, parsed.data.id);
  if (!target) return NextResponse.json({ error: "Indholdet blev ikke fundet." }, { status: 404 });

  const current = await isOperationalFavorite(user.id, parsed.data.type, parsed.data.id);
  const next = parsed.data.favorite ?? !current;

  if (next) {
    await prisma.$executeRaw`
      INSERT INTO operational_favorite (id, user_id, target_type, target_id)
      VALUES (${randomUUID()}::uuid, ${user.id}, ${parsed.data.type}, ${parsed.data.id})
      ON CONFLICT (user_id, target_type, target_id) DO NOTHING
    `;
  } else {
    await prisma.$executeRaw`
      DELETE FROM operational_favorite
      WHERE user_id = ${user.id} AND target_type = ${parsed.data.type} AND target_id = ${parsed.data.id}
    `;
  }

  return NextResponse.json({ ok: true, favorite: next });
}

function isTargetType(value: string | null): value is OperationalTargetType {
  return value === "vehicle" || value === "place" || value === "item";
}
