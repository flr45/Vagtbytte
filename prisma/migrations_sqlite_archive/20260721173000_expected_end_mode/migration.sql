-- Existing local transfers with an expectedEndAt keep that precise expected return time.
-- Existing local transfers without expectedEndAt are treated as "Til vagtens slutning".
ALTER TABLE "ShiftTransfer" ADD COLUMN "expectedEndMode" TEXT NOT NULL DEFAULT 'UNTIL_SHIFT_END';

UPDATE "ShiftTransfer"
SET "expectedEndMode" = 'SPECIFIC_TIME'
WHERE "expectedEndAt" IS NOT NULL;
