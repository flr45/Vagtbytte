"use server";

import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "./auth";
import { prisma } from "./prisma";

const execFileAsync = promisify(execFile);
const SCHEDULE_ID = "monthly-summary";

export type EmailReportActionState = {
  ok?: boolean;
  message?: string;
};

const scheduleSchema = z.object({
  name: z.string().trim().min(1, "Navnet skal udfyldes").max(100),
  recipients: z.array(z.string().email()).min(1, "Angiv mindst én gyldig mailadresse"),
  daysOfMonth: z.array(z.number().int().min(1).max(31)).min(1, "Angiv mindst én dag i måneden"),
  sendHour: z.number().int().min(0).max(23),
  sendMinute: z.number().int().min(0).max(59),
  enabled: z.boolean()
});

export async function saveEmailReportScheduleAction(
  _state: EmailReportActionState,
  formData: FormData
): Promise<EmailReportActionState> {
  const admin = await requireRole(UserRole.ADMIN);
  const recipients = parseRecipients(String(formData.get("recipients") ?? ""));
  const daysOfMonth = parseDays(String(formData.get("daysOfMonth") ?? ""));
  const time = String(formData.get("sendTime") ?? "08:00").match(/^(\d{2}):(\d{2})$/);
  const parsed = scheduleSchema.safeParse({
    name: formData.get("name"),
    recipients,
    daysOfMonth,
    sendHour: time ? Number(time[1]) : -1,
    sendMinute: time ? Number(time[2]) : -1,
    enabled: formData.get("enabled") === "on"
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Indstillingerne er ugyldige." };
  }

  await prisma.$transaction([
    prisma.emailReportSchedule.upsert({
      where: { id: SCHEDULE_ID },
      update: {
        name: parsed.data.name,
        recipients: parsed.data.recipients,
        daysOfMonth: parsed.data.daysOfMonth,
        sendHour: parsed.data.sendHour,
        sendMinute: parsed.data.sendMinute,
        timezone: "Europe/Copenhagen",
        enabled: parsed.data.enabled,
        lastError: null
      },
      create: {
        id: SCHEDULE_ID,
        name: parsed.data.name,
        recipients: parsed.data.recipients,
        daysOfMonth: parsed.data.daysOfMonth,
        sendHour: parsed.data.sendHour,
        sendMinute: parsed.data.sendMinute,
        timezone: "Europe/Copenhagen",
        enabled: parsed.data.enabled
      }
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: admin.id,
        actorRole: admin.role,
        action: "EMAIL_REPORT_SCHEDULE_UPDATED",
        description: `Mailrapporten blev ${parsed.data.enabled ? "aktiveret" : "deaktiveret"}. Dage: ${parsed.data.daysOfMonth.join(", ")}, tidspunkt: ${String(parsed.data.sendHour).padStart(2, "0")}:${String(parsed.data.sendMinute).padStart(2, "0")}`
      }
    })
  ]);

  revalidatePath("/admin/mailrapporter");
  return { ok: true, message: "Mailrapportens indstillinger er gemt." };
}

export async function sendEmailReportNowAction(
  _state: EmailReportActionState,
  _formData: FormData
): Promise<EmailReportActionState> {
  const admin = await requireRole(UserRole.ADMIN);

  try {
    const script = path.join(process.cwd(), "scripts", "email-report-cli.mjs");
    const { stdout } = await execFileAsync(
      process.execPath,
      [script, "send-now", SCHEDULE_ID],
      {
        cwd: process.cwd(),
        timeout: 180000,
        maxBuffer: 2 * 1024 * 1024
      }
    );
    const result = parseLastJsonLine(stdout);
    if (result?.failed) {
      return { ok: false, message: `Rapporten kunne ikke sendes: ${result.error ?? "ukendt fejl"}` };
    }

    await prisma.auditLog.create({
      data: {
        actorUserId: admin.id,
        actorRole: admin.role,
        action: "EMAIL_REPORT_MANUAL_REQUEST",
        description: `${admin.name} sendte mailrapporten manuelt`
      }
    });
    revalidatePath("/admin/mailrapporter");
    return { ok: true, message: "Mailrapporten er sendt." };
  } catch (error) {
    return {
      ok: false,
      message: `Rapporten kunne ikke sendes: ${extractCommandFailure(error)}`
    };
  }
}

function parseRecipients(value: string) {
  return [...new Set(value.split(/[\s,;]+/).map((item) => item.trim().toLowerCase()).filter(Boolean))];
}

function parseDays(value: string) {
  return [...new Set(value.split(/[\s,;]+/).map(Number).filter((item) => Number.isInteger(item) && item >= 1 && item <= 31))].sort((a, b) => a - b);
}

function parseLastJsonLine(value: string) {
  const line = value.trim().split(/\r?\n/).filter(Boolean).at(-1);
  if (!line) return null;
  try {
    return JSON.parse(line) as { failed?: boolean; error?: string };
  } catch {
    return null;
  }
}

function extractCommandFailure(error: unknown) {
  if (!(error instanceof Error)) {
    return "ukendt fejl";
  }

  const commandError = error as Error & {
    stdout?: string | Buffer;
    stderr?: string | Buffer;
  };
  const stdout = commandOutputText(commandError.stdout);
  const result = parseLastJsonLine(stdout);
  if (result?.error) {
    return result.error;
  }

  const stderr = commandOutputText(commandError.stderr)
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .at(-1);

  return stderr || commandError.message;
}

function commandOutputText(value: string | Buffer | undefined) {
  if (Buffer.isBuffer(value)) {
    return value.toString("utf8");
  }
  return value ?? "";
}
