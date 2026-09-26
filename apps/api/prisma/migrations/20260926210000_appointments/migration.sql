-- Appointments: anything booked with a patient (visit, call, scan, lab test, follow-up).

-- CreateEnum
CREATE TYPE "appointment_type" AS ENUM ('VISIT', 'CALL', 'SCAN', 'LAB', 'FOLLOW_UP', 'OTHER');

-- CreateEnum
CREATE TYPE "appointment_status" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "type" "appointment_type" NOT NULL,
    "title" TEXT,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 15,
    "status" "appointment_status" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "assigned_to_id" UUID,
    "created_by_id" UUID,
    "closed_at" TIMESTAMPTZ(3),
    "cancel_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appointments_clinic_id_starts_at_idx" ON "appointments"("clinic_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_patient_id_starts_at_idx" ON "appointments"("patient_id", "starts_at" DESC);

-- CreateIndex
CREATE INDEX "appointments_assigned_to_id_starts_at_idx" ON "appointments"("assigned_to_id", "starts_at");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

