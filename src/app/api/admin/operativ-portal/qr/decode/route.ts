import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { canAccessOperationalPortal, getCurrentUser } from "@/lib/auth";
import { normalizeOperationalQrValue } from "@/lib/operativ-qr";

const execFileAsync = promisify(execFile);
const MAX_QR_IMAGE_BYTES = 8 * 1024 * 1024;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Log ind for at fortsætte." }, { status: 401 });
  if (!canAccessOperationalPortal(user)) {
    return NextResponse.json({ error: "Du har ikke adgang til Operativ Portal." }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Vælg et billede af QR-koden." }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_QR_IMAGE_BYTES) {
    return NextResponse.json({ error: "Billedet må højst fylde 8 MB." }, { status: 413 });
  }
  if (!new Set(["image/jpeg", "image/png"]).has(file.type)) {
    return NextResponse.json({ error: "QR-billedet skal være JPEG eller PNG." }, { status: 415 });
  }

  const directory = await mkdtemp(path.join(os.tmpdir(), "sbr-qr-"));
  const extension = file.type === "image/png" ? ".png" : ".jpg";
  const imagePath = path.join(directory, `${randomUUID()}${extension}`);
  try {
    await writeFile(imagePath, new Uint8Array(await file.arrayBuffer()));
    const { stdout } = await execFileAsync("zbarimg", ["--quiet", "--raw", imagePath], {
      encoding: "utf8",
      timeout: 12_000,
      maxBuffer: 1024 * 1024
    });
    const raw = stdout.split(/\r?\n/).map((value) => value.trim()).find(Boolean) ?? "";
    const operationalPath = normalizeOperationalQrValue(raw, request.url);
    if (!operationalPath) {
      return NextResponse.json({ error: "QR-koden er ikke en gyldig SBR Fire App-kode." }, { status: 422 });
    }
    return NextResponse.json({ ok: true, path: operationalPath });
  } catch (error) {
    console.error("Operational QR decode failed", error);
    return NextResponse.json({ error: "QR-koden kunne ikke aflæses fra billedet." }, { status: 422 });
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}
