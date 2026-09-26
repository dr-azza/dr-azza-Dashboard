-- CreateEnum
CREATE TYPE "pregnancy_outcome" AS ENUM ('LIVE_BIRTH', 'STILLBIRTH', 'MISCARRIAGE', 'ECTOPIC', 'TERMINATION', 'MOLAR');

-- CreateEnum
CREATE TYPE "delivery_mode" AS ENUM ('VAGINAL', 'ASSISTED', 'CESAREAN');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('CASH', 'INSTAPAY', 'VODAFONE_CASH', 'CARD', 'BANK_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "attachment_kind" AS ENUM ('PAYMENT_PROOF', 'LAB_RESULT', 'SCAN', 'REPORT', 'PRESCRIPTION_SCAN', 'OTHER');

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_histories" (
    "patient_id" UUID NOT NULL,
    "allergies" JSONB NOT NULL DEFAULT '[]',
    "chronic_conditions" TEXT[],
    "current_medications" TEXT[],
    "surgeries" JSONB NOT NULL DEFAULT '[]',
    "blood_group" TEXT,
    "family_history" TEXT,
    "smoking" BOOLEAN,
    "menarche_age" INTEGER,
    "cycle_length_days" INTEGER,
    "period_length_days" INTEGER,
    "cycle_regular" BOOLEAN,
    "contraception" TEXT,
    "last_pap_smear_at" DATE,
    "last_pap_smear_result" TEXT,
    "gyn_notes" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" UUID,

    CONSTRAINT "medical_histories_pkey" PRIMARY KEY ("patient_id")
);

-- CreateTable
CREATE TABLE "obstetric_history_entries" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "year" INTEGER,
    "outcome" "pregnancy_outcome" NOT NULL,
    "delivery_mode" "delivery_mode",
    "gestation_weeks" INTEGER,
    "birth_weight_g" INTEGER,
    "complications" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "obstetric_history_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "prescribed_by_id" UUID,
    "number" TEXT NOT NULL,
    "issued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diagnosis" TEXT,
    "notes" TEXT,
    "voided_at" TIMESTAMPTZ(3),
    "void_reason" TEXT,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_items" (
    "id" UUID NOT NULL,
    "prescription_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "drug_name" TEXT NOT NULL,
    "dose" TEXT,
    "frequency" TEXT,
    "duration" TEXT,
    "instructions" TEXT,

    CONSTRAINT "prescription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "received_by_id" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'EGP',
    "method" "payment_method" NOT NULL,
    "purpose" TEXT NOT NULL,
    "reference" TEXT,
    "paid_at" TIMESTAMPTZ(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voided_at" TIMESTAMPTZ(3),
    "void_reason" TEXT,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "uploaded_by_id" UUID,
    "payment_id" UUID,
    "kind" "attachment_kind" NOT NULL,
    "title" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "taken_at" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_notes" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "author_id" UUID,
    "body" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_staff_id_idx" ON "sessions"("staff_id");

-- CreateIndex
CREATE INDEX "obstetric_history_entries_patient_id_idx" ON "obstetric_history_entries"("patient_id");

-- CreateIndex
CREATE INDEX "prescriptions_patient_id_issued_at_idx" ON "prescriptions"("patient_id", "issued_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "prescriptions_patient_id_number_key" ON "prescriptions"("patient_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "prescription_items_prescription_id_position_key" ON "prescription_items"("prescription_id", "position");

-- CreateIndex
CREATE INDEX "payments_patient_id_paid_at_idx" ON "payments"("patient_id", "paid_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "attachments_storage_key_key" ON "attachments"("storage_key");

-- CreateIndex
CREATE INDEX "attachments_patient_id_kind_created_at_idx" ON "attachments"("patient_id", "kind", "created_at" DESC);

-- CreateIndex
CREATE INDEX "clinical_notes_patient_id_created_at_idx" ON "clinical_notes"("patient_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_histories" ADD CONSTRAINT "medical_histories_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obstetric_history_entries" ADD CONSTRAINT "obstetric_history_entries_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_prescribed_by_id_fkey" FOREIGN KEY ("prescribed_by_id") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
