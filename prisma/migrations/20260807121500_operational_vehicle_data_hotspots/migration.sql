ALTER TABLE "operational_vehicle"
  ADD COLUMN "code" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "model" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "year" INTEGER,
  ADD COLUMN "fuel" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "crew" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "function_text" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "interactive_image_id" TEXT;

ALTER TABLE "operational_place"
  ADD COLUMN "description" TEXT NOT NULL DEFAULT '';

ALTER TABLE "operational_item"
  ADD COLUMN "specifications" TEXT NOT NULL DEFAULT '';

ALTER TABLE "operational_vehicle"
  ADD CONSTRAINT "operational_vehicle_interactive_image_id_fkey"
  FOREIGN KEY ("interactive_image_id") REFERENCES "operational_image"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "operational_vehicle_interactive_image_id_idx"
  ON "operational_vehicle"("interactive_image_id");

CREATE TABLE "operational_hotspot" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "place_id" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "x_percent" DECIMAL(5,2) NOT NULL,
    "y_percent" DECIMAL(5,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operational_hotspot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "operational_hotspot_x_percent_check" CHECK ("x_percent" >= 0 AND "x_percent" <= 100),
    CONSTRAINT "operational_hotspot_y_percent_check" CHECK ("y_percent" >= 0 AND "y_percent" <= 100)
);

CREATE INDEX "operational_hotspot_vehicle_id_sort_order_idx"
  ON "operational_hotspot"("vehicle_id", "sort_order", "created_at");
CREATE INDEX "operational_hotspot_place_id_idx"
  ON "operational_hotspot"("place_id");

ALTER TABLE "operational_hotspot"
  ADD CONSTRAINT "operational_hotspot_vehicle_id_fkey"
  FOREIGN KEY ("vehicle_id") REFERENCES "operational_vehicle"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "operational_hotspot"
  ADD CONSTRAINT "operational_hotspot_place_id_fkey"
  FOREIGN KEY ("place_id") REFERENCES "operational_place"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
