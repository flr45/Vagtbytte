export function shouldScheduleExpectedEndNotification(input: {
  expectedEndMode: "SPECIFIC_TIME" | "UNTIL_SHIFT_END";
  expectedEndAt: Date | null;
}) {
  return input.expectedEndMode === "SPECIFIC_TIME" && Boolean(input.expectedEndAt);
}

type ActivationReminderTransfer = {
  id: string;
  requestedStartAt: Date;
};

type ReturnExecutionReminderTransfer = {
  id: string;
  expectedEndAt?: Date | null;
};

type ReturnExecutionReminderRequest = {
  id: string;
  requestedReturnAt: Date;
};

function operationalReminderTimes(targetAt: Date, now: Date) {
  const fiveMinutesBefore = new Date(targetAt.getTime() - 5 * 60 * 1000);
  if (targetAt <= now) {
    return [{ suffix: "due", scheduledFor: null, publishNow: true }];
  }
  if (fiveMinutesBefore <= now) {
    return [{ suffix: "soon", scheduledFor: null, publishNow: true }];
  }
  return [
    { suffix: "five-minutes", scheduledFor: fiveMinutesBefore, publishNow: false },
    { suffix: "due", scheduledFor: targetAt, publishNow: false }
  ];
}

export function transferActivationReminderInputs(
  transfer: ActivationReminderTransfer,
  vcUserId: string,
  now = new Date()
) {
  return operationalReminderTimes(transfer.requestedStartAt, now).map((reminder) => ({
    recipientUserId: vcUserId,
    shiftTransferId: transfer.id,
    type: "TRANSFER_ACTIVATION_REMINDER" as const,
    title: reminder.suffix === "due" ? "Vagtskifte kræver handling nu" : "Vagtskifte skal snart udføres",
    body: "Bekræft vagtskiftet, når det er udført.",
    link: `/vagtcentral/sager/${transfer.id}`,
    scheduledFor: reminder.scheduledFor,
    publishNow: reminder.publishNow,
    uniqueKey: `transfer:${transfer.id}:activation-reminder:${reminder.suffix}:${vcUserId}`
  }));
}

export function returnExecutionReminderInputs(
  transfer: ReturnExecutionReminderTransfer,
  request: ReturnExecutionReminderRequest,
  vcUserId: string,
  now = new Date()
) {
  return operationalReminderTimes(request.requestedReturnAt, now).map((reminder) => ({
    recipientUserId: vcUserId,
    shiftTransferId: transfer.id,
    returnRequestId: request.id,
    type: "RETURN_EXECUTION_REMINDER" as const,
    title: reminder.suffix === "due" ? "Tilbagelevering kræver handling nu" : "Tilbagelevering skal snart udføres",
    body: "Bekræft tilbageleveringen, når den er udført.",
    link: `/vagtcentral/sager/${transfer.id}`,
    scheduledFor: reminder.scheduledFor,
    publishNow: reminder.publishNow,
    uniqueKey: `return:${request.id}:execution-reminder:${reminder.suffix}:${vcUserId}`
  }));
}

export function expectedReturnExecutionReminderInputs(
  transfer: ReturnExecutionReminderTransfer,
  vcUserId: string,
  now = new Date()
) {
  if (!transfer.expectedEndAt) {
    return [];
  }

  return operationalReminderTimes(transfer.expectedEndAt, now).map((reminder) => ({
    recipientUserId: vcUserId,
    shiftTransferId: transfer.id,
    type: "RETURN_EXECUTION_REMINDER" as const,
    title: reminder.suffix === "due" ? "Tilbagelevering kræver handling nu" : "Tilbagelevering skal snart udføres",
    body: "Bekræft tilbageleveringen, når vagten er tilbageleveret.",
    link: `/vagtcentral/sager/${transfer.id}`,
    scheduledFor: reminder.scheduledFor,
    publishNow: reminder.publishNow,
    uniqueKey: `transfer:${transfer.id}:expected-return-reminder:${reminder.suffix}:${vcUserId}`
  }));
}
