// Correction request repository: the only path to correction data (frontend rule 3).
// The OJT creates a request (FR-COR-01). The facilitator decides (FR-COR-02). On approval, the server makes the
// new punch that refers to the original punch (FR-COR-03). The pull brings that punch to the devices.
import { Injectable, inject } from '@angular/core';
import { LocalDbService } from '../local-db/local-db.service';
import { countOpenChanges, enqueue } from '../sync/outbox';
import { createPayload } from '../sync/payloads';
import { nowIso } from '../../shared/utils/uuid';
import { SyncStatus } from './punch.repository';

export type CorrectionKind = 'add' | 'change';
export type CorrectionStatus = 'pending' | 'approved' | 'rejected';

export interface NewCorrection {
  id: string;
  ojtId: string;
  kind: CorrectionKind;
  /** The punch to change (kind `change`), else null. */
  punchId: string | null;
  /** The type of the new punch (kind `add`), else null (D-66). */
  punchType: 'in' | 'out' | null;
  requestedTime: string;
  reason: string;
}

export interface CorrectionRequest extends NewCorrection {
  status: CorrectionStatus;
  remark: string | null;
  decidedAt: string | null;
  createdAt: string | null;
  version: number;
  syncStatus: SyncStatus;
}

export type CorrectionFailure = 'reason-required' | 'future-time' | 'punch-required' | 'not-pending' | 'remark-required' | 'not-found';
export type CorrectionResult = { ok: true; request: CorrectionRequest } | { ok: false; reason: CorrectionFailure };

interface CorrectionRow {
  [key: string]: string | number | null;
  id: string;
  ojt_id: string;
  punch_id: string | null;
  kind: string;
  punch_type: string | null;
  requested_time: string;
  reason: string;
  status: string;
  remark: string | null;
  decided_at: string | null;
  created_at: string | null;
  version: number;
  sync_status: string;
}

function fromRow(r: CorrectionRow): CorrectionRequest {
  return {
    id: r.id,
    ojtId: r.ojt_id,
    kind: r.kind as CorrectionKind,
    punchId: r.punch_id,
    punchType: r.punch_type === 'in' || r.punch_type === 'out' ? r.punch_type : null,
    requestedTime: r.requested_time,
    reason: r.reason,
    status: r.status as CorrectionStatus,
    remark: r.remark,
    decidedAt: r.decided_at,
    createdAt: r.created_at,
    version: r.version,
    syncStatus: r.sync_status as SyncStatus,
  };
}

/** The server accepts a requested time up to 2 minutes after its own time. */
const FUTURE_TOLERANCE_MS = 120_000;

@Injectable({ providedIn: 'root' })
export class CorrectionRepository {
  private readonly local = inject(LocalDbService);

  /** FR-COR-01: a request to add a punch or to change the time of a punch. The reason is necessary. */
  async create(input: NewCorrection, userId: string, now: Date = new Date()): Promise<CorrectionResult> {
    const reason = input.reason.trim();
    if (!reason) {
      return { ok: false, reason: 'reason-required' };
    }
    if (Date.parse(input.requestedTime) > now.getTime() + FUTURE_TOLERANCE_MS) {
      return { ok: false, reason: 'future-time' };
    }
    if ((input.kind === 'change') !== !!input.punchId || (input.kind === 'add') !== !!input.punchType) {
      return { ok: false, reason: 'punch-required' };
    }
    const row = {
      id: input.id,
      ojt_id: input.ojtId,
      punch_id: input.kind === 'change' ? input.punchId : null,
      kind: input.kind,
      punch_type: input.kind === 'add' ? input.punchType : null,
      requested_time: input.requestedTime,
      reason,
    };
    const db = await this.local.db();
    await db.transaction(async (tx) => {
      await tx.run(
        `insert into correction_requests (id, ojt_id, punch_id, kind, punch_type, requested_time, reason, status,
           created_at, version, sync_status)
         values (?, ?, ?, ?, ?, ?, ?, 'pending', ?, 0, 'pending')`,
        [row.id, row.ojt_id, row.punch_id, row.kind, row.punch_type, row.requested_time, row.reason, nowIso()],
      );
      await enqueue(tx, { userId, entity: 'correction_requests', entityId: row.id, opType: 'create', payload: createPayload('correction_requests', row) });
    });
    return this.result(row.id);
  }

  /** FR-COR-02: approve, or reject with a remark. The first decision wins on the server. */
  async decide(id: string, status: 'approved' | 'rejected', remark: string, userId: string, deviceId: string): Promise<CorrectionResult> {
    const current = await this.getById(id);
    if (!current) {
      return { ok: false, reason: 'not-found' };
    }
    if (current.status !== 'pending') {
      return { ok: false, reason: 'not-pending' };
    }
    if (status === 'rejected' && !remark.trim()) {
      return { ok: false, reason: 'remark-required' };
    }
    const db = await this.local.db();
    await db.transaction(async (tx) => {
      const open = await countOpenChanges(tx, 'correction_requests', id);
      await tx.run(
        `update correction_requests set status = ?, remark = ?, decided_by = ?, decided_device_id = ?, decided_at = ?,
           sync_status = 'pending' where id = ?`,
        [status, remark.trim() || null, userId, deviceId, nowIso(), id],
      );
      await enqueue(tx, {
        userId,
        entity: 'correction_requests',
        entityId: id,
        opType: 'update',
        payload: { status, remark: remark.trim() || null, decided_device_id: deviceId },
        baseVersion: current.version + open,
      });
    });
    return this.result(id);
  }

  async getById(id: string): Promise<CorrectionRequest | null> {
    const db = await this.local.db();
    const rows = await db.query<CorrectionRow>('select * from correction_requests where id = ? and deleted_at is null', [id]);
    return rows[0] ? fromRow(rows[0]) : null;
  }

  /** The requests of one OJT, newest first. */
  async listByOjt(ojtId: string): Promise<CorrectionRequest[]> {
    const db = await this.local.db();
    const rows = await db.query<CorrectionRow>(
      'select * from correction_requests where ojt_id = ? and deleted_at is null order by requested_time desc, rowid desc',
      [ojtId],
    );
    return rows.map(fromRow);
  }

  /** The requests of the OJTs of a facilitator, newest first. */
  async listForOjts(ojtIds: readonly string[]): Promise<CorrectionRequest[]> {
    if (!ojtIds.length) {
      return [];
    }
    const db = await this.local.db();
    const rows = await db.query<CorrectionRow>(
      `select * from correction_requests where deleted_at is null and ojt_id in (${ojtIds.map(() => '?').join(', ')})
       order by requested_time desc, rowid desc`,
      [...ojtIds],
    );
    return rows.map(fromRow);
  }

  private async result(id: string): Promise<CorrectionResult> {
    const request = await this.getById(id);
    return request ? { ok: true, request } : { ok: false, reason: 'not-found' };
  }
}
