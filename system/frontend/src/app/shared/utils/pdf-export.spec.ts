import { WorkSession } from './hours';
import { buildDtrPdf, buildReportPdf, dtrPdfDays, pdfFileName } from './pdf-export';

// TC-CI-EXP-01 (FR-EXP-01, FR-EXP-02, QR-CO-03): DTR PDF and report PDF.
// The PDFs are made with compress: false, so the text is readable in the bytes.
function text(bytes: Uint8Array): string {
  return new TextDecoder('latin1').decode(bytes);
}

function session(id: string, inUtc: string, outUtc: string | null, date: string, minutes: number): WorkSession {
  return {
    timeIn: { id: `${id}i`, type: 'in', time: inUtc },
    timeOut: outUtc ? { id: `${id}o`, type: 'out', time: outUtc } : null,
    date,
    minutes,
  };
}

const sessions: WorkSession[] = [
  session('a', '2026-10-19T00:00:00Z', '2026-10-19T04:00:00Z', '2026-10-19', 240), // 08:00-12:00
  session('b', '2026-10-19T05:00:00Z', '2026-10-19T09:30:00Z', '2026-10-19', 270), // 13:00-17:30
  session('c', '2026-10-21T01:15:00Z', '2026-10-21T09:15:00Z', '2026-10-21', 480), // 09:15-17:15
  session('d', '2026-10-22T00:00:00Z', null, '2026-10-22', 0), // open
  session('e', '2026-10-30T00:00:00Z', '2026-10-30T08:00:00Z', '2026-10-30', 480), // out of range
];

describe('TC-CI-EXP-01 DTR rows', () => {
  it('TC-CI-EXP-01 one row for each day of the range, with first in, last out, and minutes', () => {
    const days = dtrPdfDays(sessions, '2026-10-19', '2026-10-23');
    expect(days.map((d) => d.date)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']);
    expect(days[0]).toEqual({ date: '2026-10-19', firstIn: '08:00', lastOut: '17:30', minutes: 510 });
    expect(days[1]).toEqual({ date: '2026-10-20', firstIn: null, lastOut: null, minutes: 0 });
    expect(days[2]).toEqual({ date: '2026-10-21', firstIn: '09:15', lastOut: '17:15', minutes: 480 });
    expect(days[3]).toEqual({ date: '2026-10-22', firstIn: '08:00', lastOut: null, minutes: 0 });
  });

  it('TC-CI-EXP-01 an empty or reversed range gives no rows', () => {
    expect(dtrPdfDays(sessions, '2026-10-23', '2026-10-19')).toEqual([]);
  });
});

describe('TC-CI-EXP-01 DTR PDF', () => {
  const pdf = buildDtrPdf({
    fullName: 'Ana Cruz',
    companyName: 'Acme Corp',
    from: '2026-10-19',
    to: '2026-10-23',
    days: dtrPdfDays(sessions, '2026-10-19', '2026-10-23'),
  });
  const body = text(pdf);

  it('TC-CI-EXP-01 is a complete PDF file', () => {
    expect(pdf).toBeInstanceOf(Uint8Array);
    expect(body.startsWith('%PDF-')).toBe(true);
    expect(body.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('TC-CI-EXP-01 has the title, the OJT, the range, each day, and the total', () => {
    for (const s of [
      'Daily Time Record',
      'Ana Cruz',
      'Acme Corp',
      '2026-10-19 to 2026-10-23',
      '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23',
      '08:00', '17:30', '09:15', '17:15',
      'Total hours: 16.50',
      'Days with hours: 2',
    ]) {
      expect(body).toContain(s);
    }
  });

  it('TC-CI-EXP-01 a range of 62 days makes more than one page', () => {
    const days = dtrPdfDays([], '2026-09-01', '2026-11-01');
    expect(days.length).toBe(62);
    const many = text(buildDtrPdf({ fullName: 'A', companyName: 'B', from: '2026-09-01', to: '2026-11-01', days }));
    expect((many.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
    expect(many).toContain('2026-11-01');
    expect(many).toContain('Total hours: 0.00');
  });
});

describe('TC-CI-EXP-01 report PDF', () => {
  const pdf = buildReportPdf({
    fullName: 'Ana Cruz',
    companyName: 'Acme Corp',
    weekStart: '2026-10-19',
    minutes: 990,
    status: 'approved',
    tasksDone: 'Fixed the login form.',
    skillsLearned: 'Angular signals.',
    problems: '',
    plansNextWeek: 'Write tests.',
  });
  const body = text(pdf);

  it('TC-CI-EXP-01 is a complete PDF file', () => {
    expect(body.startsWith('%PDF-')).toBe(true);
    expect(body.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('TC-CI-EXP-01 has all sections, the week, the hours, and the status', () => {
    for (const s of [
      'Weekly Report',
      'Ana Cruz',
      'Acme Corp',
      'Week of 2026-10-19',
      'Hours: 16.50',
      'Status: approved',
      'Tasks done', 'Fixed the login form.',
      'Skills learned', 'Angular signals.',
      'Problems', 'None',
      'Plans for next week', 'Write tests.',
    ]) {
      expect(body).toContain(s);
    }
  });

  it('TC-CI-EXP-01 long text wraps to more lines and pages', () => {
    const long = buildReportPdf({
      fullName: 'A', companyName: 'B', weekStart: '2026-10-19', minutes: 0, status: 'approved',
      tasksDone: 'word '.repeat(3000), skillsLearned: 'x', problems: 'y', plansNextWeek: 'z',
    });
    expect((text(long).match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
  });
});

describe('TC-CI-EXP-01 file names', () => {
  it('TC-CI-EXP-01 names have the kind and the dates', () => {
    expect(pdfFileName('dtr', '2026-10-19', '2026-10-23')).toBe('ojt-dtr-dtr-2026-10-19-to-2026-10-23.pdf');
    expect(pdfFileName('report', '2026-10-19')).toBe('ojt-dtr-report-2026-10-19.pdf');
  });
});
