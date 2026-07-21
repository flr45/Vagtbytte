import { afterEach, describe, expect, it, vi } from "vitest";
import { completeDueShiftEndTransfers } from "../../scripts/notification-worker-core.mjs";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("automatisk afslutning ved vagtslut", () => {
  it("oprettet kl. 17.00 afsluttes kl. 23.00", async () => {
    const repo = makeShiftEndRepo([
      transfer({ id: "t-17", requestedStartAt: new Date("2026-07-21T15:00:00.000Z"), calculatedShiftEndAt: null })
    ]);

    await completeDueShiftEndTransfers(repo, new Date("2026-07-21T21:00:00.000Z"));

    expect(repo.transfers[0].status).toBe("COMPLETED");
    expect(repo.transfers[0].calculatedShiftEndAt?.toISOString()).toBe("2026-07-21T21:00:00.000Z");
  });

  it("oprettet kl. 18.00 afsluttes kl. 23.00", async () => {
    const repo = makeShiftEndRepo([
      transfer({ id: "t-18", requestedStartAt: new Date("2026-07-21T16:00:00.000Z"), calculatedShiftEndAt: null })
    ]);

    await completeDueShiftEndTransfers(repo, new Date("2026-07-21T21:01:00.000Z"));

    expect(repo.transfers[0].status).toBe("COMPLETED");
    expect(repo.transfers[0].completedAt?.toISOString()).toBe("2026-07-21T21:00:00.000Z");
  });

  it("VC_APPROVED_ACTIVE afsluttes", async () => {
    const repo = makeShiftEndRepo([transfer({ status: "VC_APPROVED_ACTIVE" })]);

    const result = await completeDueShiftEndTransfers(repo, new Date("2026-07-21T21:01:00.000Z"));

    expect(result.completedFromActive).toBe(1);
    expect(repo.transfers[0].status).toBe("COMPLETED");
  });

  it("VC_APPROVED_AWAITING_ACTIVATION afsluttes", async () => {
    const repo = makeShiftEndRepo([transfer({ status: "VC_APPROVED_AWAITING_ACTIVATION" })]);

    const result = await completeDueShiftEndTransfers(repo, new Date("2026-07-21T21:01:00.000Z"));

    expect(result.completedFromAwaitingActivation).toBe(1);
    expect(repo.transfers[0].status).toBe("COMPLETED");
  });

  it("calculatedShiftEndAt null bliver beregnet og afsluttet", async () => {
    const repo = makeShiftEndRepo([transfer({ calculatedShiftEndAt: null })]);

    const result = await completeDueShiftEndTransfers(repo, new Date("2026-07-21T21:01:00.000Z"));

    expect(result.backfilled).toBe(1);
    expect(repo.transfers[0].calculatedShiftEndAt).toBeInstanceOf(Date);
    expect(repo.transfers[0].status).toBe("COMPLETED");
  });

  it("sagen forsvinder fra VC's aktive liste", async () => {
    const repo = makeShiftEndRepo([transfer({ id: "active-before" })]);

    await completeDueShiftEndTransfers(repo, new Date("2026-07-21T21:01:00.000Z"));

    const vcActive = repo.transfers.filter((item) =>
      ["VC_APPROVED_AWAITING_ACTIVATION", "VC_APPROVED_ACTIVE"].includes(item.status)
    );
    expect(vcActive).toHaveLength(0);
  });

  it("SPECIFIC_TIME påvirkes ikke", async () => {
    const repo = makeShiftEndRepo([
      transfer({ expectedEndMode: "SPECIFIC_TIME", expectedEndAt: new Date("2026-07-21T21:00:00.000Z") })
    ]);

    const result = await completeDueShiftEndTransfers(repo, new Date("2026-07-21T21:01:00.000Z"));

    expect(result.completed).toBe(0);
    expect(repo.transfers[0].status).toBe("VC_APPROVED_ACTIVE");
  });

  it("handlingen sker kun én gang", async () => {
    const repo = makeShiftEndRepo([transfer({ id: "once" })]);

    await completeDueShiftEndTransfers(repo, new Date("2026-07-21T21:01:00.000Z"));
    await completeDueShiftEndTransfers(repo, new Date("2026-07-21T21:02:00.000Z"));

    expect(repo.auditLogs).toHaveLength(1);
    expect(repo.notifications).toHaveLength(2);
  });
});

type TestTransfer = {
  id: string;
  transferNumber: string;
  giverUserId: string;
  receiverUserId: string;
  requestedStartAt: Date;
  expectedEndMode: "UNTIL_SHIFT_END" | "SPECIFIC_TIME";
  expectedEndAt: Date | null;
  calculatedShiftEndAt: Date | null;
  status: string;
  completedAt: Date | null;
};

function transfer(overrides: Partial<TestTransfer> = {}): TestTransfer {
  return {
    id: "transfer-1",
    transferNumber: "VO-1",
    giverUserId: "giver",
    receiverUserId: "receiver",
    requestedStartAt: new Date("2026-07-21T15:00:00.000Z"),
    expectedEndMode: "UNTIL_SHIFT_END",
    expectedEndAt: null,
    calculatedShiftEndAt: new Date("2026-07-21T21:00:00.000Z"),
    status: "VC_APPROVED_ACTIVE",
    completedAt: null,
    ...overrides
  };
}

function makeShiftEndRepo(transfers: TestTransfer[]) {
  const notifications: Array<{ uniqueKey: string; shiftTransferId: string; recipientUserId: string }> = [];
  const auditLogs: Array<{ action: string; shiftTransferId: string }> = [];
  const repo = {
    transfers,
    notifications,
    auditLogs,
    async $transaction<T>(callback: (tx: typeof repo) => Promise<T>) {
      return callback(repo);
    },
    shiftTransfer: {
      async findMany({ where }: { where: Record<string, unknown> }) {
        return transfers.filter((item) => matchesShiftTransferWhere(item, where));
      },
      async updateMany({ where, data }: { where: Record<string, unknown>; data: Partial<TestTransfer> }) {
        let count = 0;
        for (const item of transfers) {
          if (matchesShiftTransferWhere(item, where)) {
            Object.assign(item, data);
            count += 1;
          }
        }
        return { count };
      }
    },
    notification: {
      async findUnique({ where }: { where: { uniqueKey: string } }) {
        return notifications.find((item) => item.uniqueKey === where.uniqueKey) ?? null;
      },
      async create({ data }: { data: { uniqueKey: string; shiftTransferId: string; recipientUserId: string } }) {
        notifications.push(data);
        return { id: data.uniqueKey, ...data };
      },
      async updateMany() {
        return { count: 0 };
      }
    },
    auditLog: {
      async create({ data }: { data: { action: string; shiftTransferId: string } }) {
        auditLogs.push(data);
        return data;
      }
    },
    pushDelivery: {
      async create() {
        return {};
      }
    }
  };

  vi.spyOn(console, "log").mockImplementation(() => undefined);
  return repo as unknown as Parameters<typeof completeDueShiftEndTransfers>[0] & {
    transfers: TestTransfer[];
    notifications: Array<{ uniqueKey: string; shiftTransferId: string; recipientUserId: string }>;
    auditLogs: Array<{ action: string; shiftTransferId: string }>;
  };
}

function matchesShiftTransferWhere(item: TestTransfer, where: Record<string, unknown>) {
  if (where.id && item.id !== where.id) {
    return false;
  }
  if (where.expectedEndMode && item.expectedEndMode !== where.expectedEndMode) {
    return false;
  }
  if (where.completedAt === null && item.completedAt !== null) {
    return false;
  }
  if (where.calculatedShiftEndAt === null && item.calculatedShiftEndAt !== null) {
    return false;
  }
  if (
    typeof where.calculatedShiftEndAt === "object" &&
    where.calculatedShiftEndAt &&
    "lte" in where.calculatedShiftEndAt
  ) {
    const lte = (where.calculatedShiftEndAt as { lte: Date }).lte;
    if (!item.calculatedShiftEndAt || item.calculatedShiftEndAt > lte) {
      return false;
    }
  }
  if (typeof where.status === "string" && item.status !== where.status) {
    return false;
  }
  if (typeof where.status === "object" && where.status && "in" in where.status) {
    const allowed = (where.status as { in: string[] }).in;
    if (!allowed.includes(item.status)) {
      return false;
    }
  }
  return true;
}
