-- ============================================================================
-- One driver per email, and one per phone number
-- ============================================================================
-- The console let a second driver be created on an email that already had one.
-- Nothing complained until the INVITATION failed, by which point the roster row
-- existed, and the error it produced blamed an account "left behind by a driver
-- who was removed" — which was not what had happened and gave the office
-- nothing to act on.
--
-- The email is how a driver signs into the app. Two roster rows on one address
-- cannot both be that driver, so it is not a preference, it is an invariant,
-- and invariants belong in the database. A check in the form alone is a check
-- that a second browser tab, a slow network or a future script walks straight
-- past.
--
-- ---------------------------------------------------------------------------
-- Why partial, and why per organisation
-- ---------------------------------------------------------------------------
-- WHERE deleted_at IS NULL, so a removed driver stops holding their address
-- hostage. That is the whole point of removing them — the console deletes the
-- auth account for the same reason, and an index that kept blocking the email
-- afterwards would undo it.
--
-- Scoped to the organisation, like everything else in this schema. Globally
-- unique emails are enforced anyway, one layer down: Supabase auth refuses a
-- second account on the same address, so two fleets cannot both have that
-- driver signed in regardless of what the roster says.
-- ============================================================================

/*
 * Lower-cased, because email addresses are not case-sensitive in practice and
 * "Nitin@..." blocking nothing while "nitin@..." blocks everything is a
 * distinction no office would expect.
 */
create unique index if not exists drivers_one_per_email
  on public.drivers (org_id, lower(email))
  where deleted_at is null and email is not null;

/*
 * Digits only. The console strips formatting on the way in, but older rows
 * were typed freely — "98765 43210" and "9876543210" are one phone, and an
 * index over the raw text would let both exist.
 */
create unique index if not exists drivers_one_per_phone
  on public.drivers (org_id, regexp_replace(phone, '\D', '', 'g'))
  where deleted_at is null and phone is not null and btrim(phone) <> '';

comment on index public.drivers_one_per_email is
  'One live driver per email in a fleet. The email is their app login; two rows on it cannot both be that driver.';
comment on index public.drivers_one_per_phone is
  'One live driver per phone number in a fleet, compared on digits alone.';
