import { LocalDb } from './local-db';
import { migrate, schemaVersion } from './migrate';
import { LOCAL_SCHEMA_VERSION } from './schema';
import { SqlJsDb } from './sqljs.db';

// The tables of the offline sync design, section 2.
const EXPECTED_TABLES = [
  'attachments',
  'correction_requests',
  'notifications',
  'outbox',
  'punches',
  'report_events',
  'sync_log',
  'sync_state',
  'user_profile',
  'weekly_reports',
];

async function tableNames(db: LocalDb): Promise<string[]> {
  const rows = await db.query<{ name: string }>(
    "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name",
  );
  return rows.map((r) => r.name);
}

describe('TC-CI-DB-01 local migrations (FR-SYNC-01, QR-FL-04)', () => {
  let db: SqlJsDb;

  beforeEach(async () => {
    db = await SqlJsDb.create();
  });
  afterEach(async () => {
    await db.close();
  });

  it('TC-CI-DB-01 makes all local tables on an empty database', async () => {
    expect(await schemaVersion(db)).toBe(0);
    const applied = await migrate(db);
    expect(applied).toEqual([LOCAL_SCHEMA_VERSION]);
    expect(await tableNames(db)).toEqual(EXPECTED_TABLES);
    expect(await schemaVersion(db)).toBe(LOCAL_SCHEMA_VERSION);
  });

  it('TC-CI-DB-01 a second run makes no change and no error', async () => {
    await migrate(db);
    const before = await db.query("select name, sql from sqlite_master order by name");
    const applied = await migrate(db);
    expect(applied).toEqual([]);
    expect(await db.query("select name, sql from sqlite_master order by name")).toEqual(before);
  });

  it('TC-CI-DB-01 a failed migration changes nothing and keeps the old version', async () => {
    await migrate(db);
    const bad = [{ version: LOCAL_SCHEMA_VERSION + 1, description: 'bad', sql: 'create table x (a); select * from missing_table;' }];
    await expect(migrate(db, bad)).rejects.toThrow();
    expect(await schemaVersion(db)).toBe(LOCAL_SCHEMA_VERSION);
    expect(await tableNames(db)).not.toContain('x');
  });

  it('TC-CI-DB-01 the sync status accepts only pending, synced, and issue', async () => {
    await migrate(db);
    await expect(
      db.run("insert into user_profile (id, role, full_name, status, sync_status) values ('a', 'ojt', 'A', 'active', 'lost')"),
    ).rejects.toThrow();
  });
});
