import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { buildBackup, serializeBackup, type BackupFile } from '../db/backup';
import { db } from '../db/db';
import { META_LAST_BACKUP } from './backupMeta';
import { localDateKey } from './date';
import { isNativePlatform } from './platform';

export type BackupExportMethod = 'download' | 'share';

export interface BackupExportResult {
  filename: string;
  method: BackupExportMethod;
  recordedAt: number;
  entries: number;
}

export function backupFilename(now = new Date()): string {
  return `kainlog-backup-${localDateKey(now)}.json`;
}

/** Web only: blob + temporary anchor. */
function downloadInBrowser(backup: BackupFile, filename: string): void {
  const blob = new Blob([serializeBackup(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Native only: write to the app cache, then hand the file to the share sheet. */
async function shareOnDevice(backup: BackupFile, filename: string): Promise<void> {
  await Filesystem.writeFile({
    path: filename,
    data: serializeBackup(backup),
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });

  const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });

  try {
    await Share.share({
      title: 'KainLog backup',
      text: 'KainLog backup (JSON)',
      files: [uri],
      dialogTitle: 'Save KainLog backup',
    });
  } finally {
    // The receiving app has its own copy once the share resolves; drop the
    // cache file either way (cache cleanup is best-effort).
    try {
      await Filesystem.deleteFile({ path: filename, directory: Directory.Cache });
    } catch {
      // Ignore: a leftover cache file is harmless.
    }
  }
}

export async function exportBackupFile(
  backup: BackupFile,
  native = isNativePlatform(),
): Promise<{ filename: string; method: BackupExportMethod }> {
  const filename = backupFilename();

  if (native) {
    await shareOnDevice(backup, filename);
    return { filename, method: 'share' };
  }

  downloadInBrowser(backup, filename);
  return { filename, method: 'download' };
}

/**
 * Build, export, then record the date. The meta write happens only after the
 * download/share resolves, so a failed export never resets the backup nudge.
 */
export async function exportBackupAndRecord(
  native = isNativePlatform(),
): Promise<BackupExportResult> {
  const backup = await buildBackup();
  const { filename, method } = await exportBackupFile(backup, native);

  const recordedAt = Date.now();
  await db.meta.put({ key: META_LAST_BACKUP, value: recordedAt });

  return { filename, method, recordedAt, entries: backup.tables.logEntries.length };
}
