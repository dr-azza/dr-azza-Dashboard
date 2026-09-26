-- CreateEnum
CREATE TYPE "staff_role" AS ENUM ('OWNER', 'DOCTOR', 'NURSE', 'RECEPTION');

-- CreateEnum
CREATE TYPE "case_type" AS ENUM ('PREGNANCY', 'GYNECOLOGY', 'POSTPARTUM', 'FERTILITY');

-- CreateEnum
CREATE TYPE "patient_status" AS ENUM ('OK', 'FLAGGED', 'OVERDUE', 'AWAITING');

-- CreateEnum
CREATE TYPE "pregnancy_status" AS ENUM ('ACTIVE', 'DELIVERED', 'ENDED');

-- CreateEnum
CREATE TYPE "channel" AS ENUM ('WHATSAPP', 'SMS', 'LINK');

-- CreateEnum
CREATE TYPE "delivery_status" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "clinics" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Cairo',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "clinics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_members" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "staff_role" NOT NULL,
    "password_hash" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "staff_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "file_number" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "full_name_ar" TEXT,
    "date_of_birth" DATE,
    "phone" TEXT NOT NULL,
    "case_type" "case_type" NOT NULL,
    "status" "patient_status" NOT NULL DEFAULT 'OK',
    "consent_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "archived_at" TIMESTAMPTZ(3),

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pregnancies" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "lmp" DATE NOT NULL,
    "edd_override" DATE,
    "gravida" INTEGER,
    "para" INTEGER,
    "blood_group" TEXT,
    "risk_notes" TEXT,
    "status" "pregnancy_status" NOT NULL DEFAULT 'ACTIVE',
    "ended_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pregnancies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visits" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "pregnancy_id" UUID,
    "recorded_by_id" UUID,
    "visited_at" TIMESTAMPTZ(3) NOT NULL,
    "weight_kg" DECIMAL(5,2),
    "systolic" INTEGER,
    "diastolic" INTEGER,
    "fundal_height_cm" DECIMAL(4,1),
    "fetal_heart_rate" INTEGER,
    "notes" TEXT,
    "is_patient_report" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_templates" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "schema" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "form_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_requests" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "channel" "channel" NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "sent_at" TIMESTAMPTZ(3),
    "opened_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_responses" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "answers" JSONB NOT NULL,
    "is_flagged" BOOLEAN NOT NULL DEFAULT false,
    "flag_reasons" TEXT[],
    "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(3),
    "reviewed_by_id" UUID,

    CONSTRAINT "form_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "patient_id" UUID,
    "kind" TEXT NOT NULL,
    "channel" "channel" NOT NULL,
    "scheduled_for" TIMESTAMPTZ(3) NOT NULL,
    "status" "delivery_status" NOT NULL DEFAULT 'QUEUED',
    "payload" JSONB NOT NULL,
    "sent_at" TIMESTAMPTZ(3),
    "error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "clinic_id" UUID,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "ip" TEXT,
    "meta" JSONB,
    "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clinics_slug_key" ON "clinics"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "staff_members_clinic_id_email_key" ON "staff_members"("clinic_id", "email");

-- CreateIndex
CREATE INDEX "patients_clinic_id_status_idx" ON "patients"("clinic_id", "status");

-- CreateIndex
CREATE INDEX "patients_clinic_id_case_type_idx" ON "patients"("clinic_id", "case_type");

-- CreateIndex
CREATE UNIQUE INDEX "patients_clinic_id_file_number_key" ON "patients"("clinic_id", "file_number");

-- CreateIndex
CREATE INDEX "pregnancies_patient_id_status_idx" ON "pregnancies"("patient_id", "status");

-- CreateIndex
CREATE INDEX "visits_patient_id_visited_at_idx" ON "visits"("patient_id", "visited_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "form_templates_clinic_id_key_version_key" ON "form_templates"("clinic_id", "key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "form_requests_token_hash_key" ON "form_requests"("token_hash");

-- CreateIndex
CREATE INDEX "form_requests_patient_id_created_at_idx" ON "form_requests"("patient_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "form_responses_request_id_key" ON "form_responses"("request_id");

-- CreateIndex
CREATE INDEX "form_responses_is_flagged_reviewed_at_idx" ON "form_responses"("is_flagged", "reviewed_at");

-- CreateIndex
CREATE INDEX "reminders_status_scheduled_for_idx" ON "reminders"("status", "scheduled_for");

-- CreateIndex
CREATE INDEX "reminders_clinic_id_scheduled_for_idx" ON "reminders"("clinic_id", "scheduled_for");

-- CreateIndex
CREATE INDEX "audit_logs_clinic_id_at_idx" ON "audit_logs"("clinic_id", "at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pregnancies" ADD CONSTRAINT "pregnancies_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_pregnancy_id_fkey" FOREIGN KEY ("pregnancy_id") REFERENCES "pregnancies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_templates" ADD CONSTRAINT "form_templates_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_requests" ADD CONSTRAINT "form_requests_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "form_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_requests" ADD CONSTRAINT "form_requests_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "form_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
