# ⚙️ Operation & Validation Manual
**How to run the system daily and ensure everything is healthy.**

---

## 1. Daily Checks
- **Server Health**: Open the Admin Dashboard. Check the "Bridge Connectivity" widget.
- **WhatsApp Status**: Ensure the phones linked are still "Connected".
- **Realtime Sync**: Create a test order and verify it appears in the "Pending" list within 2 seconds.

---

## 2. Common Dispatcher Tasks
- **Approving Drivers**: Go to "Drivers" -> "Pending Approval". Verify phone numbers before clicking "Approve".
- **Manual Overrides**: If a driver accepts an order by mistake, use the "Force Release" button in the Order Details modal.
- **Commission Management**: Check the "Billing" tab weekly to see pending commissions from drivers.

---

## 3. Troubleshooting (Disaster Recovery)

### Scenario A: WhatsApp Bridge is Offline
1.  **Check Local**: Is the local bridge server running? (Check Terminal).
2.  **Check Render**: Is the Render service in "Deploying" or "Suspended" state?
3.  **Fallback**: If both fail, the system will automatically send critical alerts via **Telegram Bot**.
4.  **Action**: Restart the failed bridge and rescan QR if necessary.

### Scenario B: Orders not Syncing
1.  **Force Sync**: Run the `forceSync` function in Google Apps Script editor.
2.  **Firebase Check**: Verify the Firebase Database URL in Script Properties.

### Scenario C: PII Exposure
1.  If PII is spotted in public logs, immediately rotate the `BRIDGE_API_KEY` in both GAS and Render to prevent unauthorized access to the logging endpoint.

---

## 4. System Validation Steps
To perform a full validation:
1.  **Health Check**: Visit `https://your-bridge.com/health`.
2.  **End-to-End Test**:
    - Place order as Customer.
    - Check WhatsApp Group for Notification.
    - Accept as Driver.
    - Confirm Payment Link works.
    - Mark as Paid and check Customer Receipt.

---

## 5. Security Protocols
- **CORS**: Only allowed origins (`menachemadmin.netlify.app`, `taxiil.netlify.app`, `taxiproil.netlify.app`, and localhost) can talk to the bridge.
- **Rate Limiting**: The bridge automatically limits WhatsApp messages to avoid account bans. Do not send more than 10 messages per minute per role.
- **Masking**: Phone numbers are masked in logs (e.g., `97250****12`). Do not debug with raw PII.
