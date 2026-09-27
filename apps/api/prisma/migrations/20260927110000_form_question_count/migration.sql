-- Question count stored with the form, so the forms list never has to load every form's questions.
ALTER TABLE "forms" ADD COLUMN "question_count" INTEGER NOT NULL DEFAULT 0;

UPDATE "forms" f
SET "question_count" = (
  SELECT count(*) FROM jsonb_array_elements(f."fields") AS q WHERE q->>'type' <> 'section'
);
