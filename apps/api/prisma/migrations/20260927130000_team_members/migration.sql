-- Team management: phone numbers, one-time password links, and sign-in emails unique across
-- clinics (stored trimmed and lower-case). Stops if two accounts would end up with the same email.
DO $$
BEGIN
  IF EXISTS (SELECT lower(trim(email)) FROM "staff_members" GROUP BY lower(trim(email)) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Two staff accounts share an email (ignoring case); resolve before applying 20260927130000_team_members';
  END IF;
END $$;

UPDATE "staff_members" SET "email" = lower(trim("email")) WHERE "email" <> lower(trim("email"));

-- DropIndex
DROP INDEX "staff_members_clinic_id_email_key";

-- AlterTable
ALTER TABLE "staff_members" ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "staff_invites" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_invites_token_hash_key" ON "staff_invites"("token_hash");

-- CreateIndex
CREATE INDEX "staff_invites_staff_id_created_at_idx" ON "staff_invites"("staff_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "staff_members_email_key" ON "staff_members"("email");

-- CreateIndex
CREATE INDEX "staff_members_clinic_id_full_name_idx" ON "staff_members"("clinic_id", "full_name");

-- AddForeignKey
ALTER TABLE "staff_invites" ADD CONSTRAINT "staff_invites_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_invites" ADD CONSTRAINT "staff_invites_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

