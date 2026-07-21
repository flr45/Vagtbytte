ALTER TABLE "Availability"
ADD COLUMN "assignedShiftStart" TIMESTAMP(3),
ADD COLUMN "assignedShiftEnd" TIMESTAMP(3);

CREATE INDEX "Availability_assignedShiftStart_assignedShiftEnd_idx"
ON "Availability"("assignedShiftStart", "assignedShiftEnd");
