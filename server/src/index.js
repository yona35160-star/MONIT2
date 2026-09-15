import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectMongo, pingMongo } from './db.js';
import { flattenPayload } from './util.js';
import { createActions } from './actions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env');
const examplePath = path.join(__dirname, '../.env.example');
dotenv.config({ path: fs.existsSync(envPath) ? envPath : examplePath });

const PORT = Number(process.env.PORT) || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/taxipro';
const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const app = express();
app.use(cors({ origin: corsOrigins.length ? corsOrigins : true }));
app.use(express.json({ type: ['application/json', 'text/plain', 'application/*+json'] }));
app.use(express.text({ type: ['text/plain', 'text/*'] }));
app.use(express.urlencoded({ extended: true }));

const actions = createActions();

function parseRequest(req) {
  let body = req.body;
  if (typeof body === 'string') {
    const trimmed = body.trim();
    if (!trimmed) body = {};
    else {
      try {
        body = JSON.parse(trimmed);
      } catch {
        body = {};
      }
    }
  }
  if (!body || typeof body !== 'object') body = {};

  const query = req.query || {};
  const action = body.action || query.action || '';
  const authToken =
    body.authToken ||
    body.auth_token ||
    query.authToken ||
    query.token ||
    (typeof req.headers.authorization === 'string'
      ? req.headers.authorization.replace(/^Bearer\s+/i, '')
      : '');

  let payload = body.payload;
  if (payload == null || typeof payload !== 'object') {
    const { action: _a, authToken: _t, auth_token: _t2, payload: _p, ...rest } = body;
    payload = rest;
  }
  payload = flattenPayload({ ...query, ...payload });
  return { action: String(action || ''), payload, authToken: String(authToken || '') };
}

async function dispatch(req, res) {
  const { action, payload, authToken } = parseRequest(req);
  if (!action && Object.keys(payload).length === 0) {
    return res.json({ ok: true, message: 'Pong' });
  }
  if (!action) {
    return res.status(400).json({ ok: false, error: 'Invalid Action: undefined' });
  }
  const handler = actions[action];
  if (!handler) {
    return res.status(400).json({
      ok: false,
      error: `Invalid Action: ${action}. Keys: ${Object.keys(payload).join(',')}`,
    });
  }
  try {
    const result = await handler(payload, {}, authToken);
    if (result && result.ok === false && /unauthor/i.test(String(result.error || ''))) {
      return res.status(401).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error(`[taxipro-api] ${action} failed`, err);
    return res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
}

app.get('/health', async (_req, res) => {
  try {
    await pingMongo();
    res.json({ ok: true, service: 'taxipro-api', mongo: true, port: PORT });
  } catch (err) {
    res.status(503).json({ ok: false, service: 'taxipro-api', mongo: false, error: err.message });
  }
});

app.get('/', dispatch);
app.post('/', dispatch);
app.get('/exec', dispatch);
app.post('/exec', dispatch);
app.options('*', cors({ origin: true }));

async function main() {
  try {
    await connectMongo(MONGODB_URI);
  } catch (err) {
    console.error(`
[taxipro-api] MongoDB is not reachable (check MONGODB_URI in server/.env)
Start Mongo first:
  • Windows: START-MONGO.bat   or   net start MongoDB
  • macOS/Linux: mongod --dbpath <data>
  • Docker: docker run -d --name taxipro-mongo -p 27017:27017 mongo:7
Then: cd server && cp .env.example .env && npm install && npm run dev
`);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`[taxipro-api] listening on http://localhost:${PORT}`);
    const _mongoHost = (() => { try { const u = MONGODB_URI.replace(/^mongodb(\+srv)?:\/\//, 'https://'); return new URL(u).host; } catch { return 'configured'; } })();
    console.log(`[taxipro-api] Mongo: connected (${_mongoHost})`);
    console.log('[taxipro-api] Frontend: set VITE_WEBAPP_URL=http://localhost:4000');
    console.log('[taxipro-api] Local admin stub: admin@taxi.co.il / 123456');
  });
}

main();
