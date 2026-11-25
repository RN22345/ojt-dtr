// Layer 2: the sync engine (offline sync design, sections 4, 5, 6, 8, 12).
// One sync = push all queued operations, then pull all changes. This class has no Angular code and no timers,
// so that unit tests can run it with sql.js and a fake server. `SyncService` gives the triggers and the retry.
import { LocalDb, Row } from '../local-db/local-db';
import {
  OutboxOp,
  entitiesWithOtherOps,
  enqueue,
  markOpIssue,
  recordKey,
  recoverSending,
  removeOps,
  requeue,
  takeQueued,
} from './outbox';
import { markIssue, markSynced, mergePage } from './local-merge';
import { OWN_ENTITIES, createPayload } from './payloads';
import { logSync } from './sync-log';
import { getState, setClockOffsetS, setState, userKey } from './sync-state';
import { PushResult, SyncTransport, TransportError, TransportErrorKind } from './sync-transport';
import { FileUploader } from './file-upload';

export const PUSH_BATCH = 50;
export const PULL_PAGE = 500;
/** A sync stops after this number of pull pages. The next sync continues from the cursor. */
const MAX_PULL_PAGES = 20;
/** Section 12: after an epoch change, the app sends its records of the last 30 days again. */
const RESEND_DAYS = 30;

export interface SyncDeps {
  db: () => Promise<LocalDb>;
  transport: SyncTransport;
  /** The logged-in user. Only the outbox of this user is sent (section 9, item 5). */
  userId: () => string | null;
  /** Uploads the photo files before the push (section 10). Without it, no file is uploaded. */
  files?: FileUploader;
  now?: () => Date;
}

/** Section 12: the columns that select the own records of the last 30 days, for each entity. */
const RESEND_COLUMNS: Readonly<Record<string, { owner: string; time: string; dateOnly: boolean }>> = {
  attachments: { owner: 'owner_id', time: 'updated_at', dateOnly: false },
  punches: { owner: 'ojt_id', time: 'device_time', dateOnly: false },
  weekly_reports: { owner: 'ojt_id', time: 'week_start', dateOnly: true },
  correction_requests: { owner: 'ojt_id', time: 'requested_time', dateOnly: false },
};

interface UploadRow {
  [key: string]: string | number | null;
  id: string;
  local_path: string;
  storage_key: string;
}

/** A record with an `applied` or a `duplicate` result, and the server copy to write (DEF-020). */
interface SyncDone {
  entity: string;
  entityId: string;
  record: Record<string, unknown> | null;
}

/** Push step 5: the server has the record (now or already). */
function isGood(result: PushResult): boolean {
  return result.result === 'applied' || result.result === 'duplicate';
}

export interface SyncOutcome {
  ok: boolean;
  pushed: number;
  pulled: number;
  issues: number;
  error?: TransportErrorKind | 'no-user' | 'unknown';
}

export class SyncEngine {
  private running: Promise<void> | null = null;
  private again = false;
  private last: SyncOutcome | null = null;

  constructor(private readonly deps: SyncDeps) {}

  /** The result of the newest sync, or null before the first sync. */
  get lastOutcome(): SyncOutcome | null {
    return this.last;
  }

  /**
   * Only one sync runs at a time. A request during a sync causes one more sync after it, also when
   * there are many requests (section 6; TC-U-SYNC-04). The promise ends when no sync is waiting.
   */
  requestSync(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      try {
        do {
          this.again = false;
          this.last = await this.syncOnce();
        } while (this.again);
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date();
  }

  private async syncOnce(): Promise<SyncOutcome> {
    const userId = this.deps.userId();
    if (!userId) {
      return { ok: false, pushed: 0, pulled: 0, issues: 0, error: 'no-user' };
    }
    const db = await this.deps.db();
    await recoverSending(db, userId);
    const counts = { pushed: 0, pulled: 0, issues: 0 };
    try {
      await this.uploadFiles(db, userId);
      await this.pushAll(db, userId, counts);
      await this.pullAll(db, userId, counts);
      await setState(db, userKey.lastSyncAt(userId), this.now().toISOString());
      await logSync(db, 'sync-ok', counts);
      return { ok: true, ...counts };
    } catch (error) {
      const kind = error instanceof TransportError ? error.kind : 'unknown';
      await logSync(db, 'sync-failed', { kind, message: String(error), ...counts });
      return { ok: false, ...counts, error: kind };
    }
  }

  /**
   * Section 10, step 3 (TC-SI-FILE-01): the files of the user go to Storage before the push of their records.
   * If the server is not reachable, the sync stops, and the retry sends the files again. If the server refuses
   * one file, the other files continue. The push then gives `file_missing`, and the photo shows as a sync issue.
   */
  private async uploadFiles(db: LocalDb, userId: string): Promise<void> {
    const files = this.deps.files;
    if (!files) {
      return;
    }
    const rows = await db.query<UploadRow>(
      `select id, local_path, storage_key from attachments
        where owner_id = ? and upload_status = 'local' and local_path is not null and storage_key is not null
        order by rowid`,
      [userId],
    );
    for (const row of rows) {
      try {
        await files.upload(row.local_path, row.storage_key);
      } catch (error) {
        if (error instanceof TransportError && error.kind === 'refused') {
          await logSync(db, 'upload-refused', { id: row.id, message: error.message });
          continue;
        }
        throw error;
      }
      await db.run("update attachments set upload_status = 'uploaded' where id = ?", [row.id]);
    }
  }

  private async pushAll(db: LocalDb, userId: string, counts: { pushed: number; issues: number }): Promise<void> {
    for (;;) {
      const ops = await takeQueued(db, userId, PUSH_BATCH);
      if (ops.length === 0) {
        return;
      }
      const sentAt = this.now();
      let response;
      try {
        response = await this.deps.transport.push(
          ops.map((op) => ({
            op_id: op.opId,
            entity: op.entity,
            entity_id: op.entityId,
            op_type: op.opType,
            payload: op.payload,
            base_version: op.baseVersion,
          })),
          sentAt.toISOString(),
        );
      } catch (error) {
        await requeue(db, ops.map((op) => op.opId), String(error));
        throw error;
      }
      await this.storeClockOffset(db, response.server_time, sentAt);

      const byId = new Map(response.results.map((r) => [r.op_id, r]));
      await db.transaction((tx) => this.saveResults(tx, ops, byId, counts));
    }
  }

  /**
   * Push steps 5 and 6 (TC-U-SYNC-02). DEF-020: the good results of the batch use one delete and one query,
   * not three local calls for each operation. One local call is one bridge call on the device.
   * `rejected`, `conflict`, and missing results keep one call for each operation. They are rare.
   */
  private async saveResults(
    db: LocalDb,
    ops: readonly OutboxOp[],
    byId: ReadonlyMap<string, PushResult>,
    counts: { pushed: number; issues: number },
  ): Promise<void> {
    const doneOpIds: string[] = [];
    const done = new Map<string, SyncDone>();
    for (const op of ops) {
      const result = byId.get(op.opId);
      if (!result) {
        await requeue(db, [op.opId], 'no result');
        continue;
      }
      if (!isGood(result)) {
        await this.saveIssue(db, op, result);
        counts.issues++;
        continue;
      }
      doneOpIds.push(op.opId);
      counts.pushed++;
      // The newest good result of a record gives the copy for `markSynced`. The order of the batch stays the same.
      done.set(recordKey(op.entity, op.entityId), { entity: op.entity, entityId: op.entityId, record: result.record ?? null });
    }
    if (doneOpIds.length === 0) {
      return;
    }
    await removeOps(db, doneOpIds);
    await this.syncDone(db, done);
  }

  /** The `rejected` and `conflict` results keep their own handling. They are rare. */
  private async saveIssue(db: LocalDb, op: OutboxOp, result: PushResult): Promise<void> {
    await markOpIssue(db, result.op_id, result.cause ?? result.result, result.record ?? null);
    await markIssue(db, op.entity, op.entityId);
  }

  /** The records with no other operation in the outbox go to `synced` with the server copy. */
  private async syncDone(db: LocalDb, done: ReadonlyMap<string, SyncDone>): Promise<void> {
    const waiting = await entitiesWithOtherOps(db, [...done.values()]);
    for (const [key, pair] of done) {
      if (!waiting.has(key)) {
        await markSynced(db, pair.entity, pair.entityId, pair.record);
      }
    }
  }

  /**
   * Section 8, step 1 (TC-U-SYNC-07): offset = server time - device time. The device time is the middle of
   * the request, so that the network delay counts only one half.
   */
  private async storeClockOffset(db: LocalDb, serverTime: string, sentAt: Date): Promise<void> {
    const server = Date.parse(serverTime);
    if (Number.isNaN(server)) {
      return;
    }
    const middle = (sentAt.getTime() + this.now().getTime()) / 2;
    await setClockOffsetS(db, (server - middle) / 1000);
  }

  private async pullAll(db: LocalDb, userId: string, counts: { pulled: number }): Promise<void> {
    let cursor = Number((await getState(db, userKey.cursor(userId))) ?? 0);
    let epoch = await getState(db, userKey.epoch(userId));
    // A pull from cursor 0 gets all records in the scope. Then a new OJT in the scope needs no second pull.
    let fullPull = cursor === 0;

    for (let page = 0; page < MAX_PULL_PAGES; page++) {
      const sentAt = this.now();
      const res = await this.deps.transport.pull(cursor, epoch, PULL_PAGE);
      // A sync with nothing to push must also give the offset, else the first punches have none.
      await this.storeClockOffset(db, res.server_time, sentAt);
      if (res.epoch_changed) {
        await this.handleEpochChange(db, userId, res.epoch);
        cursor = 0;
        fullPull = true;
        epoch = res.epoch;
        continue;
      }
      const repull = !fullPull;
      const newScope = await db.transaction(async (tx) => {
        const started = (await mergePage(tx, res.records, userId)) && repull;
        // A new OJT in the scope: pull again from 0 to get its older records. The merge is safe to repeat.
        await setState(tx, userKey.cursor(userId), started ? '0' : String(res.cursor));
        await setState(tx, userKey.epoch(userId), res.epoch);
        return started;
      });
      fullPull ||= newScope;
      counts.pulled += res.records.length;
      cursor = newScope ? 0 : res.cursor;
      epoch = res.epoch;
      if (newScope) {
        continue;
      }
      // has_more with no records: the server holds back rows of the last 2 seconds. The next sync gets them.
      if (!res.has_more || res.records.length === 0) {
        return;
      }
    }
  }

  /** Section 12: the backend was rebuilt from a backup. Reset the cursor and send the own records again. */
  private async handleEpochChange(db: LocalDb, userId: string, epoch: string): Promise<void> {
    const since = new Date(this.now().getTime() - RESEND_DAYS * 86_400_000).toISOString();
    await db.transaction(async (tx) => {
      for (const entity of OWN_ENTITIES) {
        const { owner, time, dateOnly } = RESEND_COLUMNS[entity];
        const rows = await tx.query<Row>(
          `select * from ${entity} where ${owner} = ? and sync_status = 'synced' and ${time} >= ?`,
          [userId, dateOnly ? since.slice(0, 10) : since],
        );
        for (const row of rows) {
          await enqueue(tx, { userId, entity, entityId: String(row['id']), opType: 'create', payload: createPayload(entity, row) });
          await tx.run(`update ${entity} set sync_status = 'pending' where id = ?`, [row['id']]);
        }
      }
      // The rebuilt backend can be without the files. Upload them again. A file that exists counts as uploaded.
      await tx.run(
        "update attachments set upload_status = 'local' where owner_id = ? and sync_status = 'pending' and local_path is not null",
        [userId],
      );
      await setState(tx, userKey.cursor(userId), '0');
      await setState(tx, userKey.epoch(userId), epoch);
    });
    await logSync(db, 'epoch-changed', { epoch });
    // The new outbox operations go in the next sync.
    this.again = true;
  }
}
