import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { canAccessOperationalPortal, getCurrentUser } from "@/lib/auth";
import { OPERATIONAL_IMAGE_DIRECTORY, getOperationalImage } from "@/lib/operativ-portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteProps = { params: Promise<{ imageId: string }> };

const IMAGE_CACHE_CONTROL = "private, max-age=300, must-revalidate";

export async function GET(request: Request, { params }: RouteProps) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Log ind for at fortsætte." }, { status: 401 });
  if (!canAccessOperationalPortal(user)) return NextResponse.json({ error: "Du har ikke adgang til Operativ Portal." }, { status: 403 });

  const { imageId } = await params;
  const image = await getOperationalImage(imageId);
  if (!image) return NextResponse.json({ error: "Billedet blev ikke fundet." }, { status: 404 });

  const etag = `"${image.storageName}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        "Cache-Control": IMAGE_CACHE_CONTROL,
        ETag: etag,
        "X-Content-Type-Options": "nosniff"
      }
    });
  }

  try {
    const data = await readFile(path.join(OPERATIONAL_IMAGE_DIRECTORY, image.storageName));
    return new Response(data, {
      headers: {
        "Cache-Control": IMAGE_CACHE_CONTROL,
        ETag: etag,
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
