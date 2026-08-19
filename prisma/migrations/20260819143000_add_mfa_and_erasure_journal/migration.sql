ALTER TABLE "User"
  ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "mfaSecretEncrypted" TEXT,
  ADD COLUMN "mfaRecoveryCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "mfaEnrolledAt" TIMESTAMP(3),
  ADD COLUMN "mfaLastUsedStep" INTEGER;

CREATE INDEX "User_mfaEnabled_idx" ON "User"("mfaEnabled");

CREATE TABLE "MfaChallenge" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "setupSecretEncrypted" TEXT,
  "setupRecoveryCodesEncrypted" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MfaChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MfaChallenge_tokenHash_key" ON "MfaChallenge"("tokenHash");
CREATE INDEX "MfaChallenge_userId_idx" ON "MfaChallenge"("userId");
CREATE INDEX "MfaChallenge_expiresAt_idx" ON "MfaChallenge"("expiresAt");
ALTER TABLE "MfaChallenge"
  ADD CONSTRAINT "MfaChallenge_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DataErasureTombstone" (
  "id" TEXT NOT NULL,
  "userFingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastAppliedAt" TIMESTAMP(3),
  CONSTRAINT "DataErasureTombstone_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DataErasureTombstone_userFingerprint_key"
  ON "DataErasureTombstone"("userFingerprint");
CREATE INDEX "DataErasureTombstone_createdAt_idx"
  ON "DataErasureTombstone"("createdAt");

CREATE OR REPLACE FUNCTION sbr_record_user_erasure()
RETURNS trigger AS $$
DECLARE
  fingerprint TEXT;
BEGIN
  IF current_setting('sbr.restore_mode', true) = '1' OR OLD."loginIdentifier" = '__deleted_user__' THEN
    RETURN OLD;
  END IF;

  fingerprint := md5(OLD."id");

  INSERT INTO "DataErasureTombstone" ("id", "userFingerprint", "createdAt")
  VALUES (fingerprint, fingerprint, CURRENT_TIMESTAMP)
  ON CONFLICT ("userFingerprint") DO NOTHING;

  UPDATE "BackupSnapshot"
  SET "createdByUserId" = NULL
  WHERE "createdByUserId" = OLD."id";

  UPDATE "AuditLog"
  SET "description" = 'Historisk hændelse vedrørende anonymiseret bruger'
  WHERE "actorUserId" = OLD."id" OR "targetUserId" = OLD."id";

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "record_user_erasure_before_delete"
BEFORE DELETE ON "User"
FOR EACH ROW
EXECUTE FUNCTION sbr_record_user_erasure();

CREATE OR REPLACE FUNCTION sbr_apply_user_erasure(p_user_id TEXT)
RETURNS void AS $$
DECLARE
  placeholder_id TEXT;
  fingerprint TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  fingerprint := md5(p_user_id);
  IF NOT EXISTS (
    SELECT 1 FROM "DataErasureTombstone" WHERE "userFingerprint" = fingerprint
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "User" WHERE "id" = p_user_id) THEN
    UPDATE "DataErasureTombstone"
    SET "lastAppliedAt" = CURRENT_TIMESTAMP
    WHERE "userFingerprint" = fingerprint;
    RETURN;
  END IF;

  SELECT "id" INTO placeholder_id
  FROM "User"
  WHERE "loginIdentifier" = '__deleted_user__'
  LIMIT 1;

  IF placeholder_id IS NULL THEN
    placeholder_id := '__deleted_user_id__';
    INSERT INTO "User" (
      "id", "name", "role", "employeeNumber", "loginIdentifier", "email",
      "vcSmsPhoneNumber", "passwordHash", "isActive", "mustChangePassword",
      "stationCode", "alarmStations", "receiveAlarmFollowUps", "hasAdminAccess",
      "mfaEnabled", "mfaSecretEncrypted", "mfaRecoveryCodes", "mfaEnrolledAt",
      "mfaLastUsedStep", "createdAt", "updatedAt", "lastLoginAt"
    ) VALUES (
      placeholder_id, 'Slettet bruger', 'BRANDFIGHTER'::"UserRole", NULL,
      '__deleted_user__', NULL, NULL, 'disabled-account', false, false,
      NULL, ARRAY[]::TEXT[], false, false, false, NULL, ARRAY[]::TEXT[], NULL,
      NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL
    )
    ON CONFLICT ("loginIdentifier") DO NOTHING;

    SELECT "id" INTO placeholder_id
    FROM "User"
    WHERE "loginIdentifier" = '__deleted_user__'
    LIMIT 1;
  END IF;

  DELETE FROM "Notification"
  WHERE "shiftTransferId" IN (
      SELECT "id" FROM "ShiftTransfer"
      WHERE "giverUserId" = p_user_id OR "receiverUserId" = p_user_id
    )
     OR "returnRequestId" IN (
      SELECT "id" FROM "ReturnRequest"
      WHERE "createdByUserId" = p_user_id
         OR "originalUserId" = p_user_id
         OR "currentHolderUserId" = p_user_id
    );

  UPDATE "ShiftTransfer"
  SET "giverUserId" = placeholder_id,
      "giverNameSnapshot" = 'Slettet bruger',
      "giverEmployeeNumberSnapshot" = 'ANONYMISERET'
  WHERE "giverUserId" = p_user_id;

  UPDATE "ShiftTransfer"
  SET "receiverUserId" = placeholder_id,
      "receiverNameSnapshot" = 'Slettet bruger',
      "receiverEmployeeNumberSnapshot" = 'ANONYMISERET'
  WHERE "receiverUserId" = p_user_id;

  UPDATE "ShiftTransfer" SET "activationConfirmedByUserId" = NULL
  WHERE "activationConfirmedByUserId" = p_user_id;
  UPDATE "ShiftTransfer" SET "returnExecutionConfirmedByUserId" = NULL
  WHERE "returnExecutionConfirmedByUserId" = p_user_id;
  UPDATE "ShiftTransfer" SET "cancelledByUserId" = NULL
  WHERE "cancelledByUserId" = p_user_id;

  UPDATE "ReturnRequest"
  SET "createdByUserId" = placeholder_id
  WHERE "createdByUserId" = p_user_id;

  UPDATE "ReturnRequest"
  SET "originalUserId" = placeholder_id,
      "originalNameSnapshot" = 'Slettet bruger',
      "originalEmployeeNumberSnapshot" = 'ANONYMISERET'
  WHERE "originalUserId" = p_user_id;

  UPDATE "ReturnRequest"
  SET "currentHolderUserId" = placeholder_id,
      "currentHolderNameSnapshot" = 'Slettet bruger',
      "currentHolderEmployeeNumberSnapshot" = 'ANONYMISERET'
  WHERE "currentHolderUserId" = p_user_id;

  UPDATE "ReturnRequest" SET "returnExecutionConfirmedByUserId" = NULL
  WHERE "returnExecutionConfirmedByUserId" = p_user_id;

  UPDATE "BackupSnapshot"
  SET "createdByUserId" = NULL
  WHERE "createdByUserId" = p_user_id;

  UPDATE "AuditLog"
  SET "description" = 'Historisk hændelse vedrørende anonymiseret bruger'
  WHERE "actorUserId" = p_user_id OR "targetUserId" = p_user_id;

  DELETE FROM "LoginAttempt"
  WHERE "identifier" IN (
    SELECT value FROM (
      SELECT "loginIdentifier" AS value FROM "User" WHERE "id" = p_user_id
      UNION
      SELECT "employeeNumber" AS value FROM "User" WHERE "id" = p_user_id
    ) identifiers
    WHERE value IS NOT NULL
  );

  DELETE FROM "User" WHERE "id" = p_user_id;

  UPDATE "DataErasureTombstone"
  SET "lastAppliedAt" = CURRENT_TIMESTAMP
  WHERE "userFingerprint" = fingerprint;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sbr_apply_erasure_tombstone_after_user_insert()
RETURNS trigger AS $$
BEGIN
  IF NEW."loginIdentifier" <> '__deleted_user__'
     AND EXISTS (
       SELECT 1 FROM "DataErasureTombstone"
       WHERE "userFingerprint" = md5(NEW."id")
     ) THEN
    PERFORM sbr_apply_user_erasure(NEW."id");
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "apply_erasure_tombstone_after_user_insert"
AFTER INSERT ON "User"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION sbr_apply_erasure_tombstone_after_user_insert();
