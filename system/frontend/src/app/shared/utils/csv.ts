// Layer 0: CSV text for the admin exports (FR-EXP-03, QR-CO-03). These functions are pure.
// The text opens in Excel and Google Sheets: a UTF-8 BOM, a header row, CRLF line ends, RFC 4180 quotes.
import { PROJECT_TIME_ZONE } from './hours';

export const CSV_MIME = 'text/csv;charset=utf-8';

export type CsvValue = string | number | null | undefined;

const BOM = '\uFEFF';
const LINE_END = '\r\n';
/** A text that starts with one of these characters can run as a formula in a spreadsheet. */
const FORMULA_START = /^[=+\-@]/;
const NEEDS_QUOTE = /[",\r\n]/;

/** One field of the CSV text. A text gets a quote mark if a spreadsheet can run it as a formula. */
function field(value: CsvValue): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return NEEDS_QUOTE.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** UTF-8 BOM + header row + rows. CRLF after each row. RFC 4180 quotes. */
export function toCsv(header: readonly string[], rows: readonly (readonly CsvValue[])[]): string {
  return BOM + [header, ...rows].map((row) => row.map(field).join(',') + LINE_END).join('');
}

/** One row of the DTR summary CSV. */
export interface DtrCsvRow {
  ojtName: string;
  companyName: string;
  facilitatorName: string;
  batchName: string;
  requiredHours: number;
  loggedMinutes: number;
  lateReports: number;
  behind: boolean;
}

/** One row of the report summary CSV. */
export interface ReportCsvRow {
  ojtName: string;
  companyName: string;
  facilitatorName: string;
  weekStart: string;
  status: string;
  updatedAt: string;
}

// The date and the time as parts, so the text has the same shape on each browser.
const stampFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: PROJECT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** "YYYY-MM-DD HH:mm" in the project time zone (24 h) for an ISO time. */
function stamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const part: Record<string, string> = {};
  for (const item of stampFormat.formatToParts(date)) {
    part[item.type] = item.value;
  }
  return `${part['year']}-${part['month']}-${part['day']} ${part['hour']}:${part['minute']}`;
}

/** DTR summary of a batch: the fixed columns of FR-EXP-03. */
export function dtrSummaryCsv(rows: readonly DtrCsvRow[]): string {
  return toCsv(
    ['OJT', 'Company', 'Facilitator', 'Batch', 'Required hours', 'Logged hours', 'Late reports', 'Behind schedule'],
    rows.map((r) => [
      r.ojtName,
      r.companyName,
      r.facilitatorName,
      r.batchName,
      r.requiredHours,
      (r.loggedMinutes / 60).toFixed(2),
      r.lateReports,
      r.behind ? 'Yes' : 'No',
    ]),
  );
}

/** Report summary of a batch: the fixed columns of FR-EXP-03. */
export function reportSummaryCsv(rows: readonly ReportCsvRow[]): string {
  return toCsv(
    ['OJT', 'Company', 'Facilitator', 'Week start', 'Status', 'Last change (Asia/Manila)'],
    rows.map((r) => [r.ojtName, r.companyName, r.facilitatorName, r.weekStart, r.status, stamp(r.updatedAt)]),
  );
}

/** The file name of an export. The batch name becomes a slug: lower case, `-` between the parts. */
export function csvFileName(kind: 'dtr' | 'reports', batchName: string): string {
  const slug = batchName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `ojt-dtr-${kind === 'dtr' ? 'dtr' : 'report'}-summary-${slug}.csv`;
}
