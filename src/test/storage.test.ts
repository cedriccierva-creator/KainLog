import { describe, expect, it } from 'vitest';
import { formatBytes, getPersistenceState, getStorageEstimate, requestPersistentStorage } from '../lib/storage';

describe('persistent storage without a browser StorageManager', () => {
  it('reports unsupported instead of throwing', async () => {
    expect(await getPersistenceState()).toBe('unsupported');
    expect(await requestPersistentStorage()).toBe('unsupported');
    expect(await getStorageEstimate()).toBeNull();
  });
});

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1536, '1.5 KB'],
    [5 * 1024 * 1024, '5 MB'],
    [2.5 * 1024 * 1024 * 1024, '2.5 GB'],
  ])('%s → %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});
