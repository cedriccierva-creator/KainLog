import { describe, expect, it } from 'vitest';
import {
  BACKUP_NUDGE_DAYS,
  backupNudgeDue,
  daysSince,
  describeBackupAge,
} from '../lib/backupMeta';

const DAY = 86_400_000;
// Noon local time, so calendar-day math is stable in any test timezone.
const now = new Date(2026, 9, 31, 12, 0, 0).getTime();

describe('backup age', () => {
  it('counts whole local calendar days', () => {
    expect(daysSince(now, now)).toBe(0);
    expect(daysSince(now - DAY, now)).toBe(1);
    expect(daysSince(now - 15 * DAY, now)).toBe(15);
  });

  it('describes the last backup in words', () => {
    expect(describeBackupAge(null, now)).toBe('No backup yet.');
    expect(describeBackupAge(now, now)).toBe('Last backup: today');
    expect(describeBackupAge(now - DAY, now)).toBe('Last backup: yesterday');
    expect(describeBackupAge(now - 3 * DAY, now)).toBe('Last backup: 3 days ago');
  });

  it('nudges when there is no backup or the last one is 14+ days old', () => {
    expect(BACKUP_NUDGE_DAYS).toBe(14);
    expect(backupNudgeDue(null, now)).toBe(true);
    expect(backupNudgeDue(undefined, now)).toBe(true);
    expect(backupNudgeDue(now - 13 * DAY, now)).toBe(false);
    expect(backupNudgeDue(now - 14 * DAY, now)).toBe(true);
  });
});
