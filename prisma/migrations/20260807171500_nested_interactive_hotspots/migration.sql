ALTER TABLE "operational_hotspot"
  ADD COLUMN "size_px" INTEGER NOT NULL DEFAULT 36;

ALTER TABLE "operational_hotspot"
  ADD CONSTRAINT "operational_hotspot_size_px_check"
  CHECK ("size_px" >= 24 AND "size_px" <= 96);

ALTER TABLE "operational_place"
  ADD COLUMN "interactive_image_id" TEXT;

ALTER TABLE "operational_place"
  ADD CONSTRAINT "operational_place_interactive_image_id_fkey"
  FOREIGN KEY ("interactive_image_id") REFERENCES "operational_image"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "operational_place_interactive_image_id_idx"
  ON "operational_place"("interactive_image_id");

CREATE TABLE "operational_place_hotspot" (
  "id" TEXT NOT NULL,
  "place_id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "label" TEXT NOT NULL DEFAULT '',
  "x_percent" DECIMAL(5,2) NOT NULL,
  "y_percent" DECIMAL(5,2) NOT NULL,
  "size_px" INTEGER NOT NULL DEFAULT 36,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "operational_place_hotspot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "operational_place_hotspot_x_percent_check" CHECK ("x_percent" >= 0 AND "x_percent" <= 100),
  CONSTRAINT "operational_place_hotspot_y_percent_check" CHECK ("y_percent" >= 0 AND "y_percent" <= 100),
  CONSTRAINT "operational_place_hotspot_size_px_check" CHECK ("size_px" >= 24 AND "size_px" <= 96)
);

CREATE INDEX "operational_place_hotspot_place_id_sort_order_idx"
  ON "operational_place_hotspot"("place_id", "sort_order", "created_at");
CREATE INDEX "operational_place_hotspot_item_id_idx"
  ON "operational_place_hotspot"("item_id");

ALTER TABLE "operational_place_hotspot"
  ADD CONSTRAINT "operational_place_hotspot_place_id_fkey"
  FOREIGN KEY ("place_id") REFERENCES "operational_place"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "operational_place_hotspot"
  ADD CONSTRAINT "operational_place_hotspot_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "operational_item"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
