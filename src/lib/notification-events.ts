import type { ReturnRequest, ShiftTransfer, User } from "@prisma/client";
import { prisma } from "./prisma";
import { cancelFutureTransferNotifications, createNotifications } from "./notifications";

type BasicUser = Pick<User, "id" | "role">;

export async function notifyTransferCreated(transfer: ShiftTransfer) {
  const link = `/brandmand/anmodninger/${transfer.id}`;
  await createNotifications(prisma, [
    {
      recipientUserId: transfer.giverUserId,
      shiftTransferId: transfer.id,
      type: "TRANSFER_CREATED",
      title: "Vagtoverdragelse oprettet",
      body: `Vagtoverdragelsen er oprettet og afventer svar fra ${transfer.receiverNameSnapshot}.`,
      link,
      uniqueKey: `transfer:${transfer.id}:created:giver`
    },
    {
      recipientUserId: transfer.receiverUserId,
      shiftTransferId: transfer.id,
      type: "TRANSFER_CREATED",
      title: "Ny vagtoverdragelse",
      body: `${transfer.giverNameSnapshot} ønsker at overdrage vagten til dig.`,
      link,
      uniqueKey: `transfer:${transfer.id}:receiver-request:${transfer.receiverUserId}`
    }
  ]);
}

export async function notifyReceiverAccepted(transfer: ShiftTransfer) {
  const vcUsers = await prisma.user.findMany({ where: { role: "VC", isActive: true } });
  await createNotifications(prisma, [
    {
      recipientUserId: transfer.giverUserId,
      shiftTransferId: transfer.id,
      type: "TRANSFER_RECEIVER_ACCEPTED",
      title: "Modtager har accepteret",
      body: `${transfer.receiverNameSnapshot} har accepteret vagtoverdragelsen. Sagen afventer vagtcentralen.`,
      link: `/brandmand/anmodninger/${transfer.id}`,
      uniqueKey: `transfer:${transfer.id}:receiver-accepted:giver`
    },
    {
      recipientUserId: transfer.receiverUserId,
      shiftTransferId: transfer.id,
      type: "TRANSFER_RECEIVER_ACCEPTED",
      title: "Du har accepteret",
      body: "Du har accepteret vagtoverdragelsen. Sagen afventer vagtcentralen.",
      link: `/brandmand/anmodninger/${transfer.id}`,
      uniqueKey: `transfer:${transfer.id}:receiver-accepted:receiver`
    },
    ...vcUsers.map((vc) => ({
      recipientUserId: vc.id,
      shiftTransferId: transfer.id,
      type: "TRANSFER_RECEIVER_ACCEPTED" as const,
      title: "Ny sag til godkendelse",
      body: "Ny vagtoverdragelse afventer godkendelse.",
      link: `/vagtcentral/sager/${transfer.id}`,
      uniqueKey: `transfer:${transfer.id}:receiver-accepted:vc:${vc.id}`
    }))
  ]);
}

export async function notifyReceiverRejected(transfer: ShiftTransfer) {
  const reason = transfer.receiverResponseComment ? ` Begrundelse: ${transfer.receiverResponseComment}` : "";
  await createNotifications(prisma, [
    {
      recipientUserId: transfer.giverUserId,
      shiftTransferId: transfer.id,
      type: "TRANSFER_RECEIVER_REJECTED",
      title: "Modtager har afvist",
      body: `${transfer.receiverNameSnapshot} har afvist vagtoverdragelsen.${reason}`,
      link: `/brandmand/anmodninger/${transfer.id}`,
      uniqueKey: `transfer:${transfer.id}:receiver-rejected:giver`
    },
    {
      recipientUserId: transfer.receiverUserId,
      shiftTransferId: transfer.id,
      type: "TRANSFER_RECEIVER_REJECTED",
      title: "Du har afvist",
      body: "Du har afvist vagtoverdragelsen.",
      link: `/brandmand/anmodninger/${transfer.id}`,
      uniqueKey: `transfer:${transfer.id}:receiver-rejected:receiver`
    }
  ]);
}

export async function notifyVcTransferDecision(transfer: ShiftTransfer, vc: BasicUser, approved: boolean) {
  const title = approved ? "Vagtcentralen har godkendt" : "Vagtcentralen har afvist";
  const body = approved
    ? `Vagtcentralen har godkendt vagtoverdragelsen. ${transfer.receiverNameSnapshot} overtager fra ${transfer.giverNameSnapshot}.`
    : `Vagtcentralen har afvist vagtoverdragelsen.${transfer.vcComment ? ` Begrundelse: ${transfer.vcComment}` : ""}`;

  await createNotifications(prisma, [
    ...[transfer.giverUserId, transfer.receiverUserId].map((userId) => ({
      recipientUserId: userId,
      shiftTransferId: transfer.id,
      type: approved ? ("TRANSFER_VC_APPROVED" as const) : ("TRANSFER_VC_REJECTED" as const),
      title,
      body,
      link: `/brandmand/anmodninger/${transfer.id}`,
      uniqueKey: `transfer:${transfer.id}:vc-decision:${approved ? "approved" : "rejected"}:${userId}`
    })),
    {
      recipientUserId: vc.id,
      shiftTransferId: transfer.id,
      type: approved ? "TRANSFER_VC_APPROVED" : "TRANSFER_VC_REJECTED",
      title: approved ? "Godkendt af Vagtcentralen" : "Afvist af Vagtcentralen",
      body: approved ? "Vagtoverdragelsen er godkendt." : "Vagtoverdragelsen er afvist.",
      link: `/vagtcentral/sager/${transfer.id}`,
      uniqueKey: `transfer:${transfer.id}:vc-internal:${approved ? "approved" : "rejected"}:${vc.id}`
    }
  ]);

  if (approved) {
    await scheduleTransferReminders(transfer, vc.id);
  }
}

export async function scheduleTransferReminders(transfer: ShiftTransfer, vcUserId: string, now = new Date()) {
  const recipients = [transfer.giverUserId, transfer.receiverUserId, vcUserId];
  const startFor = transfer.requestedStartAt > now ? transfer.requestedStartAt : null;
  await createNotifications(
    prisma,
    recipients.map((recipientUserId) => ({
      recipientUserId,
      shiftTransferId: transfer.id,
      type: "TRANSFER_STARTED",
      title: "Vagtoverdragelsen er startet",
      body: `Vagtoverdragelsen er nu startet. ${transfer.receiverNameSnapshot} har overtaget vagten fra ${transfer.giverNameSnapshot}.`,
      link: recipientUserId === vcUserId ? `/vagtcentral/sager/${transfer.id}` : `/brandmand/anmodninger/${transfer.id}`,
      scheduledFor: startFor,
      publishNow: !startFor,
      uniqueKey: `transfer:${transfer.id}:start:${recipientUserId}`
    }))
  );

  if (shouldScheduleExpectedEndNotification(transfer)) {
    await createNotifications(
      prisma,
      recipients.map((recipientUserId) => ({
        recipientUserId,
        shiftTransferId: transfer.id,
        type: "TRANSFER_EXPECTED_END",
        title: "Forventet sluttid er nået",
        body: "Den forventede sluttid er nået. Vagtoverdragelsen fortsætter, indtil en tilbagelevering er accepteret og godkendt af vagtcentralen.",
        link: recipientUserId === vcUserId ? `/vagtcentral/sager/${transfer.id}` : `/brandmand/anmodninger/${transfer.id}`,
        scheduledFor: transfer.expectedEndAt,
        uniqueKey: `transfer:${transfer.id}:expected-end:${recipientUserId}`
      }))
    );
  }
}

export function shouldScheduleExpectedEndNotification(input: {
  expectedEndMode: "SPECIFIC_TIME" | "UNTIL_SHIFT_END";
  expectedEndAt: Date | null;
}) {
  return input.expectedEndMode === "SPECIFIC_TIME" && Boolean(input.expectedEndAt);
}

export async function notifyReturnCreated(transfer: ShiftTransfer, request: ReturnRequest) {
  await createNotifications(prisma, [
    {
      recipientUserId: transfer.giverUserId,
      shiftTransferId: transfer.id,
      returnRequestId: request.id,
      type: "RETURN_CREATED",
      title: "Ny tilbagelevering",
      body: `${transfer.receiverNameSnapshot} ønsker at tilbagelevere vagten til dig.`,
      link: `/brandmand/anmodninger/${transfer.id}`,
      uniqueKey: `return:${request.id}:created:original`
    },
    {
      recipientUserId: transfer.receiverUserId,
      shiftTransferId: transfer.id,
      returnRequestId: request.id,
      type: "RETURN_CREATED",
      title: "Tilbagelevering oprettet",
      body: "Tilbageleveringen er oprettet og afventer den oprindelige brandmand.",
      link: `/brandmand/anmodninger/${transfer.id}`,
      uniqueKey: `return:${request.id}:created:holder`
    }
  ]);
}

export async function notifyOriginalReturnResponse(transfer: ShiftTransfer, request: ReturnRequest, accepted: boolean) {
  const vcUsers = accepted ? await prisma.user.findMany({ where: { role: "VC", isActive: true } }) : [];
  const reason = !accepted && request.originalResponseComment ? ` Kommentar: ${request.originalResponseComment}` : "";
  await createNotifications(prisma, [
    {
      recipientUserId: transfer.receiverUserId,
      shiftTransferId: transfer.id,
      returnRequestId: request.id,
      type: accepted ? "RETURN_ORIGINAL_ACCEPTED" : "RETURN_ORIGINAL_REJECTED",
      title: accepted ? "Tilbagelevering accepteret" : "Tilbagelevering afvist",
      body: accepted
        ? `${transfer.giverNameSnapshot} har accepteret tilbageleveringen. Sagen afventer vagtcentralen.`
        : `${transfer.giverNameSnapshot} har afvist tilbageleveringen.${reason}`,
      link: `/brandmand/anmodninger/${transfer.id}`,
      uniqueKey: `return:${request.id}:original-response:holder`
    },
    {
      recipientUserId: transfer.giverUserId,
      shiftTransferId: transfer.id,
      returnRequestId: request.id,
      type: accepted ? "RETURN_ORIGINAL_ACCEPTED" : "RETURN_ORIGINAL_REJECTED",
      title: accepted ? "Du har accepteret tilbageleveringen" : "Du har afvist tilbageleveringen",
      body: accepted ? "Tilbageleveringen afventer vagtcentralen." : "Vagtoverdragelsen fortsætter.",
      link: `/brandmand/anmodninger/${transfer.id}`,
      uniqueKey: `return:${request.id}:original-response:original`
    },
    ...vcUsers.map((vc) => ({
      recipientUserId: vc.id,
      shiftTransferId: transfer.id,
      returnRequestId: request.id,
      type: "RETURN_ORIGINAL_ACCEPTED" as const,
      title: "Ny tilbagelevering til godkendelse",
      body: "Ny tilbagelevering afventer godkendelse.",
      link: `/vagtcentral/sager/${transfer.id}`,
      uniqueKey: `return:${request.id}:original-accepted:vc:${vc.id}`
    }))
  ]);
}

export async function notifyVcReturnDecision(transfer: ShiftTransfer, request: ReturnRequest, vc: BasicUser, approved: boolean) {
  const body = approved
    ? "Vagtcentralen har godkendt tilbageleveringen. Vagtoverdragelsen er afsluttet."
    : `Vagtcentralen har afvist tilbageleveringen. Den oprindelige vagtoverdragelse fortsætter.${request.vcComment ? ` Begrundelse: ${request.vcComment}` : ""}`;
  await createNotifications(prisma, [
    ...[transfer.giverUserId, transfer.receiverUserId].map((userId) => ({
      recipientUserId: userId,
      shiftTransferId: transfer.id,
      returnRequestId: request.id,
      type: approved ? ("RETURN_VC_APPROVED" as const) : ("RETURN_VC_REJECTED" as const),
      title: approved ? "Tilbagelevering godkendt" : "Tilbagelevering afvist af VC",
      body,
      link: `/brandmand/anmodninger/${transfer.id}`,
      uniqueKey: `return:${request.id}:vc-decision:${approved ? "approved" : "rejected"}:${userId}`
    })),
    {
      recipientUserId: vc.id,
      shiftTransferId: transfer.id,
      returnRequestId: request.id,
      type: approved ? "RETURN_VC_APPROVED" : "RETURN_VC_REJECTED",
      title: approved ? "Tilbagelevering godkendt" : "Tilbagelevering afvist",
      body: approved ? "Sagen er afsluttet." : "Vagtoverdragelsen fortsætter.",
      link: `/vagtcentral/sager/${transfer.id}`,
      uniqueKey: `return:${request.id}:vc-internal:${approved ? "approved" : "rejected"}:${vc.id}`
    }
  ]);

  if (approved) {
    await cancelFutureTransferNotifications(prisma, transfer.id);
  }
}
