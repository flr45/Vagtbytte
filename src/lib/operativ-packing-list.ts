import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const MAX_PACKING_LIST_PDF_BYTES = 15 * 1024 * 1024;

export type ParsedPackingListRow = {
  sourceLine: number;
  placeName: string;
  itemName: string;
  quantity: number;
  note: string;
  confidence: number;
  reason: string;
};

export type PackingListPreviewRow = ParsedPackingListRow & {
  placeId: string | null;
  existingPlaceName: string | null;
  itemId: string | null;
  existingItemName: string | null;
  action: "create-place-and-item" | "create-item" | "update-item" | "review";
};

export type PackingListPdfInput = {
  vehicleName: string;
  code?: string;
  model?: string;
  generatedAt?: Date;
  places: Array<{
    name: string;
    description?: string;
    items: Array<{
      name: string;
      quantity: number;
      note?: string;
      specifications?: string;
    }>;
  }>;
};

export async function extractTextFromPackingListPdf(data: Uint8Array) {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "sbr-pakkeliste-"));
  const pdfPath = path.join(tempDirectory, `${randomUUID()}.pdf`);
  const textPath = path.join(tempDirectory, "pakkeliste.txt");
  try {
    await writeFile(pdfPath, data);
    await execFileAsync("pdftotext", ["-layout", "-enc", "UTF-8", pdfPath, textPath], {
      timeout: 20_000,
      maxBuffer: 8 * 1024 * 1024
    });
    return await readFile(textPath, "utf8");
  } finally {
    await rm(tempDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function parsePackingListText(text: string): ParsedPackingListRow[] {
  const lines = text.replace(/\r/g, "").split("\n");
  const rows: ParsedPackingListRow[] = [];
  let currentPlace = "";

  for (let index = 0; index < lines.length; index += 1) {
    const original = lines[index] ?? "";
    const line = cleanLine(original);
    if (!line || isNoiseLine(line)) continue;

    const explicit = parseExplicitRow(line, index + 1);
    if (explicit) {
      currentPlace = explicit.placeName;
      rows.push(explicit);
      continue;
    }

    if (looksLikePlaceHeading(line)) {
      currentPlace = normalizeDisplayText(line.replace(/[:：]\s*$/, ""));
      continue;
    }

    if (!currentPlace) continue;
    const contextual = parseContextualItem(line, currentPlace, index + 1);
    if (contextual) rows.push(contextual);
  }

  return dedupeParsedRows(rows);
}

function parseExplicitRow(line: string, sourceLine: number): ParsedPackingListRow | null {
  const separators = line.includes(";")
    ? line.split(";")
    : line.includes("|")
      ? line.split("|")
      : line.split(/\t+|\s{2,}/);
  const columns = separators.map((value) => normalizeDisplayText(value)).filter(Boolean);

  if (columns.length >= 3 && looksLikePlaceToken(columns[0])) {
    const quantityInfo = parseQuantity(columns[2]);
    if (quantityInfo.quantity !== null && columns[1].length >= 2) {
      return {
        sourceLine,
        placeName: columns[0],
        itemName: columns[1],
        quantity: quantityInfo.quantity,
        note: columns.slice(3).join(" · "),
        confidence: 0.99,
        reason: "Tydelige kolonner med rum, udstyr og antal"
      };
    }
  }

  const colon = line.match(/^([^:]{1,45}):\s*(.+)$/);
  if (colon && looksLikePlaceToken(colon[1])) {
    const item = parseItemAndQuantity(colon[2]);
    if (item) {
      return {
        sourceLine,
        placeName: normalizeDisplayText(colon[1]),
        itemName: item.name,
        quantity: item.quantity,
        note: item.note,
        confidence: 0.96,
        reason: "Rum og udstyr stod på samme linje"
      };
    }
  }

  return null;
}

function parseContextualItem(line: string, placeName: string, sourceLine: number): ParsedPackingListRow | null {
  if (looksLikeSectionLabel(line) || looksLikePlaceHeading(line)) return null;
  const item = parseItemAndQuantity(line);
  if (!item || item.name.length < 2) return null;
  return {
    sourceLine,
    placeName,
    itemName: item.name,
    quantity: item.quantity,
    note: item.note,
    confidence: item.hadQuantity ? 0.94 : 0.82,
    reason: item.hadQuantity
      ? "Udstyr fundet under en tydelig rumoverskrift med antal"
      : "Udstyr fundet under en tydelig rumoverskrift; antal antaget til 1"
  };
}

function parseItemAndQuantity(value: string) {
  const raw = String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/^[•·▪◦►▶-]\s*/, "")
    .replace(/^\d+[.)]\s+/, "")
    .trim();
  if (!raw || isNoiseLine(raw)) return null;

  const spacedColumns = raw.match(/^(.{3,}?)\s{2,}(\d{1,3})(?:\s{2,}(.+))?$/);
  if (spacedColumns) {
    return {
      name: normalizeDisplayText(spacedColumns[1]),
      quantity: clampQuantity(Number(spacedColumns[2])),
      note: normalizeDisplayText(spacedColumns[3] ?? ""),
      hadQuantity: true
    };
  }

  let input = normalizeDisplayText(raw);
  const leading = input.match(/^(\d{1,3})\s*[x×]\s*(.+)$/i);
  if (leading) {
    return { name: normalizeDisplayText(leading[2]), quantity: clampQuantity(Number(leading[1])), note: "", hadQuantity: true };
  }

  const leadingX = input.match(/^[x×]\s*(\d{1,3})\s+(.+)$/i);
  if (leadingX) {
    return { name: normalizeDisplayText(leadingX[2]), quantity: clampQuantity(Number(leadingX[1])), note: "", hadQuantity: true };
  }

  const trailingX = input.match(/^(.+?)\s+[x×]\s*(\d{1,3})(?:\s+[-–]\s*(.+))?$/i);
  if (trailingX) {
    return {
      name: normalizeDisplayText(trailingX[1]),
      quantity: clampQuantity(Number(trailingX[2])),
      note: normalizeDisplayText(trailingX[3] ?? ""),
      hadQuantity: true
    };
  }

  const noteSplit = input.match(/^(.+?)\s+[-–]\s+(.+)$/);
  if (noteSplit && noteSplit[1].length >= 3) {
    input = normalizeDisplayText(noteSplit[1]);
    return { name: input, quantity: 1, note: normalizeDisplayText(noteSplit[2]), hadQuantity: false };
  }

  if (input.length > 180) return null;
  return { name: input, quantity: 1, note: "", hadQuantity: false };
}

function parseQuantity(value: string) {
  const match = normalizeDisplayText(value).match(/(?:^|\b)(\d{1,3})(?:\s*[x×])?(?:\b|$)/i);
  return { quantity: match ? clampQuantity(Number(match[1])) : null };
}

function looksLikePlaceHeading(value: string) {
  const line = normalizeDisplayText(value);
  if (line.length > 65 || /\b(?:antal|quantity|qty)\b/i.test(line)) return false;
  return /^(?:h\s*\d{1,2}|v\s*\d{1,2}|rum\s*\d{1,2}(?:\s*[-–].+)?|skab\s*\d{1,2}(?:\s*[-–].+)?|kasse\s*\d{1,2}(?:\s*[-–].+)?|kabine|førerkabine|pumpe\s*panel|pumpepanel|tag|front|bagende|venstre\s+side|højre\s+side)(?:\s*[:：])?$/i.test(line);
}

function looksLikePlaceToken(value: string) {
  const token = normalizeDisplayText(value);
  return looksLikePlaceHeading(token) || /^(?:h|v)\s*\d{1,2}$/i.test(token) || /^(?:rum|skab|kasse)\s*\d{1,2}/i.test(token);
}

function looksLikeSectionLabel(value: string) {
  return /^(?:pakkeliste|indhold|udstyr|materiel|placering|rum|antal|bemærkning|note|navn|beskrivelse|spec(?:ifikationer)?\.?|genereret|sbr\s+operativ|side\s+\d+)/i.test(value);
}

function isNoiseLine(value: string) {
  const line = value.trim();
  if (/^\d{1,3}$/.test(line)) return true;
  if (/^side\s+\d+(?:\s+af\s+\d+)?$/i.test(line)) return true;
  if (/^(?:pakkeliste|køretøj|vehicle|place|item|quantity|note)(?:\s+[|;]?\s*(?:place|item|quantity|note|rum|udstyr|antal|bemærkning))*$/i.test(line)) return true;
  return false;
}

function dedupeParsedRows(rows: ParsedPackingListRow[]) {
  const seen = new Map<string, ParsedPackingListRow>();
  for (const row of rows) {
    const key = `${normalizePlaceKey(row.placeName)}::${normalizeKey(row.itemName)}`;
    const previous = seen.get(key);
    if (!previous || row.confidence > previous.confidence) seen.set(key, row);
  }
  return Array.from(seen.values());
}

export function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9æøå]+/g, "")
    .trim();
}

export function normalizePlaceKey(value: string) {
  const display = normalizeDisplayText(value).toLowerCase();
  const coded = display.match(/^(h\s*\d{1,2}|v\s*\d{1,2}|rum\s*\d{1,2}|skab\s*\d{1,2}|kasse\s*\d{1,2})\b/i);
  return normalizeKey(coded?.[1] ?? display);
}

function normalizeDisplayText(value: string) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanLine(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/[\t ]+$/g, "").trim();
}

function clampQuantity(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(999, Math.max(1, Math.trunc(value)));
}

export function createPackingListPdf(input: PackingListPdfInput): Uint8Array {
  const generatedAt = input.generatedAt ?? new Date();
  const pages: PdfPage[] = [];
  let page = createPage();
  let y = 765;

  const pushPage = () => {
    pages.push(page);
    page = createPage();
    y = 765;
  };

  const ensureSpace = (height = 28) => {
    if (y - height < 62) pushPage();
  };

  const write = (text: string, options: { size?: number; bold?: boolean; indent?: number; gap?: number } = {}) => {
    const size = options.size ?? 10;
    const gap = options.gap ?? Math.max(14, size + 4);
    const indent = options.indent ?? 0;
    const lines = wrapPdfText(text, indent ? 78 : 88);
    ensureSpace(lines.length * gap + 4);
    for (const line of lines) {
      page.lines.push({ text: line, x: 50 + indent, y, size, bold: options.bold ?? false });
      y -= gap;
    }
  };

  write(input.vehicleName, { size: 19, bold: true, gap: 25 });
  const meta = [input.code, input.model].filter(Boolean).join(" · ");
  if (meta) write(meta, { size: 10, gap: 17 });
  write(`Genereret ${formatDanishDate(generatedAt)}`, { size: 8, gap: 24 });

  for (const place of input.places) {
    ensureSpace(58);
    y -= 6;
    page.lines.push({ text: place.name, x: 50, y, size: 13, bold: true, accent: true });
    y -= 19;
    if (place.description) write(`Beskrivelse: ${place.description}`, { size: 8, gap: 13 });

    if (place.items.length === 0) {
      write("Ingen udstyrsposter", { size: 9, indent: 12, gap: 17 });
      continue;
    }

    for (const item of place.items) {
      const quantity = Math.max(1, item.quantity);
      write(`${quantity} x ${item.name}`, { size: 10, bold: true, indent: 12, gap: 15 });
      if (item.note) write(`Note: ${item.note}`, { size: 8, indent: 24, gap: 13 });
      if (item.specifications) write(`Spec.: ${item.specifications}`, { size: 8, indent: 24, gap: 13 });
      y -= 2;
    }
  }

  pages.push(page);
  return buildPdf(pages, input.vehicleName);
}

type PdfTextLine = { text: string; x: number; y: number; size: number; bold: boolean; accent?: boolean };
type PdfPage = { lines: PdfTextLine[] };

function createPage(): PdfPage {
  return { lines: [] };
}

function buildPdf(pages: PdfPage[], title: string) {
  const objectBuffers = new Map<number, Buffer>();
  const pageIds = pages.map((_, index) => 5 + index * 2);
  objectBuffers.set(1, pdfBuffer("<< /Type /Catalog /Pages 2 0 R >>"));
  objectBuffers.set(2, pdfBuffer(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`));
  objectBuffers.set(3, pdfBuffer("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"));
  objectBuffers.set(4, pdfBuffer("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"));

  pages.forEach((pdfPage, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const stream = renderPageContent(pdfPage, index + 1, pages.length, title);
    objectBuffers.set(pageId, pdfBuffer(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`));
    const streamBuffer = pdfBuffer(stream);
    objectBuffers.set(contentId, Buffer.concat([
      pdfBuffer(`<< /Length ${streamBuffer.length} >>\nstream\n`),
      streamBuffer,
      pdfBuffer("\nendstream")
    ]));
  });

  const maxObject = Math.max(...objectBuffers.keys());
  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%âãÏÓ\n", "latin1")];
  const offsets = new Array(maxObject + 1).fill(0);
  let offset = chunks[0].length;

  for (let id = 1; id <= maxObject; id += 1) {
    const body = objectBuffers.get(id) ?? pdfBuffer("<< >>");
    offsets[id] = offset;
    const object = Buffer.concat([pdfBuffer(`${id} 0 obj\n`), body, pdfBuffer("\nendobj\n")]);
    chunks.push(object);
    offset += object.length;
  }

  const xrefOffset = offset;
  const xref = ["xref", `0 ${maxObject + 1}`, "0000000000 65535 f "];
  for (let id = 1; id <= maxObject; id += 1) xref.push(`${String(offsets[id]).padStart(10, "0")} 00000 n `);
  const trailer = `${xref.join("\n")}\ntrailer\n<< /Size ${maxObject + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(pdfBuffer(trailer));
  return new Uint8Array(Buffer.concat(chunks));
}

function renderPageContent(page: PdfPage, pageNumber: number, pageCount: number, title: string) {
  const commands: string[] = [];
  commands.push("0.72 0.04 0.08 rg 0 800 595 42 re f");
  commands.push(textCommand("SBR Operativ Portal · Pakkeliste", 50, 815, 11, true, true));
  commands.push("0.12 0.12 0.12 rg");
  for (const line of page.lines) {
    if (line.accent) commands.push("0.72 0.04 0.08 rg");
    else commands.push("0.12 0.12 0.12 rg");
    commands.push(textCommand(line.text, line.x, line.y, line.size, line.bold, false));
  }
  commands.push("0.42 0.42 0.42 rg");
  commands.push(textCommand(`${title} · Side ${pageNumber} af ${pageCount}`, 50, 32, 8, false, false));
  return commands.join("\n");
}

function textCommand(text: string, x: number, y: number, size: number, bold: boolean, white: boolean) {
  const color = white ? "1 1 1 rg " : "";
  return `${color}BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${escapePdfText(text)}) Tj ET`;
}

function escapePdfText(value: string) {
  return sanitizePdfText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function sanitizePdfText(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\u0020-\u007e\u00a0-\u00ff]/g, "?");
}

function pdfBuffer(value: string) {
  return Buffer.from(value, "latin1");
}

function wrapPdfText(value: string, maxLength: number) {
  const text = sanitizePdfText(value).replace(/\s+/g, " ").trim();
  if (!text) return [""];
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) current = word;
    else if (`${current} ${word}`.length <= maxLength) current += ` ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function formatDanishDate(value: Date) {
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Copenhagen" }).format(value);
}
