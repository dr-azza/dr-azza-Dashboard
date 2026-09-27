-- CreateTable
CREATE TABLE "history_entries" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "author_id" UUID,
    "edited_by_id" UUID,
    "recorded_on" DATE NOT NULL,
    "title" TEXT,
    "body_html" TEXT NOT NULL,
    "body_text" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "history_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "history_entries_patient_id_recorded_on_created_at_idx" ON "history_entries"("patient_id", "recorded_on" DESC, "created_at" DESC);

-- AddForeignKey
ALTER TABLE "history_entries" ADD CONSTRAINT "history_entries_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "history_entries" ADD CONSTRAINT "history_entries_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "history_entries" ADD CONSTRAINT "history_entries_edited_by_id_fkey" FOREIGN KEY ("edited_by_id") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

