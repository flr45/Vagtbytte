const LOOKBACK_MS = 10 * 60 * 1000;

export async function ensureVcEventNotifications(prisma, now = new Date()) {
  const since = new Date(now.getTime() - LOOKBACK_MS);
  const vcUsers = await prisma.user.findMany({
    where: { role: "VC", isActive: true },
    select: { id: true }
  });

  if (vcUsers.length === 0) {
    return { created: 0 };
  }

  const [availabilities, transfers] = await Promise.all([
    prisma.availability.findMany({
      where: { createdAt: { gte: since } },
      include: { user: { select: { name: true, employeeNumber: true } } },
      orderBy: { createdAt: "asc" },
      take: 100
    }),
    prisma.shiftTransfer.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      take: 100
    })
  ]);

  let created = 0;

  for (const vc of vcUsers) {
    for (const availability of availabilities) {
      const result = await prisma.notification.createMany({
        data: [{
          recipientUserId: vc.id,
          availabilityId: availability.id,
          type: "AVAILABILITY_ASSIGNED",
          title: "Ny brandmand til rådighed",
          body: `${availability.user.name}${availability.user.employeeNumber ? ` (${availability.user.employeeNumber})` : ""} har stillet sig til rådighed.`,
          link: "/vagtcentral",
          uniqueKey: `availability:${availability.id}:created:vc:${vc.id}`,
          scheduledFor: now,
          publishedAt: null
        }],
        skipDuplicates: true
      });
      created += result.count;
    }

    for (const transfer of transfers) {
      const result = await prisma.notification.createMany({
        data: [{
          recipientUserId: vc.id,
          shiftTransferId: transfer.id,
          type: "TRANSFER_CREATED",
          title: "Ny vagtoverdragelse oprettet",
          body: `${transfer.giverNameSnapshot} ønsker at overdrage vagten til ${transfer.receiverNameSnapshot}.`,
          link: `/vagtcentral/sager/${transfer.id}`,
          uniqueKey: `transfer:${transfer.id}:created:vc:${vc.id}`,
          scheduledFor: now,
          publishedAt: null
        }],
        skipDuplicates: true
      });
      created += result.count;
    }
  }

  return { created };
}
