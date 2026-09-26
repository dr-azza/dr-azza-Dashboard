-- Case types become a per-clinic table so each clinic can add its own cases.
-- Existing patients keep their case: the four built-in cases are created for every clinic
-- and each patient is pointed at the one matching the old enum value.

-- 1. The table
CREATE TABLE "case_types" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "system_key" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "case_types_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "case_types_clinic_id_sort_order_idx" ON "case_types"("clinic_id", "sort_order");
CREATE UNIQUE INDEX "case_types_clinic_id_name_en_key" ON "case_types"("clinic_id", "name_en");
CREATE UNIQUE INDEX "case_types_clinic_id_system_key_key" ON "case_types"("clinic_id", "system_key");
ALTER TABLE "case_types" ADD CONSTRAINT "case_types_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Built-in cases for every existing clinic (same list the API creates for new clinics)
INSERT INTO "case_types" ("id", "clinic_id", "name_en", "name_ar", "system_key", "sort_order", "updated_at")
SELECT gen_random_uuid(), c."id", v.name_en, v.name_ar, v.system_key, v.sort_order, CURRENT_TIMESTAMP
FROM "clinics" c
CROSS JOIN (VALUES
    ('Pregnancy',  'حمل',          'PREGNANCY',  10),
    ('Gynecology', 'أمراض نساء',   'GYNECOLOGY', 20),
    ('Postpartum', 'بعد الولادة',  'POSTPARTUM', 30),
    ('Fertility',  'خصوبة',        'FERTILITY',  40)
) AS v(name_en, name_ar, system_key, sort_order);

-- 3. Point every patient at the matching case, then enforce it
ALTER TABLE "patients" ADD COLUMN "case_type_id" UUID;

UPDATE "patients" p
SET "case_type_id" = ct."id"
FROM "case_types" ct
WHERE ct."clinic_id" = p."clinic_id" AND ct."system_key" = p."case_type"::text;

ALTER TABLE "patients" ALTER COLUMN "case_type_id" SET NOT NULL;
ALTER TABLE "patients" ADD CONSTRAINT "patients_case_type_id_fkey" FOREIGN KEY ("case_type_id") REFERENCES "case_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "patients_clinic_id_case_type_id_idx" ON "patients"("clinic_id", "case_type_id");

-- 4. Remove the old enum column
DROP INDEX "patients_clinic_id_case_type_idx";
ALTER TABLE "patients" DROP COLUMN "case_type";
DROP TYPE "case_type";
