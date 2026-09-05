-- ============================================================================
-- Which regulator's rules the organisation works under
-- ============================================================================
-- The settings screen has always had a "Regulator" box. It was editable, it
-- accepted what you typed, and Save reported success — but there was no column
-- behind it, so the value disappeared on the next load. A setting that quietly
-- refuses to save is worse than one that is missing.
--
-- This is not cosmetic. It decides which working-hours limits apply: an
-- 11-hour driving limit under FMCSA is a 9-hour one under EU rules, and the
-- rule engine has to know which set to evaluate against. Storing it as text
-- rather than an enum on purpose — the set of supported rule books is not
-- settled, and a new one should not need a migration to name.
-- ============================================================================

alter table public.organizations
  add column hos_regulator text;

comment on column public.organizations.hos_regulator is
  'Which working-hours rule book applies, e.g. FMCSA or EU. Read by the rule engine to pick limits.';
