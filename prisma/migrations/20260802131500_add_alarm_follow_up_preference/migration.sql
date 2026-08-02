ALTER TABLE "User"
ADD COLUMN "receiveAlarmFollowUps" BOOLEAN NOT NULL DEFAULT false;

-- Bevar den nuværende adfærd for eksisterende brandmænd. Nye brugere
-- skal aktivt tilmeldes opfølgende sendinger i administrationen.
UPDATE "User"
SET "receiveAlarmFollowUps" = true
WHERE "role" = 'BRANDFIGHTER'::"UserRole"
  AND "loginIdentifier" <> '__deleted_user__';
