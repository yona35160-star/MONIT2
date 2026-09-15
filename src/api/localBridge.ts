const ENV_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_WHATSAPP_BRIDGE_URL) || '';

const CANDIDATES = [
  ENV_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3012',
  'http://127.0.0.1:3012',
]
  .map((u) => String(u || '').replace(/\/$/, ''))
  .filter((u, i, arr) => u.startsWith('http') && arr.indexOf(u) === i);

let cachedUrl: string | null = null;
let cachedAt = 0;
const CACHE_MS = 15_000;

export const getLocalBridgeKey = (): string =>
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_BRIDGE_API_KEY) || '';

export const discoverLocalBridgeUrl = async (): Promise<string | null> => {
  if (cachedUrl && Date.now() - cachedAt < CACHE_MS) return cachedUrl;

  for (const url of CANDIDATES) {
    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        cachedUrl = url;
        cachedAt = Date.now();
        return url;
      }
    } catch {
      /* try next */
    }
  }
  return null;
};
