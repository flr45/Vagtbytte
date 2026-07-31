import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const stationSchema = z.object({
  stations: z.array(z.enum(["A", "S", "K", "L", "R"])).max(5)
});

export async function PUT(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  const admin = await requireRole(UserRole.ADMIN);
  const { userId } = await context.params;
  const parsed = stationSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Ugyldige stationer" }, { status: 400 });
  }

  const firefighter = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true }
  });

  if (!firefighter || firefighter.role !== UserRole.BRANDFIGHTER) {
    return NextResponse.json({ error: "Brandmanden blev ikke fundet" }, { status: 404 });
  }

  const stations = [...new Set(parsed.data.stations)];
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      'UPDATE "User" SET "alarmStations" = $1::text[], "updatedAt" = NOW() WHERE "id" = $2',
      stations,
      userId
    );
    await tx.auditLog.create({
      data: {
        actorUserId: admin.id,
        actorRole: admin.role,
        action: "ALARM_STATIONS_UPDATED",
        targetUserId: userId,
        description: `Alarmstationer for ${firefighter.name} blev ændret til ${stations.join(", ") || "ingen"}`
      }
    });
  });

  return NextResponse.json({ ok: true, stations });
}
