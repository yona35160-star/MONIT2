import crypto from 'node:crypto';

const secret = () => process.env.JWT_SECRET || 'local-dev-only-change-me';

const hmac = (payload) =>
  crypto.createHmac('sha256', secret()).update(payload).digest('base64url').slice(0, 32);

export const issueAdminToken = (ttlSec = 3600 * 12) => {
  const exp = Date.now() + ttlSec * 1000;
  const body = Buffer.from(JSON.stringify({ t: 'admin', exp })).toString('base64url');
  return `adm_${body}_${hmac(body)}`;
};

export const verifyAdminToken = (token) => {
  if (!token || !String(token).startsWith('adm_')) return false;
  const parts = String(token).split('_');
  if (parts.length < 3) return false;
  const body = parts.slice(1, -1).join('_');
  const sig = parts[parts.length - 1];
  if (hmac(body) !== sig) return false;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return parsed.t === 'admin' && parsed.exp > Date.now();
  } catch {
    return false;
  }
};

export const randomSecret = (bytes = 16) => crypto.randomBytes(bytes).toString('hex');

export const issueDriverToken = (driverId, sessionSecret) => `drv_${driverId}_${sessionSecret}`;
export const issuePassengerToken = (phone, sessionSecret) => `pas_${phone}_${sessionSecret}`;

export const parseDriverToken = (token) => {
  if (!token || !String(token).startsWith('drv_')) return null;
  const parts = String(token).split('_');
  if (parts.length < 3) return null;
  return { driverId: parts[1], secret: parts.slice(2).join('_') };
};

export const parsePassengerToken = (token) => {
  if (!token || !String(token).startsWith('pas_')) return null;
  const parts = String(token).split('_');
  if (parts.length < 3) return null;
  return { phone: parts[1], secret: parts.slice(2).join('_') };
};
