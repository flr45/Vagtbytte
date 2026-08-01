import { sendMail, smtpConfigured } from "./smtp-client.mjs";

const MAX_ROWS_PER_SECTION = 200;
const RETRY_DELAY_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 3;

export async function processDueEmailReports(prisma, now = new Date()) {
  const schedules = await prisma.emailReportSchedule.findMany({
    where: { enabled: true }
  });
  let sent = 0;
  let failed = 0;

  for (const schedule of schedules) {
    if (!isScheduleDue(schedule, now)) continue;
    const result = await deliverSchedule(prisma, schedule, now, false);
    if (result.sent) sent += 1;
    if (result.failed) failed += 1;
  }

  return { sent, failed };
}

export async function sendEmailReportNow(prisma, scheduleId, now = new Date()) {
  const schedule = await prisma.emailReportSchedule.findUnique({ where: { id: scheduleId } });
  if (!schedule) throw new Error("Mailrapporten blev ikke fundet.");
  return deliverSchedule(prisma, schedule, now, true);
}

export function emailReportEnvironmentStatus(env = process.env) {
  return {
    configured: smtpConfigured(env),
    host: env.SMTP_HOST || null,
    from: env.SMTP_FROM || null
  };
}

async function deliverSchedule(prisma, schedule, now, manual) {
  const recipients = normalizeRecipients(schedule.recipients);
  if (recipients.length === 0) {
    await prisma.emailReportSchedule.update({
      where: { id: schedule.id },
      data: { lastAttemptAt: now, lastError: "Der er ikke angivet nogen modtagere." }
    });
    return { sent: false, failed: true, error: "Der er ikke angivet nogen modtagere." };
  }
  if (!smtpConfigured()) {
    const error = "SMTP er ikke konfigureret på serveren.";
    await prisma.emailReportSchedule.update({
      where: { id: schedule.id },
      data: { lastAttemptAt: now, lastError: error }
    });
    return { sent: false, failed: true, error };
  }

  const local = localParts(now, schedule.timezone);
  const dateKey = `${local.year}-${local.month}-${local.day}`;
  const uniqueKey = manual
    ? `${schedule.id}:manual:${now.toISOString()}`
    : `${schedule.id}:scheduled:${dateKey}`;
  const existing = await prisma.emailReportDelivery.findUnique({ where: { uniqueKey } });

  if (existing?.status === "SENT") {
    return { sent: false, failed: false, skipped: "already-sent" };
  }
  if (
    existing?.status === "FAILED" &&
    (existing.attemptCount >= MAX_ATTEMPTS ||
      (existing.lastAttemptAt && now.getTime() - existing.lastAttemptAt.getTime() < RETRY_DELAY_MS))
  ) {
    return { sent: false, failed: false, skipped: "retry-wait" };
  }

  const periodStart = schedule.lastSentAt ?? startOfLocalMonth(now, schedule.timezone);
  const periodEnd = now;
  const delivery = await prisma.emailReportDelivery.upsert({
    where: { uniqueKey },
    update: {
      status: "PENDING",
      periodStart,
      periodEnd,
      recipientCount: recipients.length,
      attemptCount: { increment: 1 },
      lastAttemptAt: now,
      errorMessage: null
    },
    create: {
      scheduleId: schedule.id,
      uniqueKey,
      status: "PENDING",
      periodStart,
      periodEnd,
      recipientCount: recipients.length,
      attemptCount: 1,
      lastAttemptAt: now
    }
  });

  await prisma.emailReportSchedule.update({
    where: { id: schedule.id },
    data: { lastAttemptAt: now, lastError: null }
  });

  try {
    const report = await buildReport(prisma, periodStart, periodEnd, schedule.timezone);
    const message = renderReport(report, schedule, periodStart, periodEnd);
    const sendResult = await sendMail({
      to: recipients,
      subject: message.subject,
      text: message.text,
      html: message.html
    });

    await prisma.$transaction([
      prisma.emailReportDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "SENT",
          sentAt: now,
          errorMessage: null
        }
      }),
      prisma.emailReportSchedule.update({
        where: { id: schedule.id },
        data: {
          lastSentAt: now,
          lastAttemptAt: now,
          lastError: null
        }
      }),
      prisma.auditLog.create({
        data: {
          action: manual ? "EMAIL_REPORT_SENT_MANUALLY" : "EMAIL_REPORT_SENT",
          description: `${schedule.name} blev sendt til ${recipients.length} modtager(e) for perioden ${periodStart.toISOString()} til ${periodEnd.toISOString()}`
        }
      })
    ]);

    return { sent: true, failed: false, messageId: sendResult.messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.$transaction([
      prisma.emailReportDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "FAILED",
          errorMessage: message,
          lastAttemptAt: now
        }
      }),
      prisma.emailReportSchedule.update({
        where: { id: schedule.id },
        data: {
          lastAttemptAt: now,
          lastError: message
        }
      }),
      prisma.auditLog.create({
        data: {
          action: "EMAIL_REPORT_FAILED",
          description: `${schedule.name} kunne ikke sendes: ${message}`
        }
      })
    ]);
    return { sent: false, failed: true, error: message };
  }
}

async function buildReport(prisma, periodStart, periodEnd, timeZone) {
  const transferWhere = { createdAt: { gte: periodStart, lte: periodEnd } };
  const assignmentWhere = { assignedAt: { gte: periodStart, lte: periodEnd } };
  const removalWhere = {
    action: "AVAILABILITY_ASSIGNMENT_REMOVED",
    createdAt: { gte: periodStart, lte: periodEnd }
  };
  const [
    transferCount,
    transfers,
    assignmentCount,
    assignments,
    removalCount,
    removals
  ] = await Promise.all([
    prisma.shiftTransfer.count({ where: transferWhere }),
    prisma.shiftTransfer.findMany({
      where: transferWhere,
      orderBy: { createdAt: "asc" },
      take: MAX_ROWS_PER_SECTION,
      select: {
        transferNumber: true,
        giverNameSnapshot: true,
        giverEmployeeNumberSnapshot: true,
        receiverNameSnapshot: true,
        receiverEmployeeNumberSnapshot: true,
        requestedStartAt: true,
        expectedEndAt: true,
        calculatedShiftEndAt: true,
        status: true,
        createdAt: true
      }
    }),
    prisma.availability.count({ where: assignmentWhere }),
    prisma.availability.findMany({
      where: assignmentWhere,
      orderBy: { assignedAt: "asc" },
      take: MAX_ROWS_PER_SECTION,
      select: {
        assignedAt: true,
        assignedShiftStart: true,
        assignedShiftEnd: true,
        status: true,
        user: { select: { name: true, employeeNumber: true, stationCode: true } }
      }
    }),
    prisma.auditLog.count({ where: removalWhere }),
    prisma.auditLog.findMany({
      where: removalWhere,
      orderBy: { createdAt: "asc" },
      take: MAX_ROWS_PER_SECTION,
      select: {
        createdAt: true,
        description: true,
        target: { select: { name: true, employeeNumber: true } },
        actor: { select: { name: true } }
      }
    })
  ]);

  return {
    timeZone,
    transferCount,
    transfers,
    assignmentCount,
    assignments,
    removalCount,
    removals
  };
}

function renderReport(report, schedule, periodStart, periodEnd) {
  const format = (date) => formatDateTime(date, report.timeZone);
  const periodLabel = `${format(periodStart)} – ${format(periodEnd)}`;
  const subject = `Vagtbytte – samlet vagtoversigt ${formatDate(periodStart, report.timeZone)}–${formatDate(periodEnd, report.timeZone)}`;
  const textLines = [
    schedule.name,
    `Periode: ${periodLabel}`,
    "",
    `Vagtbytter: ${report.transferCount}`,
    ...report.transfers.map(
      (transfer) =>
        `${transfer.transferNumber}: ${transfer.giverNameSnapshot} (${transfer.giverEmployeeNumberSnapshot}) → ${transfer.receiverNameSnapshot} (${transfer.receiverEmployeeNumberSnapshot}), start ${format(transfer.requestedStartAt)}, status ${transferStatusLabel(transfer.status)}`
    ),
    "",
    `Tildelte vagter: ${report.assignmentCount}`,
    ...report.assignments.map(
      (assignment) =>
        `${assignment.user.name} (${assignment.user.employeeNumber ?? "uden nr."}), tildelt ${assignment.assignedAt ? format(assignment.assignedAt) : "ukendt"}, vagt ${assignment.assignedShiftStart ? format(assignment.assignedShiftStart) : "ukendt"} → ${assignment.assignedShiftEnd ? format(assignment.assignedShiftEnd) : "ukendt"}`
    ),
    "",
    `Fjernede tildelinger: ${report.removalCount}`,
    ...report.removals.map(
      (removal) =>
        `${removal.target?.name ?? "Ukendt"} (${removal.target?.employeeNumber ?? "uden nr."}), fjernet ${format(removal.createdAt)} af ${removal.actor?.name ?? "systemet"}`
    )
  ];

  const html = `<!doctype html>
<html lang="da">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#f4f5f6;color:#171717;font-family:Arial,sans-serif">
  <div style="max-width:900px;margin:0 auto;padding:24px">
    <div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #e4e4e7">
      <p style="margin:0;color:#b42318;font-weight:700;text-transform:uppercase;font-size:12px">Vagtbytte</p>
      <h1 style="margin:8px 0 0;font-size:28px">${escapeHtml(schedule.name)}</h1>
      <p style="color:#52525b;font-weight:600">Periode: ${escapeHtml(periodLabel)}</p>
      ${summaryCards(report)}
      ${reportSection(
        "Vagtbytter",
        report.transferCount,
        report.transfers.map((transfer) => [
          transfer.transferNumber,
          `${transfer.giverNameSnapshot} (${transfer.giverEmployeeNumberSnapshot})`,
          `${transfer.receiverNameSnapshot} (${transfer.receiverEmployeeNumberSnapshot})`,
          format(transfer.requestedStartAt),
          transferStatusLabel(transfer.status)
        ]),
        ["Nummer", "Fra", "Til", "Start", "Status"]
      )}
      ${reportSection(
        "Tildelte vagter",
        report.assignmentCount,
        report.assignments.map((assignment) => [
          `${assignment.user.name} (${assignment.user.employeeNumber ?? "uden nr."})`,
          assignment.user.stationCode ?? "Ukendt",
          assignment.assignedAt ? format(assignment.assignedAt) : "Ukendt",
          assignment.assignedShiftStart ? format(assignment.assignedShiftStart) : "Ukendt",
          assignment.assignedShiftEnd ? format(assignment.assignedShiftEnd) : "Ukendt"
        ]),
        ["Medarbejder", "Station", "Tildelt", "Vagtstart", "Vagtslut"]
      )}
      ${reportSection(
        "Fjernede tildelinger",
        report.removalCount,
        report.removals.map((removal) => [
          `${removal.target?.name ?? "Ukendt"} (${removal.target?.employeeNumber ?? "uden nr."})`,
          format(removal.createdAt),
          removal.actor?.name ?? "Systemet"
        ]),
        ["Medarbejder", "Fjernet", "Udført af"]
      )}
      <p style="margin-top:24px;color:#71717a;font-size:12px">Rapporten er genereret automatisk af Vagtbytte.</p>
    </div>
  </div>
</body>
</html>`;

  return { subject, text: textLines.join("\n"), html };
}

function summaryCards(report) {
  const cards = [
    ["Vagtbytter", report.transferCount],
    ["Tildelte vagter", report.assignmentCount],
    ["Fjernede tildelinger", report.removalCount]
  ];
  return `<div style="display:flex;flex-wrap:wrap;gap:12px;margin:24px 0">${cards
    .map(
      ([label, count]) =>
        `<div style="min-width:150px;background:#f4f4f5;border-radius:12px;padding:16px"><div style="font-size:12px;color:#71717a;font-weight:700">${escapeHtml(String(label))}</div><div style="font-size:28px;font-weight:800;margin-top:4px">${count}</div></div>`
    )
    .join("")}</div>`;
}

function reportSection(title, total, rows, headers) {
  const truncated = total > rows.length;
  const table = rows.length
    ? `<div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;font-size:13px"><thead><tr>${headers
        .map((header) => `<th style="text-align:left;padding:10px;border-bottom:2px solid #e4e4e7">${escapeHtml(header)}</th>`)
        .join("")}</tr></thead><tbody>${rows
        .map(
          (row) =>
            `<tr>${row
              .map((cell) => `<td style="padding:10px;border-bottom:1px solid #e4e4e7;vertical-align:top">${escapeHtml(String(cell))}</td>`)
              .join("")}</tr>`
        )
        .join("")}</tbody></table></div>`
    : `<p style="color:#71717a">Ingen registreringer i perioden.</p>`;
  return `<section style="margin-top:28px"><h2 style="font-size:20px;margin-bottom:8px">${escapeHtml(title)} (${total})</h2>${table}${truncated ? `<p style="color:#71717a;font-size:12px">Viser de første ${rows.length} poster.</p>` : ""}</section>`;
}

function isScheduleDue(schedule, now) {
  if (!schedule.enabled || !Array.isArray(schedule.daysOfMonth) || schedule.daysOfMonth.length === 0) {
    return false;
  }
  const parts = localParts(now, schedule.timezone);
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const effectiveDays = new Set(
    schedule.daysOfMonth
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 31)
      .map((value) => Math.min(value, lastDay))
  );
  const timeReached = hour > schedule.sendHour || (hour === schedule.sendHour && minute >= schedule.sendMinute);
  return effectiveDays.has(day) && timeReached;
}

function startOfLocalMonth(date, timeZone) {
  const parts = localParts(date, timeZone);
  return zonedDateToUtc(
    Number(parts.year),
    Number(parts.month),
    1,
    0,
    0,
    timeZone
  );
}

function zonedDateToUtc(year, month, day, hour, minute, timeZone) {
  let candidate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = localParts(candidate, timeZone);
    const actualUtc = Date.UTC(
      Number(actual.year),
      Number(actual.month) - 1,
      Number(actual.day),
      Number(actual.hour),
      Number(actual.minute),
      0
    );
    const desiredUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
    candidate = new Date(candidate.getTime() + (desiredUtc - actualUtc));
  }
  return candidate;
}

function localParts(date, timeZone) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );
}

function normalizeRecipients(values) {
  return [...new Set((values || []).map((value) => String(value).trim().toLowerCase()).filter(isEmail))];
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function formatDateTime(date, timeZone) {
  return new Intl.DateTimeFormat("da-DK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone
  }).format(date);
}

function formatDate(date, timeZone) {
  return new Intl.DateTimeFormat("da-DK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone
  }).format(date);
}

function transferStatusLabel(status) {
  const labels = {
    AWAITING_RECEIVER: "Afventer modtager",
    RECEIVER_ACCEPTED_AWAITING_VC: "Afventer VC",
    RECEIVER_REJECTED: "Afvist af modtager",
    VC_REJECTED: "Afvist af VC",
    VC_APPROVED_AWAITING_ACTIVATION: "Godkendt – afventer start",
    VC_APPROVED_ACTIVE: "Aktiv",
    RETURN_AWAITING_ORIGINAL: "Afventer tilbagelevering",
    RETURN_ACCEPTED_AWAITING_VC: "Tilbagelevering afventer VC",
    RETURN_APPROVED_AWAITING_EXECUTION: "Tilbagelevering godkendt",
    COMPLETED: "Afsluttet",
    CANCELLED: "Annulleret"
  };
  return labels[status] || status;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
