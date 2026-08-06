CREATE TABLE "operational_portal_user_access" (
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operational_portal_user_access_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "operational_portal_user_access"
  ADD CONSTRAINT "operational_portal_user_access_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "operational_portal_user_access_created_at_idx"
  ON "operational_portal_user_access"("created_at");
