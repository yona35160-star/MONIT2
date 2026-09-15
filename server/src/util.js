/** Shared helpers — GAS-compatible field access, phones, IDs. */

export const nowIso = () => new Date().toISOString();

export const ok = (data, extra = {}) => ({ ok: true, data, ...extra });
export const fail = (error, extra = {}) => ({ ok: false, error, ...extra });

export const get = (obj, ...keys) => {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return undefined;
};

export const parsePrice = (v) => {
  const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export const normalizePhone = (raw) => {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('972')) d = '0' + d.slice(3);
  if (d.length === 9 && d.startsWith('5')) d = '0' + d;
  return d;
};

export const compareIds = (id1, id2) => {
  if (!id1 || !id2) return false;
  const clean = (id) => String(id).trim().replace(/^TAXI-/, '').toLowerCase();
  return clean(id1) === clean(id2);
};

const toCamel = (key) => String(key).replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const toSnake = (key) => String(key).replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);

/** Add both camelCase and snake_case aliases so GAS-style payloads work either way. */
export const flattenPayload = (payload = {}) => {
  const out = { ...payload };
  for (const [k, v] of Object.entries(payload)) {
    const camel = toCamel(k);
    const snake = toSnake(k);
    if (!(camel in out)) out[camel] = v;
    if (!(snake in out)) out[snake] = v;
  }
  return out;
};

export const stripDoc = (doc) => {
  if (!doc) return null;
  const { _id, sessionSecret, session_secret, passwordHash, ...rest } = doc;
  return rest;
};

export const haversineKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const activeOrderStatuses = new Set([
  'pending',
  'broadcasted',
  'assigned',
  'waiting_approval',
  'paid',
  'in_progress',
  'confirmed',
  'on_route',
  'arrived',
]);

export const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
