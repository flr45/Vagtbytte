import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { canAccessOperationalPortal, getCurrentUser } from "@/lib/auth";
import { isAllowedOperationalPath } from "@/lib/operativ-qr";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Log ind for at fortsætte." }, { status: 401 });
  if (!canAccessOperationalPortal(user)) {
    return NextResponse.json({ error: "Du har ikke adgang til Operativ Portal." }, { status: 403 });
  }

  const url = new URL(request.url);
  const path = url.searchParams.get("path")?.trim() ?? "";
  if (!isAllowedOperationalPath(path)) return NextResponse.json({ error: "QR-linket er ugyldigt." }, { status: 400 });

  const targetUrl = new URL(path, url.origin).toString();
  try {
    const { stdout } = await execFileAsync("qrencode", ["-t", "SVG", "-o", "-", "-m", "2", "-s", "8", targetUrl], {
      encoding: "utf8",
      timeout: 10_000,
      maxBuffer: 2 * 1024 * 1024
    });
    return new Response(stdout, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Disposition": "inline; filename=operativ-portal-qr.svg",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    console.error("Operational QR generation failed", error);
    return NextResponse.json({ error: "QR-koden kunne ikke genereres." }, { status: 500 });
  }
}
