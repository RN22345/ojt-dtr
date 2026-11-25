// Layer 0: PDF files of the DTR and the weekly report (FR-EXP-01, FR-EXP-02, QR-CO-03).
// These functions are pure. They do not use Angular, the network, or storage.
import { jsPDF } from 'jspdf';
import { timeOfDay } from './format';
import { WorkSession } from './hours';

/** One row of the DTR PDF for one calendar day. */
export interface DtrPdfDay {
  /** The calendar date (YYYY-MM-DD). */
  date: string;
  /** The earliest time-in of the day (HH:mm, Asia/Manila), or null. */
  firstIn: string | null;
  /** The latest time-out of the day (HH:mm, Asia/Manila), or null if no work session is closed. */
  lastOut: string | null;
  /** The sum of the minutes of the work sessions of the day. */
  minutes: number;
}

export interface DtrPdfInput {
  fullName: string;
  companyName: string;
  /** The first date of the range (YYYY-MM-DD). */
  from: string;
  /** The last date of the range (YYYY-MM-DD). */
  to: string;
  days: DtrPdfDay[];
}

export interface ReportPdfInput {
  fullName: string;
  companyName: string;
  /** The Monday of the week (YYYY-MM-DD). */
  weekStart: string;
  minutes: number;
  status: string;
  tasksDone: string;
  skillsLearned: string;
  problems: string;
  plansNextWeek: string;
}

const PAGE_HEIGHT = 297;
const MARGIN = 18;
const TOP = 20;
const ROW_HEIGHT = 8;
const LINE_HEIGHT = 6;
const TEXT_WIDTH = 210 - 2 * MARGIN;
/** The left position of the columns: Date, Time in, Time out, Hours. */
const COLUMNS = [18, 75, 115, 170] as const;

const DATE_TEXT = /^\d{4}-\d{2}-\d{2}$/;

/** The ISO text of a punch time. */
function isoOf(time: string | Date): string {
  return typeof time === 'string' ? time : time.toISOString();
}

/** The next calendar date (YYYY-MM-DD). */
function nextDate(date: string): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

/** One DTR row from the work sessions of the day. */
function dayRow(date: string, sessions: readonly WorkSession[]): DtrPdfDay {
  let firstIn: number | null = null;
  let lastOut: number | null = null;
  let minutes = 0;
  for (const session of sessions) {
    minutes += session.minutes;
    const inMs = Date.parse(isoOf(session.timeIn.time));
    firstIn = firstIn === null || inMs < firstIn ? inMs : firstIn;
    if (session.timeOut) {
      const outMs = Date.parse(isoOf(session.timeOut.time));
      lastOut = lastOut === null || outMs > lastOut ? outMs : lastOut;
    }
  }
  return {
    date,
    firstIn: firstIn === null ? null : timeOfDay(new Date(firstIn).toISOString()),
    lastOut: lastOut === null ? null : timeOfDay(new Date(lastOut).toISOString()),
    minutes,
  };
}

/** One row for each calendar day from `from` to `to` (both included, YYYY-MM-DD). Empty when from > to. */
export function dtrPdfDays(sessions: readonly WorkSession[], from: string, to: string): DtrPdfDay[] {
  if (!DATE_TEXT.test(from) || !DATE_TEXT.test(to) || from > to) {
    return [];
  }
  const byDate = new Map<string, WorkSession[]>();
  for (const session of sessions) {
    const list = byDate.get(session.date);
    if (list) {
      list.push(session);
    } else {
      byDate.set(session.date, [session]);
    }
  }
  const days: DtrPdfDay[] = [];
  for (let date = from; date <= to; date = nextDate(date)) {
    days.push(dayRow(date, byDate.get(date) ?? []));
  }
  return days;
}

/** Hours as text with two decimals. */
function hoursText(minutes: number): string {
  return (minutes / 60).toFixed(2);
}

function newDoc(): jsPDF {
  return new jsPDF({ unit: 'mm', format: 'a4', compress: false });
}

function bytesOf(doc: jsPDF): Uint8Array {
  return new Uint8Array(doc.output('arraybuffer'));
}

/** Adds a page when the next text does not fit. Gives the new top position. */
function addPageIfNeeded(doc: jsPDF, y: number, height: number): number {
  if (y + height > PAGE_HEIGHT - MARGIN) {
    doc.addPage();
    return TOP;
  }
  return y;
}

/** Writes the column header of the DTR table and gives the position of the first row. */
function dtrColumnHeader(doc: jsPDF, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Date', COLUMNS[0], y);
  doc.text('Time in', COLUMNS[1], y);
  doc.text('Time out', COLUMNS[2], y);
  doc.text('Hours', COLUMNS[3], y);
  return y + ROW_HEIGHT;
}

/** Writes one row of the DTR table. An empty cell has a dash. */
function dtrRow(doc: jsPDF, y: number, day: DtrPdfDay): void {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(day.date, COLUMNS[0], y);
  doc.text(day.firstIn ?? '-', COLUMNS[1], y);
  doc.text(day.lastOut ?? '-', COLUMNS[2], y);
  doc.text(hoursText(day.minutes), COLUMNS[3], y);
}

/** Writes the DTR table. It repeats the column header on each new page. Gives the next position. */
function dtrTable(doc: jsPDF, startY: number, days: readonly DtrPdfDay[]): number {
  let y = dtrColumnHeader(doc, startY);
  for (const day of days) {
    if (y + ROW_HEIGHT > PAGE_HEIGHT - MARGIN) {
      doc.addPage();
      y = dtrColumnHeader(doc, TOP);
    }
    dtrRow(doc, y, day);
    y += ROW_HEIGHT;
  }
  return y;
}

export function buildDtrPdf(input: DtrPdfInput): Uint8Array {
  const doc = newDoc();
  let y = TOP;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Daily Time Record', MARGIN, y);
  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  for (const line of [input.fullName, input.companyName, `${input.from} to ${input.to}`]) {
    doc.text(line, MARGIN, y);
    y += LINE_HEIGHT;
  }
  y = dtrTable(doc, y + 4, input.days);

  const total = input.days.reduce((sum, day) => sum + day.minutes, 0);
  const daysWithHours = input.days.filter((day) => day.minutes > 0).length;
  y = addPageIfNeeded(doc, y + 4, 2 * LINE_HEIGHT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Total hours: ${hoursText(total)}`, MARGIN, y);
  doc.text(`Days with hours: ${daysWithHours}`, MARGIN, y + LINE_HEIGHT);
  return bytesOf(doc);
}

/** Writes one report section. An empty body gives the text `None`. Gives the next position. */
function reportSection(doc: jsPDF, startY: number, heading: string, body: string, width: number): number {
  let y = addPageIfNeeded(doc, startY, 2 * LINE_HEIGHT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(heading, MARGIN, y);
  y += LINE_HEIGHT + 1;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const lines: string[] = doc.splitTextToSize(body.trim() || 'None', width);
  for (const line of lines) {
    y = addPageIfNeeded(doc, y, LINE_HEIGHT);
    doc.text(line, MARGIN, y);
    y += LINE_HEIGHT;
  }
  return y + 3;
}

export function buildReportPdf(input: ReportPdfInput): Uint8Array {
  const doc = newDoc();
  let y = TOP;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Weekly Report', MARGIN, y);
  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const head = [
    input.fullName,
    input.companyName,
    `Week of ${input.weekStart}`,
    `Hours: ${hoursText(input.minutes)}`,
    `Status: ${input.status}`,
  ];
  for (const line of head) {
    doc.text(line, MARGIN, y);
    y += LINE_HEIGHT;
  }
  const sections: [string, string][] = [
    ['Tasks done', input.tasksDone],
    ['Skills learned', input.skillsLearned],
    ['Problems', input.problems],
    ['Plans for next week', input.plansNextWeek],
  ];
  y += 4;
  for (const [heading, body] of sections) {
    y = reportSection(doc, y, heading, body, TEXT_WIDTH);
  }
  return bytesOf(doc);
}

export function pdfFileName(kind: 'dtr' | 'report', first: string, second?: string): string {
  return kind === 'dtr' ? `ojt-dtr-dtr-${first}-to-${second ?? ''}.pdf` : `ojt-dtr-report-${first}.pdf`;
}
