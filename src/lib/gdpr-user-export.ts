export type GdprExportPrisma = {
  user: { findUnique(args: unknown): Promise<any> };
  session: { findMany(args: unknown): Promise<any[]> };
  mfaChallenge: { findMany(args: unknown): Promise<any[]> };
  passwordResetToken: { findMany(args: unknown): Promise<any[]> };
  loginAttempt: { findMany(args: unknown): Promise<any[]> };
  availability: { findMany(args: unknown): Promise<any[]> };
  shiftTransfer: { findMany(args: unknown): Promise<any[]> };
  returnRequest: { findMany(args: unknown): Promise<any[]> };
  notification: { findMany(args: unknown): Promise<any[]> };
  pushSubscription: { findMany(args: unknown): Promise<any[]> };
  auditLog: { findMany(args: unknown): Promise<any[]> };
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
};

function safeFileComponent(value: string) {
  const normalized = value.normalize("NFKD").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized.slice(0, 80) || "bruger";
}

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function endpointOrigin(endpoint: string | null | undefined) {
  if (!endpoint) return null;
  try {
    return new URL(endpoint).origin;
  } catch {
    return "ugyldig/ukendt endpoint";
  }
}

function exportTransfer(record: any, userId: string) {
  const isGiver = record.giverUserId === userId;
  const isReceiver = record.receiverUserId === userId;
  const subjectSnapshot = isGiver
    ? { name: record.giverNameSnapshot, employeeNumber: record.giverEmployeeNumberSnapshot }
    : isReceiver
      ? { name: record.receiverNameSnapshot, employeeNumber: record.receiverEmployeeNumberSnapshot }
      : null;

  return {
    transferNumber: record.transferNumber,
    subjectRole: isGiver ? "GIVER" : isReceiver ? "RECEIVER" : "OTHER_RECORDED_ACTION",
    subjectSnapshot,
    requestedStartAt: iso(record.requestedStartAt),
    expectedEndMode: record.expectedEndMode,
    expectedEndAt: iso(record.expectedEndAt),
    calculatedShiftEndAt: iso(record.calculatedShiftEndAt),
    comment: record.comment,
    status: record.status,
    createdAt: iso(record.createdAt),
    updatedAt: iso(record.updatedAt),
    receiverRespondedAt: iso(record.receiverRespondedAt),
    receiverResponseComment: record.receiverResponseComment,
    vcDecidedAt: iso(record.vcDecidedAt),
    vcDecision: record.vcDecision,
    vcComment: record.vcComment,
    activatedAt: iso(record.activatedAt),
    activationConfirmedAt: iso(record.activationConfirmedAt),
    subjectConfirmedActivation: record.activationConfirmedByUserId === userId,
    returnExecutionConfirmedAt: iso(record.returnExecutionConfirmedAt),
    subjectConfirmedReturnExecution: record.returnExecutionConfirmedByUserId === userId,
    cancelledAt: iso(record.cancelledAt),
    subjectCancelled: record.cancelledByUserId === userId,
    cancellationReason: record.cancellationReason,
    completedAt: iso(record.completedAt)
  };
}

function exportReturnRequest(record: any, userId: string) {
  const roles = [
    record.createdByUserId === userId ? "CREATOR" : null,
    record.originalUserId === userId ? "ORIGINAL_USER" : null,
    record.currentHolderUserId === userId ? "CURRENT_HOLDER" : null
  ].filter(Boolean);
  const subjectSnapshot = record.originalUserId === userId
    ? { name: record.originalNameSnapshot, employeeNumber: record.originalEmployeeNumberSnapshot }
    : record.currentHolderUserId === userId
      ? { name: record.currentHolderNameSnapshot, employeeNumber: record.currentHolderEmployeeNumberSnapshot }
      : null;

  return {
    returnNumber: record.returnNumber,
    transferNumber: record.transfer?.transferNumber ?? null,
    subjectRoles: roles,
    subjectSnapshot,
    requestedReturnAt: iso(record.requestedReturnAt),
    comment: record.comment,
    status: record.status,
    createdAt: iso(record.createdAt),
    updatedAt: iso(record.updatedAt),
    originalRespondedAt: iso(record.originalRespondedAt),
    originalAcceptedAt: iso(record.originalAcceptedAt),
    originalResponseComment: record.originalResponseComment,
    vcDecidedAt: iso(record.vcDecidedAt),
    vcDecision: record.vcDecision,
    vcComment: record.vcComment,
    completedAt: iso(record.completedAt),
    returnExecutionConfirmedAt: iso(record.returnExecutionConfirmedAt),
    subjectConfirmedReturnExecution: record.returnExecutionConfirmedByUserId === userId
  };
}

export async function buildGdprUserExport(
  prisma: GdprExportPrisma,
  userId: string,
  generatedAt = new Date()
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      role: true,
      employeeNumber: true,
      loginIdentifier: true,
      email: true,
      vcSmsPhoneNumber: true,
      isActive: true,
      mustChangePassword: true,
      stationCode: true,
      alarmStations: true,
      receiveAlarmFollowUps: true,
      hasAdminAccess: true,
      mfaEnabled: true,
      mfaEnrolledAt: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true
    }
  });

  if (!user) return null;

  const identifiers = [user.loginIdentifier, user.employeeNumber].filter(Boolean);
  const [
    sessions,
    mfaChallenges,
    resetTokens,
    loginAttempts,
    availabilities,
    transfers,
    returnRequests,
    notifications,
    pushSubscriptions,
    audits,
    operationalAccess,
    operationalFavorites,
    operationalRecent
  ] = await Promise.all([
    prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, lastSeenAt: true, expiresAt: true }
    }),
    prisma.mfaChallenge.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, expiresAt: true, attemptCount: true }
    }),
    prisma.passwordResetToken.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, expiresAt: true, usedAt: true, requestedIp: true }
    }),
    prisma.loginAttempt.findMany({
      where: { identifier: { in: identifiers } },
      orderBy: { createdAt: "desc" },
      select: { identifier: true, ipAddress: true, wasSuccessful: true, failureReason: true, createdAt: true }
    }),
    prisma.availability.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        availableFrom: true,
        availableUntil: true,
        status: true,
        assignedAt: true,
        assignedShiftStart: true,
        assignedShiftEnd: true,
        acknowledgedAt: true,
        cancelledAt: true,
        expiredAt: true,
        createdAt: true,
        updatedAt: true
      }
    }),
    prisma.shiftTransfer.findMany({
      where: {
        OR: [
          { giverUserId: userId },
          { receiverUserId: userId },
          { activationConfirmedByUserId: userId },
          { returnExecutionConfirmedByUserId: userId },
          { cancelledByUserId: userId }
        ]
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.returnRequest.findMany({
      where: {
        OR: [
          { createdByUserId: userId },
          { originalUserId: userId },
          { currentHolderUserId: userId },
          { returnExecutionConfirmedByUserId: userId }
        ]
      },
      include: { transfer: { select: { transferNumber: true } } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.notification.findMany({
      where: { recipientUserId: userId },
      orderBy: { createdAt: "desc" },
      select: {
        type: true,
        title: true,
        body: true,
        link: true,
        scheduledFor: true,
        publishedAt: true,
        readAt: true,
        openedAt: true,
        cancelledAt: true,
        dismissedAt: true,
        createdAt: true,
        updatedAt: true
      }
    }),
    prisma.pushSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        endpoint: true,
        userAgent: true,
        deviceName: true,
        createdAt: true,
        updatedAt: true,
        lastUsedAt: true,
        revokedAt: true,
        deliveries: {
          select: { status: true, attemptCount: true, sentAt: true, failedAt: true, lastError: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 500
        }
      }
    }),
    prisma.auditLog.findMany({
      where: { OR: [{ actorUserId: userId }, { targetUserId: userId }] },
      orderBy: { createdAt: "desc" },
      select: { actorRole: true, action: true, description: true, createdAt: true, actorUserId: true, targetUserId: true }
    }),
    prisma.$queryRawUnsafe<any[]>(
      'SELECT created_at AS "createdAt" FROM operational_portal_user_access WHERE user_id = $1 ORDER BY created_at DESC',
      userId
    ),
    prisma.$queryRawUnsafe<any[]>(
      'SELECT target_type AS "targetType", target_id AS "targetId", created_at AS "createdAt" FROM operational_favorite WHERE user_id = $1 ORDER BY created_at DESC',
      userId
    ),
    prisma.$queryRawUnsafe<any[]>(
      'SELECT target_type AS "targetType", target_id AS "targetId", view_count AS "viewCount", last_viewed_at AS "lastViewedAt" FROM operational_recent WHERE user_id = $1 ORDER BY last_viewed_at DESC',
      userId
    )
  ]);

  return {
    format: "sbr-portal-gdpr-user-export",
    version: 1,
    generatedAt: generatedAt.toISOString(),
    releaseReviewRequired: true,
    reviewNotice:
      "Dette er et internt hjælpeudtræk. Kommentarer, notifikationer og sagskontekst kan indeholde oplysninger om andre personer og skal vurderes før udlevering.",
    excludedSecuritySecrets: [
      "passwordHash",
      "session token hashes",
      "password-reset token hashes",
      "MFA secret",
      "MFA recovery-code hashes",
      "MFA challenge secrets/tokens",
      "push p256dh/auth keys",
      "full push endpoint"
    ],
    user: {
      ...user,
      mfaEnrolledAt: iso(user.mfaEnrolledAt),
      createdAt: iso(user.createdAt),
      updatedAt: iso(user.updatedAt),
      lastLoginAt: iso(user.lastLoginAt),
      hasOperationalPortalAccess: operationalAccess.length > 0
    },
    securityHistory: {
      sessions: sessions.map((entry) => ({
        createdAt: iso(entry.createdAt),
        lastSeenAt: iso(entry.lastSeenAt),
        expiresAt: iso(entry.expiresAt)
      })),
      mfaChallenges: mfaChallenges.map((entry) => ({
        createdAt: iso(entry.createdAt),
        expiresAt: iso(entry.expiresAt),
        attemptCount: entry.attemptCount
      })),
      passwordResetRequests: resetTokens.map((entry) => ({
        createdAt: iso(entry.createdAt),
        expiresAt: iso(entry.expiresAt),
        usedAt: iso(entry.usedAt),
        requestedIp: entry.requestedIp
      })),
      loginAttempts: loginAttempts.map((entry) => ({ ...entry, createdAt: iso(entry.createdAt) })),
      pushDevices: pushSubscriptions.map((entry) => ({
        endpointOrigin: endpointOrigin(entry.endpoint),
        userAgent: entry.userAgent,
        deviceName: entry.deviceName,
        createdAt: iso(entry.createdAt),
        updatedAt: iso(entry.updatedAt),
        lastUsedAt: iso(entry.lastUsedAt),
        revokedAt: iso(entry.revokedAt),
        deliveries: entry.deliveries.map((delivery: any) => ({
          status: delivery.status,
          attemptCount: delivery.attemptCount,
          sentAt: iso(delivery.sentAt),
          failedAt: iso(delivery.failedAt),
          lastError: delivery.lastError,
          createdAt: iso(delivery.createdAt)
        }))
      }))
    },
    workAndShiftData: {
      availabilities: availabilities.map((entry) => ({
        ...entry,
        availableFrom: iso(entry.availableFrom),
        availableUntil: iso(entry.availableUntil),
        assignedAt: iso(entry.assignedAt),
        assignedShiftStart: iso(entry.assignedShiftStart),
        assignedShiftEnd: iso(entry.assignedShiftEnd),
        acknowledgedAt: iso(entry.acknowledgedAt),
        cancelledAt: iso(entry.cancelledAt),
        expiredAt: iso(entry.expiredAt),
        createdAt: iso(entry.createdAt),
        updatedAt: iso(entry.updatedAt)
      })),
      shiftTransfers: transfers.map((entry) => exportTransfer(entry, userId)),
      returnRequests: returnRequests.map((entry) => exportReturnRequest(entry, userId))
    },
    communications: {
      notifications: notifications.map((entry) => ({
        ...entry,
        scheduledFor: iso(entry.scheduledFor),
        publishedAt: iso(entry.publishedAt),
        readAt: iso(entry.readAt),
        openedAt: iso(entry.openedAt),
        cancelledAt: iso(entry.cancelledAt),
        dismissedAt: iso(entry.dismissedAt),
        createdAt: iso(entry.createdAt),
        updatedAt: iso(entry.updatedAt)
      }))
    },
    operationalPortal: {
      accessGrantedAt: operationalAccess.map((entry) => iso(entry.createdAt)),
      favorites: operationalFavorites.map((entry) => ({ ...entry, createdAt: iso(entry.createdAt) })),
      recent: operationalRecent.map((entry) => ({ ...entry, lastViewedAt: iso(entry.lastViewedAt) }))
    },
    auditHistory: audits.map((entry) => ({
      subjectWasActor: entry.actorUserId === userId,
      subjectWasTarget: entry.targetUserId === userId,
      actorRole: entry.actorRole,
      action: entry.action,
      description: entry.description,
      createdAt: iso(entry.createdAt)
    }))
  };
}

export function gdprExportFileName(user: { employeeNumber?: string | null; loginIdentifier: string }) {
  const identifier = user.employeeNumber || user.loginIdentifier;
  return `sbr-gdpr-udtraek-${safeFileComponent(identifier)}-${new Date().toISOString().slice(0, 10)}.json`;
}
