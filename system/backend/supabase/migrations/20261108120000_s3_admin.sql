-- S3: admin dashboard (D-70, points 3 and 4). API contract, section 5.
--
-- admin_dashboard(): one row for each active assignment that is not deleted. Only an admin can call it.
-- Logged minutes follow hours.ts of the frontend: only effective punches count (a deleted punch, and a
-- punch that a later punch corrects with corrects_punch_id, do not count). In time order, each time-out
-- that follows a time-in directly gives one work session. Whole minutes. An open session counts zero.
-- A week runs from Monday to Sunday (Asia/Manila). A late report is a full past week in the batch dates
-- that has no report with the status submitted or approved.

create or replace function public.admin_dashboard()
returns table (
  ojt_id uuid,
  ojt_name text,
  ojt_status text,
  company_id uuid,
  company_name text,
  batch_id uuid,
  batch_name text,
  facilitator_id uuid,
  facilitator_name text,
  required_hours int,
  logged_minutes bigint,
  late_reports int,
  behind boolean
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_today date := (now() at time zone 'Asia/Manila')::date;
begin
  if not (select private.is_admin()) then
    raise exception 'admin only' using errcode = '42501';
  end if;

  return query
  with asg as (
    select a.ojt_id, a.company_id, a.batch_id, a.facilitator_id,
           b.start_date, b.end_date, b.required_hours
    from public.ojt_assignments a
    join public.batches b on b.id = a.batch_id
    where a.active and a.deleted_at is null
  ),
  eff as (
    select p.ojt_id, p.id, p.type, p.device_time
    from public.punches p
    where p.deleted_at is null
      and p.ojt_id in (select ojt_id from asg)
      and not exists (
        select 1 from public.punches c
        where c.corrects_punch_id = p.id and c.deleted_at is null)
  ),
  paired as (
    select e.ojt_id, e.type, e.device_time,
           lag(e.type) over w as prev_type,
           lag(e.device_time) over w as prev_time
    from eff e
    window w as (partition by e.ojt_id order by e.device_time, e.id)
  ),
  logged as (
    select pr.ojt_id,
           sum(floor(extract(epoch from (pr.device_time - pr.prev_time)) / 60))::bigint as minutes
    from paired pr
    where pr.type = 'out' and pr.prev_type = 'in'
    group by pr.ojt_id
  ),
  weeks as (
    select s.ojt_id, w::date as week_start
    from asg s
    cross join lateral generate_series(
      s.start_date + ((8 - extract(isodow from s.start_date)::int) % 7),
      least(s.end_date, v_today - 1) - 6,
      interval '7 days') as w
  ),
  late as (
    select wk.ojt_id, count(*)::int as n
    from weeks wk
    where not exists (
      select 1 from public.weekly_reports r
      where r.ojt_id = wk.ojt_id and r.week_start = wk.week_start
        and r.deleted_at is null and r.status in ('submitted', 'approved'))
    group by wk.ojt_id
  ),
  full_weeks as (
    select wk.ojt_id, count(*)::int as n from weeks wk group by wk.ojt_id
  ),
  calc as (
    select s.*, coalesce(l.minutes, 0) as logged_minutes, coalesce(lt.n, 0) as late_reports,
           least(coalesce(fw.n, 0) * 2400, s.required_hours * 60) as expected
    from asg s
    left join logged l on l.ojt_id = s.ojt_id
    left join late lt on lt.ojt_id = s.ojt_id
    left join full_weeks fw on fw.ojt_id = s.ojt_id
  )
  select c.ojt_id, o.full_name, o.status,
         c.company_id, co.name, c.batch_id, bt.name,
         c.facilitator_id, f.full_name,
         c.required_hours, c.logged_minutes, c.late_reports,
         (c.late_reports > 0 or c.logged_minutes < 0.9 * c.expected)
  from calc c
  join public.profiles o on o.id = c.ojt_id
  join public.profiles f on f.id = c.facilitator_id
  join public.companies co on co.id = c.company_id
  join public.batches bt on bt.id = c.batch_id
  order by o.full_name, c.ojt_id;
end $$;

revoke all on function public.admin_dashboard() from public, anon;
grant execute on function public.admin_dashboard() to authenticated;
