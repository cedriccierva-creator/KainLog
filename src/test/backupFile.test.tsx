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
  backupFilename,
  exportBackupAndRecord,
  exportBackupFile,
} from '../lib/backupFile';

const mocks = vi.hoisted(() => ({
  writeFile: vi.fn(),
  getUri: vi.fn(),
  share: vi.fn(),
}));

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: mocks.writeFile, getUri: mocks.getUri },
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
  });

  it('leaves lastBackupAt untouched when the web download throws', async () => {
    stubObjectUrl(() => {
      throw new Error('blob blocked');
    });

    await expect(exportBackupAndRecord(false)).rejects.toThrow('blob blocked');

    expect(await db.meta.get(META_LAST_BACKUP)).toBeUndefined();
  });
});
