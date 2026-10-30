import { dateKeyToDate, localDateKey } from './date';

/** meta row holding the epoch-ms timestamp of the last successful export. */
export const META_LAST_BACKUP = 'lastBackupAt';

/** Days without an export before Profile starts nudging. */
export const BACKUP_NUDGE_DAYS = 14;

/** Whole local calendar days between a timestamp and "now". */
export function daysSince(timestamp: number, now = Date.now()): number {
  const then = dateKeyToDate(localDateKey(new Date(timestamp)));
  const today = dateKeyToDate(localDateKey(new Date(now)));
  return Math.round((today.getTime() - then.getTime()) / 86_400_000);
}

export function backupNudgeDue(lastBackupAt: number | null | undefined, now = Date.now()): boolean {
  if (lastBackupAt === null || lastBackupAt === undefined) return true;
  return daysSince(lastBackupAt, now) >= BACKUP_NUDGE_DAYS;
}

export function describeBackupAge(
  lastBackupAt: number | null | undefined,
  now = Date.now(),
): string {
  if (lastBackupAt === null || lastBackupAt === undefined) return 'No backup yet.';
  const days = daysSince(lastBackupAt, now);
  if (days <= 0) return 'Last backup: today';
  if (days === 1) return 'Last backup: yesterday';
  return `Last backup: ${days} days ago`;
}
