const path = require('path');
const fs = require('fs');
// Always load bridge/.env (works when launched from repo root via npm run bridge)
require('dotenv').config({ path: path.join(__dirname, '.env') });
// Root .env may expose VITE_BRIDGE_API_KEY as a fallback during local setup
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const {
    makeWASocket,
    DisconnectReason,
    fetchLatestBaileysVersion,
    Browsers
} = require('@whiskeysockets/baileys');
const { MongoClient } = require('mongodb');
const { useMongoDBAuthState } = require('./mongo-auth-state');

const express = require('express');
const cors = require('cors');
const qrcodeTerminal = require('qrcode-terminal');
const qrcode = require('qrcode');
const rateLimit = require('express-rate-limit');
const PINO = require('pino');

// ==============================================
// CONFIGURATION
// ==============================================

const PLACEHOLDER_KEY = /^(replace_with_strong_random_key_here)?$/i;
let BRIDGE_API_KEY = (process.env.BRIDGE_API_KEY || process.env.VITE_BRIDGE_API_KEY || '').trim();
if (!BRIDGE_API_KEY || PLACEHOLDER_KEY.test(BRIDGE_API_KEY)) {
    console.error('\n❌ FATAL: BRIDGE_API_KEY missing or still a placeholder.');
    console.error('   Fix: run SETUP-BRIDGE.bat (auto-generates a key), or set BRIDGE_API_KEY in bridge/.env');
    console.error('   Then set the SAME value as VITE_BRIDGE_API_KEY in the root .env\n');
    process.exit(1);
}
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || '';
if (!MONGO_URI) {
    console.warn('\n⚠️ WARNING: MONGO_URI not provided. Using local filesystem for sessions.\n');
}


// SESSION_DIR: על Render זה /data/sessions (persistent disk)
// מקומית: ./sessions
const SESSION_DIR = process.env.SESSION_DIR
    ? path.resolve(process.env.SESSION_DIR)
    : path.join(__dirname, 'sessions');

// ודא שהתיקייה קיימת
if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
    console.log(`📁 Created session directory: ${SESSION_DIR}`);
}

console.log(`📁 Sessions will be stored in: ${SESSION_DIR}`);

const CONFIG = {
    PORT: process.env.PORT || 3000,
    BRIDGE_API_KEY: BRIDGE_API_KEY,
    MONGO_URI: MONGO_URI,
    GAS_SCRIPT_URL: process.env.GAS_SCRIPT_URL || '',
    RENDER_URL: process.env.RENDER_URL || '', // URL used for self-pings
    CORS_ORIGINS: process.env.CORS_ORIGINS 
        ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
        : [
            'http://localhost:5273',
            'http://localhost:5274',
            'http://localhost:5275',
            'http://localhost:3000',
            'http://127.0.0.1:5273',
            'http://127.0.0.1:5274',
            'http://127.0.0.1:5275'
        ],
    MAX_TEXT_LENGTH: 4096,
    RETRY: { ATTEMPTS: 3, BASE_DELAY: 1500 },
    CONCURRENCY_LIMIT: 3
};

// ----------------------------------------------
// TELEGRAM ALERT UTILITY
// ----------------------------------------------
async function sendTelegramAlert(message) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;

    try {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: `🚨 *Taxi Bridge Error Report*\n\n${message}`,
                parse_mode: 'Markdown'
            })
        });
    } catch (e) {
        console.error('Failed to send Telegram alert:', e.message);
    }
}

// Global Error Catchers for server crashes
process.on('uncaughtException', (err) => {
    const errMsg = err && err.message ? err.message : String(err);
    console.error('Fatal Error:', err);
    sendTelegramAlert(`🔥 *CRASH DETECTED*\n\nUncaught Exception:\n\`${errMsg}\``);
});

process.on('unhandledRejection', (reason, promise) => {
    const reasonMsg = reason && reason.message ? reason.message : String(reason);
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    sendTelegramAlert(`⚠️ *Unhandled Rejection*\n\nReason:\n\`${reasonMsg}\``);
});

// Utility to mask phone numbers in logs
function maskJid(jid) {
    if (!jid || typeof jid !== 'string') return jid;
    return jid.replace(/^(\d{5})\d+(\d{2}@)/, '$1***$2');
}


const ROLES = {
    DISPATCHER: 'dispatcher',
    DRIVER: 'driver',
    PASSENGER: 'passenger'
};

const sessions = {};
const sessionStates = {};
// הגדלת מכסת המאזינים למניעת אזהרות ב-Render
process.setMaxListeners(0); 
const logger = PINO({ level: 'error' }); // צמצום לוגים של Baileys לשגיאות בלבד

let mongoClient = null;
async function getMongoDb() {
    if (!CONFIG.MONGO_URI) return null;
    if (!mongoClient) {
        mongoClient = new MongoClient(CONFIG.MONGO_URI);
        await mongoClient.connect();
        console.log('✅ Connected to MongoDB Atlas');
    }
    return mongoClient.db();
}


// ==============================================
// SESSION PATH HELPER
// ==============================================

/**
 * מחזיר את נתיב תיקיית ה-auth עבור כל role.
 * על Render → /data/sessions/auth_dispatcher (persistent)
 * מקומית → ./sessions/auth_dispatcher
 */
function getAuthDir(role) {
    return path.join(SESSION_DIR, `auth_${role}`);
}

// ==============================================
// WHATSAPP SESSION INIT
// ==============================================

async function initializeSession(role) {
    const authDir = getAuthDir(role);

    // הצג מה קורה עם ה-session
    const sessionExists = fs.existsSync(authDir) && fs.readdirSync(authDir).length > 0;
    console.log(`[${role}] Auth dir: ${authDir} | Existing session: ${sessionExists ? '✅ YES' : '❌ NO (will need QR)'}`);

    sessionStates[role] = {
        connected: false,
        qr: null,
        qrDataUrl: null,
        pairingCode: null,
        queue: [],
        isProcessing: false
    };

    let state, saveCreds;

    if (CONFIG.MONGO_URI) {
        try {
            const db = await getMongoDb();
            const collection = db.collection(`auth_${role}`);
            const mongoAuth = await useMongoDBAuthState(collection);
            state = mongoAuth.state;
            saveCreds = mongoAuth.saveCreds;
        } catch (err) {
            console.error(`[${role}] ❌ Failed to init MongoDB auth:`, err.message);
            console.warn(`[${role}] ⚠️ Falling back to local filesystem sessions.`);
        }
    }
    if (!state) {
        const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
        const { state: fileState, saveCreds: fileSaveCreds } = await useMultiFileAuthState(authDir);
        state = fileState;
        saveCreds = fileSaveCreds;
    }

    const { version, isLatest } = await fetchLatestBaileysVersion();

    console.log(`[${role}] Starting Baileys v${version.join('.')} (isLatest: ${isLatest})`);


    const sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: state,
        browser: Browsers.ubuntu('Chrome'),
        syncFullHistory: false,
        // חשוב: הגדלת timeouts למניעת שגיאות 'init queries' בסביבות איטיות (Render)
        connectTimeoutMs: 60_000,
        defaultQueryTimeoutMs: 60_000,
        keepAliveIntervalMs: 25_000,
        generateHighQualityLinkPreview: false // חוסך משאבים
    });

    sock.ev.on('creds.update', saveCreds);

    // ============================================
    // INCOMING MESSAGES → Forward to GAS
    // ============================================
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            if (!msg.message || msg.key.fromMe) continue;

            const remoteJid = msg.key.remoteJid;
            const pushName = msg.pushName || 'Unknown';
            const timestamp = msg.messageTimestamp;

            // 1. Group ID Discovery — auto-reply with JID for config
            const isGroup = remoteJid.endsWith('@g.us');
            if (isGroup) {
                const bodyText = msg.message?.conversation ||
                                 msg.message?.extendedTextMessage?.text || '';
                if (bodyText.toLowerCase().includes('group id') ||
                    bodyText.toLowerCase().includes('jid')) {
                    await sock.sendMessage(remoteJid, { text: `✅ Group JID:\n${remoteJid}` });
                    continue;
                }
            }

            // 2. Location Messages → Forward to GAS Webhook
            const loc = msg.message?.locationMessage || msg.message?.liveLocationMessage;
            if (loc?.degreesLatitude && loc?.degreesLongitude) {
                console.log(`[${role}] 📍 Location from ${pushName}: ${loc.degreesLatitude}, ${loc.degreesLongitude}`);

                if (CONFIG.GAS_SCRIPT_URL) {
                    try {
                        await fetch(CONFIG.GAS_SCRIPT_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                            body: JSON.stringify({
                                action: 'whatsappWebhook',
                                payload: {
                                    source: 'whatsapp',
                                    role: role,
                                    jid: remoteJid,
                                    pushName: pushName,
                                    lat: loc.degreesLatitude,
                                    lng: loc.degreesLongitude,
                                    isLive: !!msg.message?.liveLocationMessage,
                                    timestamp: timestamp
                                },
                                authToken: CONFIG.BRIDGE_API_KEY
                            })
                        });
                        console.log(`[${role}] ✅ Location forwarded to GAS`);
                    } catch (err) {
                        console.error(`[${role}] ❌ Location forward failed:`, err.message);
                    }
                }
            }
        }
    });

    sock.ev.on('messages.update', (updates) => {
        for (const u of (Array.isArray(updates) ? updates : [updates])) {
            if (u.key?.id) {
                // Status update handler (optional)
            }
        }
    });


    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            sessionStates[role].qr = qr;
            sessionStates[role].qrDataUrl = null;

            // Generate data-url for dashboard
            try {
                const dataUrl = await qrcode.toDataURL(qr);
                if (sessionStates[role]) sessionStates[role].qrDataUrl = dataUrl;
            } catch { /* ignore */ }

            const hebrewNames = {
                [ROLES.DISPATCHER]: 'ניהול',
                [ROLES.DRIVER]: 'נהג',
                [ROLES.PASSENGER]: 'נוסע'
            };

            console.log(`\n=========================================`);
            console.log(`📸 סרוק QR עבור: [${hebrewNames[role] || role.toUpperCase()}]`);
            console.log(`🌐 או גש ל: GET /qr?role=${role}&key=YOUR_API_KEY`);
            console.log(`=========================================`);
            qrcodeTerminal.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            sessionStates[role].connected = false;
            sessionStates[role].qr = null;
            sessionStates[role].qrDataUrl = null;

            console.log(`🔴 [${role}] Connection closed. Status: ${statusCode} | Reconnect: ${shouldReconnect}`);
            
            // Translate role to string for alert
            const hebrewNames = { [ROLES.DISPATCHER]: 'ניהול', [ROLES.DRIVER]: 'נהג', [ROLES.PASSENGER]: 'נוסע' };
            const roleName = hebrewNames[role] ? hebrewNames[role] : role;
            sendTelegramAlert(`🔌 *Bridge Disconnected*\n*Role:* ${roleName}\n*Status Code:* ${statusCode}\n*Will Reconnect:* ${shouldReconnect ? 'Yes 🔄' : 'No ❌'}`);

            if (shouldReconnect) {
                console.log(`🔄 [${role}] Reconnecting in 5s...`);
                setTimeout(() => initializeSession(role), 5000);
            } else {
                // Logged out — מחיקת session פגום ואתחול מחדש עם QR
                console.log(`💣 [${role}] Logged out or fatal error. Clearing ALL session data (Local + Mongo)...`);
                
                // 1. Clear Local Files
                const authPath = getAuthDir(role);
                try {
                    if (fs.existsSync(authPath)) {
                        fs.rmSync(authPath, { recursive: true, force: true });
                        console.log(`🧹 [${role}] Local session files cleared`);
                    }
                } catch (e) {
                    console.error(`[${role}] Failed to clear local session:`, e.message);
                }

                // 2. Clear MongoDB Collection
                if (CONFIG.MONGO_URI) {
                    try {
                        const db = await getMongoDb();
                        await db.collection(`auth_${role}`).deleteMany({});
                        console.log(`🧹 [${role}] MongoDB session collection cleared`);
                    } catch (err) {
                        console.error(`[${role}] Failed to clear MongoDB session:`, err.message);
                    }
                }

                console.log(`🔄 [${role}] Restarting for fresh QR scan in 3s...`);
                setTimeout(() => initializeSession(role), 3000);
            }
        } else if (connection === 'open') {
            sessionStates[role].connected = true;
            sessionStates[role].qr = null;
            sessionStates[role].qrDataUrl = null;
            console.log(`🟢 [${role}] WhatsApp Connected! User: ${sock.user?.id || 'unknown'}`);
            processQueue(role);
        }
    });

    sessions[role] = sock;
}

// ==============================================
// QUEUE & WORKER
// ==============================================

function toWhatsappJid(raw) {
    if (!raw || typeof raw !== 'string') return '';
    const trimmed = raw.trim();
    if (trimmed.endsWith('@g.us') || trimmed.endsWith('@s.whatsapp.net')) return trimmed;
    let digits = trimmed.replace(/\D/g, '');
    if (digits.startsWith('972')) digits = digits;
    else if (digits.startsWith('0')) digits = '972' + digits.slice(1);
    else if (digits.length === 9 && digits.startsWith('5')) digits = '972' + digits;
    return digits ? `${digits}@s.whatsapp.net` : '';
}

function validateJID(jid) {
    if (!jid || typeof jid !== 'string') return false;
    const privateJidRegex = /^\d{8,18}@s\.whatsapp\.net$/;
    const groupJidRegex = /^\d{8,25}(-\d+)?@g\.us$/;
    return privateJidRegex.test(jid) || groupJidRegex.test(jid);
}

async function processQueue(role) {
    const state = sessionStates[role];
    const sock = sessions[role];
    if (!state || state.isProcessing || !state.connected || state.queue.length === 0) return;

    state.isProcessing = true;

    while (state.queue.length > 0 && state.connected) {
        const chunk = state.queue.splice(0, CONFIG.CONCURRENCY_LIMIT);

        const promises = chunk.map(async (task) => {
            const { jid, text, attempt, resolve } = task;
            try {
                const msgPayload = typeof text === 'object' ? text : { text };
                const sent = await sock.sendMessage(jid, msgPayload);
                console.log(`✅ [${role}] Sent to ${maskJid(jid)} | id: ${sent?.key?.id}`);
                if (resolve) resolve({ ok: true, id: sent?.key?.id });
            } catch (err) {
                console.error(`❌ [${role}] Send failed for ${jid}: ${err.message}`);
                if (attempt < CONFIG.RETRY.ATTEMPTS) {
                    const delay = CONFIG.RETRY.BASE_DELAY * Math.pow(2, attempt);
                    console.log(`⏳ [${role}] Retrying ${jid} in ${delay}ms (attempt ${attempt + 1})`);
                    setTimeout(() => {
                        state.queue.push({ jid, text, attempt: attempt + 1, resolve });
                        if (!state.isProcessing) processQueue(role);
                    }, delay);
                } else {
                    console.error(`☠️ [${role}] Permanent failure for ${jid} after ${attempt} attempts.`);
                    sendTelegramAlert(`✉️❌ *Message Delivery Failed*\n*Role:* ${role}\n*Target:* \`${maskJid(jid)}\`\n*Error:* \`${err.message}\``);
                    if (resolve) resolve({ ok: false, error: err.message });
                }
            }
        });

        await Promise.allSettled(promises);

        if (state.queue.length > 0) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    state.isProcessing = false;
}

function queueMessageAsync(role, jid, text) {
    return new Promise((resolve) => {
        // Prefer the requested role; fall back to any connected session (dispatcher first)
        let targetRole = (sessionStates[role] && sessionStates[role].connected) ? role : null;
        if (!targetRole) {
            targetRole = [ROLES.DISPATCHER, ROLES.DRIVER, ROLES.PASSENGER]
                .find(r => sessionStates[r] && sessionStates[r].connected) || null;
        }
        if (!targetRole) {
            targetRole = sessionStates[role] ? role : ROLES.DISPATCHER;
        }
        const state = sessionStates[targetRole];

        if (!state) {
            return resolve({ ok: false, error: 'Session is not initialized', status: 'failed' });
        }

        if (!state.connected) {
            state.queue.push({ jid, text, attempt: 1, resolve: null });
            console.log(`📥 [${targetRole}] Queued for ${maskJid(jid)} (waiting for QR scan). depth=${state.queue.length}`);
            return resolve({ ok: true, queued: true, status: 'queued' });
        }

        state.queue.push({ jid, text, attempt: 1, resolve });
        processQueue(targetRole);
    });
}

// ==============================================
// EXPRESS SERVER
// ==============================================

const app = express();
app.set('trust proxy', 1);
app.use(cors({
    origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
        if (CONFIG.CORS_ORIGINS.includes(origin)) return cb(null, true);
        cb(null, false);
    }
}));
app.use(express.json());

// Verbose logging
app.use((req, res, next) => {
    if (req.path !== '/health') { // לא מדפיס health checks
        console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
    }
    next();
});

// Auth Middleware
const authMiddleware = (req, res, next) => {
    const raw = req.headers['x-api-key'] || req.headers['authorization'] || req.query.key || '';
    if (!raw) return res.status(401).json({ success: false, error: 'Missing API Key' });
    const clean = raw.startsWith('Bearer ') ? raw.substring(7) : raw;
    if (String(clean).trim() !== String(CONFIG.BRIDGE_API_KEY).trim()) {
        return res.status(403).json({ success: false, error: 'Invalid API Key' });
    }
    next();
};

const limiter = rateLimit({ windowMs: 60_000, max: 120, message: { success: false, error: 'Rate limit exceeded' } });

// ==============================================
// ROUTES
// ==============================================

// Health (ללא auth — נדרש ל-Render health check + keep-alive ping)
app.get('/health', (req, res) => {
    const statusRpt = {};
    for (const r of Object.values(ROLES)) {
        const st = sessionStates[r];
        statusRpt[r] = st ? { connected: st.connected, queueDepth: st.queue?.length || 0 } : 'not_initialized';
    }
    res.json({ status: 'ok', uptime: Math.round(process.uptime()), sessions: statusRpt });
});

// QR Code endpoint — גש מהדפדפן כדי לסרוק
// GET /qr?role=dispatcher&key=YOUR_API_KEY
app.get('/qr', authMiddleware, (req, res) => {
    const role = req.query.role || ROLES.DISPATCHER;
    const state = sessionStates[role];

    if (!state) {
        return res.status(404).send(`<h2>Role '${role}' not found</h2>`);
    }

    if (state.connected) {
        return res.send(`<html><body style="font-family:sans-serif;text-align:center;padding:40px">
            <h2 style="color:green">✅ [${role}] Connected!</h2>
            <p>No QR needed — this role is already authenticated.</p>
        </body></html>`);
    }

    if (state.qrDataUrl) {
        const key = encodeURIComponent(req.query.key || '');
        const pairingHtml = state.pairingCode
            ? `<p style="font-size:42px;letter-spacing:12px;font-weight:900;margin:16px 0">${state.pairingCode}</p>
               <p>ווטסאפ → מכשירים מקושרים → קישור עם מספר טלפון</p>`
            : `<form id="pairf" style="margin:20px auto;max-width:320px">
                 <input id="phone" placeholder="050..." style="padding:10px;width:180px;font-size:16px"/>
                 <button type="submit" style="padding:10px 14px">קבל קוד קישור</button>
               </form>
               <p id="pairmsg"></p>
               <script>
                 document.getElementById('pairf').onsubmit = async (e) => {
                   e.preventDefault();
                   const phone = document.getElementById('phone').value;
                   const r = await fetch('/pair', { method:'POST', headers:{'Content-Type':'application/json','x-api-key':decodeURIComponent('${key}')}, body: JSON.stringify({ phone, role: '${role}' }) });
                   const j = await r.json();
                   document.getElementById('pairmsg').textContent = j.code || j.error || 'error';
                   if (j.code) document.getElementById('pairmsg').style.fontSize = '42px';
                 };
               </script>`;
        return res.send(`<html>
            <head><meta http-equiv="refresh" content="12"></head>
            <body style="font-family:sans-serif;text-align:center;padding:40px;background:#f0f0f0;dir:rtl">
                <h2>חיבור ווטסאפ — <strong>${role}</strong></h2>
                ${pairingHtml}
                <p style="color:gray">או סרוק QR (מתרענן כל 30 שניות)</p>
                <img src="${state.qrDataUrl}" style="border:4px solid #333;border-radius:8px;max-width:300px"/>
                <br><br>
                <a href="/qr?role=dispatcher&key=${req.query.key}" style="margin:10px">dispatcher</a> |
                <a href="/qr?role=driver&key=${req.query.key}" style="margin:10px">driver</a> |
                <a href="/qr?role=passenger&key=${req.query.key}" style="margin:10px">passenger</a>
            </body></html>`);
    }

    // אין QR עדיין — ממתין
    return res.send(`<html>
        <head><meta http-equiv="refresh" content="5"></head>
        <body style="font-family:sans-serif;text-align:center;padding:40px">
            <h2>⏳ [${role}] Generating QR...</h2>
            <p>Page will refresh automatically.</p>
        </body></html>`);
});

// Status
app.get('/status', authMiddleware, (req, res) => {
    const sessionsReport = {};
    let anyQrDataUrl = null;
    let allConnected = true;

    for (const r of Object.values(ROLES)) {
        const st = sessionStates[r];
        const connected = !!(st && st.connected);
        allConnected = allConnected && connected;
        sessionsReport[r] = st ? {
            connected,
            queueDepth: st.queue?.length || 0,
            waitingForQr: !!st.qr,
            pairingCode: st.pairingCode || null,
        } : 'not_initialized';
        if (st?.qrDataUrl && !anyQrDataUrl) anyQrDataUrl = st.qrDataUrl;
    }

    res.json({
        ok: true,
        data: {
            connected: allConnected,
            qr: anyQrDataUrl || null,
            pairingCode: sessionStates[ROLES.DISPATCHER]?.pairingCode || null,
            lastUpdate: new Date().toISOString(),
            sessionDir: SESSION_DIR,
            userData: { name: 'multi-bot', roles: sessionsReport }
        }
    });
});

// Pairing code — alternative to QR (WhatsApp → Linked devices → Link with phone number)
// POST /pair { "phone": "0501234567", "role": "dispatcher" }
app.post('/pair', limiter, authMiddleware, async (req, res) => {
    const role = req.body?.role || ROLES.DISPATCHER;
    const sock = sessions[role];
    const state = sessionStates[role];
    if (!sock || !state) {
        return res.status(404).json({ success: false, error: 'Role not ready yet — retry in a few seconds' });
    }
    if (state.connected) {
        return res.json({ success: true, connected: true });
    }
    const jid = toWhatsappJid(String(req.body?.phone || ''));
    const digits = jid.replace('@s.whatsapp.net', '');
    if (!digits || digits.length < 10) {
        return res.status(400).json({ success: false, error: 'מספר טלפון לא תקין' });
    }
    try {
        const code = await sock.requestPairingCode(digits);
        state.pairingCode = code;
        console.log(`🔑 [${role}] Pairing code for ${maskJid(jid)}: ${code}`);
        return res.json({ success: true, code });
    } catch (e) {
        console.error(`[${role}] Pairing code failed:`, e.message);
        return res.status(500).json({ success: false, error: e.message || 'Pairing failed' });
    }
});

// Reset session — מחיקת session ספציפי לסריקה מחדש
// POST /reset-session { "role": "driver" }
app.post('/reset-session', authMiddleware, (req, res) => {
    const { role } = req.body || {};
    if (!role || !Object.values(ROLES).includes(role)) {
        return res.status(400).json({ success: false, error: `Invalid role. Use: ${Object.values(ROLES).join(', ')}` });
    }

    const authPath = getAuthDir(role);
    try {
        if (fs.existsSync(authPath)) {
            fs.rmSync(authPath, { recursive: true, force: true });
        }
        // אתחל מחדש
        setTimeout(() => initializeSession(role), 500);
        res.json({ success: true, message: `Session for [${role}] cleared. Reconnecting...` });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Broadcast / Send Message
async function handleBroadcast(req, res) {
    const { text, targetGroupJid, jid, role } = req.body || {};
    let { jids } = req.body || {};

    if (!jids) jids = [];
    if (jid && !jids.includes(jid)) jids.push(jid);
    if (targetGroupJid && !jids.includes(targetGroupJid)) jids.push(targetGroupJid);
    jids = jids.map(toWhatsappJid).filter(Boolean);

    if (jids.length === 0) {
        return res.status(400).json({ success: false, error: 'Missing jid(s) or targetGroupJid' });
    }
    if (!text || typeof text !== 'string' || text.length > CONFIG.MAX_TEXT_LENGTH) {
        return res.status(400).json({ success: false, error: 'Invalid or too long text content' });
    }

    const results = [];
    for (const targetJid of jids) {
        if (!validateJID(targetJid)) {
            results.push({ jid: targetJid, status: 'rejected', error: 'Invalid JID format' });
            continue;
        }
        const targetRole = Object.values(ROLES).includes(role) ? role : ROLES.DISPATCHER;
        const queueRes = await queueMessageAsync(targetRole, targetJid, text);
        results.push({ jid: targetJid, ...queueRes });
    }

    return res.json({ success: true, processed: results.length, details: results });
}

app.post('/new-order', limiter, authMiddleware, handleBroadcast);
app.post('/send-message', limiter, authMiddleware, handleBroadcast);

// Edit Message
app.post('/edit-message', limiter, authMiddleware, async (req, res) => {
    const { messageId, text, jid, role } = req.body || {};
    if (!messageId || !text || !jid) {
        return res.status(400).json({ success: false, error: 'Missing messageId, text, or jid' });
    }
    if (!validateJID(jid)) {
        return res.status(400).json({ success: false, error: 'Invalid JID format' });
    }

    const targetRole = Object.values(ROLES).includes(role) ? role : ROLES.DISPATCHER;
    const queueRes = await queueMessageAsync(targetRole, jid, { text, edit: { id: messageId, remoteJid: jid, fromMe: true } });
    res.json({ success: true, ...queueRes });
});

// ==============================================
// GRACEFUL SHUTDOWN
// ==============================================

process.on('SIGTERM', async () => {
    console.log('📴 SIGTERM received. Graceful shutdown...');
    for (const role of Object.values(ROLES)) {
        if (sessions[role]) {
            try { sessions[role].end(); } catch (e) { /* ignore */ }
        }
    }
    process.exit(0);
});

// ==============================================
// STARTUP
// ==============================================

async function runSystem() {
    console.log('\n🚀 Starting Taxi Multi-Bot System...');
    console.log(`📂 Auth Strategy: ${CONFIG.MONGO_URI ? 'MongoDB Atlas' : 'Local Filesystem'}`);
    
    const startRoles = String(process.env.START_ROLES || ROLES.DISPATCHER)
        .split(',')
        .map((s) => s.trim())
        .filter((r) => Object.values(ROLES).includes(r));
    const rolesToStart = startRoles.length ? startRoles : [ROLES.DISPATCHER];
    console.log(`📱 Starting roles: ${rolesToStart.join(', ')}`);
    for (let i = 0; i < rolesToStart.length; i++) {
        if (i === 0) await initializeSession(rolesToStart[i]);
        else setTimeout(() => initializeSession(rolesToStart[i]), i * 2500);
    }

        app.listen(CONFIG.PORT, () => {
        console.log(`\n🚀 Bridge listening on port ${CONFIG.PORT}`);
        console.log(`📱 Scan QR codes at: /qr?role=dispatcher&key=YOUR_KEY\n`);
    });

    // ============================================
    // SELF-KEEP-ALIVE (Render Free Tier)
    // ============================================
    if (CONFIG.RENDER_URL) {
        console.log(`💓 Self-ping enabled for: ${CONFIG.RENDER_URL}`);
        setInterval(async () => {
            try {
                const url = `${CONFIG.RENDER_URL.replace(/\/$/, '')}/health`;
                await fetch(url);
                // console.log('💓 Pinged self /health');
            } catch (e) {
                console.warn('💓 Self-ping failed:', e.message);
            }
        }, 9 * 60 * 1000); // Every 9 minutes
    }
}


runSystem();
