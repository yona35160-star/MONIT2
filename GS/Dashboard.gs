/**
 * Dashboard Service
 * Analytics, statistics, map data for admin dashboard
 * 
 * Dependencies: Utils.gs, Config.gs, Firebase.gs
 */
const DashboardService = {
  getStats: (params) => {
    const force = params && params.force === true;
    const cache = CacheService.getScriptCache();
    const cacheKey = "dashboard_stats_v302"; 
    
    if (!force) {
        const cached = cache.get(cacheKey);
        if (cached) return Utils.json({ ok: true, data: JSON.parse(cached), cached: true });
    }

    // Try Incremental Stats first
    let stats = Utils.getStoredStats();
    
    // Fallback to full sync if no counters exist or forced
    if (!stats || force) {
        stats = DashboardService.syncStats();
    }

    cache.put(cacheKey, JSON.stringify(stats), CONSTANTS.CACHE_TTL_DASHBOARD); 
    return Utils.json({ ok: true, data: stats });
  },

  /**
   * Bundle API for fast dashboard loading
   */
  getBundle: (limit = 30) => {
      const stats = DashboardService.syncStats(); // Always get fresh stats for bundle
      const orders = Utils.getData('Orders', false, limit);
      // [FIX] Use DriverService.getAll() to ensure stats (totalRides, totalRevenue) are calculated
      const driversRes = JSON.parse(DriverService.getAll({ limit: 1000 }).getContent());
      const drivers = driversRes.ok ? driversRes.data.items : [];
      const settings = SettingsService.getAll({ force: true }).data; 

      return Utils.json({
          ok: true,
          data: {
              stats,
              orders,
              drivers,
              settings,
              fetchedAt: Utils.now()
          }
      });
  },

  /**
   * Full Recalculation with Rollup Support
   */
  syncStats: () => {
    // 1. Fetch Aggregates from Formula Sheet (Fastest for current totals)
    let aggregates = StatsService.getAggregates();
    
    const hasData = Utils.getSS().getSheetByName(Schema.Sheets.ORDERS).getLastRow() > 1;
    const hasCompleted = (aggregates.completedCount || 0) > 0;
    const seemsBroken = !aggregates || (hasData && (aggregates.totalOrders === 0 || (hasCompleted && aggregates.totalRevenue === 0)));
    
    if (seemsBroken) {
        Utils.log("WARN", "Stats seem broken or empty. Forcing formula repair.", { aggregates });
        StatsService.setupFormulas();
        aggregates = StatsService.getAggregates();
    }

    // 2. Fetch Recent Data
    const drivers = Utils.getData('Drivers');
    const settings = SettingsService.getMap();
    const commPct = (settings['STATION_COMMISSION_PCT'] !== undefined) ? parseFloat(settings['STATION_COMMISSION_PCT']) : CONSTANTS.COMMISSION_PCT;
    
    // 3. Construct Trends using Rollup (New Performance Optimization)
    // Try to get historical trends from DailyStats sheet first
    let historicalTrends = [];
    try {
        const dailySheet = Utils.getSS().getSheetByName('DailyStats');
        if (dailySheet && dailySheet.getLastRow() > 1) {
            const data = dailySheet.getRange(2, 1, Math.min(dailySheet.getLastRow() - 1, 30), 4).getValues();
            historicalTrends = data.map(row => {
                const dateObj = row[0] instanceof Date ? row[0] : new Date(row[0]);
                const iso = Utilities.formatDate(dateObj, "Asia/Jerusalem", "yyyy-MM-dd");
                return {
                    rawDate: iso,
                    date: Utilities.formatDate(dateObj, "Asia/Jerusalem", "dd/MM"),
                    count: Number(row[1]) || 0,
                    revenue: Number(row[2]) || 0,
                    commission: Number(row[3]) || 0
                };
            });
        }
    } catch (e) {
        Utils.log("WARN", "Failed to read historical trends", e.toString());
    }

    // Capture recent orders NOT yet rolled up (e.g. from last 2 hours)
    const recentOrders = Utils.getData('Orders', false, 200);
    const trends = DashboardService.generateDailyStatsFromRecent(recentOrders, commPct, historicalTrends);
    
    const last7 = trends.slice(-7);
    const last30 = trends;
    const sum = (arr, key) => arr.reduce((a, b) => a + (Number(b[key]) || 0), 0);

    const activeDriverStatuses = ['active', 'working', 'online', 'פעיל', 'מחובר'];
    const activeDriversCount = drivers.filter(d => activeDriverStatuses.includes(String(d.status || '').toLowerCase().trim())).length;

    const revToday = aggregates.revenueToday || 0;
    const totalRevAllTime = aggregates.totalRevenue || 0;

    let stats = {
      ordersToday: aggregates.ordersToday || 0,
      ordersWeekly: sum(last7, 'count'),
      ordersMonthly: sum(last30, 'count'),
      
      completedCount: aggregates.completedCount || 0,
      cancelledCount: aggregates.cancelledCount || 0,
      pendingCount: aggregates.pending || 0, 
      activeCount: (aggregates.activeCount || 0) + (aggregates.waitingApproval || 0) + (aggregates.paid || 0), 
      activeDriversCount: activeDriversCount,
      
      revenueToday: revToday,
      revenueWeekly: sum(last7, 'revenue'),
      revenueMonthly: sum(last30, 'revenue'),
      totalRevenue: revToday || totalRevAllTime,
      totalRevenueAllTime: totalRevAllTime,
      
      commissionPct: commPct,
      commissionToday: revToday * (commPct / 100),
      commissionWeekly: sum(last7, 'commission'),
      commissionMonthly: sum(last30, 'commission'),
      stationCommission: (revToday || totalRevAllTime) * (commPct / 100),
      
      averagePickupTime: aggregates.averagePickupTime || 0,
      revenueByStatus: { 
          completed: totalRevAllTime, 
          pending: 0, 
          cancelled: 0,
          waiting_approval: 0
      },
      dailyStats: trends,
      lastSync: Utils.now()
    };
    
    Utils.saveStoredStats(stats);

    // [FIREBASE SYNC] Push aggregated stats to Firebase for real-time dashboard updates
    try {
      if (Firebase.isEnabled()) {
        Firebase.set('system/stats', {
          ...stats,
          _updated_at: Date.now()
        });
      }
    } catch(e) {
      console.error('Failed to sync stats to Firebase:', e);
    }

    return stats;
  },

  /**
   * Helper to generate graph data from whatever recent orders we have, 
   * merged with historical trends rollup.
   */
  generateDailyStatsFromRecent: (orders, commPct = 15, historicalTrends = []) => {
      const trendsMap = {};
      const today = new Date();
      
      // 1. Initialize from historical trends
      historicalTrends.forEach(t => {
          trendsMap[t.rawDate] = t;
      });

      // 2. Ensure at least 30 days exist in the map
      for (let i = 0; i < 30; i++) {
          const d = new Date();
          d.setDate(today.getDate() - i);
          const isoKey = Utilities.formatDate(d, "Asia/Jerusalem", "yyyy-MM-dd");
          
          if (!trendsMap[isoKey]) {
              trendsMap[isoKey] = { 
                date: Utilities.formatDate(d, "Asia/Jerusalem", "dd/MM"), 
                count: 0, 
                revenue: 0, 
                commission: 0, 
                rawDate: isoKey 
              };
          }
      }

      // 3. Update with data from recent orders (potentially overwriting historical if overlapping)
      // This ensures that if historical data is slightly stale (e.g. from 2am), current orders fill the gap.
      orders.forEach(o => {
          if (!o.created_at) return;
          
          let dateObj = Utils.parseDate(o.created_at);
          if (dateObj) {
               const iso = Utilities.formatDate(dateObj, "Asia/Jerusalem", "yyyy-MM-dd");
               
               if (trendsMap[iso]) {
                   // Optimization: If this is purely "recent" orders, we might be double-counting 
                   // if historical also has them. To be safe, we only "update" the current and previous day 
                   // from scratch using full orders, OR we subtract what was already there.
                   // BETTER: For today and yesterday, we always calculate from scratch using the recent orders.
                   const rowTime = dateObj.getTime();
                   const now = new Date().getTime();
                   const hoursDiff = (now - rowTime) / (1000 * 3600);
                   
                   if (hoursDiff < 48) {
                        // Reset if not already reset for this specific run
                        if (!trendsMap[iso].resetInRun) {
                            trendsMap[iso].count = 0;
                            trendsMap[iso].revenue = 0;
                            trendsMap[iso].commission = 0;
                            trendsMap[iso].resetInRun = true;
                        }
                        
                        trendsMap[iso].count++;
                        if (Utils.normalizeStatus(o.status) === OrderStatus.COMPLETED || Utils.normalizeStatus(o.status) === OrderStatus.PAID) {
                            const price = Utils.parsePrice(o.price);
                            trendsMap[iso].revenue += price;
                            trendsMap[iso].commission += price * (commPct / 100);
                        }
                   }
               }
          }
      });

      // Sort by date (oldest to newest)
      return Object.values(trendsMap)
        .sort((a, b) => String(a.rawDate || '').localeCompare(String(b.rawDate || '')))
        .map(t => { delete t.resetInRun; return t; });
  },

  /**
   * Update Stats Incrementally without rescan
   * (Now less critical since syncStats is O(1) via formulas, but good for cache bursts)
   */
  updateStatsIncremental: (updates) => {
    let stats = Utils.getStoredStats();
    if (!stats) return DashboardService.syncStats();

    // Simple delta logic
    Object.keys(updates).forEach(key => {
        if (typeof stats[key] === 'number') {
            stats[key] += updates[key];
        }
    });

    Utils.saveStoredStats(stats);
    Utils.clearCache('Orders');
    return stats;
  },
  
  submitRating: (payload) => {
    const sheet = Utils.getSS().getSheetByName('Ratings');
    const rowData = [
      `RAT-${new Date().getTime()}`,
      payload.order_id,
      payload.driver_id || '',
      payload.rating,
      payload.comment || '',
      Utils.now()
    ];
    if (!Utils.appendRowWithRetry(sheet, rowData)) {
      return Utils.error('שגיאה בכתיבה ל-DB, נסה שוב.');
    }
    return Utils.json({ ok: true });
  },

  // Return map-friendly orders and drivers for the dashboard (recent and with coords)
  // [HYBRID] Prioritizes Firebase for real-time data, falls back to Sheets
  getMapData: () => {
    try {
      let mapOrders = [];
      let mapDrivers = [];
      let source = 'firebase';

      // 1. Try Firebase First (Real-time)
      if (Firebase.isEnabled()) {
          const fbOrders = Firebase.get('active_orders');
          const fbDrivers = Firebase.get('drivers');

          if (fbOrders.ok && fbOrders.data) {
              const now = new Date();
              const CUTOFF_MS = 20 * 60 * 1000;
              
              mapOrders = Object.keys(fbOrders.data).map(id => ({
                  order_id: id,
                  ...fbOrders.data[id]
              })).filter(o => {
                  const status = Utils.normalizeStatus(o.status);
                  if (status === OrderStatus.CANCELLED) return false;
                  if (status === OrderStatus.COMPLETED) {
                      const updated = Utils.parseDate(o.updated_at || o.created_at);
                      return updated && (now.getTime() - updated.getTime() < CUTOFF_MS);
                  }
                  return true;
              });
          }

          if (fbDrivers.ok && fbDrivers.data) {
              mapDrivers = Object.keys(fbDrivers.data).map(id => {
                  const d = fbDrivers.data[id];
                  return {
                      driver_id: id,
                      driver_name: d.location?.driver_name || d.name || id,
                      lat: d.location?.lat,
                      lng: d.location?.lng,
                      lastUpdate: d.location?.updated_at,
                      car_model: d.car_model,
                      car_color: d.car_color,
                      total_rides: d.total_rides,
                      total_revenue: d.total_revenue,
                      consent_date: d.consent_date,
                      telegram_username: d.telegram_username,
                      updated_at: d.updated_at,
                      average_rating: d.average_rating,
                      total_ratings: d.total_ratings,
                      session_secret: d.session_secret
                  };
              }).filter(d => d.lat && d.lng);
          }
      }

      // 2. Fallback to Sheets if Firebase is empty/failed OR for broad history
      if (mapOrders.length === 0 || mapDrivers.length === 0) {
          source = 'sheets';
          const allOrders = Utils.getData('Orders', false, 500); // last 500
          const allDrivers = Utils.getData('Drivers');
          const now = new Date();
          const CUTOFF_MS = 20 * 60 * 1000; // 20 minutes (User request)

          if (mapOrders.length === 0) {
              mapOrders = allOrders.filter(o => {
                  const status = Utils.normalizeStatus(o.status);
                  if (status === OrderStatus.CANCELLED) return false;
                  if (status === OrderStatus.COMPLETED) {
                      const updated = Utils.parseDate(o.updated_at || o.created_at);
                      return updated && (now.getTime() - updated.getTime() < CUTOFF_MS);
                  }
                  return true; // Keep all non-final orders
              });
          }

          if (mapDrivers.length === 0) {
              mapDrivers = allDrivers
                  .filter(d => String(d.status || '').toLowerCase() === 'active' && d.lat && d.lng)
                  .map(d => ({
                      driver_id: d.driver_id,
                      driver_name: d.driver_name,
                      lat: d.lat,
                      lng: d.lng,
                      lastUpdate: d.updated_at
                  }));
          }
      }

      return Utils.json({ 
          ok: true, 
          source,
          data: { 
              orders: mapOrders, 
              drivers: mapDrivers,
              serverTime: new Date().getTime()
          } 
      });
    } catch (e) {
      Utils.log('ERROR', 'getMapData failed', e.toString());
      return Utils.error('getMapData failed: ' + e.toString());
    }
  },

  /**
   * Build/refresh CityDemand sheet: aggregates number of orders per city
   * based on pickup_address in Orders sheet. Keeps existing lat/lng if available.
   */
  rebuildCityDemand: () => {
    try {
      const ss = Utils.getSS();
      let sheet = ss.getSheetByName('CityDemand');

      // Ensure sheet and headers exist
      if (!sheet) {
        sheet = ss.insertSheet('CityDemand');
        sheet.appendRow(['city', 'lat', 'lng', 'total_orders']);
        sheet.getRange(1, 1, 1, 4)
          .setFontWeight('bold')
          .setBackground('#f3f3f3')
          .setBorder(true, true, true, true, true, true);
        sheet.setFrozenRows(1);
      } else if (sheet.getLastRow() === 0) {
        sheet.appendRow(['city', 'lat', 'lng', 'total_orders']);
        sheet.getRange(1, 1, 1, 4)
          .setFontWeight('bold')
          .setBackground('#f3f3f3')
          .setBorder(true, true, true, true, true, true);
        sheet.setFrozenRows(1);
      }

      // Read existing lat/lng per city (if any) so we don't lose manual tuning
      const existingCoords = {};
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const existingData = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
        existingData.forEach(row => {
          const cityName = String(row[0] || '').trim();
          if (!cityName) return;
          existingCoords[cityName] = {
            lat: row[1],
            lng: row[2]
          };
        });
      }

      // Aggregate counts from Orders sheet
      const orders = Utils.getData('Orders', false, 5000);
      const cityCounts = {};

      const extractCity = (addr) => {
        if (!addr) return '';
        const text = String(addr);
        const parts = text.split(',');
        if (parts.length >= 2) return parts[1].trim();
        return parts[0].trim();
      };

      orders.forEach(o => {
        const pickup = o.pickup_address || o.pickupAddress || '';
        const city = extractCity(pickup);
        if (!city) return;
        if (!cityCounts[city]) cityCounts[city] = 0;
        cityCounts[city]++;
      });

      // Clear old data (keep header)
      if (sheet.getLastRow() > 1) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).clearContent();
      }

      const cities = Object.keys(cityCounts).sort();
      if (cities.length > 0) {
        const rows = cities.map(city => {
          const coords = existingCoords[city] || {};
          return [
            city,
            coords.lat || '',
            coords.lng || '',
            cityCounts[city]
          ];
        });
        sheet.getRange(2, 1, rows.length, 4).setValues(rows);
      }

      return Utils.json({
        ok: true,
        cities: cities.length
      });
    } catch (e) {
      Utils.log('ERROR', 'rebuildCityDemand failed', e.toString());
      return Utils.error('rebuildCityDemand failed: ' + e.toString());
    }
  },

  /**
   * Heatmap Data for demand analysis
   * Returns pickup coordinates for heatmap.
   * Priority:
   * 1) If sheet "CityDemand" exists with city-level summary (city, lat, lng, total_orders)
   *    - use its rows so that hotspots are based on number of orders per city.
   * 2) Otherwise, fallback to using raw pickup coordinates from Orders sheet.
   */
  getHeatmapData: () => {
    try {
      const ss = Utils.getSS();
      const citySheet = ss.getSheetByName('CityDemand');

      // 1) Prefer pre-aggregated CityDemand sheet if it exists
      if (citySheet && citySheet.getLastRow() > 1) {
        const data = citySheet.getRange(2, 1, citySheet.getLastRow() - 1, 4).getValues();
        const pointsFromSheet = data
          .filter(row => row[0] && row[1] && row[2]) // city, lat, lng
          .map(row => [
            Number(row[1]), // lat
            Number(row[2]), // lng
            row[3] ? Number(row[3]) : 1 // intensity = total_orders (fallback 1)
          ]);

        return Utils.json({
          ok: true,
          data: pointsFromSheet,
          count: pointsFromSheet.length,
          source: 'CityDemand'
        });
      }

      // 2) Fallback: use raw pickup coordinates from Orders sheet (backwards compatible)
      const orders = Utils.getData('Orders', false, 1000); // Fetch more for better density
      const pointsFromOrders = orders
        .map(o => {
          // Support multiple possible column names for coordinates
          const lat = o.pickup_lat || o.pickupLat || o.pickup_latitude || o.pickupLatitude;
          const lng = o.pickup_lng || o.pickupLng || o.pickup_longitude || o.pickupLongitude;
          if (!lat || !lng) return null;
          return [
            Number(lat),
            Number(lng),
            1 // Default intensity per order
          ];
        })
        .filter(p => p !== null);

      return Utils.json({
        ok: true,
        data: pointsFromOrders,
        count: pointsFromOrders.length,
        source: 'Orders'
      });
    } catch (e) {
      Utils.log('ERROR', 'getHeatmapData failed', e.toString());
      return Utils.error('getHeatmapData failed: ' + e.toString());
    }
  }
};
