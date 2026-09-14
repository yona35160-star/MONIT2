/**
 * Billing Service
 * Monthly reports, commission calculations, invoices
 * 
 * Dependencies: Utils.gs
 */
const BillingService = {
  generateMonthlyReport: (driverId, month, year, settings, token) => {
    // [AUTH] Security Gate
    if (!token && !driverId) return Utils.error("Unauthorized");

    // 1. Admin Bypass
    if (token && Utils.checkAuth(token, 'admin', settings)) {
        // Admin allowed to generate for anyone
    } else {
        // 2. Self Check (Driver generating for self)
        if (!token) return Utils.error("Unauthorized: Missing Token");
        // Verify token matches driverId (assuming token logic implementation)
        // For now, if simple token matches driver phone or id from cache
    }

    const orders = Utils.getData('Orders');
    const driverOrders = orders.filter(o => 
      Utils.compareIds(o.driver_id, driverId) && 
      o.status === OrderStatus.COMPLETED
    );

    // Filter by month/year (month is 1-indexed from frontend)
    const filtered = driverOrders.filter(o => {
      try {
        const date = Utils.parseDate(o.pickup_datetime || o.pickup_date || o.created_at);
        if (!date) return false;
        
        return (date.getMonth() + 1) === month && date.getFullYear() === year;
      } catch (e) { return false; }
    });

    const totalRevenue = filtered.reduce((sum, o) => sum + (parseFloat(o.price) || 0), 0);
    const totalCommission = filtered.reduce((sum, o) => sum + (parseFloat(o.commission) || 0), 0);
    const driverNet = totalRevenue - totalCommission;

    const driversMap = Utils.getDataMap('Drivers', 'driver_id', { transformKey: k => String(k || '').trim() });
    const driver = driversMap.get(String(driverId || '').trim());

    const html = `
      <div dir="rtl" style="font-family: sans-serif; padding: 40px; color: #333;">
        <h1 style="color: #0f172a; border-bottom: 2px solid #facc15; padding-bottom: 10px;">׳“׳•"׳— ׳”׳›׳ ׳¡׳•׳× ׳—׳•׳“׳©׳™ - ׳×׳—׳ ׳× ׳׳•׳ ׳™׳•׳×</h1>
        <p><b>׳ ׳”׳’:</b> ${driver ? driver.driver_name : driverId}</p>
        <p><b>׳×׳§׳•׳₪׳”:</b> ${month}/${year}</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="border: 1px solid #ddd; padding: 12px; text-align: right;">׳×׳׳¨׳™׳</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: right;">׳׳–׳”׳”</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: right;">׳׳—׳™׳¨</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: right;">׳¢׳׳׳”</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(o => `
              <tr>
                <td style="border: 1px solid #ddd; padding: 10px;">${o.pickup_datetime}</td>
                <td style="border: 1px solid #ddd; padding: 10px;">${o.order_id}</td>
                <td style="border: 1px solid #ddd; padding: 10px;">${o.price} ג‚×</td>
                <td style="border: 1px solid #ddd; padding: 10px;">${o.commission} ג‚×</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="margin-top: 30px; background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0;">
          <p style="font-size: 18px; margin: 5px 0;"><b>׳¡׳”"׳› ׳‘׳¨׳•׳˜׳•:</b> ${totalRevenue.toLocaleString()} ג‚×</p>
          <p style="font-size: 18px; margin: 5px 0;"><b>׳¢׳׳׳•׳× ׳׳×׳©׳׳•׳:</b> ${totalCommission.toLocaleString()} ג‚×</p>
          <hr style="border: 0; border-top: 2px solid #facc15; margin: 15px 0;">
          <p style="font-size: 22px; margin: 5px 0; color: #0f172a;"><b>׳ ׳˜׳• ׳׳ ׳”׳’: ${driverNet.toLocaleString()} ג‚×</b></p>
        </div>

        <p style="margin-top: 40px; font-size: 10px; color: #64748b; text-align: center;">׳”׳•׳₪׳§ ׳׳•׳˜׳•׳׳˜׳™׳× ׳¢"׳™ ׳׳¢׳¨׳›׳× ׳”׳“׳™׳¡׳₪׳׳¥' - ${Utils.now()}</p>
      </div>
    `;

    try {
      const blob = HtmlService.createHtmlOutput(html).getAs('application/pdf');
      const base64 = Utilities.base64Encode(blob.getBytes());
      return Utils.json({ ok: true, data: { pdfBase64: base64, fileName: `Report_${driverId}_${month}_${year}.pdf` } });
    } catch (e) {
      return Utils.json({ ok: false, error: 'PDF Generation Failed: ' + e.toString() });
    }
  },
  
  getDailyReport: (settings, token) => {
    if (!Utils.checkAuth(token, 'admin', settings || {})) return Utils.error("Unauthorized", 401, null);
    // Basic Daily Report based on Orders Sheet
    const today = Utils.formatDate(new Date(), "Asia/Jerusalem", "yyyy-MM-dd");
    const orders = Utils.getData('Orders');
    
    // Filter for today and completed
    const dailyOrders = orders.filter(o => {
      if (o.status !== OrderStatus.COMPLETED) return false;
      const d = Utils.parseDate(o.created_at);
      if (!d) return false;
      return Utils.formatDate(d, "Asia/Jerusalem", "yyyy-MM-dd") === today;
    });

    const totalRevenue = dailyOrders.reduce((sum, o) => sum + (parseFloat(o.price) || 0), 0);
    const totalCommission = dailyOrders.reduce((sum, o) => sum + (parseFloat(o.commission) || 0), 0);

    return Utils.json({
      ok: true,
      data: {
        date: today,
        orders_count: dailyOrders.length,
        total_revenue: totalRevenue,
        total_commission: totalCommission,
        currency: 'ILS'
      }
    });
  },

  /**
   * Fleet Management: Generate commission report for admin
   * @param {Object} payload { driverId: string | 'all', startDate: string, endDate: string }
   */
  generateCommissionReport: (payload, settings) => {
    try {
      const driverId = payload.driverId || 'all';
      const startDate = payload.startDate ? new Date(payload.startDate) : new Date(0);
      const endDate = payload.endDate ? new Date(payload.endDate) : new Date();
      
      const orders = Utils.getData(Schema.Sheets.ORDERS);
      const filtered = orders.filter(o => {
        const status = Utils.normalizeStatus(o.status);
        if (status !== OrderStatus.COMPLETED && status !== OrderStatus.PAID) return false;
        if (driverId !== 'all' && !Utils.compareIds(o.driver_id, driverId)) return false;
        
        const date = new Date(o.created_at || o.pickup_datetime);
        return date >= startDate && date <= endDate;
      });

      const summary = {
        totalRevenue: 0,
        totalCommission: 0,
        driverProfit: 0,
        rideCount: filtered.length,
        items: filtered.map(o => ({
          id: o.order_id,
          date: Utils.formatDateTime(o.created_at),
          driver: o.driver_name,
          price: Utils.parsePrice(o.price),
          commission: parseFloat(o.commission || 0)
        }))
      };

      summary.items.forEach(i => {
        summary.totalRevenue += i.price;
        summary.totalCommission += i.commission;
      });
      summary.driverProfit = summary.totalRevenue - summary.totalCommission;

      return Utils.json({ ok: true, data: summary });
    } catch (e) {
      Utils.log("ERROR", "generateCommissionReport Failed", e.toString());
      return Utils.error("Failed to generate commission report");
    }
  }
};

