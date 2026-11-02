-- CreateEnum
CREATE TYPE "finance_kind" AS ENUM ('INCOME', 'EXPENSE');

-- CreateTable
CREATE TABLE "finance_categories" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "kind" "finance_kind" NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "system_key" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_entries" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "kind" "finance_kind" NOT NULL,
    "category_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'EGP',
    "method" "payment_method" NOT NULL,
    "occurred_on" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "counterparty" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "recurring_id" UUID,
    "recurrence_month" DATE,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "voided_at" TIMESTAMPTZ(3),
    "void_reason" TEXT,
    "voided_by_id" UUID,

    CONSTRAINT "finance_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_receipts" (
    "id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "uploaded_by_id" UUID,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "finance_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_expenses" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'EGP',
    "method" "payment_method" NOT NULL,
    "description" TEXT NOT NULL,
    "counterparty" TEXT,
    "day_of_month" INTEGER NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE,
    "paused_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recurring_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "finance_categories_clinic_id_kind_idx" ON "finance_categories"("clinic_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "finance_categories_clinic_id_system_key_key" ON "finance_categories"("clinic_id", "system_key");

-- CreateIndex
CREATE INDEX "finance_entries_clinic_id_occurred_on_idx" ON "finance_entries"("clinic_id", "occurred_on");

-- CreateIndex
CREATE UNIQUE INDEX "finance_entries_recurring_id_recurrence_month_key" ON "finance_entries"("recurring_id", "recurrence_month");

-- CreateIndex
CREATE UNIQUE INDEX "finance_receipts_storage_key_key" ON "finance_receipts"("storage_key");

-- CreateIndex
CREATE INDEX "finance_receipts_entry_id_idx" ON "finance_receipts"("entry_id");

-- CreateIndex
CREATE INDEX "recurring_expenses_clinic_id_idx" ON "recurring_expenses"("clinic_id");

-- AddForeignKey
ALTER TABLE "finance_categories" ADD CONSTRAINT "finance_categories_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_entries" ADD CONSTRAINT "finance_entries_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_entries" ADD CONSTRAINT "finance_entries_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "finance_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_entries" ADD CONSTRAINT "finance_entries_recurring_id_fkey" FOREIGN KEY ("recurring_id") REFERENCES "recurring_expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_entries" ADD CONSTRAINT "finance_entries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_entries" ADD CONSTRAINT "finance_entries_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_receipts" ADD CONSTRAINT "finance_receipts_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "finance_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_receipts" ADD CONSTRAINT "finance_receipts_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "finance_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Guards the API also enforces, kept in the database so no path can store bad money.
ALTER TABLE "finance_entries" ADD CONSTRAINT "finance_entries_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_day_of_month" CHECK ("day_of_month" BETWEEN 1 AND 28);
