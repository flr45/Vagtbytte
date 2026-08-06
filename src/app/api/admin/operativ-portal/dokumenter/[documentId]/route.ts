import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { canAccessOperationalPortal, getCurrentUser } from "@/lib/auth";
import {
  OPERATIONAL_DOCUMENT_DIRECTORY,
  getOperationalDocument
} from "@/lib/operativ-portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteProps = {
  params: Promise<{ documentId: string }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Log ind for at fortsætte." }, { status: 401 });
  }
  if (!canAccessOperationalPortal(user)) {
    return NextResponse.json({ error: "Du har ikke adgang til Operativ Portal." }, { status: 403 });
  }

  const { documentId } = await params;
  const document = await getOperationalDocument(documentId);
  if (!document) {
    return NextResponse.json({ error: "Dokumentet blev ikke fundet." }, { status: 404 });
  }

  try {
    const data = await readFile(path.join(OPERATIONAL_DOCUMENT_DIRECTORY, document.storageName));
    const encodedName = encodeURIComponent(document.originalName);
    return new Response(data, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": document.mimeType,
        "Content-Length": String(data.byteLength),
        "Content-Disposition": `inline; filename*=UTF-8''${encodedName}`,
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "Dokumentfilen mangler på serveren." }, { status: 410 });
  }
}
