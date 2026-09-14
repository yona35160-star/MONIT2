/**
 * Stats Service
 * Handles analytics, revenue calculations, and demand heatmaps
 * 
 * Dependencies: Utils.gs, Config.gs
 */

const StatsService = {
  /**
   * Get Revenue Stats over time
   * @param {Object} payload { period: 'day'|'week'|'month' }
   */
  getRevenueStats: (payload, settings) => {
    try {
      const period = payload.period || 'week';
      const allOrders = Utils.getLiteData(Schema.Sheets.ORDERS, ['status', 'price', 'created_at', 'commission', 'driver_profit']);
      
      const now = new Date();
      const startDate = StatsService._getPeriodStart(period, now);
      
      const stats = {
        totalRevenue: 0,
        totalCommission: 0,
        totalProfit: 0,
        rideCount: 0,
        history: {} // Grouped by date string
      };

      Utils.log("DEBUG", "getRevenueStats: processing orders", { 
        count: allOrders.length, 
        period, 
        startDate: startDate.toISOString() 
      });

      allOrders.forEach(o => {
        const orderDate = Utils.parseDate(o.created_at);
        if (!orderDate || isNaN(orderDate.getTime())) return;
        if (orderDate < startDate) return;

        const status = Utils.normalizeStatus(o.status);
        if (status === OrderStatus.COMPLETED || status === OrderStatus.PAID) {
          const price = Utils.parsePrice(o.price);
          const commission = Utils.parsePrice(o.commission);
          const profit = Utils.parsePrice(o.driver_profit);
          
          stats.totalRevenue += price;
          stats.totalCommission += commission;
          stats.totalProfit += profit;
          stats.rideCount++;

          // Grouping for chart
          const dateStr = Utilities.formatDate(orderDate, settings['TIMEZONE'] || "Asia/Jerusalem", "yyyy-MM-dd");
          if (!stats.history[dateStr]) {
            stats.history[dateStr] = { revenue: 0, rides: 0, commission: 0 };
          }
          stats.history[dateStr].revenue += price;
          stats.history[dateStr].rides++;
          stats.history[dateStr].commission += commission;
        }
      });

      // Convert history to sorted array for charts
      const chartData = Object.keys(stats.history).sort().map(date => ({
        date,
        ...stats.history[date]
      }));

      return Utils.json({ ok: true, data: { ...stats, chartData } });
    } catch (e) {
      Utils.log("ERROR", "StatsService.getRevenueStats Failed", e.toString());
      return Utils.error("Failed to calculate revenue stats");
    }
  },

  /**
   * Get Demand Heatmap (City level)
   */
  getDemandHeatmap: (payload, settings) => {
    try {
      const allOrders = Utils.getLiteData(Schema.Sheets.ORDERS, ['pickup_address', 'status', 'created_at']);
      const demandMap = {};
      
      const extractCity = (addr) => {
          if (!addr) return 'Unknown';
          const parts = addr.split(',');
          if (parts.length >= 2) return parts[1].trim(); 
          return parts[0].trim();
      };

      allOrders.forEach(o => {
        const city = extractCity(o.pickup_address);
        if (!demandMap[city]) demandMap[city] = { total: 0, completed: 0 };
        demandMap[city].total++;
        if (Utils.normalizeStatus(o.status) === OrderStatus.COMPLETED) {
          demandMap[city].completed++;
        }
      });

      const heatmap = Object.keys(demandMap).map(city => ({
        city,
        count: demandMap[city].total,
        completed: demandMap[city].completed,
        rate: ((demandMap[city].completed / demandMap[city].total) * 100).toFixed(1) + '%'
      })).sort((a, b) => b.count - a.count);

      // Sync to CityDemand sheet for persistence if needed
      try {
        const sheet = Utils.getSS().getSheetByName(Schema.Sheets.CITY_DEMAND);
        if (sheet) {
           sheet.clearContents();
           sheet.appendRow(Schema.Columns.CityDemand);
           heatmap.slice(0, 20).forEach(h => {
             sheet.appendRow([h.city, h.count, 0, h.rate, Utils.now()]);
           });
        }
      } catch (ee) {}

      return Utils.json({ ok: true, data: heatmap });
    } catch (e) {
      return Utils.error("Failed to generate demand heatmap");
    }
  },

  /**
   * Driver Performance Leaderboard
   */
  getDriverLeaderboard: (payload, settings) => {
    try {
      const allDrivers = Utils.getData(Schema.Sheets.DRIVERS);
      const allOrders = Utils.getLiteData(Schema.Sheets.ORDERS, ['driver_id', 'status', 'price', 'created_at']);
      
      const driverStats = {};
      
      allOrders.forEach(o => {
        const did = String(o.driver_id || '').trim();
        if (!did) return;
        
        if (!driverStats[did]) {
          driverStats[did] = { rides: 0, revenue: 0, lastRide: null };
        }
        
        const status = Utils.normalizeStatus(o.status);
        if (status === OrderStatus.COMPLETED || status === OrderStatus.PAID) {
          driverStats[did].rides++;
          driverStats[did].revenue += Utils.parsePrice(o.price);
          const oDate = Utils.parseDate(o.created_at);
          if (oDate && !isNaN(oDate.getTime())) {
            if (!driverStats[did].lastRide || oDate > driverStats[did].lastRide) {
              driverStats[did].lastRide = oDate;
            }
          }
        }
      });

      const leaderboard = allDrivers
        .filter(d => d.status === DriverStatus.ACTIVE)
        .map(d => {
          const stats = driverStats[d.driver_id] || { rides: 0, revenue: 0, lastRide: null };
          return {
            id: d.driver_id,
            name: d.driver_name,
            phone: d.phone,
            rating: d.average_rating || 5.0,
            rides: stats.rides,
            revenue: stats.revenue,
            lastActive: stats.lastRide ? Utils.formatDateTime(stats.lastRide) : 'Never'
          };
        })
        .sort((a, b) => b.revenue - a.revenue);

      return Utils.json({ ok: true, data: leaderboard });
    } catch (e) {
      return Utils.error("Failed to generate leaderboard");
    }
  },

  _getPeriodStart: (period, now) => {
    const start = new Date(now);
    if (period === 'day') start.setHours(0,0,0,0);
    else if (period === 'week') start.setDate(now.getDate() - 7);
    else if (period === 'month') start.setMonth(now.getMonth() - 1);
    else start.setDate(now.getDate() - 7);
    return start;
  },

  /**
   * Build/Refresh the hidden "Stats" summary sheet with COUNTIF/SUMIF formulas.
   * Called during setupSystem, heartbeat, and whenever aggregates appear broken.
   * This is an O(1) replacement for scanning all orders every time.
   */
  setupFormulas: () => {
    try {
      const ss = Utils.getSS();
      const STATS_SHEET = 'Stats';
      let sheet = ss.getSheetByName(STATS_SHEET);

      if (!sheet) {
        sheet = ss.insertSheet(STATS_SHEET);
        sheet.hideSheet(); // Internal computation sheet - hide from users
      }

      sheet.clearContents();

      // Orders column mapping (1-indexed, matching Schema.Columns.Orders):
      // A=order_id, B=customer_name, C=customer_phone, D=pickup_address,
      // E=destination_address, F=pickup_datetime, G=price, H=status,
      // I=driver_id, J=driver_name, K=driver_phone, L=created_at
      const o = Schema.Sheets.ORDERS; // 'Orders'
      const today = Utilities.formatDate(new Date(), 'Asia/Jerusalem', 'yyyy-MM-dd');

      const rows = [
        ['label',             'value'],
        ['totalOrders',       `=COUNTA(${o}!A2:A)-COUNTBLANK(${o}!A2:A)`],
        ['completedCount',    `=COUNTIF(${o}!H2:H,"completed")+COUNTIF(${o}!H2:H,"paid")`],
        ['cancelledCount',    `=COUNTIF(${o}!H2:H,"cancelled")`],
        ['pending',           `=COUNTIF(${o}!H2:H,"pending")+COUNTIF(${o}!H2:H,"broadcasted")`],
        ['activeCount',       `=COUNTIF(${o}!H2:H,"assigned")+COUNTIF(${o}!H2:H,"arrived")+COUNTIF(${o}!H2:H,"in_progress")+COUNTIF(${o}!H2:H,"on_route")`],
        ['waitingApproval',   `=COUNTIF(${o}!H2:H,"waiting_approval")`],
        ['paid',              `=COUNTIF(${o}!H2:H,"paid")`],
        ['totalRevenue',      `=SUMPRODUCT(IFERROR(VALUE(REGEXREPLACE(TO_TEXT(${o}!G2:G), "[^0-9.]", "")), 0) * ((${o}!H2:H="completed")+(${o}!H2:H="paid")))`],
        ['ordersToday',       `=COUNTIFS(${o}!H2:H,"<>cancelled",${o}!L2:L,">=${today}")`],
        ['revenueToday',      `=SUMPRODUCT(IFERROR(VALUE(REGEXREPLACE(TO_TEXT(${o}!G2:G), "[^0-9.]", "")), 0) * ((${o}!H2:H="completed")+(${o}!H2:H="paid")) * (${o}!L2:L>=DATEVALUE("${today}")))`],
        ['averagePickupTime', `=IFERROR(AVERAGE(ARRAYFORMULA(IF((${o}!O2:O<>"")*(${o}!N2:N<>""), (${o}!O2:O-${o}!N2:N)*24*60, ""))), 0)`],
      ];

      sheet.getRange(1, 1, rows.length, 2).setValues(rows);
      sheet.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#e8f0fe');
      sheet.setFrozenRows(1);
      sheet.autoResizeColumns(1, 2);

      Utils.log('INFO', 'StatsService.setupFormulas', `Stats sheet rebuilt with ${rows.length - 1} metrics`);
      return { ok: true, rows: rows.length - 1 };
    } catch (e) {
      Utils.log('ERROR', 'StatsService.setupFormulas failed', e.toString());
      return { ok: false, error: e.toString() };
    }
  },

  /**
   * Read aggregate stats from the Stats sheet.
   * Returns a plain object used by DashboardService.syncStats().
   * Auto-rebuilds the Stats sheet if it's missing or empty.
   */
  getAggregates: () => {
    try {
      const ss = Utils.getSS();
      let sheet = ss.getSheetByName('Stats');

      // Rebuild if missing or has no data rows
      if (!sheet || sheet.getLastRow() < 2) {
        StatsService.setupFormulas();
        sheet = ss.getSheetByName('Stats');
      }

      if (!sheet || sheet.getLastRow() < 2) {
        // Final fallback: compute directly from Orders
        return StatsService._aggregateFromOrders();
      }

      // Read label → value pairs (skip header row)
      const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
      const result = {};
      data.forEach(row => {
        const key = String(row[0] || '').trim();
        if (key) result[key] = (typeof row[1] === 'number') ? row[1] : (parseFloat(row[1]) || 0);
      });

      return result;
    } catch (e) {
      Utils.log('ERROR', 'StatsService.getAggregates failed', e.toString());
      return StatsService._aggregateFromOrders();
    }
  },

  /**
   * Direct O(n) fallback: compute aggregates by scanning Orders.
   * Used only when the Stats sheet is unavailable (e.g. first run).
   */
  _aggregateFromOrders: () => {
    try {
      const orders = Utils.getLiteData(Schema.Sheets.ORDERS, ['status', 'price', 'created_at']);
      const todayStr = Utilities.formatDate(new Date(), 'Asia/Jerusalem', 'yyyy-MM-dd');
      const agg = {
        totalOrders: 0, completedCount: 0, cancelledCount: 0,
        pending: 0, activeCount: 0, waitingApproval: 0, paid: 0,
        totalRevenue: 0, ordersToday: 0, revenueToday: 0, averagePickupTime: 0
      };

      orders.forEach(o => {
        const s = Utils.normalizeStatus(o.status);
        agg.totalOrders++;

        const orderDateStr = o.created_at
          ? Utilities.formatDate(Utils.parseDate(o.created_at) || new Date(0), 'Asia/Jerusalem', 'yyyy-MM-dd')
          : '';
        const isToday = orderDateStr === todayStr;

        if (s === OrderStatus.COMPLETED) {
          agg.completedCount++;
          const price = Utils.parsePrice(o.price);
          agg.totalRevenue += price;
          if (isToday) { agg.ordersToday++; agg.revenueToday += price; }
        } else if (s === OrderStatus.PAID) {
          agg.completedCount++;
          agg.paid++;
          const price = Utils.parsePrice(o.price);
          agg.totalRevenue += price;
          if (isToday) { agg.ordersToday++; agg.revenueToday += price; }
        } else if (s === OrderStatus.CANCELLED) {
          agg.cancelledCount++;
        } else if (s === OrderStatus.PENDING || s === OrderStatus.BROADCASTED) {
          agg.pending++;
          if (isToday) agg.ordersToday++;
        } else if (s === OrderStatus.WAITING_APPROVAL) {
          agg.waitingApproval++;
          if (isToday) agg.ordersToday++;
        } else {
          // assigned, arrived, in_progress, on_route
          agg.activeCount++;
          if (isToday) agg.ordersToday++;
        }
      });

      return agg;
    } catch (e) {
      Utils.log('ERROR', 'StatsService._aggregateFromOrders failed', e.toString());
      return {
        totalOrders: 0, completedCount: 0, cancelledCount: 0,
        pending: 0, activeCount: 0, waitingApproval: 0, paid: 0,
        totalRevenue: 0, ordersToday: 0, revenueToday: 0, averagePickupTime: 0
      };
    }
  }
};
