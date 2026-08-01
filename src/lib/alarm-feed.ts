import { createHash, randomUUID } from "crypto";
import { NotificationType, Prisma } from "@prisma/client";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { isStationCode } from "@/lib/stations";

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
  stationCode: string | null;
  openedAt: Date;
  messages: AlarmFeedMessage[];
};

export type StoredAlarmPage = {
  alarms: AlarmFeedAlarm[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const FOLLOW_UP_WINDOW_MS = 30 * 60 * 1000;
const ALARM_NOTIFICATION_TYPE = "ALARM_MESSAGE" as NotificationType;
const MAX_PUBLIC_ALARMS = 5;
const MAX_ADMIN_PAGE_SIZE = 100;

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

export function detectStationCode(rawMessage: string) {
  const parenthesizedMatch = rawMessage.match(/\((ISL|[ASKLR])\)/i);
  const parenthesizedCode = parenthesizedMatch?.[1]?.toUpperCase() ?? null;

  if (isStationCode(parenthesizedCode)) {
    return parenthesizedCode;
  }

  const hasStandaloneIsl = /(^|[^A-Z0-9])ISL(?=$|[^A-Z0-9])/i.test(rawMessage);
  return hasStandaloneIsl ? "ISL" : null;
}

export async function ingestAlarmMessage(input: AlarmFeedMessageInput) {
  const senderNumber = normalizePhoneNumber(input.senderNumber);
  const rawMessage = input.rawMessage.trim();

  if (!senderNumber || !rawMessage) {
    throw new Error("Afsendernummer og beskedtekst er påkrævet");
  }

  const deduplicationKey = createDeduplicationKey({ ...input, senderNumber, rawMessage });
  const detectedStationCode = detectStationCode(rawMessage);

  const result = await prisma.$transaction(async (tx) => {
    const duplicate = await tx.alarmMessage.findUnique({
      where: { deduplicationKey },
      select: { id: true, alarmId: true, sequenceNumber: true }
    });

    if (duplicate) {
      return { created: false, ...duplicate, stationCode: null as string | null };
    }

    const windowStart = new Date(input.receivedAt.getTime() - FOLLOW_UP_WINDOW_MS);
    const activeAlarm = await tx.$queryRaw<Array<{ id: string; stationCode: string | null }>>(
      Prisma.sql`SELECT "id", "stationCode"
                 FROM "Alarm"
                 WHERE "status" = 'ACTIVE'::"AlarmStatus"
                   AND "senderNumber" = ${senderNumber}
                   AND "openedAt" >= ${windowStart}
                 ORDER BY "openedAt" DESC
                 LIMIT 1
                 FOR UPDATE`
    );

    const alarmId = activeAlarm[0]?.id ?? randomUUID();
    const stationCode = activeAlarm[0]?.stationCode ?? detectedStationCode;

    if (!activeAlarm[0]) {
      await tx.alarm.create({
        data: {
          id: alarmId,
          senderNumber,
          stationCode,
          openedAt: input.receivedAt
        }
      });
    } else if (!activeAlarm[0].stationCode && detectedStationCode) {
      await tx.alarm.update({
        where: { id: alarmId },
        data: { stationCode: detectedStationCode }
      });
    }

    const highestSequence = await tx.alarmMessage.aggregate({
      where: { alarmId },
      _max: { sequenceNumber: true }
    });
    const sequenceNumber = (highestSequence._max.sequenceNumber ?? 0) + 1;
    const messageId = randomUUID();

    await tx.alarmMessage.create({
      data: {
        id: messageId,
        alarmId,
        sequenceNumber,
        senderNumber,
        rawMessage,
        receivedAt: input.receivedAt,
        sourceMessageId: input.sourceMessageId ?? null,
        deduplicationKey
      }
    });

    await tx.alarm.update({
      where: { id: alarmId },
      data: { updatedAt: new Date() }
    });

    await tx.alarmStatistic.upsert({
      where: { alarmId },
      update: {
        stationCode: stationCode ?? detectedStationCode,
        lastMessageAt: input.receivedAt,
        messageCount: { increment: 1 }
      },
      create: {
        alarmId,
        stationCode: stationCode ?? detectedStationCode,
        openedAt: input.receivedAt,
        lastMessageAt: input.receivedAt,
        messageCount: 1
      }
    });

    return {
      created: true,
      id: messageId,
      alarmId,
      sequenceNumber,
      stationCode: stationCode ?? detectedStationCode
    };
  });

  if (result.created && result.stationCode) {
    await notifyStationFirefighters({
      alarmId: result.alarmId,
      messageId: result.id,
      sequenceNumber: result.sequenceNumber,
      rawMessage,
      stationCode: result.stationCode
    });
  }

  return result;
}

async function notifyStationFirefighters(input: {
  alarmId: string;
  messageId: string;
  sequenceNumber: number;
  rawMessage: string;
  stationCode: string;
}) {
  const firefighters = await prisma.user.findMany({
    where: {
      role: "BRANDFIGHTER",
      isActive: true,
      alarmStations: { has: input.stationCode }
    },
    select: { id: true }
  });

  const title =
    input.sequenceNumber === 1
      ? `🚨 Ny alarm (${input.stationCode})`
      : `🚨 Sending ${input.sequenceNumber} (${input.stationCode})`;
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
        stationCode: input.stationCode,
        recipientUserId: firefighter.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

export async function listRecentAlarms(limit = MAX_PUBLIC_ALARMS): Promise<AlarmFeedAlarm[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 1, 1), MAX_PUBLIC_ALARMS);
  const alarms = await prisma.alarm.findMany({
    orderBy: [{ openedAt: "desc" }, { createdAt: "desc" }],
    take: safeLimit,
    include: {
      messages: {
        orderBy: [{ receivedAt: "asc" }, { sequenceNumber: "asc" }],
        select: {
          id: true,
          alarmId: true,
          sequenceNumber: true,
          senderNumber: true,
          rawMessage: true,
          receivedAt: true
        }
      }
    }
  });

  return mapAlarms(alarms);
}

export async function listStoredAlarmsPage(
  requestedPage = 1,
  requestedPageSize = 25
): Promise<StoredAlarmPage> {
  const pageSize = Math.min(
    Math.max(Math.trunc(requestedPageSize) || 25, 1),
    MAX_ADMIN_PAGE_SIZE
  );
  const total = await prisma.alarm.count();
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const page = Math.min(Math.max(Math.trunc(requestedPage) || 1, 1), totalPages);
  const alarms = await prisma.alarm.findMany({
    orderBy: [{ openedAt: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: {
      messages: {
        orderBy: [{ receivedAt: "asc" }, { sequenceNumber: "asc" }],
        select: {
          id: true,
          alarmId: true,
          sequenceNumber: true,
          senderNumber: true,
          rawMessage: true,
          receivedAt: true
        }
      }
    }
  });

  return {
    alarms: mapAlarms(alarms),
    page,
    pageSize,
    total,
    totalPages
  };
}

function mapAlarms(
  alarms: Array<{
    id: string;
    status: "ACTIVE" | "CLOSED";
    senderNumber: string;
    stationCode: string | null;
    openedAt: Date;
    messages: AlarmFeedMessage[];
  }>
): AlarmFeedAlarm[] {
  return alarms.map((alarm) => ({
    id: alarm.id,
    status: alarm.status,
    senderNumber: alarm.senderNumber,
    stationCode: alarm.stationCode,
    openedAt: alarm.openedAt,
    messages: alarm.messages
  }));
}

function truncateForPush(value: string, maxLength: number) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length <= maxLength ? compact : `${compact.slice(0, maxLength - 1)}…`;
}

function normalizePhoneNumber(value: string) {
  return value.trim().replace(/[\s()-]/g, "");
}
