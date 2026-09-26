-- Patient link on audit entries, as an indexed column instead of a JSON lookup.
ALTER TABLE "audit_logs" ADD COLUMN "patient_id" UUID;

-- Backfill from the JSON meta written by earlier versions, and from patient.create entries.
UPDATE "audit_logs"
SET "patient_id" = ("meta"->>'patientId')::uuid
WHERE "meta" ? 'patientId';

UPDATE "audit_logs"
SET "patient_id" = "entity_id"::uuid
WHERE "patient_id" IS NULL AND "entity" = 'patient'
  AND "entity_id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

CREATE INDEX "audit_logs_clinic_id_patient_id_id_idx" ON "audit_logs"("clinic_id", "patient_id", "id" DESC);
