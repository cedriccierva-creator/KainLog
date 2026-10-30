/**
 * Persistent-storage helpers.
 *
 * `navigator.storage.persist()` is secure-context only. On plain HTTP the API
 * is absent or always refuses, so every function degrades to a status the UI
 * can explain instead of throwing.
 */

export type PersistenceState = 'persisted' | 'not-persisted' | 'unsupported';

export interface StorageEstimate {
  usage: number;
  quota: number;
}

function storageManager(): StorageManager | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return navigator.storage;
}

export async function getPersistenceState(): Promise<PersistenceState> {
  const storage = storageManager();
  if (!storage || typeof storage.persisted !== 'function') return 'unsupported';
  try {
    return (await storage.persisted()) ? 'persisted' : 'not-persisted';
  } catch {
    return 'not-persisted';
  }
}

export async function requestPersistentStorage(): Promise<PersistenceState> {
  const storage = storageManager();
  if (!storage || typeof storage.persist !== 'function') return 'unsupported';
  try {
    await storage.persist();
  } catch {
    // Denied or unavailable; the state below tells the user what happened.
  }
  return getPersistenceState();
}

export async function getStorageEstimate(): Promise<StorageEstimate | null> {
  const storage = storageManager();
  if (!storage || typeof storage.estimate !== 'function') return null;
  try {
    const estimate = await storage.estimate();
    return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
  } catch {
    return null;
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  const rounded = value >= 10 || exponent === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[exponent]}`;
}
