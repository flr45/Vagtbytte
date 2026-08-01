const MONITOR_ACTIONS = [
  "SMS_GATEWAY_ONLINE",
  "SMS_GATEWAY_DEGRADED",
  "SMS_GATEWAY_OFFLINE"
];
const MODEM_STALE_AFTER_MS = 2 * 60 * 1000;

export async function monitorSmsGateway(prisma, now = new Date()) {
  const healthUrl =
    process.env.SMS_GATEWAY_HEALTH_URL?.trim() || "http://sms-gateway:8080/health";
  const health = await readGatewayHealth(healthUrl, now);
  const action = `SMS_GATEWAY_${health.state}`;
  const previous = await prisma.auditLog.findFirst({
    where: { action: { in: MONITOR_ACTIONS } },
    orderBy: { createdAt: "desc" },
    select: { action: true }
  });

  if (previous?.action === action) {
    return { changed: false, state: health.state };
  }

  const description = statusDescription(health);
  const event = await prisma.auditLog.create({
    data: { action, description }
  });

  const recipients = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [{ role: "ADMIN" }, { hasAdminAccess: true }]
    },
    select: { id: true }
  });

  if (health.state !== "ONLINE" || previous) {
    await prisma.notification.createMany({
      data: recipients.map((recipient) => ({
        recipientUserId: recipient.id,
        type: "TEST",
        title:
          health.state === "ONLINE"
            ? "SMS-modemmet er online igen"
            : health.state === "DEGRADED"
              ? "SMS-systemet kræver opmærksomhed"
              : "SMS-modemmet er offline",
        body: description,
        link: "/admin/systemstatus",
        scheduledFor: now,
        uniqueKey: `system:sms-gateway:${event.id}:${recipient.id}`
      })),
      skipDuplicates: true
    });
  }

  return { changed: true, state: health.state };
}

async function readGatewayHealth(url, now) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const modem = payload?.modem ?? {};
    const updatedAt = parseDate(modem.updated_at);
    const stale = !updatedAt || now.getTime() - updatedAt.getTime() > MODEM_STALE_AFTER_MS;
    const modemState = String(modem.state ?? "unknown").toLowerCase();

    if (modemState === "online" && !stale) {
      return { state: "ONLINE", error: null, modemState, stale };
    }
    if (modemState === "connecting" || modemState === "degraded") {
      return {
        state: "DEGRADED",
        error: String(modem.last_error ?? "Modemmet er ikke fuldt online"),
        modemState,
        stale
      };
    }
    return {
      state: "OFFLINE",
      error: String(
        modem.last_error ?? (stale ? "Modemstatus er for gammel" : "Modemmet er offline")
      ),
      modemState,
      stale
    };
  } catch (error) {
    return {
      state: "OFFLINE",
      error: error instanceof Error ? error.message : String(error),
      modemState: "unreachable",
      stale: true
    };
  } finally {
    clearTimeout(timeout);
  }
}

function statusDescription(health) {
  if (health.state === "ONLINE") {
    return "SMS-gateway og modem er online igen.";
  }
  if (health.state === "DEGRADED") {
    return `SMS-systemet er ustabilt: ${health.error ?? "ukendt fejl"}`;
  }
  return `SMS-modemmet eller gatewayen er offline: ${health.error ?? "ukendt fejl"}`;
}

function parseDate(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
