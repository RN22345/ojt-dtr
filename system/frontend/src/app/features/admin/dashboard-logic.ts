// Pure functions of the admin dashboard (FR-MON-03, FR-MON-04, D-70 point 3).
// The server gives one row for each active assignment. The web app counts and filters the rows.
import { DashboardRow } from '../../data/admin/admin-models';

/** A filter value of '' means all. */
export interface DashboardFilter {
  batchId: string;
  companyId: string;
  facilitatorId: string;
}

export const NO_FILTER: DashboardFilter = { batchId: '', companyId: '', facilitatorId: '' };

export interface DashboardTotals {
  ojts: number;
  lateReports: number;
  behind: number;
}

export interface CountItem {
  id: string;
  name: string;
  count: number;
}

export interface FilterOptions {
  batches: { id: string; name: string }[];
  companies: { id: string; name: string }[];
  facilitators: { id: string; name: string }[];
}

export function filterRows(rows: DashboardRow[], filter: DashboardFilter): DashboardRow[] {
  return rows.filter(
    (r) =>
      (!filter.batchId || r.batchId === filter.batchId) &&
      (!filter.companyId || r.companyId === filter.companyId) &&
      (!filter.facilitatorId || r.facilitatorId === filter.facilitatorId),
  );
}

export function totals(rows: DashboardRow[]): DashboardTotals {
  return {
    ojts: rows.length,
    lateReports: rows.reduce((sum, r) => sum + r.lateReports, 0),
    behind: rows.filter((r) => r.behind).length,
  };
}

/** The OJT count for each batch or each host company, in name order. */
export function countBy(rows: DashboardRow[], key: 'batch' | 'company'): CountItem[] {
  const map = new Map<string, CountItem>();
  for (const r of rows) {
    const id = key === 'batch' ? r.batchId : r.companyId;
    const name = key === 'batch' ? r.batchName : r.companyName;
    const item = map.get(id) ?? { id, name, count: 0 };
    item.count += 1;
    map.set(id, item);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function unique(pairs: { id: string; name: string }[]): { id: string; name: string }[] {
  const map = new Map(pairs.map((p) => [p.id, p]));
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** The values of the three filter lists, from all rows (not from the filtered rows). */
export function filterOptions(rows: DashboardRow[]): FilterOptions {
  return {
    batches: unique(rows.map((r) => ({ id: r.batchId, name: r.batchName }))),
    companies: unique(rows.map((r) => ({ id: r.companyId, name: r.companyName }))),
    facilitators: unique(rows.map((r) => ({ id: r.facilitatorId, name: r.facilitatorName }))),
  };
}

export function isFiltered(filter: DashboardFilter): boolean {
  return !!(filter.batchId || filter.companyId || filter.facilitatorId);
}
