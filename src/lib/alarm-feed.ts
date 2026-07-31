import { createHash, randomUUID } from "crypto";
import { NotificationType, Prisma } from "@prisma/client";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

export type AlarmFeedMessageInput = {
  senderNumber: string;
  rawMessage: string;
  receivedAt: Date;
  sourceMessageId?: string | null;
};

export type AlarmFeedMessage = {
  id: string;
  alarmId: string;
  sequenceNumber: number;
  senderNumber: string;
  rawMessage: string;
  receivedAt: Date;
};

export type AlarmFeedAlarm = {
  id: string;
  status: "ACTIVE" | "CLOSED";
  senderNumber: string;
  openedAt: Date;
  messages: AlarmFeedMessage[];
};

const FOLLOW_UP_WINDOW_MS = 30 * 60 * 1000;
const ALARM_NOTIFICATION_TYPE = "ALARM_MESSAGE" as NotificationType;

export function createDeduplicationKey(input: AlarmFeedMessageInput) {
  return createHash("sha256")
    .update(
      [
        normalizePhoneNumber(input.senderNumber),
        input.receivedAt.toISOString(),
        input.sourceMessageId ?? "",
        input.rawMessage
      ].join("\n")
    )
    .digest("hex");
}

export async function ingestAlarmMessage(input: AlarmFeedMessageInput) {
  const senderNumber = normalizePhoneNumber(input.senderNumber);
  const rawMessage = input.rawMessage.trim();

  if (!senderNumber || !rawMessage) {
    throw new Error("Afsendernummer og beskedtekst er påkrævet");
  }

  const deduplicationKey = createDeduplicationKey({ ...input, senderNumber, rawMessage });

  const result = await prisma.$transaction(async (tx) => {
    const duplicate = await tx.$queryRaw<Array<{ id: string; alarmId: string; sequenceNumber: number }>>(
      Prisma.sql`SELECT "id", "alarmId", "sequenceNumber"
                 FROM "AlarmMessage"
                 WHERE "deduplicationKey" = ${deduplicationKey}
                 LIMIT 1`
    );

    if (duplicate[0]) {
      return { created: false, ...duplicate[0] };
    }

    const windowStart = new Date(input.receivedAt.getTime() - FOLLOW_UP_WINDOW_MS);
    const activeAlarm = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id"
                 FROM "Alarm"
                 WHERE "status" = 'ACTIVE'::"AlarmStatus"
                   AND "senderNumber" = ${senderNumber}
                   AND "openedAt" >= ${windowStart}
                 ORDER BY "openedAt" DESC
                 LIMIT 1
                 FOR UPDATE`
    );

    const alarmId = activeAlarm[0]?.id ?? randomUUID();

    if (!activeAlarm[0]) {
      await tx.$executeRaw(
        Prisma.sql`INSERT INTO "Alarm"
          ("id", "status", "source", "senderNumber", "openedAt", "createdAt", "updatedAt")
          VALUES (${alarmId}, 'ACTIVE'::"AlarmStatus", 'SMS', ${senderNumber}, ${input.receivedAt}, NOW(), NOW())`
      );
    }

    const sequenceRows = await tx.$queryRaw<Array<{ next: number }>>(
      Prisma.sql`SELECT COALESCE(MAX("sequenceNumber"), 0) + 1 AS "next"
                 FROM "AlarmMessage"
                 WHERE "alarmId" = ${alarmId}`
    );
    const sequenceNumber = Number(sequenceRows[0]?.next ?? 1);
    const messageId = randomUUID();

    await tx.$executeRaw(
      Prisma.sql`INSERT INTO "AlarmMessage"
        ("id", "alarmId", "sequenceNumber", "senderNumber", "rawMessage", "receivedAt", "sourceMessageId", "deduplicationKey", "createdAt")
        VALUES (${messageId}, ${alarmId}, ${sequenceNumber}, ${senderNumber}, ${rawMessage}, ${input.receivedAt}, ${input.sourceMessageId ?? null}, ${deduplicationKey}, NOW())`
    );

    await tx.$executeRaw(
      Prisma.sql`UPDATE "Alarm" SET "updatedAt" = NOW() WHERE "id" = ${alarmId}`
    );

    return { created: true, id: messageId, alarmId, sequenceNumber };
  });

  if (result.created) {
    await notifyActiveFirefighters({
      alarmId: result.alarmId,
      messageId: result.id,
      sequenceNumber: result.sequenceNumber,
      rawMessage
    });
  }

  return result;
}

async function notifyActiveFirefighters(input: {
  alarmId: string;
  messageId: string;
  sequenceNumber: number;
  rawMessage: string;
}) {
  const firefighters = await prisma.user.findMany({
    where: { role: "BRANDFIGHTER", isActive: true },
    select: { id: true }
  });

  const title = input.sequenceNumber === 1 ? "🚨 Ny alarm" : `🚨 Sending ${input.sequenceNumber}`;
  const body = truncateForPush(input.rawMessage, 220);

  for (const firefighter of firefighters) {
    try {
      await createNotification(prisma, {
        recipientUserId: firefighter.id,
        type: ALARM_NOTIFICATION_TYPE,
        title,
        body,
        link: "/brandmand/alarmer",
        uniqueKey: `alarm:${input.alarmId}:message:${input.messageId}:user:${firefighter.id}`,
        publishNow: true
      });
    } catch (error) {
      console.error("ALARM_NOTIFICATION_FAILED", {
        alarmId: input.alarmId,
        messageId: input.messageId,
        recipientUserId: firefighter.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

export async function listRecentAlarms(limit = 25): Promise<AlarmFeedAlarm[]> {
  const alarms = await prisma.$queryRaw<Array<Omit<AlarmFeedAlarm, "messages">>>(
    Prisma.sql`SELECT "id", "status", "senderNumber", "openedAt"
               FROM "Alarm"
               ORDER BY "openedAt" DESC
               LIMIT ${limit}`
  );

  if (alarms.length === 0) return [];

  const alarmIds = alarms.map((alarm) => alarm.id);
  const messages = await prisma.$queryRaw<AlarmFeedMessage[]>(
    Prisma.sql`SELECT "id", "alarmId", "sequenceNumber", "senderNumber", "rawMessage", "receivedAt"
               FROM "AlarmMessage"
               WHERE "alarmId" IN (${Prisma.join(alarmIds)})
               ORDER BY "receivedAt" ASC, "sequenceNumber" ASC`
  );

  const messagesByAlarm = new Map<string, AlarmFeedMessage[]>();
  for (const message of messages) {
    const current = messagesByAlarm.get(message.alarmId) ?? [];
    current.push(message);
    messagesByAlarm.set(message.alarmId, current);
  }

  return alarms.map((alarm) => ({ ...alarm, messages: messagesByAlarm.get(alarm.id) ?? [] }));
}

function truncateForPush(value: string, maxLength: number) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length <= maxLength ? compact : `${compact.slice(0, maxLength - 1)}…`;
}

function normalizePhoneNumber(value: string) {
  return value.trim().replace(/[\s()-]/g, "");
}
