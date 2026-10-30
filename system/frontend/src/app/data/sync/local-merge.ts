// Layer 2: writes server records to the local database (offline sync design, sections 4 and 5).
// The local tables use the server column names. Columns that the local table does not have are ignored.
import { LocalDb, SqlValue } from '../local-db/local-db';

/** The local tables that the pull fills (API contract, section 5.2). */
export const PULLED_ENTITIES = [
  'profiles', 'companies', 'batches', 'ojt_assignments', 'punches', 'weekly_reports',
  'report_events', 'correction_requests', 'attachments', 'notifications',
] as const;

export type MergeOutcome = 'written' | 'kept-local' | 'deleted' | 'ignored';

const columnCache = new WeakMap<LocalDb, Map<string, Set<string>>>();

async function columnsOf(db: LocalDb, table: string): Promise<Set<string>> {
  let tables = columnCache.get(db);
  if (!tables) {
    tables = new Map();
    columnCache.set(db, tables);
  }
  let columns = tables.get(table);
  if (!columns) {
    const rows = await db.query<{ name: string }>(`pragma table_info(${table})`);
    columns = new Set(rows.map((r) => r.name));
    tables.set(table, columns);
  }
  return columns;
}

function toSql(value: unknown): SqlValue {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (typeof value === 'number' || typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value);
}

function isPulled(entity: string): boolean {
  return (PULLED_ENTITIES as readonly string[]).includes(entity);
}

/** Writes the server copy with sync status `synced`. A tombstone removes the local row. */
async function writeSynced(db: LocalDb, entity: string, data: Record<string, unknown>): Promise<MergeOutcome> {
  const id = String(data['id']);
  if (data['deleted_at']) {
    await db.run(`delete from ${entity} where id = ?`, [id]);
    return 'deleted';
  }
  const columns = await columnsOf(db, entity);
  const names = Object.keys(data).filter((k) => columns.has(k) && k !== 'sync_status');
  const values = names.map((k) => toSql(data[k]));
  const updates = [...names.filter((k) => k !== 'id').map((k) => `${k} = excluded.${k}`), "sync_status = 'synced'"];
  await db.run(
    `insert into ${entity} (${names.join(', ')}, sync_status) values (${names.map(() => '?').join(', ')}, 'synced')
     on conflict (id) do update set ${updates.join(', ')}`,
    values,
  );
  return 'written';
}

/**
 * Pull merge rule (section 5, step 4; TC-U-SYNC-05). A local record with status `pending` or `issue` stays.
 * Else the server copy replaces it.
 */
export async function mergePulled(db: LocalDb, entity: string, data: Record<string, unknown>): Promise<MergeOutcome> {
  if (!isPulled(entity) || typeof data['id'] !== 'string') {
    return 'ignored';
  }
  const local = await db.query<{ sync_status: string }>(`select sync_status from ${entity} where id = ?`, [data['id']]);
  if (local[0] && local[0].sync_status !== 'synced') {
    return 'kept-local';
  }
  return writeSynced(db, entity, data);
}

/** After `applied` or `duplicate`: the server copy is the local copy now (section 4, step 5). */
export async function markSynced(db: LocalDb, entity: string, id: string, record: Record<string, unknown> | null): Promise<void> {
  if (!isPulled(entity)) {
    return;
  }
  if (record && typeof record['id'] === 'string') {
    await writeSynced(db, entity, record);
  } else {
    await db.run(`update ${entity} set sync_status = 'synced' where id = ?`, [id]);
  }
}

/** After `rejected` or `conflict`: the record shows on the "Sync issues" screen (section 4, step 6). */
export async function markIssue(db: LocalDb, entity: string, id: string): Promise<void> {
  if (isPulled(entity)) {
    await db.run(`update ${entity} set sync_status = 'issue' where id = ?`, [id]);
  }
}

type ScopeChange = 'started' | 'ended' | 'none';

/** On a facilitator device: an assignment of an OJT starts or ends (API contract, section 5.2, NOTE). */
async function scopeChange(db: LocalDb, data: Record<string, unknown>, userId: string): Promise<ScopeChange> {
  if (data['ojt_id'] === userId || typeof data['id'] !== 'string') {
    return 'none';
  }
  const active = data['active'] === true && !data['deleted_at'];
  const local = await db.query<{ active: number }>('select active from ojt_assignments where id = ?', [data['id']]);
  const wasActive = local[0]?.active === 1;
  if (active && !wasActive) {
    return 'started';
  }
  return !active && wasActive ? 'ended' : 'none';
}

/**
 * The OJT left the scope of this device (its assignment ended). The pull sends no tombstones for it, so the
 * device removes the synced records of the OJT. Records with a local change stay (QR-SF-03).
 */
export async function removeOjtRecords(db: LocalDb, ojtId: string): Promise<void> {
  const others = await db.query<{ n: number }>(
    'select count(*) as n from ojt_assignments where ojt_id = ? and active = 1 and deleted_at is null',
    [ojtId],
  );
  if (Number(others[0]?.n ?? 0) > 0) {
    return;
  }
  await db.run(
    `delete from report_events where sync_status = 'synced'
       and report_id in (select id from weekly_reports where ojt_id = ?)`,
    [ojtId],
  );
  for (const [table, owner] of [['weekly_reports', 'ojt_id'], ['correction_requests', 'ojt_id'], ['punches', 'ojt_id'], ['attachments', 'owner_id']]) {
    await db.run(`delete from ${table} where ${owner} = ? and sync_status = 'synced'`, [ojtId]);
  }
}

/**
 * Merges one pull page (section 5, step 4) and applies the scope changes of the assignments.
 * Returns true if an OJT came into the scope of this device. Then the caller pulls again from cursor 0,
 * because the older records of that OJT have a change number below the cursor.
 */
export async function mergePage(db: LocalDb, records: readonly { entity: string; data: Record<string, unknown> }[], userId: string): Promise<boolean> {
  let started = false;
  for (const r of records) {
    const change = r.entity === 'ojt_assignments' ? await scopeChange(db, r.data, userId) : 'none';
    await mergePulled(db, r.entity, r.data);
    if (change === 'ended') {
      await removeOjtRecords(db, String(r.data['ojt_id']));
    }
    started ||= change === 'started';
  }
  return started;
}
