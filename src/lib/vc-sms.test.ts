import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeSmsPhoneNumber } from "./sms-phone";
import {
  buildVcSmsBody,
  isVcActionNotification,
  sanitizeVcSmsText,
  sendVcSmsForNotification,
  setVcSmsGatewaySenderForTests
} from "./vc-sms";

afterEach(() => {
  setVcSmsGatewaySenderForTests(null);
});

describe("VC SMS", () => {
  it("normaliserer danske og internationale telefonnumre", () => {
    expect(normalizeSmsPhoneNumber("12 34 56 78")).toBe("+4512345678");
    expect(normalizeSmsPhoneNumber("0045 12 34 56 78")).toBe("+4512345678");
    expect(normalizeSmsPhoneNumber("+4512345678")).toBe("+4512345678");
    expect(() => normalizeSmsPhoneNumber("123")).toThrow("Ugyldigt telefonnummer");
  });

  it("sender kun SMS for notifikationer hvor VC skal handle", () => {
    expect(isVcActionNotification({
      type: "TRANSFER_RECEIVER_ACCEPTED",
      link: "/vagtcentral/sager/transfer-1"
    })).toBe(true);
    expect(isVcActionNotification({
      type: "TRANSFER_RECEIVER_ACCEPTED",
      link: "/brandmand/anmodninger/transfer-1"
    })).toBe(false);
    expect(isVcActionNotification({
      type: "TRANSFER_VC_APPROVED",
      link: "/vagtcentral/sager/transfer-1"
    })).toBe(false);
  });

  it("undgår Huawei-problemtegn og holder SMS under 155 tegn", () => {
    const sanitized = sanitizeVcSmsText("VC | test {x} [y] ~ ^ \\ € – → …");
    expect(sanitized).not.toMatch(/[|{}\[\]~^\\€–—→…]/);

    const body = buildVcSmsBody({
      transferNumber: "VO-00042",
      title: "Ny sag til godkendelse",
      body: "Ny vagtoverdragelse afventer godkendelse. ".repeat(10)
    });
    expect(body).toContain("VO-00042");
    expect(body.length).toBeLessThanOrEqual(155);
    expect(body).not.toContain("|");
  });

  it("køer SMS til det nummer admin har gemt", async () => {
    const sender = vi.fn(async () => undefined);
    setVcSmsGatewaySenderForTests(sender);
    const repo = {
      user: {
        findFirst: vi.fn(async () => ({ vcSmsPhoneNumber: "12 34 56 78" }))
      },
      shiftTransfer: {
        findUnique: vi.fn(async () => ({ transferNumber: "VO-00042" }))
      }
    } as unknown as Parameters<typeof sendVcSmsForNotification>[0];

    const result = await sendVcSmsForNotification(repo, {
      type: "TRANSFER_RECEIVER_ACCEPTED",
      title: "Ny sag til godkendelse",
      body: "Ny vagtoverdragelse afventer godkendelse.",
      link: "/vagtcentral/sager/transfer-1",
      shiftTransferId: "transfer-1"
    });

    expect(result.queued).toBe(true);
    expect(sender).toHaveBeenCalledTimes(1);
    expect(sender.mock.calls[0]?.[0]).toBe("+4512345678");
    expect(sender.mock.calls[0]?.[1]).toContain("VO-00042");
    expect(sender.mock.calls[0]?.[1]).not.toContain("|");
  });

  it("påvirker ikke vagtflowet hvis SMS-gatewayen fejler", async () => {
    setVcSmsGatewaySenderForTests(async () => {
      throw new Error("gateway nede");
    });
    const repo = {
      user: {
        findFirst: vi.fn(async () => ({ vcSmsPhoneNumber: "+4512345678" }))
      },
      shiftTransfer: {
        findUnique: vi.fn(async () => ({ transferNumber: "VO-00042" }))
      }
    } as unknown as Parameters<typeof sendVcSmsForNotification>[0];

    await expect(sendVcSmsForNotification(repo, {
      type: "TRANSFER_RECEIVER_ACCEPTED",
      title: "Ny sag til godkendelse",
      body: "Ny vagtoverdragelse afventer godkendelse.",
      link: "/vagtcentral/sager/transfer-1",
      shiftTransferId: "transfer-1"
    })).resolves.toMatchObject({ queued: false, reason: "gateway-error" });
  });
});
