import { PunchInput } from './hours';
import { ReportAction, ReportStatus, canEditReport, isCompleteForSubmit, nextStatus, reportWeekMinutes } from './report-rules';

describe('TC-U-RPT-01 report status machine (FR-RPT-04, FR-RPT-05, FR-RPT-06)', () => {
  const statuses: ReportStatus[] = ['draft', 'submitted', 'approved', 'returned'];
  const actions: ReportAction[] = ['submit', 'approve', 'return'];
  const permitted: Record<string, ReportStatus> = {
    'draft:submit': 'submitted',
    'submitted:approve': 'approved',
    'submitted:return': 'returned',
    'returned:submit': 'submitted',
  };

  for (const status of statuses) {
    for (const action of actions) {
      const expected = permitted[`${status}:${action}`] ?? null;
      it(`TC-U-RPT-01 ${status} + ${action} gives ${expected ?? 'rejected'}`, () => {
        expect(nextStatus(status, action)).toBe(expected);
      });
    }
  }

  it('TC-U-RPT-01 content can change only in draft or returned', () => {
    expect(statuses.filter(canEditReport)).toEqual(['draft', 'returned']);
  });

  it('TC-U-RPT-01 a submit needs the tasks and the skills', () => {
    expect(isCompleteForSubmit({ tasksDone: 'x', skillsLearned: ' ' })).toBe(false);
    expect(isCompleteForSubmit({ tasksDone: 'x', skillsLearned: 'y' })).toBe(true);
  });
});

describe('TC-U-RPT-02 report hours (FR-RPT-02)', () => {
  // Week of Monday 2026-10-19 (Asia/Manila). Times are UTC (+08:00 in Manila).
  const punches: PunchInput[] = [
    { id: 'a', type: 'in', time: '2026-10-19T00:00:00Z' }, // Mon 08:00
    { id: 'b', type: 'out', time: '2026-10-19T09:00:00Z' }, // Mon 17:00, 9 h
    { id: 'c', type: 'in', time: '2026-10-25T01:00:00Z' }, // Sun 09:00
    { id: 'd', type: 'out', time: '2026-10-25T03:30:00Z' }, // Sun 11:30, 2.5 h
    { id: 'e', type: 'in', time: '2026-10-26T00:00:00Z' }, // next Monday
    { id: 'f', type: 'out', time: '2026-10-26T08:00:00Z' },
  ];

  it('TC-U-RPT-02 gives the logged minutes of the week only', () => {
    expect(reportWeekMinutes(punches, '2026-10-19')).toBe(11.5 * 60);
    expect(reportWeekMinutes(punches, '2026-10-26')).toBe(8 * 60);
    expect(reportWeekMinutes(punches, '2026-10-12')).toBe(0);
  });

  it('TC-U-RPT-02 an approved correction replaces its original punch (FR-COR-03)', () => {
    const corrected = [...punches, { id: 'g', type: 'out' as const, time: '2026-10-19T10:00:00Z', correctsPunchId: 'b' }];
    expect(reportWeekMinutes(corrected, '2026-10-19')).toBe(12.5 * 60);
  });
});
