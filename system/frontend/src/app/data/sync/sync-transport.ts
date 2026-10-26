// Layer 2: the two sync RPC calls (API contract, section 5). The sync engine uses only this interface,
// so that unit tests can give a fake server.
import { InjectionToken, inject } from '@angular/core';
import { SUPABASE } from '../../core/supabase.client';

export interface PushOp {
  op_id: string;
  entity: string;
  entity_id: string;
  op_type: string;
  payload: unknown;
  base_version: number | null;
}

export type PushResultCode = 'applied' | 'duplicate' | 'conflict' | 'rejected';

export interface PushResult {
  op_id: string;
  result: PushResultCode;
  cause?: string;
  record?: Record<string, unknown> | null;
}

export interface PushResponse {
  server_time: string;
  results: PushResult[];
}

export interface PullRecord {
  entity: string;
  change_seq: number;
  data: Record<string, unknown>;
}

export interface PullResponse {
  epoch: string;
  epoch_changed: boolean;
  server_time: string;
  records: PullRecord[];
  cursor: number;
  has_more: boolean;
}

/**
 * `unreachable`: no answer, a timeout, or a 5xx error (FR-SYNC-08). Retry later. Keep the session.
 * `session`: the server does not accept the session (401). AUTH shows the login screen. The outbox stays.
 * `refused`: the server refused the call (for example an inactive account).
 */
export type TransportErrorKind = 'unreachable' | 'session' | 'refused';

export class TransportError extends Error {
  constructor(
    readonly kind: TransportErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'TransportError';
  }
}

export interface SyncTransport {
  push(ops: PushOp[], deviceNow: string): Promise<PushResponse>;
  pull(cursor: number, epoch: string | null, limit: number): Promise<PullResponse>;
}

/** Sorts the error of an RPC call (offline sync design, section 13). Status 0 means that fetch failed. */
export function errorKindOf(status: number): TransportErrorKind {
  if (status === 0 || status >= 500) {
    return 'unreachable';
  }
  if (status === 401) {
    return 'session';
  }
  return 'refused';
}

export const SYNC_TRANSPORT = new InjectionToken<SyncTransport>('SYNC_TRANSPORT', {
  providedIn: 'root',
  factory: () => {
    const supabase = inject(SUPABASE);
    const call = async <T>(fn: string, args: Record<string, unknown>): Promise<T> => {
      let result;
      try {
        result = await supabase.rpc(fn, args);
      } catch (error) {
        throw new TransportError('unreachable', String(error));
      }
      if (result.error) {
        throw new TransportError(errorKindOf(result.status), result.error.message);
      }
      return result.data as T;
    };
    return {
      push: (ops, deviceNow) => call<PushResponse>('sync_push', { p_ops: ops, p_device_now: deviceNow }),
      pull: (cursor, epoch, limit) => call<PullResponse>('sync_pull', { p_cursor: cursor, p_epoch: epoch, p_limit: limit }),
    };
  },
});
