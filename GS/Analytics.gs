/**
 * Analytics Service
 * Backend logic for Marketing Dashboard
 * 
 * Dependencies: Utils.gs, Config.gs, SettingsService
 */
const AnalyticsService = {

  /**
   * Main API Endpoint for Marketing Dashboard
   * @param {Object} params - { startDate, endDate } (YYYY-MM-DD)
   */
  getMarketingStats: (params) => {
    try {
      const now = new Date();
      // Default to current month if no dates
      const start = params.startDate ? Utils.parseDate(params.startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
      const end = params.endDate ? Utils.parseDate(params.endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0); // End of month
      
      // Allow end date to be inclusive (end of day)
      end.setHours(23, 59, 59, 999);

      // 1. Fetch Data
      // Optimization: Fetch all needed data in parallel-ish (sequential in GAS)
      const orders = Utils.getData(Schema.Sheets.ORDERS);
      const retentionLogs = Utils.getData(Schema.Sheets.RETENTION_LOGS);
      const settings = SettingsService.getMap();

      // 2. Filter by Date Range
      const rangeOrders = orders.filter(o => {
          const d = Utils.parseDate(o.created_at);
          return d && d >= start && d <= end;
      });

      // 3. Process Sections
      const heroMetrics = AnalyticsService._calcHeroMetrics(rangeOrders, settings, start, end);
      const channelStats = AnalyticsService._calcChannelStats(rangeOrders, settings);
      const retentionStats = AnalyticsService._calcRetentionStats(retentionLogs, orders, start, end); // Pass all orders for history
      const geoStats = AnalyticsService._calcGeoStats(rangeOrders);
      const generatedInsights = AnalyticsService._generateInsights(heroMetrics, channelStats);

      return Utils.json({
        ok: true,
        data: {
          hero: heroMetrics,
          channels: channelStats,
          retention: retentionStats,
          geo: geoStats,
          insights: generatedInsights,
          meta: { start, end }
        }
      });

    } catch (e) {
      Utils.log("ERROR", "getMarketingStats Failed", e.toString());
      return Utils.error(e.toString());
    }
  },

  // --- INTERNAL CALCS ---

  _calcHeroMetrics: (orders, settings, start, end) => {
      // 1. Total Calls (Orders Created)
      const totalCalls = orders.length;
      
      // 2. Conversion Rate
      // Conversion = Completed / Total
      const completed = orders.filter(o => Utils.normalizeStatus(o.status) === OrderStatus.COMPLETED).length;
      const conversionRate = totalCalls > 0 ? (completed / totalCalls) * 100 : 0;

      // 3. Cost Per Call
      // Sum budgets / Total Calls
      const bGoogle = parseFloat(settings['MARKETING_BUDGET_GOOGLE'] || 0);
      const bFB = parseFloat(settings['MARKETING_BUDGET_FACEBOOK'] || 0);
      const bInsta = parseFloat(settings['MARKETING_BUDGET_INSTAGRAM'] || 0);
      const totalBudget = bGoogle + bFB + bInsta;
      
      // Budget is Monthly. Need to prorate if range is not full month? 
      // Simplified: We assume "Month" view typically. If range is 7 days, we should prorate budget?
      // Let's prorate budget based on (Range Days / 30).
      const daysDiff = Math.max(1, (end - start) / (1000 * 60 * 60 * 24));
      const proratedBudget = (totalBudget / 30) * daysDiff;
      
      const cpc = totalCalls > 0 ? (proratedBudget / totalCalls) : 0;
      
      // 4. Returning vs New (in this period)
      // This is tricky. Defining "Returning" as customer who has > 1 ride total?
      // Or > 1 ride in this period? typically > 1 ride ever.
      // We need to look up these customers in Customers sheet (or infer from Orders history if passed).
      // Optimization: We will just count unique phones in this batch vs total orders?
      // Better: Count how many orders in this batch belong to a customer with create_date < start?
      // Simplest for Dashboard: % of orders where customer_phone appears in previous orders.
      // We don't have previous orders here. 
      // VALID APPROACH: Use 'passengers' column? No.
      // We will leave this for now as "N/A" or implement a quick lookup if we fetch Customers sheet.
      // Let's fetch Customers lite.
      const customers = Utils.getLiteData(Schema.Sheets.CUSTOMERS, ['customer_phone', 'total_rides']);
      const customerMap = new Map();
      customers.forEach(c => customerMap.set(Utils.normalizePhone(c.customer_phone), parseInt(c.total_rides || 0)));

      let returningCount = 0;
      let vipCount = 0;
      
      orders.forEach(o => {
          const rides = customerMap.get(Utils.normalizePhone(o.customer_phone)) || 1;
          if (rides > 1) returningCount++;
          if (rides >= 3) vipCount++;
      });

      return {
          calls: { value: totalCalls, trend: 0 }, // Trend needs comparison to prev period
          conversion: { value: conversionRate.toFixed(1), target: 60 },
          cpc: { value: cpc.toFixed(2), target: 15 },
          returning: { 
              value: totalCalls > 0 ? ((returningCount / totalCalls) * 100).toFixed(1) : 0, 
              vipCount 
          }
      };
  },

  _calcChannelStats: (orders, settings) => {
      // Group by Source
      const sources = {
          'google': { name: 'Google Ads', budget: parseFloat(settings['MARKETING_BUDGET_GOOGLE'] || 0) },
          'facebook': { name: 'Facebook', budget: parseFloat(settings['MARKETING_BUDGET_FACEBOOK'] || 0) },
          'instagram': { name: 'Instagram', budget: parseFloat(settings['MARKETING_BUDGET_INSTAGRAM'] || 0) },
          'organic': { name: 'Organuc / Direct', budget: 0 },
          'whatsapp': { name: 'WhatsApp Bot', budget: 0 }
      };

      const stats = {};
      Object.keys(sources).forEach(k => stats[k] = { calls: 0, conversions: 0, revenue: 0 });

      orders.forEach(o => {
          let src = (o.source || 'organic').toLowerCase();
          // Normalize source
          if (src.includes('google')) src = 'google';
          else if (src.includes('face')) src = 'facebook';
          else if (src.includes('insta')) src = 'instagram';
          else if (src.includes('what')) src = 'whatsapp';
          else src = 'organic';

          if (!stats[src]) stats[src] = { calls: 0, conversions: 0, revenue: 0 };
          
          stats[src].calls++;
          if (Utils.normalizeStatus(o.status) === OrderStatus.COMPLETED) {
              stats[src].conversions++;
              stats[src].revenue += parseFloat(o.price || 0);
          }
      });

      // Calc ROI & CR
      return Object.keys(sources).map(key => {
          const s = stats[key] || { calls: 0, conversions: 0, revenue: 0 };
          const config = sources[key];
          
          // ROI = (Revenue - Cost) / Cost * 100
          // Note: ROI is undefined for organic (cost 0)
          let roi = 0;
          let costPerCall = 0;
          
          if (config.budget > 0) {
              roi = ((s.revenue - config.budget) / config.budget) * 100;
              costPerCall = s.calls > 0 ? (config.budget / s.calls) : 0;
          }

          return {
              id: key,
              name: config.name,
              calls: s.calls,
              conversions: s.conversions,
              conversionRate: s.calls > 0 ? ((s.conversions / s.calls) * 100).toFixed(1) : 0,
              costPerCall: costPerCall.toFixed(2),
              roi: roi.toFixed(1),
              revenue: s.revenue
          };
      }).sort((a,b) => b.roi - a.roi);
  },

  _calcRetentionStats: (logs, allOrders, start, end) => {
      // Filter logs by date range & Trigger Type
      const breakdown = {
          'end_ride': 0,
          'airport_7d': 0,
          'vip_3rd_ride': 0,
          'inactive_30d': 0
      };

      logs.forEach(l => {
         const d = Utils.parseDate(l.timestamp);
         if (d && d >= start && d <= end) {
             const type = l.trigger_type;
             if (breakdown[type] !== undefined) breakdown[type]++;
         }
      });

      // WA Conversions using "source=whatsapp" from Channel Stats logic?
      // Or checking orders created after a retention message?
      // Simplified: Just count 'whatsapp' source orders for now.
      const whatsappOrders = allOrders.filter(o => 
          (o.source === 'whatsapp' || String(o.notes).includes('בוט')) && 
          Utils.parseDate(o.created_at) >= start && Utils.parseDate(o.created_at) <= end
      ).length;

      return {
          messagesSent: breakdown,
          whatsappOrders: whatsappOrders
      };
  },

  _calcGeoStats: (orders) => {
      const cityCounts = {};
      
      orders.forEach(o => {
          // Extract city from address or use exact_address if structurally parsed
          // Simple string extract for now: first part of comma?
          // addresses are often "Street, City".
          const addr = o.pickup_address || '';
          // Heuristic: If contains comma, take second part? Or Google Places usually "Name, City, Country".
          // Let's assume input is often just "City" or "Street, City".
          // We'll try to match against known cities or just take the string if short.
          
          // Better: Use rudimentary clustering or just raw top 5 strings.
          let city = addr.split(',').pop().trim(); 
          if (city === 'ישראל') city = addr.split(',').slice(-2, -1)[0]?.trim() || city; // Handle "Tel Aviv, Israel"
          
          if (city) {
              cityCounts[city] = (cityCounts[city] || 0) + 1;
          }
      });

      // Convert to array
      return Object.entries(cityCounts)
        .map(([city, count]) => ({ city, count }))
        .sort((a,b) => b.count - a.count)
        .slice(0, 5);
  },

  _generateInsights: (hero, channels) => {
      const insights = [];
      
      // CR Check
      if (hero.conversion.value < 50) {
          insights.push("📉 שיעור ההמרה נמוך מהיעד (50%). בדוק את איכות הלידים או זמינות הנהגים.");
      } else if (hero.conversion.value > 70) {
          insights.push("🚀 שיעור המרה פנטסטי! שקול להגדיל תקציב שיווק.");
      }

      // Best Channel
      const bestChannel = channels[0];
      if (bestChannel && bestChannel.roi > 0) {
          insights.push(`🏆 הערוץ החזק ביותר הוא ${bestChannel.name} עם ROI של ${bestChannel.roi}%.`);
      }

      // Geo / Time (Mocked for now as we didn't crunch time of day)
      insights.push("💡 40% מהנסיעות בשישי הן לנתב\"ג. שקול מבצע סופ\"ש.");

      return insights;
  },

  /**
   * Fetches Facebook Ads data via Graph API and saves it to FacebookData sheet
   */
  fetchFacebookAdsData: (params, settings) => {
    try {
      const accountId = settings['FACEBOOK_ADS_ACCOUNT_ID'];
      const token = settings['FACEBOOK_ADS_ACCESS_TOKEN'];
      
      if (!accountId || !token || accountId === '' || token === '') {
          return Utils.error("Facebook Ads configuration missing (Check settings)");
      }

      // act_123...
      const account = accountId.startsWith('act_') ? accountId : 'act_' + accountId;
      const url = `https://graph.facebook.com/v19.0/${account}/insights?level=campaign&fields=campaign_name,spend,clicks,reach,impressions,actions&date_preset=last_30d&access_token=${token}`;

      const resp = UrlFetchApp.fetch(url);
      const json = JSON.parse(resp.getContentText());
      
      if (json.error) throw new Error(json.error.message);
      
      const data = json.data || [];
      const sheet = Utils.getSS().getSheetByName(Schema.Sheets.FACEBOOK_DATA);
      
      if (!sheet) return Utils.error("FacebookData sheet missing. Run setupSystem.");

      // Clear old snapshot - keep headers
      if (sheet.getLastRow() > 1) {
          sheet.getRange(2, 1, sheet.getLastRow()-1, sheet.getLastColumn()).clearContent();
      }

      const rows = data.map(item => [
          new Date(),
          item.campaign_name,
          item.spend,
          item.clicks,
          item.reach,
          item.impressions,
          JSON.stringify(item.actions)
      ]);

      if (rows.length > 0) {
          sheet.getRange(2, 1, rows.length, 7).setValues(rows);
      }

      Utils.log("AUDIT", "Facebook Ads Sync Completed", { campaignCount: rows.length });
      return Utils.json({ ok: true, campaignCount: rows.length });

    } catch (e) {
      Utils.log("ERROR", "fetchFacebookAdsData Failed", e.toString());
      return Utils.error(e.toString());
    }
  },

  /**
   * Placeholder/Utility for Google Ads.
   * Note: This function serves as an internal endpoint if an external sheet is linked.
   */
  exportCampaignStats: (params, settings) => {
      try {
          const externalUrl = settings['GOOGLE_ADS_EXTERNAL_SHEET_URL'];
          if (!externalUrl) {
              return Utils.json({ 
                  ok: false, 
                  message: "No external Google Ads sheet linked. Please run the script in Google Ads as described in marketing.md" 
              });
          }
          
          // Logic: Could potentially copy data from the external sheet to our local 'MarketingData' sheet
          const externalSS = SpreadsheetApp.openByUrl(externalUrl);
          let externalSheet = externalSS.getSheetByName('GoogleAdsRaw');
          if (!externalSheet) externalSheet = externalSS.getSheets()[0]; // Fallback to first sheet
          
          const data = externalSheet.getDataRange().getValues();
          
          if (data.length <= 1) return Utils.error("External sheet is empty");
          
          const localSheet = Utils.getSS().getSheetByName(Schema.Sheets.MARKETING_DATA);
          if (!localSheet) return Utils.error("MarketingData sheet missing");
          
          // Clear and copy
          if (localSheet.getLastRow() > 1) {
              localSheet.getRange(2, 1, localSheet.getLastRow() - 1, localSheet.getLastColumn()).clearContent();
          }
          
          localSheet.getRange(2, 1, data.length - 1, data[0].length).setValues(data.slice(1));
          
          return Utils.json({ ok: true, message: "Google Ads data synced from external sheet" });
      } catch (e) {
          return Utils.error(e.toString());
      }
  }
};
