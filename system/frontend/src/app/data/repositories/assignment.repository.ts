// The active assignments of a facilitator, from the local copy of the pulled data (FR-DTR-10, offline).
// The pull gives only the OJTs in the scope of the facilitator (RLS, API contract 5.2).
import { Injectable, inject } from '@angular/core';
import { LocalDbService } from '../local-db/local-db.service';

export interface AssignedOjt {
  ojtId: string;
  fullName: string;
  companyName: string;
}

/** The profile and the active assignment of an OJT, from the pulled data (FR-PROF-01, FR-MON-02). */
export interface OjtDetails {
  ojtId: string;
  fullName: string;
  contactNumber: string;
  companyName: string;
  facilitatorName: string;
  batchName: string;
  requiredHours: number;
  startDate: string;
}

interface DetailsRow {
  [key: string]: string | number | null;
  ojt_id: string;
  full_name: string | null;
  contact_no: string | null;
  company_name: string | null;
  facilitator_name: string | null;
  batch_name: string | null;
  required_hours: number | null;
  start_date: string | null;
}

interface AssignedRow {
  [key: string]: string | number | null;
  ojt_id: string;
  full_name: string | null;
  company_name: string | null;
}

@Injectable({ providedIn: 'root' })
export class AssignmentRepository {
  private readonly local = inject(LocalDbService);

  /** The OJTs of the facilitator, by name. A missing profile or company shows as an empty name. */
  async ojtsOf(facilitatorId: string): Promise<AssignedOjt[]> {
    const db = await this.local.db();
    const rows = await db.query<AssignedRow>(
      `select a.ojt_id, p.full_name, c.name as company_name
         from ojt_assignments a
         left join profiles p on p.id = a.ojt_id
         left join companies c on c.id = a.company_id
        where a.facilitator_id = ? and a.active = 1 and a.deleted_at is null
        order by p.full_name collate nocase, a.ojt_id`,
      [facilitatorId],
    );
    return rows.map((r) => ({ ojtId: r.ojt_id, fullName: r.full_name ?? '', companyName: r.company_name ?? '' }));
  }

  /**
   * FR-DTR-05: true if the company of the active assignment of the OJT requires a photo for each punch.
   * False if the device has no assignment or company data yet (no pull since the first login).
   */
  async photoRequired(ojtId: string): Promise<boolean> {
    const db = await this.local.db();
    const rows = await db.query<{ photo_required: number }>(
      `select c.photo_required
         from ojt_assignments a
         join companies c on c.id = a.company_id and c.deleted_at is null
        where a.ojt_id = ? and a.active = 1 and a.deleted_at is null
        limit 1`,
      [ojtId],
    );
    return rows[0]?.photo_required === 1;
  }

  /** The details of each OJT that has an active assignment on this device, by name. */
  async details(ojtIds: readonly string[]): Promise<OjtDetails[]> {
    if (!ojtIds.length) {
      return [];
    }
    const db = await this.local.db();
    const rows = await db.query<DetailsRow>(
      `select a.ojt_id, p.full_name, p.contact_no, c.name as company_name, f.full_name as facilitator_name,
              b.name as batch_name, b.required_hours, b.start_date
         from ojt_assignments a
         left join profiles p on p.id = a.ojt_id
         left join profiles f on f.id = a.facilitator_id
         left join companies c on c.id = a.company_id
         left join batches b on b.id = a.batch_id
        where a.active = 1 and a.deleted_at is null and a.ojt_id in (${ojtIds.map(() => '?').join(', ')})
        order by p.full_name collate nocase, a.ojt_id`,
      [...ojtIds],
    );
    return rows.map((r) => ({
      ojtId: r.ojt_id,
      fullName: r.full_name ?? '',
      contactNumber: r.contact_no ?? '',
      companyName: r.company_name ?? '',
      facilitatorName: r.facilitator_name ?? '',
      batchName: r.batch_name ?? '',
      requiredHours: Number(r.required_hours ?? 0),
      startDate: r.start_date ?? '',
    }));
  }

  /** The assigned OJT, or null if the OJT is not an active OJT of this facilitator. */
  async ojtOf(facilitatorId: string, ojtId: string): Promise<AssignedOjt | null> {
    return (await this.ojtsOf(facilitatorId)).find((o) => o.ojtId === ojtId) ?? null;
  }
}
