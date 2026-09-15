# ARCHITECTURE — DB consolidation (Wave Mongo)

## Problem
Today we juggle three stores:
1. Google Sheets + Apps Script — business logic / CRUD
2. Firebase Realtime — live map & order status
3. Mongo — WhatsApp sessions only (optional)

## Decision
**MongoDB becomes the system of record.** One database.

### Phase 1 (now)
- Install local Mongo (`START-MONGO.bat` / Windows service)
- Bridge uses `MONGODB_URI=mongodb://127.0.0.1:27017/taxipro`
- Build **Node.js API** (`server/`) on Express + Mongo to replace GAS/Sheets endpoints
- Frontend keeps calling the same actions; swap `VITE_WEBAPP_URL` from script.google.com → `http://localhost:4000`

### Phase 2
- Replace Firebase listeners with Socket.io (or Mongo Change Streams) on the same Node API
- Then remove Firebase config from the client

## Keep temporarily
- Firebase only until Phase 2 realtime is ready (maps/status)
- Sheets/GAS — deprecate; no new features there

## Node
Project requires Node >= 18. This machine has Node v25 — OK. No need to downgrade to 18.