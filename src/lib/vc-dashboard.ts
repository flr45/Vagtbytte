import type { NotificationType, TransferStatus } from "@prisma/client";

export type VcTaskKind = "TRANSFER" | "RETURN" | "EXPECTED_END" | "ACTIVATION" | "RETURN_EXECUTION";
export type VcPriority = "green" | "yellow" | "red" | "critical";

export type VcDashboardTask = {
  id: string;
  kind: VcTaskKind;
  transferId: string;
  returnRequestId?: string;
  transferNumber: string;
  status: TransferStatus;
  deadlineAt: Date | null;
  awaitingSince: Date | null;
};

export type VcDashboardStatus = {
  priority: VcPriority;
  taskCount: number;
  text: string;
  livePrefix: string;
  ariaLive: "off" | "polite" | "assertive";
};

const minute = 60 * 1000;

export function getVcTaskDeadline(task: Pick<VcDashboardTask, "kind" | "deadlineAt">) {
  return task.deadlineAt;
}

export function sortVcTasksByDeadline<T extends Pick<VcDashboardTask, "deadlineAt" | "awaitingSince">>(
  tasks: T[],
  now = new Date()
) {
  return [...tasks].sort((a, b) => {
    const aTime = a.deadlineAt?.getTime() ?? now.getTime();
    const bTime = b.deadlineAt?.getTime() ?? now.getTime();
    if (aTime !== bTime) {
      return aTime - bTime;
    }
    return (a.awaitingSince?.getTime() ?? 0) - (b.awaitingSince?.getTime() ?? 0);
  });
}

export function getVcPriority(deadlineAt: Date | null, now = new Date()): VcPriority {
  if (!deadlineAt) {
    return "critical";
  }

  const msRemaining = deadlineAt.getTime() - now.getTime();
  if (msRemaining <= minute) {
    return "critical";
  }
  if (msRemaining <= 5 * minute) {
    return "red";
  }
  return "yellow";
}

export function getVcDashboardStatus(tasks: VcDashboardTask[], now = new Date()): VcDashboardStatus {
  const actionableTasks = tasks.filter(
    (task) =>
      task.kind === "EXPECTED_END" ||
      task.kind === "ACTIVATION" ||
      task.kind === "RETURN_EXECUTION" ||
      ["RECEIVER_ACCEPTED_AWAITING_VC", "RETURN_ACCEPTED_AWAITING_VC"].includes(task.status)
  );

  if (actionableTasks.length === 0) {
    return {
      priority: "green",
      taskCount: 0,
      text: "Alle opgaver er ajour",
      livePrefix: "",
      ariaLive: "off"
    };
  }

  const [nextTask] = sortVcTasksByDeadline(actionableTasks, now);
  const priority = getVcPriority(getVcTaskDeadline(nextTask), now);

  if (priority === "critical") {
    return {
      priority,
      taskCount: actionableTasks.length,
      text: "HASTER - opgave kræver handling nu",
      livePrefix: "",
      ariaLive: "assertive"
    };
  }

  if (priority === "red") {
    return {
      priority,
      taskCount: actionableTasks.length,
      text: "Opgave kræver handling",
      livePrefix: "inden for",
      ariaLive: "assertive"
    };
  }

  return {
    priority,
    taskCount: actionableTasks.length,
    text: `${actionableTasks.length} opgave${actionableTasks.length === 1 ? "" : "r"} afventer`,
    livePrefix: "næste opgave om",
    ariaLive: "polite"
  };
}

export function formatCountdown(deadlineAt: Date | null, now = new Date()) {
  if (!deadlineAt) {
    return "Kræver handling nu";
  }

  const diff = deadlineAt.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const totalSeconds = Math.max(0, Math.floor(abs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  let text: string;
  if (minutes > 0 && seconds > 0 && minutes < 5) {
    text = `${minutes} minut${minutes === 1 ? "" : "ter"} og ${seconds} sekund${seconds === 1 ? "" : "er"}`;
  } else if (minutes > 0) {
    text = `${minutes} minut${minutes === 1 ? "" : "ter"}`;
  } else {
    text = `${seconds} sekund${seconds === 1 ? "" : "er"}`;
  }

  return diff < 0 ? `Overskredet med ${text}` : `Om ${text}`;
}

export function priorityLabel(priority: VcPriority, deadlineAt: Date | null, now = new Date()) {
  if (deadlineAt && deadlineAt.getTime() < now.getTime()) {
    return "Tidsfrist overskredet";
  }
  if (priority === "critical") {
    return "Kræver handling nu";
  }
  if (priority === "red") {
    return "Haster";
  }
  if (priority === "yellow") {
    return "Afventer";
  }
  return "Ajour";
}

export function notificationTypeLabel(type: NotificationType) {
  const labels: Record<NotificationType, string> = {
    TRANSFER_CREATED: "Ny vagtoverdragelse",
    TRANSFER_RECEIVER_ACCEPTED: "Accepteret af modtager",
    TRANSFER_RECEIVER_REJECTED: "Afvist af modtager",
    TRANSFER_VC_APPROVED: "Godkendt af vagtcentralen",
    TRANSFER_VC_REJECTED: "Afvist af vagtcentralen",
    TRANSFER_STARTED: "Starttidspunkt nærmer sig",
    TRANSFER_ACTIVATION_REMINDER: "Vagtskifte skal bekræftes",
    TRANSFER_ACTIVATED: "Vagtskifte gennemført",
    TRANSFER_EXPECTED_END: "Forventet sluttid nået",
    TRANSFER_CANCELLED: "Vagtoverdragelse annulleret",
    RETURN_CREATED: "Ny tilbagelevering",
    RETURN_ORIGINAL_ACCEPTED: "Tilbagelevering accepteret",
    RETURN_ORIGINAL_REJECTED: "Tilbagelevering afvist",
    RETURN_VC_APPROVED: "Tilbagelevering godkendt",
    RETURN_VC_REJECTED: "Tilbagelevering afvist af vagtcentralen",
    RETURN_EXECUTION_REMINDER: "Tilbagelevering skal bekræftes",
    RETURN_COMPLETED: "Tilbagelevering gennemført",
    TEST: "Testnotifikation"
  };

  return labels[type];
}

export function hasValidCaseLink(link: string | null | undefined) {
  return Boolean(link && /^\/(brandmand\/anmodninger|vagtcentral\/sager)\/[A-Za-z0-9_-]+$/.test(link));
}
