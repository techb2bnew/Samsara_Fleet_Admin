-- ============================================================================
-- The office may review a correction the DRIVER asked for
-- ============================================================================
-- The hours_of_service migration gave staff one power over duty events: they
-- may propose a correction. There was no update policy for them at all, with
-- the reasoning that "a carrier cannot accept its own edit".
--
-- That reasoning is right and the policy was too broad. Two different things
-- were being blocked:
--
--   the carrier accepting its OWN proposal   must stay blocked. This is the
--                                            abuse the rules exist to prevent:
--                                            a carrier rewriting a driver's
--                                            legal record unchallenged.
--
--   the office responding to the DRIVER'S     was blocked too, and should not
--   request                                   be. The driver asked for the
--                                             change; approving it is not the
--                                             carrier altering anything behind
--                                             their back.
--
-- The console has a "Correction requests" queue with Approve and Reject
-- buttons for exactly the second case. Without this policy those buttons
-- could never write anything — the request vanished from the screen and came
-- straight back on reload, while the reviewer believed they had decided it.
--
-- `source` is what tells the two apart, and it is set when the row is written:
--
--   'manual'       the driver entered it, from the phone
--   'carrier_edit' the office proposed it, from this console
--
-- So staff may review anything except a carrier_edit. The append-only trigger
-- still limits the update to the review outcome, so approving a correction
-- cannot quietly change what it proposed.
-- ============================================================================

create policy duty_events_review_driver_request on public.duty_status_events
  for update to authenticated
  using (
    edit_of_id is not null
    and edit_status = 'pending'
    and source <> 'carrier_edit'
    and (select public.has_org_role(org_id, array['fleet_admin','compliance_officer']))
  )
  with check (
    edit_of_id is not null
    and source <> 'carrier_edit'
    and (select public.has_org_role(org_id, array['fleet_admin','compliance_officer']))
  );

comment on policy duty_events_review_driver_request on public.duty_status_events is
  'Office staff may accept or reject a correction the driver asked for. A carrier_edit stays for the driver alone to decide.';
