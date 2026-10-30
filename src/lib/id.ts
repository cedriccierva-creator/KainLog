/**
 * RFC 4122 v4 id generator.
 *
 * `crypto.randomUUID()` only exists in secure contexts (HTTPS, localhost,
 * Capacitor's localhost scheme). Testing the app over plain HTTP on a LAN IP
 * would otherwise throw, so fall back to `crypto.getRandomValues()` and, on
 * very old WebViews without Web Crypto, to Math.random. Ids only need to be
 * unique — not unguessable — so the last fallback is acceptable.
 */
export function newId(): string {
  const cryptoApi: Crypto | undefined = globalThis.crypto;

  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof cryptoApi?.getRandomValues === 'function') {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
