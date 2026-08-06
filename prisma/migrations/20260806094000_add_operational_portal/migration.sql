CREATE TABLE "operational_vehicle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operational_vehicle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "operational_vehicle_name_key" ON "operational_vehicle"("name");
CREATE INDEX "operational_vehicle_sort_order_name_idx" ON "operational_vehicle"("sort_order", "name");

CREATE TABLE "operational_place" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operational_place_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "operational_place_vehicle_id_sort_order_name_idx" ON "operational_place"("vehicle_id", "sort_order", "name");
ALTER TABLE "operational_place" ADD CONSTRAINT "operational_place_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "operational_vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "operational_item" (
    "id" TEXT NOT NULL,
    "place_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT NOT NULL DEFAULT '',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operational_item_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "operational_item_place_id_sort_order_name_idx" ON "operational_item"("place_id", "sort_order", "name");
ALTER TABLE "operational_item" ADD CONSTRAINT "operational_item_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "operational_place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "operational_document" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT,
    "title" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "storage_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operational_document_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "operational_document_storage_name_key" ON "operational_document"("storage_name");
CREATE INDEX "operational_document_vehicle_id_created_at_idx" ON "operational_document"("vehicle_id", "created_at");
ALTER TABLE "operational_document" ADD CONSTRAINT "operational_document_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "operational_vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "operational_video" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT,
    "item_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'Udstyr',
    "youtube_url" TEXT NOT NULL,
    "youtube_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operational_video_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "operational_video_vehicle_id_sort_order_idx" ON "operational_video"("vehicle_id", "sort_order");
CREATE INDEX "operational_video_item_id_sort_order_idx" ON "operational_video"("item_id", "sort_order");
ALTER TABLE "operational_video" ADD CONSTRAINT "operational_video_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "operational_vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "operational_video" ADD CONSTRAINT "operational_video_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "operational_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
