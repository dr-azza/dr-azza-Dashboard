-- Replaces the never-used form_templates / form_requests / form_responses design with the form
-- builder. Refuses to run if any of the old tables hold rows, so no data can be dropped silently.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "form_templates") OR EXISTS (SELECT 1 FROM "form_requests") OR EXISTS (SELECT 1 FROM "form_responses") THEN
    RAISE EXCEPTION 'Old form tables contain data; migrate it before applying 20260927100000_forms_builder';
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "form_language" AS ENUM ('ar', 'en');

-- CreateEnum
CREATE TYPE "form_response_match" AS ENUM ('LINK', 'PHONE', 'STAFF');

-- DropForeignKey
ALTER TABLE "form_requests" DROP CONSTRAINT "form_requests_patient_id_fkey";

-- DropForeignKey
ALTER TABLE "form_requests" DROP CONSTRAINT "form_requests_template_id_fkey";

-- DropForeignKey
ALTER TABLE "form_responses" DROP CONSTRAINT "form_responses_request_id_fkey";

-- DropForeignKey
ALTER TABLE "form_templates" DROP CONSTRAINT "form_templates_clinic_id_fkey";

-- DropIndex
DROP INDEX "form_responses_is_flagged_reviewed_at_idx";

-- DropIndex
DROP INDEX "form_responses_request_id_key";

-- AlterTable
ALTER TABLE "form_responses" DROP COLUMN "flag_reasons",
DROP COLUMN "is_flagged",
DROP COLUMN "request_id",
ADD COLUMN     "clinic_id" UUID NOT NULL,
ADD COLUMN     "form_id" UUID NOT NULL,
ADD COLUMN     "link_id" UUID,
ADD COLUMN     "linked_by_id" UUID,
ADD COLUMN     "matched_by" "form_response_match",
ADD COLUMN     "patient_id" UUID,
ADD COLUMN     "respondent_name" TEXT,
ADD COLUMN     "respondent_phone" TEXT,
ADD COLUMN     "version_id" UUID NOT NULL;

-- DropTable
DROP TABLE "form_requests";

-- DropTable
DROP TABLE "form_templates";

-- CreateTable
CREATE TABLE "forms" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "language" "form_language" NOT NULL DEFAULT 'ar',
    "fields" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "public_token" TEXT NOT NULL,
    "accepting_responses" BOOLEAN NOT NULL DEFAULT true,
    "archived_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_versions" (
    "id" UUID NOT NULL,
    "form_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "language" "form_language" NOT NULL,
    "fields" JSONB NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_links" (
    "id" UUID NOT NULL,
    "form_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "opened_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "forms_public_token_key" ON "forms"("public_token");

-- CreateIndex
CREATE INDEX "forms_clinic_id_updated_at_idx" ON "forms"("clinic_id", "updated_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "form_versions_form_id_version_key" ON "form_versions"("form_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "form_links_token_hash_key" ON "form_links"("token_hash");

-- CreateIndex
CREATE INDEX "form_links_patient_id_created_at_idx" ON "form_links"("patient_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "form_responses_link_id_key" ON "form_responses"("link_id");

-- CreateIndex
CREATE INDEX "form_responses_form_id_submitted_at_idx" ON "form_responses"("form_id", "submitted_at" DESC);

-- CreateIndex
CREATE INDEX "form_responses_patient_id_submitted_at_idx" ON "form_responses"("patient_id", "submitted_at" DESC);

-- CreateIndex
CREATE INDEX "form_responses_clinic_id_reviewed_at_idx" ON "form_responses"("clinic_id", "reviewed_at");

-- AddForeignKey
ALTER TABLE "forms" ADD CONSTRAINT "forms_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forms" ADD CONSTRAINT "forms_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forms" ADD CONSTRAINT "forms_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_versions" ADD CONSTRAINT "form_versions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_versions" ADD CONSTRAINT "form_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_links" ADD CONSTRAINT "form_links_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_links" ADD CONSTRAINT "form_links_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_links" ADD CONSTRAINT "form_links_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "form_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "form_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_linked_by_id_fkey" FOREIGN KEY ("linked_by_id") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

