-- S4: admin export of the report summary (FR-EXP-03, QR-CO-03). API contract, section 5.
--
-- admin_export_reports(): one row for each report that is not deleted, of each OJT with an assignment
-- in the batch. The company and the facilitator come from the active assignment of the batch. If the
-- OJT has no active assignment in the batch, they come from the newest assignment in the batch.
-- The output has one row for each report only. Only an admin can call the function.

create or replace function public.admin_export_reports(p_batch_id uuid)
returns table (
  ojt_id uuid,
  ojt_name text,
  company_name text,
  facilitator_name text,
  week_start date,
  status text,
  updated_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not (select private.is_admin()) then
    raise exception 'admin only' using errcode = '42501';
  end if;

  return query
  with ojt as (
    select a.ojt_id
    from public.ojt_assignments a
    where a.batch_id = p_batch_id and a.deleted_at is null
    group by a.ojt_id
  ),
  pick as (
    select distinct on (a.ojt_id) a.ojt_id, a.company_id, a.facilitator_id
    from public.ojt_assignments a
    join ojt on ojt.ojt_id = a.ojt_id
    where a.batch_id = p_batch_id and a.deleted_at is null
    order by a.ojt_id, a.active desc, a.created_at desc, a.id
  )
  select r.ojt_id, o.full_name, co.name, f.full_name, r.week_start, r.status, r.updated_at
  from public.weekly_reports r
  join pick p on p.ojt_id = r.ojt_id
  join public.profiles o on o.id = r.ojt_id
  join public.companies co on co.id = p.company_id
  join public.profiles f on f.id = p.facilitator_id
  where r.deleted_at is null
  order by o.full_name, r.week_start;
end $$;

revoke all on function public.admin_export_reports(uuid) from public, anon;
grant execute on function public.admin_export_reports(uuid) to authenticated;
