// Outbox: the local operations that the server did not accept yet (offline sync design, section 2.1).
// S2 adds the sync engine that sends them with sync_push.
import { LocalDb } from '../local-db/local-db';
import { newId, nowIso } from '../../shared/utils/uuid';

export type OpType = 'create' | 'update' | 'delete';
export type OutboxStatus = 'queued' | 'sending' | 'issue';

export interface OutboxOp {
  opId: string;
  userId: string;
  entity: string;
  entityId: string;
  opType: OpType;
  payload: unknown;
  baseVersion: number | null;
  createdAt: string;
  attempts: number;
  lastError: string | null;
  status: OutboxStatus;
}

interface OutboxRow {
  [key: string]: string | number | null;
  op_id: string;
  user_id: string;
  entity: string;
  entity_id: string;
  op_type: string;
  payload: string;
  base_version: number | null;
  created_at: string;
  attempts: number;
  last_error: string | null;
  status: string;
}

/** Adds one operation. Call it in the same transaction as the record change (FR-SYNC-01). */
export async function enqueue(
  db: LocalDb,
  op: { userId: string; entity: string; entityId: string; opType: OpType; payload: unknown; baseVersion?: number | null },
): Promise<string> {
  const opId = newId();
  await db.run(
    `insert into outbox (op_id, user_id, entity, entity_id, op_type, payload, base_version, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?)`,
    [opId, op.userId, op.entity, op.entityId, op.opType, JSON.stringify(op.payload), op.baseVersion ?? null, nowIso()],
  );
  return opId;
}

function fromRow(r: OutboxRow): OutboxOp {
  return {
    opId: r.op_id,
    userId: r.user_id,
    entity: r.entity,
    entityId: r.entity_id,
    opType: r.op_type as OpType,
    payload: JSON.parse(r.payload),
    baseVersion: r.base_version,
    createdAt: r.created_at,
    attempts: r.attempts,
    lastError: r.last_error,
    status: r.status as OutboxStatus,
  };
}

/** The operations of one user, oldest first. The outbox of a different user is never given (offline sync design 9.5). */
export async function listOutbox(db: LocalDb, userId: string): Promise<OutboxOp[]> {
  const rows = await db.query<OutboxRow>(
    'select * from outbox where user_id = ? order by created_at, rowid',
    [userId],
  );
  return rows.map(fromRow);
}

/** Push step 1 and 2 (section 4): takes up to `limit` queued operations and sets them to `sending`. */
export async function takeQueued(db: LocalDb, userId: string, limit: number): Promise<OutboxOp[]> {
  return db.transaction(async (tx) => {
    const rows = await tx.query<OutboxRow>(
      "select * from outbox where user_id = ? and status = 'queued' order by created_at, rowid limit ?",
      [userId, limit],
    );
    if (rows.length > 0) {
      // DEF-020: one local call sets the whole batch, not one call for each operation.
      await tx.run(`update outbox set status = 'sending' where op_id in (${rows.map(() => '?').join(', ')})`, rows.map((r) => r.op_id));
    }
    return rows.map((r) => ({ ...fromRow(r), status: 'sending' as const }));
  });
}

/** Push step 7: the request failed. The operations go back to the queue with one more attempt. */
export async function requeue(db: LocalDb, opIds: readonly string[], error: string): Promise<void> {
  for (const id of opIds) {
    await db.run(
      "update outbox set status = 'queued', attempts = attempts + 1, last_error = ? where op_id = ?",
      [error, id],
    );
  }
}

/**
 * Operations with status `sending` at the start of a sync were in a sync that stopped (app stop, TC-SI-SYNC-03).
 * They go back to the queue. The server gives `duplicate` if it applied them already.
 */
export async function recoverSending(db: LocalDb, userId: string): Promise<void> {
  await db.run("update outbox set status = 'queued' where user_id = ? and status = 'sending'", [userId]);
}

export async function removeOp(db: LocalDb, opId: string): Promise<void> {
  await db.run('delete from outbox where op_id = ?', [opId]);
}

/**
 * Removes many operations in one call (DEF-020). Each call is one bridge call on the device.
 * The push sends at most 50 operations in one batch, below the SQLite limit of 999 parameters.
 */
export async function removeOps(db: LocalDb, opIds: readonly string[]): Promise<void> {
  if (opIds.length === 0) {
    return;
  }
  await db.run(`delete from outbox where op_id in (${opIds.map(() => '?').join(', ')})`, opIds);
}

/** The key of one record: `entity` and `entity_id`. It finds a record in a `Set` from `entitiesWithOtherOps`. */
export function recordKey(entity: string, entityId: string): string {
  return `${entity}\u0000${entityId}`;
}

/**
 * The records of `keys` that still have one or more operations in the outbox (DEF-020). One call finds them all.
 * The push calls it after it removes the good results, so only the operations of `rejected` and `conflict` stay.
 */
export async function entitiesWithOtherOps(
  db: LocalDb,
  keys: readonly { entity: string; entityId: string }[],
): Promise<Set<string>> {
  if (keys.length === 0) {
    return new Set();
  }
  const rows = await db.query<{ entity: string; entity_id: string }>(
    `select distinct entity, entity_id from outbox
      where ${keys.map(() => '(entity = ? and entity_id = ?)').join(' or ')}`,
    keys.flatMap((k) => [k.entity, k.entityId]),
  );
  return new Set(rows.map((r) => recordKey(r.entity, r.entity_id)));
}

/** `serverRecord`: the current server copy, if the server gave it (conflict). The user can take it (FR-SYNC-06). */
export async function markOpIssue(
  db: LocalDb,
  opId: string,
  cause: string,
  serverRecord: Record<string, unknown> | null = null,
): Promise<void> {
  await db.run("update outbox set status = 'issue', last_error = ?, server_record = ? where op_id = ?", [
    cause,
    serverRecord ? JSON.stringify(serverRecord) : null,
    opId,
  ]);
}

/** True if other operations of the same record wait in the outbox. Then the record stays `pending`. */
export async function hasOtherOps(db: LocalDb, entity: string, entityId: string): Promise<boolean> {
  const rows = await db.query<{ n: number }>(
    'select count(*) as n from outbox where entity = ? and entity_id = ?',
    [entity, entityId],
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

/** The number of unsynced changes of one user (FR-SYNC-04, QR-SF-01). */
export async function countOutbox(db: LocalDb, userId: string): Promise<number> {
  const rows = await db.query<{ n: number }>('select count(*) as n from outbox where user_id = ?', [userId]);
  return Number(rows[0]?.n ?? 0);
}

/** The newest queued operation of a record, or null. A queued operation is not sent yet, so its payload can change. */
export async function findQueued(db: LocalDb, entity: string, entityId: string): Promise<OutboxOp | null> {
  const rows = await db.query<OutboxRow>(
    "select * from outbox where entity = ? and entity_id = ? and status = 'queued' order by created_at desc, rowid desc limit 1",
    [entity, entityId],
  );
  return rows[0] ? fromRow(rows[0]) : null;
}

/** Changes the payload of a queued operation (one operation for many saves of the same record). */
export async function replacePayload(db: LocalDb, opId: string, payload: unknown): Promise<void> {
  await db.run("update outbox set payload = ? where op_id = ? and status = 'queued'", [JSON.stringify(payload), opId]);
}

/**
 * The number of unsent operations that change the server version of a record: the operations of the record, and
 * the operations of `ref.entity` that refer to it with `ref.column` in their payload (for example, a report event).
 * The base version of a new update is the local version plus this number (offline sync design, section 7).
 */
export async function countOpenChanges(
  db: LocalDb,
  entity: string,
  entityId: string,
  ref?: { entity: string; column: string },
): Promise<number> {
  const own = await db.query<{ n: number }>('select count(*) as n from outbox where entity = ? and entity_id = ?', [entity, entityId]);
  let refs = 0;
  if (ref) {
    const rows = await db.query<{ n: number }>('select count(*) as n from outbox where entity = ? and payload like ?', [
      ref.entity,
      `%"${ref.column}":"${entityId}"%`,
    ]);
    refs = Number(rows[0]?.n ?? 0);
  }
  return Number(own[0]?.n ?? 0) + refs;
}
