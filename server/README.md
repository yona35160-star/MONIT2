# TAXIPRO Mongo API

Express server that replaces primary GAS Web App calls.

## Run

1. Start MongoDB (`START-MONGO.bat` from repo root, or `mongod`, or Docker `mongo:7`).
2. Copy env: `cp .env.example .env` (no live secrets — local stubs only).
3. `npm install && npm run dev` — listens on **http://localhost:4000**.

From repo root: `npm run dev:api`.

Health: `GET /health`

## Contract

Same as the frontend `sendToBackend` helper:

```http
POST /
Content-Type: text/plain;charset=utf-8

{"action":"loginAdmin","payload":{"email":"admin@taxi.co.il","password":"123456"},"authToken":""}
```

Also accepts JSON and `?action=`.

Local admin stub: `admin@taxi.co.il` / `123456`. Local OTP: `123456`.
