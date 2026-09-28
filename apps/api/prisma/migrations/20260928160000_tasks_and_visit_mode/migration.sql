-- CreateEnum
CREATE TYPE "patient_visit_mode" AS ENUM ('IN_CLINIC', 'ONLINE');

-- CreateEnum
CREATE TYPE "task_priority" AS ENUM ('NORMAL', 'HIGH');

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "visit_mode" "patient_visit_mode" NOT NULL DEFAULT 'IN_CLINIC';

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "due_at" TIMESTAMPTZ(3) NOT NULL,
    "priority" "task_priority" NOT NULL DEFAULT 'NORMAL',
    "assignee_id" UUID,
    "patient_id" UUID,
    "created_by_id" UUID,
    "completed_at" TIMESTAMPTZ(3),
    "completed_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tasks_clinic_id_completed_at_due_at_idx" ON "tasks"("clinic_id", "completed_at", "due_at");

-- CreateIndex
CREATE INDEX "tasks_assignee_id_completed_at_due_at_idx" ON "tasks"("assignee_id", "completed_at", "due_at");

-- CreateIndex
CREATE INDEX "tasks_patient_id_due_at_idx" ON "tasks"("patient_id", "due_at");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

