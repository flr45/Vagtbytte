import type { NotificationType, PrismaClient } from "@prisma/client";
import { normalizeSmsPhoneNumber } from "./sms-phone";

export type VcSmsRepo = Pick<PrismaClient, "user" | "shiftTransfer">;

type VcActionNotification = {
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  shiftTransferId?: string | null;
};

type SmsGatewaySender = (recipient: string, body: string) => Promise<void>;

const VC_ACTION_NOTIFICATION_TYPES = new Set<NotificationType>([
  "TRANSFER_RECEIVER_ACCEPTED",
  "RETURN_ORIGINAL_ACCEPTED",
  "TRANSFER_ACTIVATION_REMINDER",
  "TRANSFER_EXPECTED_END",
  "RETURN_EXECUTION_REMINDER"
]);

let smsGatewaySenderForTests: SmsGatewaySender | null = null;

export function setVcSmsGatewaySenderForTests(sender: SmsGatewaySender | null) {
  smsGatewaySenderForTests = sender;
}

export function isVcActionNotification(input: Pick<VcActionNotification, "type" | "link">) {
  return input.link.startsWith("/vagtcentral/") && VC_ACTION_NOTIFICATION_TYPES.has(input.type);
}

export function sanitizeVcSmsText(value: string) {
  return value
    .replace(/\|/g, "-")
    .replace(/[{}\[\]~^\\]/g, "-")
    .replace(/€/g, "EUR")
    .replace(/[–—]/g, "-")
    .replace(/→/g, "->")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildVcSmsBody(input: {
  transferNumber?: string | null;
  title: string;
  body: string;
}) {
  const prefix = input.transferNumber ? `VC ${input.transferNumber}` : "VC";
  return sanitizeVcSmsText(`${prefix} - ${input.title}. ${input.body}`).slice(0, 155);
}

export async function sendVcSmsForNotification(repo: VcSmsRepo, input: VcActionNotification) {
  if (!isVcActionNotification(input)) {
    return { queued: false, reason: "not-actionable" as const };
  }

  const vc = await repo.user.findFirst({
    where: {
      role: "VC",
      isActive: true,
      vcSmsPhoneNumber: { not: null }
    },
    orderBy: { createdAt: "asc" },
    select: { vcSmsPhoneNumber: true }
  });
  if (!vc?.vcSmsPhoneNumber) {
    return { queued: false, reason: "no-number" as const };
  }

  let recipient: string;
  try {
    recipient = normalizeSmsPhoneNumber(vc.vcSmsPhoneNumber);
  } catch {
    console.error("VC_SMS_INVALID_PHONE_NUMBER");
    return { queued: false, reason: "invalid-number" as const };
  }

  const transfer = input.shiftTransferId
    ? await repo.shiftTransfer.findUnique({
        where: { id: input.shiftTransferId },
        select: { transferNumber: true }
      })
    : null;
  const body = buildVcSmsBody({
    transferNumber: transfer?.transferNumber,
    title: input.title,
    body: input.body
  });

  try {
    const sender = smsGatewaySenderForTests ?? sendThroughSmsGateway;
    await sender(recipient, body);
    console.info("VC_SMS_QUEUED", { type: input.type, shiftTransferId: input.shiftTransferId ?? null });
    return { queued: true, reason: null };
  } catch (error) {
    console.error("VC_SMS_QUEUE_FAILED", {
      type: input.type,
      shiftTransferId: input.shiftTransferId ?? null,
      error: error instanceof Error ? error.message : String(error)
    });
    return { queued: false, reason: "gateway-error" as const };
  }
}

async function sendThroughSmsGateway(recipient: string, body: string) {
  const url = smsGatewayOutgoingUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipient, body }),
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`SMS-gateway svarede HTTP ${response.status}`);
    }
    const payload = (await response.json()) as { id?: number | string };
    if (!payload.id) {
      throw new Error("SMS-gateway kvitterede ikke med et kø-id");
    }
  } finally {
    clearTimeout(timeout);
  }
}

function smsGatewayOutgoingUrl() {
  const explicit = process.env.SMS_GATEWAY_OUTGOING_URL?.trim();
  if (explicit) return explicit;

  const healthUrl = process.env.SMS_GATEWAY_HEALTH_URL?.trim();
  if (healthUrl?.endsWith("/health")) {
    return `${healthUrl.slice(0, -"/health".length)}/api/outgoing`;
  }

  return "http://sms-gateway:8080/api/outgoing";
}
