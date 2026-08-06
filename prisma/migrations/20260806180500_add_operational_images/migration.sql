CREATE TABLE "operational_image" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "place_id" TEXT,
    "item_id" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "alt_text" TEXT NOT NULL DEFAULT '',
    "original_name" TEXT NOT NULL,
    "storage_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "is_cover" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operational_image_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "operational_image_target_check" CHECK (
      ("place_id" IS NULL OR "vehicle_id" IS NOT NULL) AND
      ("item_id" IS NULL OR "place_id" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "operational_image_storage_name_key"
  ON "operational_image"("storage_name");
CREATE INDEX "operational_image_vehicle_id_created_at_idx"
  ON "operational_image"("vehicle_id", "created_at");
CREATE INDEX "operational_image_place_id_created_at_idx"
  ON "operational_image"("place_id", "created_at");
CREATE INDEX "operational_image_item_id_created_at_idx"
  ON "operational_image"("item_id", "created_at");
CREATE UNIQUE INDEX "operational_image_vehicle_cover_key"
  ON "operational_image"("vehicle_id")
  WHERE "is_cover" = true AND "place_id" IS NULL AND "item_id" IS NULL;
CREATE UNIQUE INDEX "operational_image_place_cover_key"
  ON "operational_image"("place_id")
  WHERE "is_cover" = true AND "place_id" IS NOT NULL AND "item_id" IS NULL;
CREATE UNIQUE INDEX "operational_image_item_cover_key"
  ON "operational_image"("item_id")
  WHERE "is_cover" = true AND "item_id" IS NOT NULL;

ALTER TABLE "operational_image"
  ADD CONSTRAINT "operational_image_vehicle_id_fkey"
  FOREIGN KEY ("vehicle_id") REFERENCES "operational_vehicle"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "operational_image"
  ADD CONSTRAINT "operational_image_place_id_fkey"
  FOREIGN KEY ("place_id") REFERENCES "operational_place"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "operational_image"
  ADD CONSTRAINT "operational_image_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "operational_item"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
