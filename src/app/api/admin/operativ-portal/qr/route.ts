import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { canAccessOperationalPortal, getCurrentUser } from "@/lib/auth";

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
  if (!isAllowedOperationalPath(path)) {
    return NextResponse.json({ error: "QR-linket er ugyldigt." }, { status: 400 });
  }

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
  } catch {
    return NextResponse.json({ error: "QR-koden kunne ikke genereres." }, { status: 500 });
  }
}

function isAllowedOperationalPath(path: string) {
  if (!path.startsWith("/admin/operativ-portal/")) return false;
  if (path.includes("..") || path.includes("\\") || path.includes("\u0000")) return false;
  return /^\/admin\/operativ-portal\/(?:koeretoejer\/[0-9a-f-]{36}|rum\/[0-9a-f-]{36}|udstyr\/[0-9a-f-]{36})(?:[#?].*)?$/i.test(path);
}
