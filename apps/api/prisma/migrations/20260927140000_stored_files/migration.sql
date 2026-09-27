-- File bytes in the database, for hosts without a lasting disk (STORAGE_DRIVER=database).
-- CreateTable
CREATE TABLE "stored_files" (
    "key" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("key")
);

