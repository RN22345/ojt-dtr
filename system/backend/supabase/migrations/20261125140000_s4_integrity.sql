-- S4: record integrity fixes (QR-SE-05, QR-SE-06, QR-MA-03). Audit findings s4-rev-contract and s4-rev-security.
--
-- 1. A report decision needs a device ID. The length is 1 to 200 characters.
-- 2. A correction decision needs a device ID. The length is 1 to 200 characters.
-- 3. A check constraint limits the two device ID columns. An old row has a null value, so a null value is allowed.
-- 4. heartbeat rejects a null source with error code 22023.
-- 5. admin_export_reports rejects a null batch ID with error code 22023.
-- 6. The append-only trigger also protects the columns id and deleted_at of a punch.
-- 7. A new public table gives no privilege to authenticated. Each table grants its own privileges.

-- ---------------------------------------------------------------------------
-- 1. Report actions: a decision needs a device ID of 1 to 200 characters.
-- ---------------------------------------------------------------------------
create or replace function private.push_report_event(p_op jsonb, p_uid uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_p jsonb := p_op -> 'payload';
  v_id uuid := (p_op ->> 'entity_id')::uuid;
  v_action text;
  v_remark text;
  v_report public.weekly_reports;
  v_row public.report_events;
  v_week text;
begin
  if p_op ->> 'op_type' is distinct from 'create' then
    perform private.reject('append_only');
  end if;
  if jsonb_typeof(v_p) is distinct from 'object' or (v_p ->> 'id')::uuid is distinct from v_id then
    perform private.reject('invalid_data');
  end if;
  if v_p ->> 'device_id' is null or char_length(v_p ->> 'device_id') not between 1 and 200 then
    perform private.reject('invalid_data');
  end if;
  if exists (select 1 from public.report_events where id = v_id) then
    if exists (select 1 from public.report_events where id = v_id and actor_id = p_uid) then
      raise exception 'duplicate' using errcode = 'PSDUP';
    end if;
    perform private.reject('id_conflict');
  end if;

  v_action := v_p ->> 'action';
  v_remark := nullif(btrim(coalesce(v_p ->> 'remark', '')), '');
  select * into v_report from public.weekly_reports
    where id = (v_p ->> 'report_id')::uuid and deleted_at is null for update;
  if v_report.id is null then
    perform private.reject('not_found');
  end if;
  v_week := to_char(v_report.week_start, 'YYYY-MM-DD');

  if v_action = 'submit' then
    if (select private.my_role()) is distinct from 'ojt' or v_report.ojt_id <> p_uid then
      perform private.reject('forbidden');
    end if;
    if v_report.status not in ('draft', 'returned') then
      perform private.reject('not_editable');
    end if;
    if btrim(v_report.tasks_done) = '' or btrim(v_report.skills_learned) = '' then
      perform private.reject('incomplete');
    end if;
    update public.weekly_reports set status = 'submitted' where id = v_report.id;
    perform private.notify(private.facilitator_of(p_uid), 'report_submitted', 'Report submitted',
      'An OJT submitted the report for the week of ' || v_week || '.',
      '/facilitator/reviews/report/' || v_report.id);

  elsif v_action in ('approve', 'return') then
    if not (select private.facilitates(v_report.ojt_id)) then
      perform private.reject('forbidden');
    end if;
    if v_report.status <> 'submitted' then
      perform private.decided();
    end if;
    if v_action = 'return' and v_remark is null then
      perform private.reject('remark_required');
    end if;
    if v_action = 'approve' then
      update public.weekly_reports set status = 'approved' where id = v_report.id;
      -- FR-RPT-07 (A-05): approve the punches of that week (Monday to Sunday, Asia/Manila).
      update public.punches set approved = true
      where ojt_id = v_report.ojt_id and deleted_at is null and not approved
        and (device_time at time zone 'Asia/Manila')::date between v_report.week_start and v_report.week_start + 6;
      perform private.notify(v_report.ojt_id, 'report_approved', 'Weekly report approved',
        'Your report for the week of ' || v_week || ' is approved.', '/ojt/reports/' || v_week);
    else
      update public.weekly_reports set status = 'returned' where id = v_report.id;
      perform private.notify(v_report.ojt_id, 'report_returned', 'Weekly report returned',
        'Your report for the week of ' || v_week || ' is returned. Read the remark.', '/ojt/reports/' || v_week);
    end if;

  else
    perform private.reject('invalid_data');
  end if;

  insert into public.report_events (id, report_id, actor_id, action, device_id, remark)
  values (v_id, v_report.id, p_uid, v_action, v_p ->> 'device_id', v_remark)
  returning * into v_row;
  return to_jsonb(v_row) - 'change_seq';
end $$;

-- ---------------------------------------------------------------------------
-- 2. Correction requests: a decision needs a device ID of 1 to 200 characters.
--    The create branch does not change.
-- ---------------------------------------------------------------------------
create or replace function private.push_correction(p_op jsonb, p_uid uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_p jsonb := p_op -> 'payload';
  v_id uuid := (p_op ->> 'entity_id')::uuid;
  v_cur public.correction_requests;
  v_row public.correction_requests;
  v_orig public.punches;
  v_time timestamptz;
  v_status text;
  v_remark text;
  v_day text;
begin
  if jsonb_typeof(v_p) is distinct from 'object' then
    perform private.reject('invalid_data');
  end if;
  select * into v_cur from public.correction_requests where id = v_id for update;

  if p_op ->> 'op_type' = 'create' then
    if (select private.my_role()) is distinct from 'ojt' then
      perform private.reject('forbidden');
    end if;
    if (v_p ->> 'id')::uuid is distinct from v_id then
      perform private.reject('invalid_data');
    end if;
    if (v_p ->> 'ojt_id')::uuid is distinct from p_uid then
      perform private.reject('forbidden');
    end if;
    if v_cur.id is not null then
      if v_cur.ojt_id = p_uid then
        raise exception 'duplicate' using errcode = 'PSDUP';
      end if;
      perform private.reject('id_conflict');
    end if;
    v_time := private.parse_iso_time(v_p ->> 'requested_time');
    if v_time > now() + interval '2 minutes' then
      perform private.reject('invalid_data');
    end if;
    if v_p ->> 'kind' = 'change' then
      if not exists (select 1 from public.punches
                     where id = (v_p ->> 'punch_id')::uuid and ojt_id = p_uid and deleted_at is null) then
        perform private.reject('invalid_reference');
      end if;
    end if;
    insert into public.correction_requests (id, ojt_id, punch_id, kind, punch_type, requested_time, reason)
    values (v_id, p_uid, (v_p ->> 'punch_id')::uuid, v_p ->> 'kind',
      case when v_p ->> 'kind' = 'add' then v_p ->> 'punch_type' end,
      v_time, btrim(coalesce(v_p ->> 'reason', '')))
    returning * into v_row;
    perform private.notify(private.facilitator_of(p_uid), 'correction_submitted', 'New correction request',
      'An OJT sent a correction request.', '/facilitator/reviews/correction/' || v_id);

  elsif p_op ->> 'op_type' = 'update' then
    if v_cur.id is null then
      perform private.reject('not_found');
    end if;
    if not (select private.facilitates(v_cur.ojt_id)) then
      perform private.reject('forbidden');
    end if;
    v_status := v_p ->> 'status';
    v_remark := nullif(btrim(coalesce(v_p ->> 'remark', '')), '');
    if v_status is null or v_status not in ('approved', 'rejected') then
      perform private.reject('invalid_data');
    end if;
    if v_cur.status <> 'pending' then
      perform private.decided();
    end if;
    if v_status = 'rejected' and v_remark is null then
      perform private.reject('remark_required');
    end if;
    if v_p ->> 'decided_device_id' is null
      or char_length(v_p ->> 'decided_device_id') not between 1 and 200 then
      perform private.reject('invalid_data');
    end if;
    update public.correction_requests set
      status = v_status, remark = v_remark, decided_by = p_uid,
      decided_device_id = v_p ->> 'decided_device_id', decided_at = now()
    where id = v_id
    returning * into v_row;

    -- FR-COR-03: the original punch stays. An approval makes a new punch that refers to it.
    if v_status = 'approved' then
      if v_cur.kind = 'change' then
        select * into v_orig from public.punches where id = v_cur.punch_id;
      end if;
      insert into public.punches (ojt_id, type, device_time, time_zone, device_id,
        corrects_punch_id, correction_id, clock_offset_s)
      values (v_cur.ojt_id, coalesce(v_orig.type, v_cur.punch_type), v_cur.requested_time,
        coalesce(v_orig.time_zone, 'Asia/Manila'), 'correction', v_cur.punch_id, v_cur.id, 0);
    end if;
    v_day := to_char(v_cur.requested_time at time zone 'Asia/Manila', 'YYYY-MM-DD');
    perform private.notify(v_cur.ojt_id, 'correction_' || v_status, 'Correction ' || v_status,
      'Your correction request for ' || v_day || ' is ' || v_status || '.', '/ojt/corrections');

  else
    perform private.reject('unsupported');
  end if;
  return to_jsonb(v_row) - 'change_seq';
end $$;

-- ---------------------------------------------------------------------------
-- 3. A limit for the two device ID columns. An old row has a null value, so a null value is allowed.
-- ---------------------------------------------------------------------------
alter table public.report_events
  add constraint report_events_device_id_len
  check (device_id is null or char_length(device_id) between 1 and 200);
alter table public.correction_requests
  add constraint correction_requests_decided_device_id_len
  check (decided_device_id is null or char_length(decided_device_id) between 1 and 200);

-- ---------------------------------------------------------------------------
-- 4. heartbeat: a null source gives error 22023, not 23502. The secret check stays first.
-- ---------------------------------------------------------------------------
create or replace function ops.heartbeat(p_source text, p_secret text) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  v_secret text;
  v_now timestamptz := now();
begin
  select value into v_secret from ops.settings where key = 'keepalive_secret';
  if v_secret is null or p_secret is null or v_secret <> p_secret then
    raise exception 'invalid secret' using errcode = '28000';
  end if;
  if p_source is null or p_source !~ '^[A-Za-z0-9_-]{1,32}$' then
    raise exception 'invalid source' using errcode = '22023';
  end if;
  insert into ops.heartbeat (source, created_at) values (p_source, v_now);
  delete from ops.heartbeat where created_at < v_now - interval '30 days';
  return v_now;
end $$;
revoke all on function ops.heartbeat(text, text) from public;

-- ---------------------------------------------------------------------------
-- 5. admin_export_reports: a null batch ID gives error 22023.
-- ---------------------------------------------------------------------------
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
  if p_batch_id is null then
    raise exception 'batch id is necessary' using errcode = '22023';
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

-- ---------------------------------------------------------------------------
-- 6. The append-only rule also protects id and deleted_at. approved, change_seq, and version can still change.
-- ---------------------------------------------------------------------------
create or replace function private.protect_punch() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'punches are append-only' using errcode = '42501';
  end if;
  if (new.id, new.ojt_id, new.type, new.device_time, new.time_zone, new.device_id, new.corrects_punch_id,
      new.server_received_at, new.lat, new.lng, new.accuracy_m, new.photo_id, new.clock_offset_s,
      new.correction_id, new.deleted_at)
     is distinct from
     (old.id, old.ojt_id, old.type, old.device_time, old.time_zone, old.device_id, old.corrects_punch_id,
      old.server_received_at, old.lat, old.lng, old.accuracy_m, old.photo_id, old.clock_offset_s,
      old.correction_id, old.deleted_at) then
    raise exception 'punches are append-only' using errcode = '42501';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 7. A new public table gives no privilege to authenticated. Each table grants its own privileges.
-- ---------------------------------------------------------------------------
alter default privileges for role postgres in schema public revoke all on tables from authenticated;
