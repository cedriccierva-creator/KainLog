import { describe, expect, it } from 'vitest';
import { shouldRegisterServiceWorker } from '../lib/platform';

describe('service worker registration guard', () => {
  it('registers only in a production web build', () => {
    expect(shouldRegisterServiceWorker(true, false)).toBe(true);
    expect(shouldRegisterServiceWorker(true, true)).toBe(false);
    expect(shouldRegisterServiceWorker(false, false)).toBe(false);
    expect(shouldRegisterServiceWorker(false, true)).toBe(false);
  });
});
