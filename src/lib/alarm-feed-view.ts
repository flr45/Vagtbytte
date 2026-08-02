import { detectStationCode, type AlarmFeedAlarm, type AlarmFeedMessage } from "@/lib/alarm-feed";

const DISPLAY_GROUP_WINDOW_MS = 5 * 60 * 1000;

export type AlarmFeedDisplayAlarm = AlarmFeedAlarm & {
  sourceAlarmIds: string[];
};

export function groupAlarmFeedForDisplay(
  alarms: AlarmFeedAlarm[],
  groupWindowMs = DISPLAY_GROUP_WINDOW_MS
): AlarmFeedDisplayAlarm[] {
  const ordered = [...alarms].sort(compareAlarmsNewestFirst);
  const groups: AlarmFeedDisplayAlarm[] = [];
  const followUpOnly: AlarmFeedAlarm[] = [];

  for (const alarm of ordered) {
    if (hasAlarmStartMessage(alarm)) {
      groups.push(toDisplayAlarm(alarm));
    } else {
      followUpOnly.push(alarm);
    }
  }

  for (const alarm of followUpOnly) {
    const matchingGroup = findClosestAlarmGroup(alarm, groups, groupWindowMs);

    if (!matchingGroup) {
      groups.push(toDisplayAlarm(alarm));
      continue;
    }

    matchingGroup.sourceAlarmIds.push(alarm.id);
    matchingGroup.messages.push(...alarm.messages);
    matchingGroup.status =
      matchingGroup.status === "ACTIVE" || alarm.status === "ACTIVE" ? "ACTIVE" : "CLOSED";
  }

  return groups
    .map((alarm) => {
      const messages = orderMessagesByImportance(alarm.messages).map((message, index) => ({
        ...message,
        sequenceNumber: index + 1
      }));
      const alarmStart = messages.find((message) => detectStationCode(message.rawMessage) !== null);

      return {
        ...alarm,
        openedAt: alarmStart?.receivedAt ?? alarm.openedAt,
        messages,
        sourceAlarmIds: [...new Set(alarm.sourceAlarmIds)]
      };
    })
    .sort(compareAlarmsNewestFirst);
}

export function orderMessagesByImportance(messages: AlarmFeedMessage[]) {
  return [...messages].sort((left, right) => {
    const leftIsStart = detectStationCode(left.rawMessage) !== null;
    const rightIsStart = detectStationCode(right.rawMessage) !== null;

    if (leftIsStart !== rightIsStart) {
      return leftIsStart ? -1 : 1;
    }

    const timeDifference = left.receivedAt.getTime() - right.receivedAt.getTime();
    if (timeDifference !== 0) return timeDifference;

    const sequenceDifference = left.sequenceNumber - right.sequenceNumber;
    if (sequenceDifference !== 0) return sequenceDifference;

    return left.id.localeCompare(right.id);
  });
}

function toDisplayAlarm(alarm: AlarmFeedAlarm): AlarmFeedDisplayAlarm {
  return {
    ...alarm,
    messages: [...alarm.messages],
    sourceAlarmIds: [alarm.id]
  };
}

function hasAlarmStartMessage(alarm: AlarmFeedAlarm) {
  return alarm.messages.some((message) => detectStationCode(message.rawMessage) !== null);
}

function findClosestAlarmGroup(
  alarm: AlarmFeedAlarm,
  groups: AlarmFeedDisplayAlarm[],
  groupWindowMs: number
) {
  if (!alarm.stationCode) return null;

  return groups
    .filter(
      (group) =>
        group.stationCode === alarm.stationCode &&
        hasAlarmStartMessage(group) &&
        Math.abs(group.openedAt.getTime() - alarm.openedAt.getTime()) <= groupWindowMs
    )
    .sort(
      (left, right) =>
        Math.abs(left.openedAt.getTime() - alarm.openedAt.getTime()) -
        Math.abs(right.openedAt.getTime() - alarm.openedAt.getTime())
    )[0] ?? null;
}

function compareAlarmsNewestFirst(left: AlarmFeedAlarm, right: AlarmFeedAlarm) {
  return right.openedAt.getTime() - left.openedAt.getTime();
}
