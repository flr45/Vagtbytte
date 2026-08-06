import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { OPERATIONAL_IMAGE_DIRECTORY, getOperationalImage } from "@/lib/operativ-portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteProps = { params: Promise<{ imageId: string }> };

export async function GET(_request: Request, { params }: RouteProps) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Log ind for at fortsætte." }, { status: 401 });
  if (user.role !== UserRole.ADMIN && !user.hasAdminAccess) return NextResponse.json({ error: "Kun administratorer har adgang." }, { status: 403 });

  const { imageId } = await params;
  const image = await getOperationalImage(imageId);
  if (!image) return NextResponse.json({ error: "Billedet blev ikke fundet." }, { status: 404 });

  try {
    const data = await readFile(path.join(OPERATIONAL_IMAGE_DIRECTORY, image.storageName));
    return new Response(data, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": image.mimeType,
        "Content-Length": String(data.byteLength),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(image.originalName)}`,
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "Billedfilen mangler på serveren." }, { status: 410 });
  }
}
