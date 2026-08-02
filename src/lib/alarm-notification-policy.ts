export function isAlarmFollowUpNotification(input: {
  type: string;
  title: string;
}) {
  return input.type === "ALARM_MESSAGE" && /^🚨 Sending \d+\b/.test(input.title);
}
