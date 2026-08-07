CREATE TABLE "operational_vehicle_view" (
  "id" TEXT NOT NULL,
  "vehicle_id" TEXT NOT NULL,
  "view_key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "image_id" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "operational_vehicle_view_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "operational_vehicle_view_key_check" CHECK ("view_key" IN ('front', 'right', 'rear', 'left', 'roof')),
  CONSTRAINT "operational_vehicle_view_vehicle_key_unique" UNIQUE ("vehicle_id", "view_key")
);

CREATE INDEX "operational_vehicle_view_vehicle_order_idx"
  ON "operational_vehicle_view"("vehicle_id", "sort_order");

ALTER TABLE "operational_vehicle_view"
  ADD CONSTRAINT "operational_vehicle_view_vehicle_id_fkey"
  FOREIGN KEY ("vehicle_id") REFERENCES "operational_vehicle"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "operational_vehicle_view"
  ADD CONSTRAINT "operational_vehicle_view_image_id_fkey"
  FOREIGN KEY ("image_id") REFERENCES "operational_image"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "operational_hotspot"
  ADD COLUMN "view_key" TEXT NOT NULL DEFAULT 'front';

ALTER TABLE "operational_hotspot"
  ADD CONSTRAINT "operational_hotspot_view_key_check"
  CHECK ("view_key" IN ('front', 'right', 'rear', 'left', 'roof'));

CREATE INDEX "operational_hotspot_vehicle_view_sort_idx"
  ON "operational_hotspot"("vehicle_id", "view_key", "sort_order", "created_at");

INSERT INTO "operational_vehicle_view" ("id", "vehicle_id", "view_key", "label", "image_id", "sort_order")
SELECT md5(v.id || ':front'), v.id, 'front', 'Front', v.interactive_image_id, 0
FROM "operational_vehicle" v
WHERE v.interactive_image_id IS NOT NULL
ON CONFLICT ("vehicle_id", "view_key") DO NOTHING;
