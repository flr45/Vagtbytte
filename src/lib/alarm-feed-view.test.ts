import { describe, expect, it } from "vitest";
import type { AlarmFeedAlarm, AlarmFeedMessage } from "./alarm-feed";
import {
  applyAlarmFollowUpVisibility,
  groupAlarmFeedForDisplay,
  orderMessagesByImportance
} from "./alarm-feed-view";

function message(
  id: string,
  alarmId: string,
  rawMessage: string,
  receivedAt: string,
  sequenceNumber = 1
): AlarmFeedMessage {
  return {
    id,
    alarmId,
    rawMessage,
    receivedAt: new Date(receivedAt),
    sequenceNumber,
    senderNumber: "+4512345678"
  };
}

function alarm(
  id: string,
  stationCode: string,
  openedAt: string,
  messages: AlarmFeedMessage[]
): AlarmFeedAlarm {
  return {
    id,
    stationCode,
    openedAt: new Date(openedAt),
    messages,
    senderNumber: "+4512345678",
    status: "ACTIVE"
  };
}

describe("groupAlarmFeedForDisplay", () => {
  it("samler umærkede opfølgninger under den stationsmarkerede alarm", () => {
    const start = alarm(
      "alarm-start",
      "A",
      "2026-08-02T20:55:10.000Z",
      [message("message-start", "alarm-start", "(A) Testalarm", "2026-08-02T20:55:10.000Z")]
    );
    const brand = alarm(
      "alarm-brand",
      "A",
      "2026-08-02T20:55:20.000Z",
      [message("message-brand", "alarm-brand", "Brand", "2026-08-02T20:55:20.000Z")]
    );
    const address = alarm(
      "alarm-address",
      "A",
      "2026-08-02T20:55:30.000Z",
      [message("message-address", "alarm-address", "Kongelyset", "2026-08-02T20:55:30.000Z")]
    );

    const result = groupAlarmFeedForDisplay([address, brand, start]);

    expect(result).toHaveLength(1);
    expect(result[0].sourceAlarmIds).toEqual([
      "alarm-start",
      "alarm-address",
      "alarm-brand"
    ]);
    expect(result[0].messages.map((item) => item.rawMessage)).toEqual([
      "(A) Testalarm",
      "Brand",
      "Kongelyset"
    ]);
    expect(result[0].messages.map((item) => item.sequenceNumber)).toEqual([1, 2, 3]);
  });

  it("blander ikke forskellige stationer sammen", () => {
    const slagelse = alarm(
      "alarm-a",
      "A",
      "2026-08-02T20:55:10.000Z",
      [message("message-a", "alarm-a", "(A) Testalarm", "2026-08-02T20:55:10.000Z")]
    );
    const skaelskoer = alarm(
      "alarm-l",
      "L",
      "2026-08-02T20:55:20.000Z",
      [message("message-l", "alarm-l", "Brand", "2026-08-02T20:55:20.000Z")]
    );

    expect(groupAlarmFeedForDisplay([slagelse, skaelskoer])).toHaveLength(2);
  });
});

describe("applyAlarmFollowUpVisibility", () => {
  const groupedAlarm = groupAlarmFeedForDisplay([
    alarm(
      "alarm-start",
      "A",
      "2026-08-02T20:55:10.000Z",
      [message("message-start", "alarm-start", "(A) Testalarm", "2026-08-02T20:55:10.000Z")]
    ),
    alarm(
      "alarm-brand",
      "A",
      "2026-08-02T20:55:20.000Z",
      [message("message-brand", "alarm-brand", "Brand", "2026-08-02T20:55:20.000Z")]
    )
  ]);

  it("viser alle sendinger, når admin har slået visningen til", () => {
    expect(applyAlarmFollowUpVisibility(groupedAlarm, true)[0].messages).toHaveLength(2);
  });

  it("viser kun primærmeldingen, når admin har slået visningen fra", () => {
    const result = applyAlarmFollowUpVisibility(groupedAlarm, false);

    expect(result).toHaveLength(1);
    expect(result[0].messages).toHaveLength(1);
    expect(result[0].messages[0].rawMessage).toBe("(A) Testalarm");
    expect(result[0].messages[0].sequenceNumber).toBe(1);
  });

  it("skjuler en løs opfølgning uden en primærmelding", () => {
    const followUpOnly = groupAlarmFeedForDisplay([
      alarm(
        "alarm-brand",
        "A",
        "2026-08-02T20:55:20.000Z",
        [message("message-brand", "alarm-brand", "Brand", "2026-08-02T20:55:20.000Z")]
      )
    ]);

    expect(applyAlarmFollowUpVisibility(followUpOnly, false)).toEqual([]);
  });
});

describe("orderMessagesByImportance", () => {
  it("viser den stationsmarkerede førstesending før opfølgninger", () => {
    const messages = [
      message("2", "alarm", "Brand", "2026-08-02T20:55:00.000Z"),
      message("1", "alarm", "(A) Testalarm", "2026-08-02T20:55:05.000Z")
    ];

    expect(orderMessagesByImportance(messages).map((item) => item.rawMessage)).toEqual([
      "(A) Testalarm",
      "Brand"
    ]);
  });
});
