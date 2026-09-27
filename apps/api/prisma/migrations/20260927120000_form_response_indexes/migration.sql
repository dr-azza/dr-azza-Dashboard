-- CreateIndex
CREATE INDEX "form_responses_clinic_id_submitted_at_idx" ON "form_responses"("clinic_id", "submitted_at" DESC);

-- CreateIndex
CREATE INDEX "form_responses_clinic_id_patient_id_idx" ON "form_responses"("clinic_id", "patient_id");

