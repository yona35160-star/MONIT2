# 🚀 Setup & Deployment Guide
**Follow these steps to deploy the system from scratch.**

---

## 1. Firebase Setup (Real-time Database)
1.  Go to [Firebase Console](https://console.firebase.google.com/).
2.  Create a new project (e.g., `taxi-bridge-prod`).
3.  **Realtime Database**: Create a database in `us-central1` (or your preferred region).
4.  **Security Rules**: Set them to Allow for initial setup (or use the provided rules in `GS/FirebaseSetup.md`).
5.  **Service Account**: Go to Project Settings -> Service Accounts -> Generate new private key. **Save this JSON.**

---

## 2. Google Apps Script (GAS) Setup
1.  Create a new Google Sheet.
2.  Extensions -> Apps Script.
3.  Paste the code from `bridge/BridgeRouter.gs` and other `.gs` files in the repository.
4.  **Script Properties**: Set the following:
    - `FIREBASE_URL`: Your Database URL.
    - `BRIDGE_API_KEY`: A strong random string.
    - `TELEGRAM_BOT_TOKEN`: (Optional) For fallback alerts.
    - `TELEGRAM_CHAT_ID`: (Optional).
    - `ALERT_EMAIL`: Your email for final fallback.

---

## 3. WhatsApp Bridge - Cloud Deployment (Render)
1.  **Push to GitHub**:
    - Build your bridge folder: `multi-bot.js`, `package.json`, `render.yaml`.
    - Create a Private Repo and push the code.
2.  **Deploy on Render**:
    - Connect your GitHub Repo.
    - Select **Web Service**.
    - **Instance Type**: Starter ($7 - Required for Persistent Disk).
    - **Disk**: Mount 1GB at `/data/sessions`.
3.  **Environment Variables**:
    - `BRIDGE_API_KEY`: Must match the GAS property.
    - `SESSION_DIR`: `/data/sessions`.

---

## 4. WhatsApp Bridge - Local Hybrid Setup (Optional)
If you want to use your computer as the primary bridge (saves Render bandwidth/latency):
1.  Install Node.js 20+.
2.  Run `npm install` in the bridge folder.
3.  Set `.env` with `PORT=3001` and your `BRIDGE_API_KEY`.
4.  Run `node multi-bot.js`.
5.  The GAS will automatically detect the local bridge if it responds on `localhost:3001`.

---

## 5. Connecting the Apps
1.  In `BridgeRouter.gs`, update `RENDER_BRIDGE_URL` with your Render URL.
2.  Deploy GAS as a **Web App** (Execute as: Me, Access: Anyone).
3.  Copy the Web App URL and set it in your Frontend `.env` files.

---

## 6. QR Code Pairing
Visit your Bridge URL in a browser:
- `https://YOUR-URL.render.com/qr?role=dispatcher&key=YOUR_KEY`
- `https://YOUR-URL.render.com/qr?role=driver&key=YOUR_KEY`
- `https://YOUR-URL.render.com/qr?role=passenger&key=YOUR_KEY`
Scan each with a separate WhatsApp account.
