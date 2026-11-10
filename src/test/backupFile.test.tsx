// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/db';
import { buildBackup } from '../db/backup';
import { seedDatabase } from '../db/seed';
import { createLogEntry } from '../lib/nutrition';
import { todayKey } from '../lib/date';
import { backupNudgeDue, META_LAST_BACKUP } from '../lib/backupMeta';
import {
  BACKUP_FILE_PREFIX,
  FOOD_TEMPLATE_FILE_PREFIX,
  backupFilename,
  exportBackupAndRecord,
  exportBackupFile,
  sweepStaleExports,
} from '../lib/backupFile';

const mocks = vi.hoisted(() => ({
  writeFile: vi.fn(),
  getUri: vi.fn(),
  share: vi.fn(),
  deleteFile: vi.fn(),
  readdir: vi.fn(),
}));

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: {
    writeFile: mocks.writeFile,
    getUri: mocks.getUri,
    deleteFile: mocks.deleteFile,
    readdir: mocks.readdir,
  },
  Directory: { Cache: 'CACHE', Documents: 'DOCUMENTS' },
  Encoding: { UTF8: 'utf8' },
}));

vi.mock('@capacitor/share', () => ({
  Share: { share: mocks.share },
}));

const filenamePattern = /^kainlog-backup-\d{4}-\d{2}-\d{2}\.json$/;

/** jsdom has no URL.createObjectURL, so tests install their own. */
function stubObjectUrl(impl: () => string = () => 'blob:kainlog') {
  const create = vi.fn(impl);
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  return create;
}

async function seedWithEntry(): Promise<void> {
  await db.delete();
  await db.open();
  await seedDatabase(db);

  const food = await db.foods.get('seed-pork-adobo');
  expect(food).toBeDefined();
  if (!food) return;

  await db.logEntries.add(createLogEntry(food, { date: todayKey(), meal: 'lunch', servings: 1 }));
}

beforeEach(async () => {
  mocks.writeFile.mockReset();
  mocks.getUri.mockReset();
  mocks.share.mockReset();
  mocks.deleteFile.mockReset();
  mocks.deleteFile.mockResolvedValue(undefined);
  mocks.readdir.mockReset();
  mocks.readdir.mockResolvedValue({ files: [] });
  mocks.writeFile.mockResolvedValue({ uri: 'file:///cache/file.json' });
  mocks.getUri.mockResolvedValue({ uri: 'file:///cache/kainlog-backup.json' });
  mocks.share.mockResolvedValue({ activityType: 'com.example.save' });
  await seedWithEntry();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('backup filename', () => {
  it('uses the local calendar day', () => {
    expect(backupFilename(new Date(2026, 9, 31, 23, 59))).toBe('kainlog-backup-2026-10-31.json');
  });
});

describe('native export', () => {
  it('writes the JSON to the cache and opens the share sheet', async () => {
    const backup = await buildBackup();
    const createObjectURL = stubObjectUrl();

    const result = await exportBackupFile(backup, true);

    expect(result.method).toBe('share');
    expect(result.filename).toMatch(filenamePattern);
    expect(createObjectURL).not.toHaveBeenCalled();

    expect(mocks.writeFile).toHaveBeenCalledTimes(1);
    const writeArgs = mocks.writeFile.mock.calls[0][0] as {
      path: string;
      data: string;
      directory: string;
      encoding: string;
    };
    expect(writeArgs.path).toMatch(filenamePattern);
    expect(writeArgs.directory).toBe('CACHE');
    expect(writeArgs.encoding).toBe('utf8');
    expect(JSON.parse(writeArgs.data).app).toBe('kainlog');

    expect(mocks.getUri).toHaveBeenCalledWith({
      path: result.filename,
      directory: 'CACHE',
    });
    expect(mocks.share).toHaveBeenCalledWith(
      expect.objectContaining({ files: ['file:///cache/kainlog-backup.json'] }),
    );

    // The share no longer deletes the file afterwards; cleanup happens before
    // the next export instead.
    expect(mocks.deleteFile).not.toHaveBeenCalled();
  });

  it('sweeps every prefix it owns and leaves unrelated files alone', async () => {
    mocks.readdir.mockResolvedValue({
      files: [
        { name: 'kainlog-backup-2026-01-01.json' },
        { name: 'kainlog-foods-template.json' },
        { name: 'kainlog-notes.json' },
        { name: 'photo.png' },
      ],
    });

    await sweepStaleExports([BACKUP_FILE_PREFIX, FOOD_TEMPLATE_FILE_PREFIX]);

    expect(mocks.deleteFile).toHaveBeenCalledTimes(2);
    expect(mocks.deleteFile).toHaveBeenCalledWith({
      path: 'kainlog-backup-2026-01-01.json',
      directory: 'CACHE',
    });
    expect(mocks.deleteFile).toHaveBeenCalledWith({
      path: 'kainlog-foods-template.json',
      directory: 'CACHE',
    });
    expect(mocks.deleteFile).not.toHaveBeenCalledWith(
      expect.objectContaining({ path: 'kainlog-notes.json' }),
    );
    expect(mocks.deleteFile).not.toHaveBeenCalledWith(
      expect.objectContaining({ path: 'photo.png' }),
    );
  });

  it('clears leftover backup files from the cache before writing a new one', async () => {
    mocks.readdir.mockResolvedValue({
      files: [
        { name: 'kainlog-backup-2026-01-01.json' },
        { name: 'kainlog-backup-2026-01-02.json' },
        { name: 'notes.txt' },
      ],
    });

    const backup = await buildBackup();
    const result = await exportBackupFile(backup, true);

    expect(result.method).toBe('share');
    expect(mocks.readdir).toHaveBeenCalledWith({ path: '', directory: 'CACHE' });
    expect(mocks.deleteFile).toHaveBeenCalledTimes(2);
    expect(mocks.deleteFile).toHaveBeenCalledWith({
      path: 'kainlog-backup-2026-01-01.json',
      directory: 'CACHE',
    });
    expect(mocks.deleteFile).toHaveBeenCalledWith({
      path: 'kainlog-backup-2026-01-02.json',
      directory: 'CACHE',
    });
    // Unrelated cache entries are left alone.
    expect(mocks.deleteFile).not.toHaveBeenCalledWith(
      expect.objectContaining({ path: 'notes.txt' }),
    );

    // Every delete happens before the new file is written.
    const lastDelete = Math.max(...mocks.deleteFile.mock.invocationCallOrder);
    expect(lastDelete).toBeLessThan(mocks.writeFile.mock.invocationCallOrder[0]);
  });

  it('still exports when the cache cannot be listed', async () => {
    mocks.readdir.mockRejectedValue(new Error('no cache dir'));

    const backup = await buildBackup();
    const result = await exportBackupFile(backup, true);

    expect(result.method).toBe('share');
    expect(mocks.writeFile).toHaveBeenCalledTimes(1);
    expect(mocks.share).toHaveBeenCalledTimes(1);
  });

  it('still exports when deleting a stale file fails', async () => {
    mocks.readdir.mockResolvedValue({ files: [{ name: 'kainlog-backup-old.json' }] });
    mocks.deleteFile.mockRejectedValue(new Error('permission denied'));

    const backup = await buildBackup();
    const result = await exportBackupFile(backup, true);

    expect(result.method).toBe('share');
    expect(mocks.writeFile).toHaveBeenCalledTimes(1);
    expect(mocks.share).toHaveBeenCalledTimes(1);
  });

  it('defaults to the web download when Capacitor reports a browser', async () => {
    const backup = await buildBackup();
    stubObjectUrl();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const result = await exportBackupFile(backup); // no explicit platform flag

    expect(result.method).toBe('download');
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });

  it('does not call the native plugins on web', async () => {
    const backup = await buildBackup();
    stubObjectUrl();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const result = await exportBackupFile(backup, false);

    expect(result.method).toBe('download');
    expect(mocks.writeFile).not.toHaveBeenCalled();
    expect(mocks.share).not.toHaveBeenCalled();
  });
});

describe('recording the export', () => {
  it('sets lastBackupAt only after a successful native share', async () => {
    const result = await exportBackupAndRecord(true);
    expect(result.method).toBe('share');
    expect(result.entries).toBe(1);
    expect((await db.meta.get(META_LAST_BACKUP))?.value).toBe(result.recordedAt);
  });

  it('leaves lastBackupAt (and the nudge) untouched when the write fails', async () => {
    mocks.writeFile.mockRejectedValue(new Error('disk full'));

    await expect(exportBackupAndRecord(true)).rejects.toThrow('disk full');

    const stored = await db.meta.get(META_LAST_BACKUP);
    expect(stored).toBeUndefined();
    const recorded = typeof stored?.value === 'number' ? stored.value : null;
    expect(backupNudgeDue(recorded)).toBe(true);
    expect(mocks.share).not.toHaveBeenCalled();
  });

  it('leaves lastBackupAt untouched when the share sheet is cancelled or fails', async () => {
    mocks.share.mockRejectedValue(new Error('share cancelled'));

    await expect(exportBackupAndRecord(true)).rejects.toThrow('share cancelled');

    expect(await db.meta.get(META_LAST_BACKUP)).toBeUndefined();
    expect(backupNudgeDue(null)).toBe(true);
    // The stale-file sweep ran before the write, but the share failure is not
    // recorded as a backup.
    expect(mocks.readdir).toHaveBeenCalledTimes(1);
    expect(mocks.deleteFile).not.toHaveBeenCalled();
  });

  it('leaves lastBackupAt untouched when the web download throws', async () => {
    stubObjectUrl(() => {
      throw new Error('blob blocked');
    });

    await expect(exportBackupAndRecord(false)).rejects.toThrow('blob blocked');

    expect(await db.meta.get(META_LAST_BACKUP)).toBeUndefined();
  });
});
