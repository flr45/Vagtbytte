export function shouldScheduleExpectedEndNotification(input: {
  expectedEndMode: "SPECIFIC_TIME" | "UNTIL_SHIFT_END";
  expectedEndAt: Date | null;
}) {
  return input.expectedEndMode === "SPECIFIC_TIME" && Boolean(input.expectedEndAt);
}
