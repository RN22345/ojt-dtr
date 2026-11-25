-- DEF-019 (QR-PE-03): the select policies of punches, weekly_reports, correction_requests, and attachments
-- called private.can_read_ojt() once for each row. A security definer function is not inlined, so a list
-- request read each row of the table at about 0.3 ms. With 20 users the 95th percentile was more than 4 s.
--
-- private.readable_ojt_ids() gives the set of OJT IDs that the current user can read. PostgreSQL runs it
-- one time for each query (hashed subplan). The rows are the same as with can_read_ojt():
--   OJT: the own ID. Facilitator: the OJTs of the active assignments. Admin: all profiles.
-- can_read_ojt() stays for the database functions that check one OJT.

create function private.readable_ojt_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) where (select private.my_role()) = 'ojt'
  union all
  select a.ojt_id from public.ojt_assignments a
  where (select private.my_role()) = 'facilitator'
    and a.facilitator_id = (select auth.uid()) and a.active and a.deleted_at is null
  union all
  select p.id from public.profiles p where (select private.is_admin())
$$;

revoke all on function private.readable_ojt_ids() from public, anon;
grant execute on function private.readable_ojt_ids() to authenticated;

alter policy punches_select on public.punches
  using (ojt_id in (select private.readable_ojt_ids()));
alter policy weekly_reports_select on public.weekly_reports
  using (ojt_id in (select private.readable_ojt_ids()));
alter policy correction_requests_select on public.correction_requests
  using (ojt_id in (select private.readable_ojt_ids()));
alter policy attachments_select on public.attachments
  using (owner_id in (select private.readable_ojt_ids()));
