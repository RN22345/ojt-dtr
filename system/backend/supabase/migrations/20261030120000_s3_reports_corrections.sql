-- S3: weekly report actions, correction requests, notifications (D-66, D-67).
-- Offline sync design, sections 4 and 7. API contract, section 5.1.
--
-- 1. Data model changes
--    correction_requests.punch_type: the punch type of a request of kind 'add' (DM-01, D-66).
--    punches.correction_id: the correction request that made the punch (FR-COR-03).
--    notifications.body, notifications.link: the text and the app page of a notification (FR-NOTI-05).
-- 2. sync_push entities: report_events (submit, approve, return), correction_requests (create, decide),
--    notifications (mark as read), attachments (report link, FR-RPT-03).

-- ---------------------------------------------------------------------------
-- 1. Data model
-- ---------------------------------------------------------------------------
alter table public.correction_requests
  add column punch_type text check (punch_type in ('in', 'out'));
alter table public.correction_requests
  add constraint correction_requests_punch_type check ((kind = 'add') = (punch_type is not null));

alter table public.punches
  add column correction_id uuid references public.correction_requests (id);
create unique index punches_one_for_each_correction on public.punches (correction_id) where correction_id is not null;

-- The append-only rule also protects the new column.
create or replace function private.protect_punch() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'punches are append-only' using errcode = '42501';
  end if;
  if (new.ojt_id, new.type, new.device_time, new.time_zone, new.device_id, new.corrects_punch_id,
      new.server_received_at, new.lat, new.lng, new.accuracy_m, new.photo_id, new.clock_offset_s,
      new.correction_id)
     is distinct from
     (old.ojt_id, old.type, old.device_time, old.time_zone, old.device_id, old.corrects_punch_id,
      old.server_received_at, old.lat, old.lng, old.accuracy_m, old.photo_id, old.clock_offset_s,
      old.correction_id) then
    raise exception 'punches are append-only' using errcode = '42501';
  end if;
  return new;
end $$;

-- A punch of an 'add' correction has no corrects_punch_id. The audit also records it (FR-AUD-01).
drop trigger audit on public.punches;
create trigger audit after insert on public.punches
  for each row when (new.corrects_punch_id is not null or new.correction_id is not null)
  execute function private.audit_change();

alter table public.notifications
  add column body text not null default '' check (char_length(body) <= 500),
  add column link text check (char_length(link) <= 200);

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------
-- The first decision wins (offline sync design, section 7). A second decision gives 'conflict'.
create function private.decided() returns void
language plpgsql set search_path = '' as $$
begin
  raise exception 'decided' using errcode = 'PSDEC';
end $$;

create function private.notify(p_user uuid, p_type text, p_title text, p_body text, p_link text)
returns void
language sql security definer set search_path = '' as $$
  -- An OJT with no active facilitator gives no notification.
  insert into public.notifications (user_id, type, title, body, link)
  select p_user, p_type, p_title, p_body, p_link where p_user is not null
$$;

-- The active facilitator of an OJT, or null.
create function private.facilitator_of(p_ojt uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select facilitator_id from public.ojt_assignments
  where ojt_id = p_ojt and active and deleted_at is null
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- 3. Report actions (FR-RPT-04, FR-RPT-05, FR-RPT-07, FR-RPT-08)
--    Entity report_events, operation create. Payload: id, report_id, action, remark, device_id.
-- ---------------------------------------------------------------------------
create function private.push_report_event(p_op jsonb, p_uid uuid) returns jsonb
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
-- 4. Correction requests (FR-COR-01, FR-COR-02, FR-COR-03)
--    create (OJT): id, ojt_id, kind, punch_id (change), punch_type (add), requested_time, reason.
--    update (facilitator decision): status ('approved' or 'rejected'), remark, decided_device_id.
-- ---------------------------------------------------------------------------
create function private.push_correction(p_op jsonb, p_uid uuid) returns jsonb
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
-- 5. Notifications: the owner marks a notification as read (FR-NOTI-05). Last write wins.
-- ---------------------------------------------------------------------------
create function private.push_notification(p_op jsonb, p_uid uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := (p_op ->> 'entity_id')::uuid;
  v_row public.notifications;
begin
  if p_op ->> 'op_type' is distinct from 'update' then
    perform private.reject('unsupported');
  end if;
  if (p_op -> 'payload' ->> 'read') is distinct from 'true' then
    perform private.reject('invalid_data');
  end if;
  select * into v_row from public.notifications where id = v_id;
  if v_row.id is null then
    perform private.reject('not_found');
  end if;
  if v_row.user_id <> p_uid then
    perform private.reject('forbidden');
  end if;
  if not v_row.read then
    update public.notifications set read = true where id = v_id returning * into v_row;
  end if;
  return to_jsonb(v_row) - 'change_seq';
end $$;

-- ---------------------------------------------------------------------------
-- 6. Attachments: an optional link to an own report in draft or returned, five photos or less (FR-RPT-03).
-- ---------------------------------------------------------------------------
create or replace function private.push_attachment(p_op jsonb, p_uid uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_p jsonb := p_op -> 'payload';
  v_id uuid := (p_op ->> 'entity_id')::uuid;
  v_owner uuid;
  v_key text;
  v_size int;
  v_report uuid := (v_p ->> 'report_id')::uuid;
  v_row public.attachments;
begin
  if p_op ->> 'op_type' is distinct from 'create' then
    perform private.reject('append_only');
  end if;
  if (select private.my_role()) is distinct from 'ojt' then
    perform private.reject('forbidden');
  end if;
  if jsonb_typeof(v_p) is distinct from 'object' or (v_p ->> 'id')::uuid is distinct from v_id then
    perform private.reject('invalid_data');
  end if;
  if (v_p ->> 'owner_id')::uuid is distinct from p_uid then
    perform private.reject('forbidden');
  end if;

  select owner_id into v_owner from public.attachments where id = v_id;
  if found then
    if v_owner = p_uid then
      raise exception 'duplicate' using errcode = 'PSDUP';
    end if;
    perform private.reject('id_conflict');
  end if;

  v_key := p_uid::text || '/' || v_id::text || '.jpg';
  if v_p ->> 'storage_key' is distinct from v_key then
    perform private.reject('invalid_data');
  end if;
  select (o.metadata ->> 'size')::int into v_size
    from storage.objects o where o.bucket_id = 'attachments' and o.name = v_key;
  if v_size is null then
    perform private.reject('file_missing');
  end if;

  if v_report is not null then
    perform 1 from public.weekly_reports where id = v_report and ojt_id = p_uid and deleted_at is null for update;
    if not found then
      perform private.reject('invalid_reference');
    end if;
    if (select status from public.weekly_reports where id = v_report) not in ('draft', 'returned') then
      perform private.reject('not_editable');
    end if;
    if (select count(*) from public.attachments where report_id = v_report and deleted_at is null) >= 5 then
      perform private.reject('too_many_photos');
    end if;
  end if;

  insert into public.attachments (id, owner_id, report_id, storage_key, size_bytes)
  values (v_id, p_uid, v_report, v_key, v_size)
  returning * into v_row;
  return to_jsonb(v_row) - 'change_seq';
end $$;

-- ---------------------------------------------------------------------------
-- 7. current_record and sync_push with the new entities
-- ---------------------------------------------------------------------------
create or replace function private.current_record(p_entity text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb;
begin
  if p_entity = 'punches' then
    select to_jsonb(t) - 'change_seq' into v from public.punches t
    where t.id = p_id and private.can_read_ojt(t.ojt_id);
  elsif p_entity = 'weekly_reports' then
    select to_jsonb(t) - 'change_seq' into v from public.weekly_reports t
    where t.id = p_id and private.can_read_ojt(t.ojt_id);
  elsif p_entity = 'attachments' then
    select to_jsonb(t) - 'change_seq' into v from public.attachments t
    where t.id = p_id and private.can_read_ojt(t.owner_id);
  elsif p_entity = 'correction_requests' then
    select to_jsonb(t) - 'change_seq' into v from public.correction_requests t
    where t.id = p_id and private.can_read_ojt(t.ojt_id);
  elsif p_entity = 'report_events' then
    select to_jsonb(t) - 'change_seq' into v from public.report_events t
    where t.id = p_id and private.can_read_report(t.report_id);
  elsif p_entity = 'notifications' then
    select to_jsonb(t) - 'change_seq' into v from public.notifications t
    where t.id = p_id and t.user_id = (select auth.uid());
  end if;
  return v;
end $$;

create or replace function public.sync_push(p_ops jsonb, p_device_now timestamptz default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_offset_now int;
  v_op jsonb;
  v_op_id uuid;
  v_record jsonb;
  v_results jsonb := '[]'::jsonb;
  v_constraint text;
  v_result jsonb;
begin
  if (select private.my_role()) is null or (select private.my_role()) not in ('ojt', 'facilitator') then
    raise exception 'sync is for active OJT and facilitator accounts' using errcode = '42501';
  end if;
  if jsonb_typeof(p_ops) is distinct from 'array' then
    raise exception 'p_ops must be an array of 1 to 50 operations' using errcode = '22023';
  end if;
  if jsonb_array_length(p_ops) not between 1 and 50 then
    raise exception 'p_ops must be an array of 1 to 50 operations' using errcode = '22023';
  end if;
  if p_device_now is not null then
    v_offset_now := round(extract(epoch from (now() - p_device_now)));
  end if;

  for v_op in select value from jsonb_array_elements(p_ops) loop
    v_record := null;
    begin
      v_op_id := (v_op ->> 'op_id')::uuid;
      if v_op_id is null then
        perform private.reject('invalid_data');
      end if;
      if exists (select 1 from public.processed_ops where op_id = v_op_id) then
        raise exception 'duplicate' using errcode = 'PSDUP';
      end if;
      v_record := case v_op ->> 'entity'
        when 'punches' then private.push_punch(v_op, v_uid, v_offset_now)
        when 'weekly_reports' then private.push_report(v_op, v_uid)
        when 'attachments' then private.push_attachment(v_op, v_uid)
        when 'report_events' then private.push_report_event(v_op, v_uid)
        when 'correction_requests' then private.push_correction(v_op, v_uid)
        when 'notifications' then private.push_notification(v_op, v_uid)
      end;
      if v_record is null then
        perform private.reject('unsupported');
      end if;
      insert into public.processed_ops (op_id, user_id, result) values (v_op_id, v_uid, 'applied');
      v_result := jsonb_build_object('result', 'applied', 'record', v_record);
    exception
      when sqlstate 'PSDUP' then
        v_result := jsonb_build_object('result', 'duplicate');
      when sqlstate 'PSCON' then
        v_result := jsonb_build_object('result', 'conflict', 'cause', 'version');
      when sqlstate 'PSDEC' then
        v_result := jsonb_build_object('result', 'conflict', 'cause', 'decided');
      when sqlstate 'PSREJ' then
        v_result := jsonb_build_object('result', 'rejected', 'cause', sqlerrm);
      when unique_violation then
        get stacked diagnostics v_constraint = constraint_name;
        if v_constraint = 'weekly_reports_ojt_id_week_start_key' then
          v_result := jsonb_build_object('result', 'conflict', 'cause', 'week_exists');
        else
          v_result := jsonb_build_object('result', 'duplicate');
        end if;
      when foreign_key_violation then
        v_result := jsonb_build_object('result', 'rejected', 'cause', 'invalid_reference');
      when check_violation or not_null_violation or invalid_text_representation
        or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range
        or string_data_right_truncation or invalid_parameter_value then
        v_result := jsonb_build_object('result', 'rejected', 'cause', 'invalid_data');
    end;
    if v_result ->> 'result' in ('duplicate', 'conflict') then
      begin
        v_result := v_result || jsonb_build_object('record',
          private.current_record(v_op ->> 'entity', (v_op ->> 'entity_id')::uuid));
      exception when invalid_text_representation then
        null;
      end;
    end if;
    v_results := v_results || jsonb_build_array(jsonb_build_object('op_id', v_op ->> 'op_id') || v_result);
  end loop;

  return jsonb_build_object('server_time', now(), 'results', v_results);
end $$;

revoke all on function private.decided(), private.notify(uuid, text, text, text, text),
  private.facilitator_of(uuid), private.push_report_event(jsonb, uuid), private.push_correction(jsonb, uuid),
  private.push_notification(jsonb, uuid) from public;
