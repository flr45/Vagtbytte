import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { buildGdprUserExport, gdprExportFileName } from "@/lib/gdpr-user-export";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteProps = {
  params: Promise<{ userId: string }>;
};

function isAdmin(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  return Boolean(user && (user.role === UserRole.ADMIN || user.hasAdminAccess));
}

export async function GET(_request: Request, { params }: RouteProps) {
  const admin = await getCurrentUser();
  if (!admin) {
    return NextResponse.json({ error: "Log ind for at fortsætte." }, { status: 401 });
  }
  if (!isAdmin(admin)) {
    return NextResponse.json({ error: "Kun administratorer har adgang." }, { status: 403 });
  }

  const { userId } = await params;
  if (!userId || userId.length > 128) {
    return NextResponse.json({ error: "Brugeren er ugyldig." }, { status: 400 });
  }

  const generatedAt = new Date();
  const data = await buildGdprUserExport(prisma, userId, generatedAt);
  if (!data) {
    return NextResponse.json({ error: "Brugeren blev ikke fundet." }, { status: 404 });
  }

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      actorRole: admin.role,
      action: "GDPR_USER_EXPORT_CREATED",
      targetUserId: userId,
      description: "Administrator genererede et internt GDPR-brugerudtræk"
    }
  });

  const fileName = gdprExportFileName(data.user);
  return new Response(`${JSON.stringify(data, null, 2)}\n`, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
