ALTER TABLE "operational_document"
  ADD COLUMN "place_id" TEXT,
  ADD COLUMN "item_id" TEXT,
  ADD COLUMN "category" TEXT NOT NULL DEFAULT 'Dokument',
  ADD COLUMN "description" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "operational_document_place_id_created_at_idx"
  ON "operational_document"("place_id", "created_at");
CREATE INDEX "operational_document_item_id_created_at_idx"
  ON "operational_document"("item_id", "created_at");
CREATE INDEX "operational_document_category_created_at_idx"
  ON "operational_document"("category", "created_at");

ALTER TABLE "operational_document"
  ADD CONSTRAINT "operational_document_place_id_fkey"
  FOREIGN KEY ("place_id") REFERENCES "operational_place"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "operational_document"
  ADD CONSTRAINT "operational_document_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "operational_item"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "operational_video"
  ADD COLUMN "place_id" TEXT;

CREATE INDEX "operational_video_place_id_sort_order_idx"
  ON "operational_video"("place_id", "sort_order");

ALTER TABLE "operational_video"
  ADD CONSTRAINT "operational_video_place_id_fkey"
  FOREIGN KEY ("place_id") REFERENCES "operational_place"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
