import { NextResponse } from "next/server";
import { z } from "zod";
import { ingestAlarmMessage } from "@/lib/alarm-feed";

const payloadSchema = z.object({
  senderNumber: z.string().min(1).max(40),
  rawMessage: z.string().min(1).max(5000),
  receivedAt: z.string().datetime().optional(),
  sourceMessageId: z.string().max(200).nullish()
});

export async function POST(request: Request) {
  const configuredToken = process.env.ALARM_FEED_INGEST_TOKEN;
  const suppliedToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!configuredToken || !suppliedToken || suppliedToken !== configuredToken) {
    return NextResponse.json({ error: "Ikke godkendt" }, { status: 401 });
  }

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ugyldig alarmbesked", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await ingestAlarmMessage({
    senderNumber: parsed.data.senderNumber,
    rawMessage: parsed.data.rawMessage,
    receivedAt: parsed.data.receivedAt ? new Date(parsed.data.receivedAt) : new Date(),
    sourceMessageId: parsed.data.sourceMessageId
  });

  return NextResponse.json(result, { status: result.created ? 201 : 200 });
}
