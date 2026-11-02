-- How far each recurring expense has been brought up to date, so reads only add what's newly due
-- and resuming or extending one never back-fills the months it was off.
ALTER TABLE "recurring_expenses" ADD COLUMN "materialized_through" DATE;
