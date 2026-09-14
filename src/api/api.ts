import { ApiResponse, Order, Driver, LoginPayload, DashboardStats, SystemSettings } from '../types';
import { normalizeResponseKeys, toSnakeCaseLite } from '../utils/apiUtils';

/** Chatty GAS reads / location pings — coalesce in-flight + skip if a fresh OK is cached. Mutations are not limited. */
const CHATTY_ACTION_MIN_MS: Record<string, number> = {
  getOrders: 8000,
  getOrderStatus: 4000,
  getOrderDetails: 8000,
  getDashboardBundle: 10000,
  getMapData: 15000,
  getDriverPortalData: 15000,
  getOrdersDelta: 8000,
  updateDriverLocation: 10000,
  getSystemHealth: 15000,
  proxyBridgeStatus: 8000,
  getCustomerOrders: 10000,
};

const inflightGasCalls = new Map<string, Promise<ApiResponse<any>>>();
const lastGasOk = new Map<string, { at: number; result: ApiResponse<any> }>();

const gasCallKey = (action: string, payload: any) => {
  try {
    return `${action}:${JSON.stringify(payload ?? {})}`;
  } catch {
    return action;
  }
};

export const DEFAULT_WEBAPP_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_WEBAPP_URL) || '';

let cachedScriptsUrl: string | null = null;

const getApiUrl = (): string => {
  // 1. Check cached URL
  if (cachedScriptsUrl && cachedScriptsUrl.startsWith('https://')) return cachedScriptsUrl;

  // 2. Main localStorage key (Unified)
  const savedUrl = localStorage.getItem('taxi_app_script_url');
  if (savedUrl && savedUrl.startsWith('https://')) {
    cachedScriptsUrl = savedUrl;
    return savedUrl;
  }

  // 3. Migration: Check legacy localStorage v3/v2 and move to unified key
  const legacyV3 = localStorage.getItem('taxi_app_script_url_v3');
  if (legacyV3 && legacyV3.startsWith('https://')) {
    localStorage.setItem('taxi_app_script_url', legacyV3);
    localStorage.removeItem('taxi_app_script_url_v3');
    cachedScriptsUrl = legacyV3;
    return legacyV3;
  }

  // 4. Use build-time VITE_WEBAPP_URL
  if (DEFAULT_WEBAPP_URL && DEFAULT_WEBAPP_URL.startsWith('https://')) {
    cachedScriptsUrl = DEFAULT_WEBAPP_URL;
    return DEFAULT_WEBAPP_URL;
  }

  return '';
};

export const initializeApiUrl = async (settingsUrl?: string): Promise<string> => {
  if (settingsUrl && settingsUrl.startsWith('https://')) {
    cachedScriptsUrl = settingsUrl;
    localStorage.setItem('taxi_app_script_url', settingsUrl);
    return settingsUrl;
  }

  const fromStore = localStorage.getItem('taxi_app_script_url');
  if (fromStore && fromStore.startsWith('https://')) {
    cachedScriptsUrl = fromStore;
    return fromStore;
  }

  return getApiUrl();
};

/**
 * Sends a notification to the Telegram management bot
 * Used for critical system errors and infrastructure reports
 */
export const sendToTelegram = async (message: string, isError: boolean = true) => {
  try {
    const token = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
    const chatId = import.meta.env.VITE_TELEGRAM_CHAT_ID;
    
    if (!token || !chatId) return;

    // Use text/plain to avoid complicated escapes for simple error messages
    const prefix = isError ? '🚨 *שגיאת מערכת:* ' : 'ℹ️ *עדכון מערכת:* ';
    const fullMessage = `${prefix}\n${message}`;

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: fullMessage,
        parse_mode: 'Markdown'
      })
    });
  } catch (e) {
    console.warn('Failed to send telegram alert', e);
  }
};

/**
 * @deprecated Each app should provide its own token to sendToBackend
 */
const getAuthToken = (): string => {
  return localStorage.getItem('taxi_auth_token') || localStorage.getItem('taxi_driver_token') || '';
};

/**
 * @deprecated Use normalizeResponseKeys from utils/apiUtils instead.
 * Kept as a re-export for any external callers.
 */
export const toSnakeCase = toSnakeCaseLite;

/**
 * @deprecated Use normalizeResponseKeys from utils/apiUtils instead.
 * Kept as a re-export for any external callers.
 */
export const toCamelCase = normalizeResponseKeys;

export const compareIds = (id1: any, id2: any): boolean => {
  if (!id1 || !id2) return false;
  const clean = (id: any) => String(id).trim().replace(/^TAXI-/, '').toLowerCase();
  return clean(id1) === clean(id2);
};

export interface SendOptions {
  raw?: boolean;
  token?: string;
}

/**
 * Core communication utility with GAS backend
 * [FIX IMP-001] Auto-refreshes admin token on 401 Unauthorized responses
 */
let _isRefreshingToken = false; // Guard to prevent infinite refresh loops
const sendToBackendUnthrottled = async <T>(
  action: string,
  payload: any = {},
  options: SendOptions | boolean = false // support old 'raw' boolean for compat
): Promise<ApiResponse<T>> => {
  try {
    const isRaw = typeof options === 'boolean' ? options : !!options.raw;
    const providedToken = typeof options === 'object' ? options.token : null;

    // [SEC-005] Full reliance on Firebase Auth:
    // If no token is provided, attempt to get a fresh Firebase ID Token
    let token = providedToken || localStorage.getItem('taxi_auth_token') || '';
    
    // Only attempt Firebase token if not an admin (admin uses its own custom token)
    if (!providedToken && !token.startsWith('adm_')) {
      try {
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        if (auth.currentUser) {
          // Force refresh is false by default
          token = await auth.currentUser.getIdToken();
        }
      } catch (e) {
        // Fallback to legacy localStorage tokens if Firebase is not initialized yet
        token = token || localStorage.getItem('taxi_driver_token') || localStorage.getItem('taxi_passenger_token') || '';
      }
    }

    const url = getApiUrl();
    if (!url) return { ok: false, error: 'כתובת השרת לא הוגדרה.' };

    const response = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action,
        payload: toSnakeCaseLite(payload),
        authToken: token
      }),
      signal: AbortSignal.timeout(45000)
    });

    if (!response.ok) {
      const err = `שגיאת שרת (${response.status})`;
      if (response.status >= 500) sendToTelegram(`כשל שרת (HTTP ${response.status}) בפעולה: ${action}`);
      return { ok: false, error: err };
    }

    const text = await response.text();
    try {
      const data = JSON.parse(text);
      const result = isRaw ? data : normalizeResponseKeys(data);

      if (!result.ok && result.error && String(result.error).toLowerCase().includes('unauthorized') && !_isRefreshingToken) {
        const adminToken = localStorage.getItem('taxi_auth_token');
        if (adminToken) {
          _isRefreshingToken = true;
          try {
            const refreshRes = await sendToBackend<{ token: string }>('refreshAdminToken', {}, { token: adminToken });
            if (refreshRes.ok && refreshRes.data?.token) {
              localStorage.setItem('taxi_auth_token', refreshRes.data.token);
              _isRefreshingToken = false;
              return sendToBackend<T>(action, payload, options);
            }
          } catch (e) { }
          _isRefreshingToken = false;
        }
      }

      if (!result.ok && result.error && String(result.error).includes('Messaging gateway offline')) {
        sendToTelegram(`⚠️ וואטסאפ אופליין! פעולה: ${action}`);
        return { 
          ok: false, 
          error: '⚠️ שגיאת תקשורת: גשר הוואטסאפ המקומי לא זמין. וודא שה-Tunnel (ngrok) פעיל והכתובת מעודכנת בהגדרות.',
          error_code: 'GATEWAY_OFFLINE'
        };
      }

      return result;
    } catch (e) {
      if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
        sendToTelegram(`🔥 שרת גוגל עמוס/כשל (HTML Error Response)`);
        return { ok: false, error: 'השרת עמוס מדי כרגע, אנא נסה שוב בעוד מספר רגעים.' };
      }
      return { ok: false, error: 'תגובה לא תקינה מהשרת' };
    }
  } catch (error: any) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return { ok: false, error: 'הבקשה ארכה מדי. אנא בדוק את החיבור לאינטרנט.' };
    }
    const errMsg = error.message || 'אירעה שגיאה';
    if (!errMsg.includes('AbortError')) {
       sendToTelegram(`🔌 שגיאת תקשורת קריטית: ${errMsg}`);
    }
    return { ok: false, error: 'בעיה בתקשורת לשרת.' };
  }
};

export const sendToBackend = async <T>(
  action: string,
  payload: any = {},
  options: SendOptions | boolean = false
): Promise<ApiResponse<T>> => {
  const minMs = CHATTY_ACTION_MIN_MS[action];
  if (!minMs) return sendToBackendUnthrottled<T>(action, payload, options);

  const key = gasCallKey(action, payload);
  const existing = inflightGasCalls.get(key);
  if (existing) return existing as Promise<ApiResponse<T>>;

  const cached = lastGasOk.get(key);
  if (cached && Date.now() - cached.at < minMs) {
    return cached.result as ApiResponse<T>;
  }

  const pending = sendToBackendUnthrottled<T>(action, payload, options).then((result) => {
    if (result?.ok) lastGasOk.set(key, { at: Date.now(), result });
    return result;
  }).finally(() => {
    inflightGasCalls.delete(key);
  });

  inflightGasCalls.set(key, pending);
  return pending;
};

export const sendToBackendWithRetry = async <T>(action: string, payload: any = {}, maxRetries = 3, retryDelay = 1000): Promise<ApiResponse<T>> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await sendToBackend<T>(action, payload);
    if (result.ok || attempt === maxRetries || (result.error && (result.error.includes('Unauthorized') || result.error === 'NOT_REGISTERED' || result.error.includes('TAKEN')))) {
      return result;
    }
    await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
  }
  return { ok: false, error: 'כל הנסיונות לביצוע הפעולה נכשלו. אנא פנה לתמיכה.' };
};

/* ===============================
   Admin & Core Infrastructure
================================ */

// Core search address utility remains in api.ts as it might be used across components
export const searchAddress = (q: string, lat?: number, lon?: number) =>
  sendToBackend<{ display_name: string, lat: string, lon: string }[]>('searchAddress', { q, lat, lon });

export const getBridgeStatus = async (bridgeUrl: string, apiKey: string) => {
  if (!bridgeUrl) return { ok: false, error: 'כתובת הגשר לא הוגדרה' };

  const cleanUrl = bridgeUrl.replace(/\/$/, '');

  if (apiKey === '[SECURELY_STORED_IN_PROPS]' || apiKey === '[HIDDEN]') {
    try {
      const res = await sendToBackend<any>('proxyBridgeStatus', { bridgeUrl: cleanUrl });
      return res;
    } catch (e: any) {
      return { ok: false, error: e.message || 'שגיאת תקשורת דרך שרת' };
    }
  }

  try {
    const response = await fetch(`${cleanUrl}/status`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      if (response.status === 401) return { ok: false, error: 'אין הרשאה: חסר מפתח API' };
      if (response.status === 403) return { ok: false, error: 'אין הרשאה: מפתח API שגוי' };
      return { ok: false, error: `שגיאת גשר: ${response.status}` };
    }

    const json: any = await response.json();
    if (json && typeof json === 'object') {
      if (json.ok === true && json.data) return json;
      if (json.success === true) return { ok: true, data: json };
    }
    return { ok: false, error: 'תשובת גשר לא תקינה' };
  } catch (error) {
    console.error("API Call Error:", error);
    return { ok: false, error: 'שגיאת תקשורת עם השרת' };
  }
};

/**
 * Fetches status for both Local and Render bridges simultaneously.
 */
export const getBothBridgeStatuses = async (localUrl: string, renderUrl: string, apiKey: string) => {
  const [localRes, renderRes] = await Promise.all([
    localUrl ? getBridgeStatus(localUrl, apiKey) : Promise.resolve({ ok: false, error: 'לא הוגדר URL מקומי' }),
    renderUrl ? getBridgeStatus(renderUrl, apiKey) : Promise.resolve({ ok: false, error: 'לא הוגדר URL לענן' })
  ]);

  return {
    local: localRes,
    render: renderRes
  };
};


/**
 * Fetch and apply Firebase Custom Token for the current session
 */
export const initializeFirebaseSession = async (token?: string) => {
  try {
    const sessionToken = token || localStorage.getItem('taxi_admin_token') || localStorage.getItem('taxi_driver_token') || localStorage.getItem('taxi_passenger_token');
    if (!sessionToken) return;

    const res = await sendToBackend<{ token: string }>('getFirebaseToken', {}, { token: sessionToken });
    if (res.ok && res.data?.token) {
      const { authenticateFirebase } = await import('../firebase-config');
      await authenticateFirebase(res.data.token);
    }
  } catch (e) {
    console.warn('Silent failure on Firebase session init', e);
  }
};

const LOCAL_GROUP_JID = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_WHATSAPP_GROUP_JID) || '';

/** Send WhatsApp via the local bridge so group/private messages work during local testing. */
export const notifyLocalWhatsApp = async (opts: {
  text: string;
  jid?: string;
  role?: 'dispatcher' | 'driver' | 'passenger';
}): Promise<{ ok: boolean; queued?: boolean; error?: string }> => {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const isLocalHost = host === 'localhost' || host === '127.0.0.1';
  if (!isLocalHost) return { ok: false, error: 'הגשר המקומי זמין רק ב-localhost' };

  const { discoverLocalBridgeUrl, getLocalBridgeKey } = await import('./localBridge');
  const jid = opts.jid || LOCAL_GROUP_JID;
  const key = getLocalBridgeKey();
  const bridgeUrl = await discoverLocalBridgeUrl();
  if (!jid || !key) return { ok: false, error: 'הגשר לא הוגדר' };
  if (!bridgeUrl) return { ok: false, error: 'הגשר המקומי לא רץ — הפעל START-ALL.bat' };
  try {
    const res = await fetch(`${bridgeUrl}/new-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({ jid, text: opts.text, role: opts.role || 'dispatcher' }),
      signal: AbortSignal.timeout(15000)
    });
    const json = await res.json().catch(() => ({}));
    const first = json.details && json.details[0];
    if (res.ok && json.success && first?.status === 'queued') return { ok: true, queued: true };
    if (res.ok && json.success && (!first || first.ok !== false)) return { ok: true };
    return { ok: false, error: first?.error || json.error || `HTTP ${res.status}` };
  } catch (e: any) {
    return { ok: false, error: e.message || 'הגשר המקומי לא מגיב' };
  }
};

export const formatNewRideGroupMessage = (order: {
  orderId: string;
  pickupAddress: string;
  destinationAddress: string;
  price: number | string;
  pickupDate?: string;
  pickupTime?: string;
  notes?: string;
}) => {
  const driverBase = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_DRIVER_SITE_URL) || 'http://localhost:5274/driver.html';
  const link = `${String(driverBase).replace(/\/$/, '')}#/accept-ride?orderId=${order.orderId}`;
  const time = [order.pickupDate, order.pickupTime].filter(Boolean).join(' ') || 'מיידי';
  return `🚖 *נסיעה חדשה זמינה! - ${order.orderId}*\n\n📍 *מאיפה:* ${order.pickupAddress}\n🏁 *לאן:* ${order.destinationAddress}\n\n💰 *מחיר:* ${order.price} ₪\n🕒 *זמן:* ${time}\n${order.notes ? `\n📝 *הערות:* ${order.notes}\n` : ''}\n👇 *לחץ כאן לקבלת הנסיעה והכתובת המלאה:*\n${link}`;
};

if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    // Delay slightly so auth states settle
    setTimeout(() => initializeFirebaseSession(), 1000);
  });
}
