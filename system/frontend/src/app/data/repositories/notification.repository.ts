// Notification repository (FR-NOTI-05). The server makes the notifications. The pull brings them.
// The user marks a notification as read. The mark goes to the outbox (last write wins on the server).
import { Injectable, inject } from '@angular/core';
import { LocalDb, fromSqlBool } from '../local-db/local-db';
import { LocalDbService } from '../local-db/local-db.service';
import { enqueue, findQueued } from '../sync/outbox';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  /** The app page to open, or null. */
  link: string | null;
  read: boolean;
  createdAt: string | null;
}

interface NotificationRow {
  [key: string]: string | number | null;
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: number;
  created_at: string | null;
}

function fromRow(r: NotificationRow): AppNotification {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body ?? '',
    link: r.link,
    read: fromSqlBool(r.read),
    createdAt: r.created_at,
  };
}

@Injectable({ providedIn: 'root' })
export class NotificationRepository {
  private readonly local = inject(LocalDbService);

  /** The notifications of the user, newest first. */
  async list(userId: string): Promise<AppNotification[]> {
    const db = await this.local.db();
    const rows = await db.query<NotificationRow>(
      'select * from notifications where user_id = ? and deleted_at is null order by created_at desc, rowid desc',
      [userId],
    );
    return rows.map(fromRow);
  }

  async markRead(id: string, userId: string): Promise<void> {
    const db = await this.local.db();
    await db.transaction((tx) => this.mark(tx, id, userId));
  }

  async markAllRead(userId: string): Promise<void> {
    const db = await this.local.db();
    await db.transaction(async (tx) => {
      const rows = await tx.query<{ id: string }>('select id from notifications where user_id = ? and read = 0', [userId]);
      for (const r of rows) {
        await this.mark(tx, r.id, userId);
      }
    });
  }

  private async mark(tx: LocalDb, id: string, userId: string): Promise<void> {
    const rows = await tx.query<{ read: number }>('select read from notifications where id = ? and user_id = ?', [id, userId]);
    if (!rows[0] || fromSqlBool(rows[0].read)) {
      return;
    }
    await tx.run("update notifications set read = 1, sync_status = 'pending' where id = ?", [id]);
    if (!(await findQueued(tx, 'notifications', id))) {
      await enqueue(tx, { userId, entity: 'notifications', entityId: id, opType: 'update', payload: { read: true } });
    }
  }
}
