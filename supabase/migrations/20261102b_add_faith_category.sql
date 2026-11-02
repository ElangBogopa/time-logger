-- Add 'faith' to the time_category enum.
--
-- Religious and spiritual practice had no category. An evaluation over 140
-- such entries (prayer, salah, Quran study, Bible study, mass, synagogue,
-- puja, fasting) scattered them across ten categories with a quarter landing
-- in 'other' — which aggregates to Ops, so a person's prayer was being
-- reported as operational overhead. No prompt wording fixed it, because the
-- taxonomy had no home for the thing.
--
-- Enum values cannot be removed in Postgres, so this is additive and safe to
-- re-run. Existing rows keep whatever they were given; only new
-- categorisations use it.

ALTER TYPE time_category ADD VALUE IF NOT EXISTS 'faith';
