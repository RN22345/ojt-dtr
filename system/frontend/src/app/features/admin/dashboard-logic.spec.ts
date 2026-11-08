import { DashboardRow } from '../../data/admin/admin-models';
import { NO_FILTER, countBy, filterOptions, filterRows, isFiltered, totals } from './dashboard-logic';

function row(over: Partial<DashboardRow>): DashboardRow {
  return {
    ojtId: 'o1', ojtName: 'Ana', ojtStatus: 'active', companyId: 'c1', companyName: 'Acme',
    batchId: 'b1', batchName: 'Batch 1', facilitatorId: 'f1', facilitatorName: 'Fe',
    requiredHours: 486, loggedMinutes: 0, lateReports: 0, behind: false, ...over,
  };
}

const ROWS = [
  row({ ojtId: 'o1', lateReports: 2, behind: true }),
  row({ ojtId: 'o2', companyId: 'c2', companyName: 'Beta', lateReports: 1 }),
  row({ ojtId: 'o3', batchId: 'b2', batchName: 'Batch 2', facilitatorId: 'f2', facilitatorName: 'Gil', behind: true }),
];

describe('admin dashboard logic (FR-MON-03, FR-MON-04)', () => {
  it('totals the OJTs, the late reports, and the OJTs behind', () => {
    expect(totals(ROWS)).toEqual({ ojts: 3, lateReports: 3, behind: 2 });
    expect(totals([])).toEqual({ ojts: 0, lateReports: 0, behind: 0 });
  });

  it('counts the OJTs for each batch and for each company', () => {
    expect(countBy(ROWS, 'batch')).toEqual([
      { id: 'b1', name: 'Batch 1', count: 2 },
      { id: 'b2', name: 'Batch 2', count: 1 },
    ]);
    expect(countBy(ROWS, 'company').map((c) => [c.name, c.count])).toEqual([['Acme', 2], ['Beta', 1]]);
  });

  it('gives all rows for an empty filter', () => {
    expect(filterRows(ROWS, NO_FILTER)).toHaveLength(3);
    expect(isFiltered(NO_FILTER)).toBe(false);
  });

  it('filters by batch, company, and facilitator, alone and together', () => {
    expect(filterRows(ROWS, { ...NO_FILTER, batchId: 'b1' }).map((r) => r.ojtId)).toEqual(['o1', 'o2']);
    expect(filterRows(ROWS, { ...NO_FILTER, companyId: 'c2' }).map((r) => r.ojtId)).toEqual(['o2']);
    expect(filterRows(ROWS, { ...NO_FILTER, facilitatorId: 'f2' }).map((r) => r.ojtId)).toEqual(['o3']);
    expect(filterRows(ROWS, { batchId: 'b1', companyId: 'c1', facilitatorId: 'f1' }).map((r) => r.ojtId)).toEqual(['o1']);
    expect(filterRows(ROWS, { batchId: 'b2', companyId: 'c2', facilitatorId: '' })).toEqual([]);
    expect(isFiltered({ ...NO_FILTER, batchId: 'b1' })).toBe(true);
  });

  it('recalculates the totals for the filtered rows', () => {
    expect(totals(filterRows(ROWS, { ...NO_FILTER, batchId: 'b2' }))).toEqual({ ojts: 1, lateReports: 0, behind: 1 });
  });

  it('gives the filter lists without duplicates, in name order', () => {
    const options = filterOptions(ROWS);
    expect(options.batches.map((b) => b.name)).toEqual(['Batch 1', 'Batch 2']);
    expect(options.companies.map((c) => c.name)).toEqual(['Acme', 'Beta']);
    expect(options.facilitators.map((f) => f.name)).toEqual(['Fe', 'Gil']);
  });
});
