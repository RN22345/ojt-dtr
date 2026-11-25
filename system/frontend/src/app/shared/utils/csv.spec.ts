import { CSV_MIME, csvFileName, dtrSummaryCsv, reportSummaryCsv, toCsv } from './csv';

// TC-CI-EXP-02 (FR-EXP-03, QR-CO-03), CSV text part. Excel and Google Sheets open UTF-8 CSV with a BOM,
// a header row, CRLF line ends, and RFC 4180 quotes.
describe('TC-CI-EXP-02 CSV output', () => {
  it('TC-CI-EXP-02 starts with the UTF-8 BOM and a header row, with CRLF line ends', () => {
    const text = toCsv(['a', 'b'], [['1', '2']]);
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toBe('﻿a,b\r\n1,2\r\n');
  });

  it('TC-CI-EXP-02 quotes fields with a comma, a quote, or a line end', () => {
    const text = toCsv(['x'], [['a,b'], ['say "hi"'], ['line1\nline2'], ['plain']]);
    expect(text).toBe('﻿x\r\n"a,b"\r\n"say ""hi"""\r\n"line1\nline2"\r\nplain\r\n');
  });

  it('TC-CI-EXP-02 keeps non-ASCII letters and writes numbers and empty values', () => {
    const text = toCsv(['name', 'h', 'n'], [['Peña, Niño', 12.5, null]]);
    expect(text).toBe('﻿name,h,n\r\n"Peña, Niño",12.5,\r\n');
  });

  it('TC-CI-EXP-02 a text that starts with = + - or @ gets a leading quote mark (formula guard)', () => {
    const text = toCsv(['x'], [['=SUM(A1)'], ['+1'], ['-x'], ['@a'], [-3]]);
    expect(text).toBe("﻿x\r\n'=SUM(A1)\r\n'+1\r\n'-x\r\n'@a\r\n-3\r\n");
  });

  it('TC-CI-EXP-02 the DTR summary has the fixed columns and hours with two decimals', () => {
    const text = dtrSummaryCsv([
      {
        ojtName: 'Ana Cruz', companyName: 'Acme', facilitatorName: 'Fac One', batchName: 'B1',
        requiredHours: 486, loggedMinutes: 750, lateReports: 1, behind: true,
      },
    ]);
    const lines = text.slice(1).split('\r\n');
    expect(lines[0]).toBe('OJT,Company,Facilitator,Batch,Required hours,Logged hours,Late reports,Behind schedule');
    expect(lines[1]).toBe('Ana Cruz,Acme,Fac One,B1,486,12.50,1,Yes');
    expect(lines.length).toBe(3); // header, one row, empty text after the last CRLF
  });

  it('TC-CI-EXP-02 the report summary has the fixed columns, sorted as given', () => {
    const text = reportSummaryCsv([
      {
        ojtName: 'Ana Cruz', companyName: 'Acme', facilitatorName: 'Fac One',
        weekStart: '2026-10-12', status: 'approved', updatedAt: '2026-10-19T02:30:00Z',
      },
    ]);
    const lines = text.slice(1).split('\r\n');
    expect(lines[0]).toBe('OJT,Company,Facilitator,Week start,Status,Last change (Asia/Manila)');
    expect(lines[1]).toBe('Ana Cruz,Acme,Fac One,2026-10-12,approved,2026-10-19 10:30');
  });

  it('TC-CI-EXP-02 file name and type', () => {
    expect(CSV_MIME).toBe('text/csv;charset=utf-8');
    expect(csvFileName('dtr', 'Batch 2026/A')).toBe('ojt-dtr-dtr-summary-batch-2026-a.csv');
    expect(csvFileName('reports', 'B1')).toBe('ojt-dtr-report-summary-b1.csv');
  });
});
