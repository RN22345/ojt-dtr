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

/** The operations of one user, oldest first. The outbox of a different user is never given (offline sync design 9.5). */
export async function listOutbox(db: LocalDb, userId: string): Promise<OutboxOp[]> {
  const rows = await db.query<OutboxRow>(
    'select * from outbox where user_id = ? order by created_at, rowid',
    [userId],
  );
  return rows.map((r) => ({
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
  }));
}

/** The number of unsynced changes of one user (FR-SYNC-04, QR-SF-01). */
export async function countOutbox(db: LocalDb, userId: string): Promise<number> {
  const rows = await db.query<{ n: number }>('select count(*) as n from outbox where user_id = ?', [userId]);
  return Number(rows[0]?.n ?? 0);
}
