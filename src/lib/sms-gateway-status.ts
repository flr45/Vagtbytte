export type SmsGatewayHealth = {
  reachable: boolean;
  overallStatus: string;
  checkedAt: Date;
  error: string | null;
  modem: {
    state: string;
    device: string | null;
    updatedAt: Date | null;
    lastMessageAt: Date | null;
    lastError: string | null;
    network: string | null;
    signal: string | null;
    stale: boolean;
  };
  gateway: {
    database: string;
    lastReceivedSmsAt: Date | null;
    lastVagtbytteSuccessAt: Date | null;
    lastVagtbytteErrorAt: Date | null;
    lastVagtbytteError: string | null;
  };
};

const MODEM_STALE_AFTER_MS = 2 * 60 * 1000;

export async function fetchSmsGatewayHealth(): Promise<SmsGatewayHealth> {
  const checkedAt = new Date();
  const url = process.env.SMS_GATEWAY_HEALTH_URL?.trim() || "http://sms-gateway:8080/health";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`SMS-gateway svarede HTTP ${response.status}`);
    }

    const payload = asRecord(await response.json());
    const modem = asRecord(payload.modem);
    const gateway = asRecord(payload.gateway);
    const modemUpdatedAt = asDate(modem.updated_at);

    return {
      reachable: true,
      overallStatus: asString(payload.status) ?? "unknown",
      checkedAt,
      error: null,
      modem: {
        state: asString(modem.state) ?? "unknown",
        device: asString(modem.device),
        updatedAt: modemUpdatedAt,
        lastMessageAt: asDate(modem.last_message_at),
        lastError: asString(modem.last_error),
        network: asString(modem.network),
        signal: asString(modem.signal),
        stale:
          !modemUpdatedAt || checkedAt.getTime() - modemUpdatedAt.getTime() > MODEM_STALE_AFTER_MS
      },
      gateway: {
        database: asString(gateway.database) ?? "unknown",
        lastReceivedSmsAt: asDate(gateway.last_received_sms_at),
        lastVagtbytteSuccessAt: asDate(gateway.last_vagtbytte_success_at),
        lastVagtbytteErrorAt: asDate(gateway.last_vagtbytte_error_at),
        lastVagtbytteError: asString(gateway.last_vagtbytte_error)
      }
    };
  } catch (error) {
    return {
      reachable: false,
      overallStatus: "offline",
      checkedAt,
      error: error instanceof Error ? error.message : String(error),
      modem: {
        state: "offline",
        device: null,
        updatedAt: null,
        lastMessageAt: null,
        lastError: null,
        network: null,
        signal: null,
        stale: true
      },
      gateway: {
        database: "unknown",
        lastReceivedSmsAt: null,
        lastVagtbytteSuccessAt: null,
        lastVagtbytteErrorAt: null,
        lastVagtbytteError: null
      }
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function smsModemIsOnline(health: SmsGatewayHealth) {
  return health.reachable && health.modem.state === "online" && !health.modem.stale;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asDate(value: unknown) {
  const text = asString(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}
