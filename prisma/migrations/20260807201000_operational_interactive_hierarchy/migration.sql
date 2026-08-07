CREATE TABLE "operational_interactive_node" (
  "id" TEXT NOT NULL,
  "place_id" TEXT NOT NULL,
  "parent_node_id" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "image_id" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "operational_interactive_node_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "operational_interactive_node_place_parent_order_idx"
  ON "operational_interactive_node"("place_id", "parent_node_id", "sort_order", "created_at");

ALTER TABLE "operational_interactive_node"
  ADD CONSTRAINT "operational_interactive_node_place_id_fkey"
  FOREIGN KEY ("place_id") REFERENCES "operational_place"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "operational_interactive_node"
  ADD CONSTRAINT "operational_interactive_node_parent_id_fkey"
  FOREIGN KEY ("parent_node_id") REFERENCES "operational_interactive_node"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "operational_interactive_node"
  ADD CONSTRAINT "operational_interactive_node_image_id_fkey"
  FOREIGN KEY ("image_id") REFERENCES "operational_image"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "operational_interactive_link" (
  "id" TEXT NOT NULL,
  "place_id" TEXT NOT NULL,
  "source_node_id" TEXT,
  "target_node_id" TEXT,
  "item_id" TEXT,
  "label" TEXT NOT NULL DEFAULT '',
  "x_percent" DECIMAL(6,3) NOT NULL,
  "y_percent" DECIMAL(6,3) NOT NULL,
  "size_px" INTEGER NOT NULL DEFAULT 40,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "operational_interactive_link_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "operational_interactive_link_target_check" CHECK (
    (("target_node_id" IS NOT NULL)::int + ("item_id" IS NOT NULL)::int) = 1
  ),
  CONSTRAINT "operational_interactive_link_x_check" CHECK ("x_percent" >= 0 AND "x_percent" <= 100),
  CONSTRAINT "operational_interactive_link_y_check" CHECK ("y_percent" >= 0 AND "y_percent" <= 100),
  CONSTRAINT "operational_interactive_link_size_check" CHECK ("size_px" >= 24 AND "size_px" <= 96)
);

CREATE INDEX "operational_interactive_link_source_order_idx"
  ON "operational_interactive_link"("place_id", "source_node_id", "sort_order", "created_at")
  WHERE "deleted_at" IS NULL;

CREATE INDEX "operational_interactive_link_target_node_idx"
  ON "operational_interactive_link"("target_node_id")
  WHERE "target_node_id" IS NOT NULL AND "deleted_at" IS NULL;

CREATE INDEX "operational_interactive_link_item_idx"
  ON "operational_interactive_link"("item_id")
  WHERE "item_id" IS NOT NULL AND "deleted_at" IS NULL;

ALTER TABLE "operational_interactive_link"
  ADD CONSTRAINT "operational_interactive_link_place_id_fkey"
  FOREIGN KEY ("place_id") REFERENCES "operational_place"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "operational_interactive_link"
  ADD CONSTRAINT "operational_interactive_link_source_node_id_fkey"
  FOREIGN KEY ("source_node_id") REFERENCES "operational_interactive_node"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "operational_interactive_link"
  ADD CONSTRAINT "operational_interactive_link_target_node_id_fkey"
  FOREIGN KEY ("target_node_id") REFERENCES "operational_interactive_node"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "operational_interactive_link"
  ADD CONSTRAINT "operational_interactive_link_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "operational_item"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Bevar alle eksisterende rum -> værktøj-plusser som rod-links i den nye motor.
INSERT INTO "operational_interactive_link"
  ("id", "place_id", "source_node_id", "target_node_id", "item_id", "label", "x_percent", "y_percent", "size_px", "sort_order", "created_at", "updated_at")
SELECT
  h."id", h."place_id", NULL, NULL, h."item_id", COALESCE(h."label", ''),
  h."x_percent", h."y_percent", h."size_px", h."sort_order", h."created_at", h."updated_at"
FROM "operational_place_hotspot" h
ON CONFLICT ("id") DO NOTHING;
