import { prisma } from "./prisma";
import { STATIONS, stationLabel } from "./stations";

export const ALARM_STATISTICS_RESET_ACTION = "ALARM_STATISTICS_RESET";

export type AlarmStatisticRow = {
  alarmId: string;
  stationCode: string | null;
  openedAt: Date;
  lastMessageAt: Date;
  messageCount: number;
};

export type AlarmStatisticsBucket = {
  key: string;
  label: string;
  count: number;
};

export type AlarmStatisticsSummary = {
  totalAlarms: number;
  totalMessages: number;
  averageMessagesPerAlarm: number;
  islAlarms: number;
  ordinaryAlarms: number;
  unknownAlarms: number;
  busiestWeekday: AlarmStatisticsBucket | null;
  busiestHour: AlarmStatisticsBucket | null;
  byStation: AlarmStatisticsBucket[];
  byWeekday: AlarmStatisticsBucket[];
  byHour: AlarmStatisticsBucket[];
};

const WEEKDAYS = [
  { key: "1", label: "Mandag" },
  { key: "2", label: "Tirsdag" },
  { key: "3", label: "Onsdag" },
  { key: "4", label: "Torsdag" },
  { key: "5", label: "Fredag" },
  { key: "6", label: "Lørdag" },
  { key: "7", label: "Søndag" }
] as const;

const copenhagenDateParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Copenhagen",
  weekday: "short",
  hour: "2-digit",
  hourCycle: "h23"
});

const weekdayKeys: Record<string, string> = {
  Mon: "1",
  Tue: "2",
  Wed: "3",
  Thu: "4",
  Fri: "5",
  Sat: "6",
  Sun: "7"
};

export async function getAlarmStatisticsResetAt() {
  const latestReset = await prisma.auditLog.findFirst({
    where: { action: ALARM_STATISTICS_RESET_ACTION },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true }
  });

  return latestReset?.createdAt ?? null;
}

export async function loadAlarmStatisticsRows() {
  const resetAt = await getAlarmStatisticsResetAt();
  const rows = await prisma.alarmStatistic.findMany({
    where: resetAt ? { openedAt: { gte: resetAt } } : undefined,
    orderBy: { openedAt: "asc" },
    select: {
      alarmId: true,
      stationCode: true,
      openedAt: true,
      lastMessageAt: true,
      messageCount: true
    }
  });

  return { resetAt, rows };
}

export function summarizeAlarmStatistics(rows: AlarmStatisticRow[]): AlarmStatisticsSummary {
  const stationCounts = new Map<string, number>();
  const weekdayCounts = new Map<string, number>();
  const hourCounts = new Map<string, number>();

  for (const weekday of WEEKDAYS) {
    weekdayCounts.set(weekday.key, 0);
  }
  for (let hour = 0; hour < 24; hour += 1) {
    hourCounts.set(String(hour), 0);
  }

  let totalMessages = 0;
  let islAlarms = 0;
  let ordinaryAlarms = 0;
  let unknownAlarms = 0;

  for (const row of rows) {
    totalMessages += row.messageCount;

    if (row.stationCode === "ISL") {
      islAlarms += 1;
    } else if (row.stationCode) {
      ordinaryAlarms += 1;
    } else {
      unknownAlarms += 1;
    }

    const stationKey = row.stationCode ?? "UNKNOWN";
    stationCounts.set(stationKey, (stationCounts.get(stationKey) ?? 0) + 1);

    const parts = Object.fromEntries(
      copenhagenDateParts.formatToParts(row.openedAt).map((part) => [part.type, part.value])
    );
    const weekdayKey = weekdayKeys[parts.weekday] ?? "1";
    const hourKey = String(Number(parts.hour));
    weekdayCounts.set(weekdayKey, (weekdayCounts.get(weekdayKey) ?? 0) + 1);
    hourCounts.set(hourKey, (hourCounts.get(hourKey) ?? 0) + 1);
  }

  const stationOrder = [
    ...STATIONS.map((station) => station.code),
    ...[...stationCounts.keys()].filter(
      (key) => key !== "UNKNOWN" && !STATIONS.some((station) => station.code === key)
    ),
    "UNKNOWN"
  ];
  const byStation = stationOrder
    .filter((key, index, all) => all.indexOf(key) === index)
    .map((key) => ({
      key,
      label: key === "UNKNOWN" ? "Ukendt station" : stationLabel(key),
      count: stationCounts.get(key) ?? 0
    }));

  const byWeekday = WEEKDAYS.map((weekday) => ({
    key: weekday.key,
    label: weekday.label,
    count: weekdayCounts.get(weekday.key) ?? 0
  }));

  const byHour = Array.from({ length: 24 }, (_, hour) => ({
    key: String(hour),
    label: `${String(hour).padStart(2, "0")}:00–${String((hour + 1) % 24).padStart(2, "0")}:00`,
    count: hourCounts.get(String(hour)) ?? 0
  }));

  return {
    totalAlarms: rows.length,
    totalMessages,
    averageMessagesPerAlarm: rows.length === 0 ? 0 : totalMessages / rows.length,
    islAlarms,
    ordinaryAlarms,
    unknownAlarms,
    busiestWeekday: maxBucket(byWeekday),
    busiestHour: maxBucket(byHour),
    byStation,
    byWeekday,
    byHour
  };
}

export function alarmStatisticsCsv(rows: AlarmStatisticRow[]) {
  const header = [
    "Alarm-id",
    "Station",
    "Åbnet",
    "Seneste sending",
    "Antal sendinger"
  ];
  const lines = rows.map((row) => [
    row.alarmId,
    row.stationCode ?? "Ukendt",
    row.openedAt.toISOString(),
    row.lastMessageAt.toISOString(),
    String(row.messageCount)
  ]);

  return [header, ...lines].map((line) => line.map(csvCell).join(";")).join("\r\n");
}

function maxBucket(buckets: AlarmStatisticsBucket[]) {
  if (buckets.length === 0) return null;
  const winner = buckets.reduce((highest, current) =>
    current.count > highest.count ? current : highest
  );
  return winner.count > 0 ? winner : null;
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
