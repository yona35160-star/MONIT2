# 🛠️ Maintenance, Audit Logs & Roadmaps
**Historical record of changes and future development priorities.**

---

## 1. Audit Log (April 2026 Audit)
A comprehensive system audit was performed to prepare for high-traffic production.

### Key Fixes Implemented:
- ✅ **Duplicate Payments**: Prevented multiple notifications if a driver clicks "Pay" repeatedly.
- ✅ **Phone Normalization**: Fixed Israeli phone format inconsistencies (e.g., `054` vs `+972`).
- ✅ **Tiered Fallback**: WhatsApp -> Telegram -> Email implementation.
- ✅ **CORS Hardening**: Restricted access to production domains only.
- ✅ **PII Masking**: Integrated a masking utility for phone numbers in all bridge logs.

### UI & Performance Optimizations (Current):
- ✅ **Offline Degradation UI**: Added a global banner to handle client network disconnects gracefully showing cached data.
- ✅ **React Memoization**: Optimized `LiveMap` rendering with deep equality checks to reduce CPU overhead during state changes.
- ✅ **Data Fetch Limiting**: Capped administrative pulls to explicit bounded limits with filtering to minimize database egress overhead.

---

## 2. Technical Debt & Known Bugs
- **Memory Consumption**: Puppeteer (WhatsApp Web) uses ~200-300MB per role. If Render memory hits 512MB, the service may restart. **Monitor with `/health` endpoint.**
- **Sync Latency**: Google Sheets can sometimes have a 1-5 second lag between a write and the `onChange` trigger.
- **Message Rate**: Sending messages too fast can lead to temporary WhatsApp bans. Rate limiting is active but should be monitored.

---

## 3. High Priority Roadmap (Next Phase)
1.  **Auto-Scale Bridge**: Horizontal scaling of the bridge server (multiple Render instances).
2.  **Voice-to-Text**: Integration with WhatsApp Voice Messages using Whisper API to automatically create orders.
3.  **Advanced Analytics**: A dedicated React dashboard for station owners to see daily profits and driver performance metrics.
4.  **Native Mobile Apps**: Wrapping the current PWAs into native Android/iOS shells for Push Notification support.

---

## 4. Past Change Summaries
- **v1.0**: Initial GAS + WhatsApp Web.js integration.
- **v2.0**: Added Firebase Realtime DB for UI sync.
- **v2.1**: Render migration, MongoDB session persistence, and security hardening.
- **v2.2**: UI degradation, React map rendering memoizations, and Firebase egress payload caps.

---

## 5. Maintenance Checklist
- **Monthly**: Export Google Sheets to Excel (Backup).
- **Weekly**: Monitor Render logs for Puppeteer errors.
- **Daily**: Check for unassigned orders that may have slipped through the cracks.
