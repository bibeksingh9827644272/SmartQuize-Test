import type { Exam } from '../types';

export type ExamAvailability = 'scheduled' | 'open' | 'closed';

function timeOf(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function examAvailability(
  exam: Pick<Exam, 'opensAt' | 'closesAt'>,
  now = Date.now(),
): ExamAvailability {
  const opensAt = timeOf(exam.opensAt);
  const closesAt = timeOf(exam.closesAt);
  if (opensAt !== null && now < opensAt) return 'scheduled';
  if (closesAt !== null && now >= closesAt) return 'closed';
  return 'open';
}

export function scheduleIssue(opensAt: string | null, closesAt: string | null): string | null {
  const opens = timeOf(opensAt);
  const closes = timeOf(closesAt);
  if (opensAt && opens === null) return 'Choose a valid opening date and time.';
  if (closesAt && closes === null) return 'Choose a valid closing date and time.';
  if (opens !== null && closes !== null && closes <= opens) {
    return 'The close time must be after the open time.';
  }
  return null;
}

export function formatScheduleMoment(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function scheduleSummary(exam: Pick<Exam, 'opensAt' | 'closesAt'>): string {
  const parts: string[] = [];
  if (exam.opensAt) parts.push(`Opens ${formatScheduleMoment(exam.opensAt)}`);
  if (exam.closesAt) parts.push(`Closes ${formatScheduleMoment(exam.closesAt)}`);
  return parts.length > 0 ? parts.join(' · ') : 'Open until you close it';
}

export function isoToLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function localInputToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
