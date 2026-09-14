import { Button } from '../components/ui';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import {
  setOrdersLoading,
  setOrdersError,
  setActiveOrders,
  setHistoricalOrders,
  updateActiveOrder
} from '../store/slices/ordersSlice';
import {
  setActiveDrivers,
  setDriversLoading,
  setDriversError
} from '../store/slices/driversReducer';
import { setStatsData, setStatsLoading } from '../store/slices/statsSlice';
import { setSettingsData } from '../store/slices/settingsSlice';
import {
  Plus, RefreshCw, CheckCircle, Clock,
  DollarSign, Calendar, XCircle, Zap, UserX, UserPlus, ShieldCheck, Clipboard as ClipboardIcon, Car, MapPin, ChevronDown,
  LucideIcon, Timer, Sparkles, ArrowLeftRight, TrendingUp
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getOrders,
  getDashboardStats,
  getSystemSettings,
  getDashboardBundle,
  getHeatmapData,
  compareIds,
  toCamelCase,
} from '../api/adminApi';
import { Order, Driver, DashboardStats, SystemSettings } from '../types';

// Properly imported components (formerly lazy)
import { StatsCards } from '../components/StatsCards';
import { SystemHealth } from '../components/SystemHealth';
import { DashboardHeader } from '../components/DashboardHeader';
import { WhatsAppConnect } from '../components/WhatsAppConnect';
import { OrdersTable } from '../components/OrdersTable';
import { DriversTable } from '../components/DriversTable';
import { Toast } from '../components/Toast';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { AdminAnalytics } from './AdminAnalytics';

// Modals and heavy Map remain lazy to reduce initial chunk size
const LiveMap = React.lazy(() => import('../components/LiveMap').then(m => ({ default: m.LiveMap })));
const CreateOrderModal = React.lazy(() => import('../components/CreateOrderModal').then(m => ({ default: m.CreateOrderModal })));
const OrderDetailsModal = React.lazy(() => import('../components/OrderDetailsModal').then(m => ({ default: m.OrderDetailsModal })));


import { createDeferredCleanup, createLatestThrottler } from '../utils/perf';

const TabButton: React.FC<{ active: boolean; onClick: () => void; label: string; icon: LucideIcon }> = ({ active, onClick, label, icon: Icon }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 py-3 px-6 rounded-2xl font-black text-sm transition-all duration-300 ${active
      ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20 translate-y-[-2px]'
      : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
      }`}
  >
    <Icon size={18} className={active ? 'animate-pulse' : ''} />
    {label}
  </button>
);

export const AdminDashboard: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Redux State
  const orders = useSelector((state: any) => state.orders.activeOrders as Order[]);
  const stats = useSelector((state: any) => state.stats.data as DashboardStats);
  const drivers = useSelector((state: any) => state.drivers.activeDrivers as Driver[]);
  const settings = useSelector((state: any) => state.settings.data as SystemSettings);
  const isLoading = useSelector((state: any) => (
    state.orders.isLoading || state.drivers.isLoading || state.stats.isLoading
  ));

  // Keep latest orders in ref for realtime listeners (avoid stale closure issues)
  const ordersRef = useRef<Order[]>([]);
  useEffect(() => {
    ordersRef.current = orders || [];
  }, [orders]);

  // Local UI State (Remaining)
  const lastFetchTimestamp = useRef<string | undefined>(undefined);
  const [isCreateOrderModalOpen, setIsCreateOrderModalOpen] = useState(false);
  const [mapData, setMapData] = useState<{ orders: Order[], drivers: Driver[] }>({ orders: [], drivers: [] });

  const [activeTab, setActiveTab] = useState<'orders' | 'drivers' | 'map' | 'heatmap' | 'scheduled' | 'analytics'>('orders');
  const [heatmapData, setHeatmapData] = useState<number[][]>([]);
  const [isFetchingHeatmap, setIsFetchingHeatmap] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState<string | null>(null);
  const [messageStatuses, setMessageStatuses] = useState<Record<string, Record<string, any>>>({});
  const [bridgeStatus, setBridgeStatus] = useState<{ online: boolean; last_heartbeat?: string }>({ online: false });

  const [expiryAlerts, setExpiryAlerts] = useState<any[]>([]);
  const [passengerLocations, setPassengerLocations] = useState<Record<string, any>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  // AI State
  const [aiCommand, setAiCommand] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiBriefing, setAiBriefing] = useState<string | null>(null);
  const [isAiBriefingLoading, setIsAiBriefingLoading] = useState(false);

  // Smart Assign Modal State
  const [smartAssignOrderId, setSmartAssignOrderId] = useState<string | null>(null);
  const [smartAssignLoading, setSmartAssignLoading] = useState(false);

  // Modal Selection
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Period Selector State
  const [statsPeriod, setStatsPeriod] = useState<'today' | 'weekly' | 'monthly'>('today');

  // Daily report modal state
  const [isDailyReportModalOpen, setIsDailyReportModalOpen] = useState(false);
  const [isDailyReportLoading, setIsDailyReportLoading] = useState(false);

  const handleDownloadReport = async (driverId: string) => {
    setIsGeneratingReport(driverId);
    const now = new Date();
    const { generateMonthlyReport } = await import('../api/adminApi');
    const res = await generateMonthlyReport({ driverId, month: now.getMonth() + 1, year: now.getFullYear() });
    if (res.ok && res.data) {
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${res.data.pdfBase64}`;
      link.download = res.data.fileName;
      link.click();
    } else {
      alert('שגיאה בהפקת הדו"ח: ' + res.error);
    }
    setIsGeneratingReport(null);
  };

  const handleDailyReport = () => {
    setIsDailyReportModalOpen(true);
  };

  const confirmDailyReport = async () => {
    setIsDailyReportLoading(true);
    try {
      const { getDailyReport } = await import('../api/adminApi');
      const res = await getDailyReport();
      if (res.ok && res.data) {
        setToast({
          message: `דוח יומי (${res.data.date}) — סה"כ הזמנות: ${res.data.orders_count}, סה"כ עמלות: ${res.data.total_commission} ${res.data.currency}`,
          type: 'info'
        });
      } else {
        setToast({
          message: 'שגיאה בהפקת הדו"ח: ' + (res.error || 'נסה שוב'),
          type: 'error'
        });
      }
    } catch (e: any) {
      setToast({
        message: 'שגיאה בהפקת הדו"ח: ' + (e?.message || 'נסה שוב'),
        type: 'error'
      });
    } finally {
      setIsDailyReportLoading(false);
      setIsDailyReportModalOpen(false);
    }
  };

  // --- Computed: Future rides scheduled >20 minutes from now ---
  const futureRides = React.useMemo(() => {
    if (!orders) return [];
    const now = Date.now();
    const TWENTY_MIN_MS = 20 * 60 * 1000;

    return orders.filter(o => {
      if (o.status === 'completed' || o.status === 'cancelled') return false;
      const pickup = o.pickupDatetime ? new Date(o.pickupDatetime).getTime() : 0;
      return pickup > 0 && (pickup - now) > TWENTY_MIN_MS;
    }).sort((a, b) => {
      const aTime = a.pickupDatetime ? new Date(a.pickupDatetime).getTime() : 0;
      const bTime = b.pickupDatetime ? new Date(b.pickupDatetime).getTime() : 0;
      return aTime - bTime; // nearest first
    });
  }, [orders]);

  const handleSmartAssign = async (orderId: string) => {
    if (smartAssignLoading) return; // Prevent double-clicks
    setSmartAssignOrderId(orderId);
    setSmartAssignLoading(true);

    const order = orders.find(o => String(o.orderId).trim().replace(/^TAXI-/, '').toLowerCase() === String(orderId).trim().replace(/^TAXI-/, '').toLowerCase());
    if (!order) {
      setToast({ message: 'הזמנה לא נמצאה', type: 'error' });
      setSmartAssignOrderId(null);
      setSmartAssignLoading(false);
      return;
    }

    // Filter available drivers
    const availableDrivers = (drivers || []).filter(d => d.isOnline && d.lat && d.lng);

    if (availableDrivers.length === 0) {
      setToast({ message: 'אין נהגים זמינים כרגע', type: 'warning' });
      setSmartAssignOrderId(null);
      setSmartAssignLoading(false);
      return;
    }

    // Calculate distance (Haversine approximation)
    const pickupLat = order.pickupLat || 0;
    const pickupLng = order.pickupLng || 0;

    const toRad = (deg: number) => deg * Math.PI / 180;
    const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const R = 6371;
      const dLat = toRad(lat2 - lat1);
      const dLng = toRad(lng2 - lng1);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    // Attach distances for AI, and keep fallback mechanism
    let bestFallbackDriver: Driver | null = null;
    let fallbackDist = Infinity;

    const driversWithContext = availableDrivers.map(d => {
       const dist = (pickupLat && pickupLng) ? haversine(pickupLat, pickupLng, d.lat!, d.lng!) : 0;
       if (pickupLat && pickupLng && dist < fallbackDist) {
         fallbackDist = dist;
         bestFallbackDriver = d;
       }
       return { ...d, distance: dist };
    });

    if (!bestFallbackDriver) {
        bestFallbackDriver = availableDrivers[0];
        fallbackDist = 0;
    }

    let finalDriverPhone = bestFallbackDriver.phone;
    let finalDriverName = bestFallbackDriver.driverName;
    let assignmentReason = `שיוך מבוסס מרחק (${fallbackDist.toFixed(1)} ק"מ)`;

    // AI Attempt
    try {
        const { aiRecommendDriver } = await import('../services/aiService');
        const aiRec = await aiRecommendDriver(order, driversWithContext);
        if (aiRec && aiRec.driverPhone) {
            const chosen = availableDrivers.find(d => String(d.phone) === String(aiRec.driverPhone));
            if (chosen) {
                finalDriverPhone = chosen.phone;
                finalDriverName = chosen.driverName;
                assignmentReason = `AI: ${aiRec.reason}`;
            }
        }
    } catch (err: any) {
        console.log("AI smart assign skipped/failed: ", err);
    }

    try {
      const { assignDriver } = await import('../api/adminApi');
      const res = await assignDriver({ orderId, phone: finalDriverPhone, driverName: finalDriverName });
      if (res.ok) {
        setToast({ message: `שובץ ${finalDriverName} 🎯 | ${assignmentReason}`, type: 'success' });
        fetchData(false);
      } else {
        setToast({ message: 'שגיאה: ' + (res.error || 'לא ניתן לשבץ'), type: 'error' });
      }
    } catch (e: any) {
      setToast({ message: 'שגיאה בשיבוץ', type: 'error' });
    }
    
    setSmartAssignOrderId(null);
    setSmartAssignLoading(false);
  };

  const fetchData = useCallback(async (isInitial = true) => {
    if (isInitial) {
      dispatch(setOrdersLoading(true));
      dispatch(setStatsLoading(true));
      dispatch(setDriversLoading(true));
    }

    try {
      // Limit bundle fetch to 50 and specify 'active' explicitly to reduce GAS response payload
      const bundleRes = await getDashboardBundle(50, 'active');
      if (bundleRes.ok && bundleRes.data) {
        const { orders: apiOrders, stats: apiStats, drivers: apiDrivers, settings: apiSettings } = bundleRes.data;
        if (apiOrders) dispatch(setActiveOrders(apiOrders));
        if (apiStats) dispatch(setStatsData(apiStats));
        if (apiDrivers) {
          const sorted = [...apiDrivers].sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0));
          dispatch(setActiveDrivers(sorted));
        }
        if (apiSettings) dispatch(setSettingsData(apiSettings));
      }
    } catch (e) {
      console.error("Fetch Error", e);
    } finally {
      if (isInitial) {
        dispatch(setOrdersLoading(false));
        dispatch(setStatsLoading(false));
        dispatch(setDriversLoading(false));
      }
      try {
        const { getMapData, checkDocumentExpiry } = await import('../api/adminApi');
        getMapData().then(mapRes => {
          if (mapRes.ok && mapRes.data) setMapData(mapRes.data);
        }).catch(() => { });
        checkDocumentExpiry().then(res => {
          if (res.ok && res.data) setExpiryAlerts(res.data);
        }).catch(() => { });
      } catch (e) { }
    }
  }, [dispatch]);

  const handleEditOrder = useCallback((orderId: string) => {
    setSelectedOrderId(orderId);
  }, []);

  const handleRefresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  // Filtered Stats Utility
  const currentView = React.useMemo(() => {
    const empty = { revenue: 0, orders: 0, commission: 0, chartData: [] as any[] };
    if (!stats) return empty;

    const periodData = {
      today: {
        revenue: stats.revenueToday ?? 0,
        orders: stats.ordersToday ?? 0,
        commission: stats.commissionToday ?? 0,
        chartData: (stats.dailyStats || []).slice(-7)
      },
      weekly: {
        revenue: stats.revenueWeekly ?? 0,
        orders: stats.ordersWeekly ?? 0,
        commission: stats.commissionWeekly ?? 0,
        chartData: (stats.dailyStats || []).slice(-7)
      },
      monthly: {
        revenue: stats.revenueMonthly ?? 0,
        orders: stats.ordersMonthly ?? 0,
        commission: stats.commissionMonthly ?? 0,
        chartData: (stats.dailyStats || [])
      }
    };
    return periodData[statsPeriod] || empty;
  }, [stats, statsPeriod]);


  const fetchHeatmap = useCallback(async () => {
    setIsFetchingHeatmap(true);
    try {
      const res = await getHeatmapData();
      if (res.ok && res.data) setHeatmapData(res.data);
    } catch (e) {
    } finally {
      setIsFetchingHeatmap(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'heatmap' && heatmapData.length === 0) {
      fetchHeatmap();
    }
  }, [activeTab, heatmapData.length, fetchHeatmap]);

    const unsubs = useRef<Record<string, (() => void) | undefined>>({});
  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;

  useEffect(() => {
    let isMounted = true;
    const deferred = createDeferredCleanup();
    const mapDriversThrottle = createLatestThrottler((drivers: Driver[]) => {
      setMapData(prev => ({ ...prev, drivers }));
    }, 1500);
    const passengerThrottle = createLatestThrottler((locs: Record<string, any>) => {
      setPassengerLocations(locs);
    }, 1500);
    
    // Sync tab with URL if needed
    const currentHash = window.location.hash.replace('#', '');
    if (currentHash === 'admin' || currentHash === '') setActiveTab('orders');
    else if (currentHash.includes('analytics')) setActiveTab('analytics');
    else if (currentHash.includes('heatmap')) setActiveTab('heatmap');
    else if (currentHash.includes('publish')) setActiveTab('heatmap');
    else if (currentHash === 'admin/drivers' || currentHash === 'drivers') setActiveTab('drivers');
    
    // Initial Fetch (History + State)
    fetchDataRef.current(true);

    // Load listeners via dynamic import — once per mount, not when fetchData identity changes
    import('../services/firebase').then(({ listenToDrivers, listenToActiveOrders, listenToAllOrderMessages, listenToSystemHealth, listenToStats, listenToSettings, listenToPassengerLocations }) => {
      if (!isMounted) return;

      unsubs.current.stats = listenToStats((apiStats) => {
        if (!isMounted) return;
        dispatch(setStatsData(apiStats));
      });

      unsubs.current.settings = listenToSettings((apiSettings) => {
        if (!isMounted) return;
        dispatch(setSettingsData(apiSettings));
      });

      unsubs.current.drivers = listenToDrivers((loadedDrivers) => {
        if (!isMounted) return;
        
        const now = Date.now();
        const HEARTBEAT_THRESHOLD = 2 * 60 * 1000;

        const activeOnly = loadedDrivers.filter(d => {
          if (!d.isOnline) return false;
          const lastActive = d.lastHeartbeat ? new Date(d.lastHeartbeat).getTime() : 0;
          return (now - lastActive) < HEARTBEAT_THRESHOLD;
        });

        dispatch(setActiveDrivers(activeOnly));
        mapDriversThrottle.push(activeOnly);
      });

      unsubs.current.activeOrders = listenToActiveOrders((activeOrders) => {
        if (!isMounted) return;

        const now = Date.now();
        const CUTOFF_MS = 5 * 60 * 1000;

        const nowOrders = [...ordersRef.current];
        const indexedOrders = new Map();

        nowOrders.forEach(o => {
          const clean = String(o.orderId).trim().replace(/^TAXI-/, '').toLowerCase();
          indexedOrders.set(clean, o);
        });

        let changed = false;
        activeOrders.forEach(rawOrder => {
          const order = toCamelCase(rawOrder) as Order;
          const clean = String(order.orderId).trim().replace(/^TAXI-/, '').toLowerCase();

          const existing = indexedOrders.get(clean);
          if (!existing || existing.status !== order.status || existing.updatedAt !== order.updatedAt || existing.paymentCompleted !== order.paymentCompleted) {

            if (existing && existing.status !== 'waiting_approval' && order.status === 'waiting_approval') {
              const driverName = (order as any).driverName || 'נהג';
              const amount = (order as any).price || 'סכום לא ידוע';

              setToast({
                message: `${driverName} דיווח על העברת תשלום בסך ${amount} ₪`,
                type: 'success'
              });

              if (window.Notification && window.Notification.permission === "granted") {
                new Notification("תשלום ממתין לאישור", {
                  body: `${driverName} דיווח על העברת תשלום בסך ${amount} ₪`,
                  icon: '/vite.svg'
                });
              }
            }

            indexedOrders.set(clean, { ...(existing || {}), ...order });
            changed = true;
          }
        });

        if (changed) {
          const merged = Array.from(indexedOrders.values())
            .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          dispatch(setActiveOrders(merged));
        }

        const mapOrders = activeOrders
          .map(o => toCamelCase(o))
          .filter(o => {
            if (o.status === 'cancelled') return false;
            if (o.status === 'completed') {
              const updatedAt = o.updatedAt ? new Date(o.updatedAt).getTime() : 0;
              return (now - updatedAt) < CUTOFF_MS;
            }
            return true;
          }) as Order[];

        setMapData(prev => ({ ...prev, orders: mapOrders }));
      });

      unsubs.current.messages = listenToAllOrderMessages((data) => {
        if (!isMounted) return;
        setMessageStatuses(data);
      });

      unsubs.current.health = listenToSystemHealth((status) => {
        if (!isMounted) return;
        setBridgeStatus(status);
      });

      unsubs.current.passengers = listenToPassengerLocations((data) => {
        if (!isMounted) return;
        passengerThrottle.push(data || {});
      });

      Object.values(unsubs.current).forEach((unsub) => {
        if (typeof unsub === 'function') deferred.attach(unsub);
      });

      if (!isMounted) deferred.flush();

    }).catch(err => {
      console.error("Firebase Sync Error:", err);
    });

    return () => {
      isMounted = false;
      mapDriversThrottle.flush();
      passengerThrottle.flush();
      deferred.flush();
      unsubs.current = {};
    };
  }, [dispatch]);



  return (
    <div
      className="p-4 md:p-10 min-h-screen relative font-sans selection:bg-primary-500 selection:text-white admin-theme-transition"
      style={{ backgroundColor: 'var(--admin-bg)', color: 'var(--admin-text-primary)' }}
      dir="rtl"
    >
      {/* Live Operational Ticker */}
      <div
        className="sticky top-0 z-[60] -mx-4 md:-mx-10 mb-10 backdrop-blur-2xl overflow-hidden shadow-2xl"
        style={{
          backgroundColor: 'var(--admin-panel)',
          borderBottom: '1px solid var(--admin-card-border)',
          opacity: 0.95,
        }}
        dir="rtl"
      >
        <div className="flex animate-[shimmer_30s_linear_infinite] whitespace-nowrap py-3 px-6 gap-12 items-center">
          <div className="flex items-center gap-3 text-xs font-black text-slate-400 uppercase tracking-widest">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse"></span>
            סיסטם אונליין ({new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })})
          </div>
          <div className="flex items-center gap-3 text-xs font-black text-amber-400 uppercase tracking-widest">
            <Car size={16} /> נהגים בזמן אמת: <span className="text-white text-sm">{mapData?.drivers?.filter(d => d.lat && d.lng)?.length || 0}</span>
          </div>
          <div className="flex items-center gap-3 text-xs font-black text-primary-400 uppercase tracking-widest">
            <ClipboardIcon size={16} /> הזמנות פעילות: <span className="text-white text-sm">{mapData?.orders?.filter(o => o.status !== 'completed' && o.status !== 'cancelled')?.length || 0}</span>
          </div>
          <div className="flex items-center gap-3 text-xs font-black text-emerald-400 uppercase tracking-widest">
            <DollarSign size={16} /> מחזור יומי: <span className="text-white text-sm">₪{stats?.revenueToday || 0}</span>
          </div>
          <div className="flex items-center gap-3 text-xs font-black text-rose-400 uppercase tracking-widest">
            <MapPin size={16} /> נוסעים בלייב: <span className="text-white text-sm">{Object.keys(passengerLocations).length}</span>
          </div>
        </div>
      </div>

      {/* AI Smart Command Box */}
      <div className="mb-8 flex flex-col md:flex-row gap-4" dir="rtl">
          <form onSubmit={async (e) => {
              e.preventDefault();
              if(!aiCommand) return;
              setIsAiLoading(true);
              try {
                  const data = await import('../services/aiService').then(m => m.aiParseOrder(aiCommand));
                  setAiCommand('');
                  const payload = {
                      passengerPhone: data.passengerPhone || "",
                      pickupAddress: data.pickupLocation || "",
                      destinationAddress: data.destination || "",
                      passengerName: data.passengerName || "לא סופק",
                      passengers: data.passengers || 1,
                      vehicleType: "regular",
                  };
                  const { createOrder } = await import('../api/adminApi');
                  const res = await createOrder(payload);
                  if(res.ok) {
                      setToast({ message: "הזמנה נוצרה בהצלחה ע״י AI! 🤖", type: 'success' });
                      fetchData(false);
                  } else {
                      setToast({ message: "שגיאה ביצירת נסיעה: " + res.error, type: 'error' });
                  }
              } catch(e: any) {
                  setToast({ message: e.message || 'שגיאה בפענוח AI', type: 'error' });
              } finally {
                  setIsAiLoading(false);
              }
          }} className="flex-1 bg-[#1E293B] flex items-center p-2 rounded-2xl border border-primary-500/30 shadow-lg shadow-primary-500/10 focus-within:border-primary-500 transition-colors">
              <Sparkles className="text-primary-400 mx-3" size={24} />
              <input 
                  type="text" 
                  value={aiCommand}
                  onChange={e => setAiCommand(e.target.value)}
                  disabled={isAiLoading}
                  placeholder="פקודת AI: 'קח את יוסי מדיזנגוף לנתבג עכשיו 0541234567'"
                  className="flex-1 bg-transparent border-none text-white focus:outline-none focus:ring-0 placeholder-slate-500 font-medium w-full min-w-0"
              />
              <button 
                  type="submit" 
                  disabled={isAiLoading || !aiCommand}
                  className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50"
              >
                  {isAiLoading ? <RefreshCw className="animate-spin" size={18}/> : 'שגר'}
              </button>
          </form>
          
          <button 
              onClick={async () => {
                  setIsAiBriefingLoading(true);
                  try {
                      const msg = await import('../services/aiService').then(m => 
                          m.aiGenerateDailyBrief(stats, orders.length, drivers.filter((d: any) => d.isOnline).length)
                      );
                      setAiBriefing(msg);
                  } catch(e:any) {
                      setToast({ message: e.message || 'שגיאת AI', type: 'error' });
                  } finally {
                      setIsAiBriefingLoading(false);
                  }
              }}
              disabled={isAiBriefingLoading}
              className="bg-gradient-to-r from-primary-600 to-primary-700 p-2 px-6 rounded-2xl flex items-center justify-center gap-2 font-bold text-white shadow-lg hover:shadow-primary-500/25 transition-all outline-none"
          >
               {isAiBriefingLoading ? <RefreshCw className="animate-spin" size={20}/> : <Sparkles size={20} />}
               סיכום מנהלים
          </button>
      </div>

      <WhatsAppConnect />

      <DashboardHeader
        statsPeriod={statsPeriod}
        setStatsPeriod={setStatsPeriod}
        settings={settings}
        handleDailyReport={handleDailyReport}
        handleRefresh={handleRefresh}
        isLoading={isLoading}
        setIsCreateOrderModalOpen={setIsCreateOrderModalOpen}
      />

      <div className="space-y-10">
        <StatsCards stats={stats} currentView={currentView} statsPeriod={statsPeriod} />

        {/* Bento Grid Analytics Section */}
        {stats && stats.dailyStats && stats.dailyStats.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3 bg-[#1E293B] p-8 md:p-10 rounded-[2.5rem] shadow-2xl border border-white/5 overflow-hidden transition-all hover:bg-[#1E293B]/90">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-2xl font-black text-white flex items-center gap-3 tracking-tight">
                  <span className="w-2 h-8 bg-primary-500 rounded-full"></span>
                  מגמות פעילות והכנסה
                </h3>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest border border-white/5 px-4 py-2 rounded-xl">7 ימים אחרונים</div>
              </div>
              <div className="h-[300px] md:h-[350px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={currentView.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }} dy={15} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 800 }} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#10b981', fontSize: 12, fontWeight: 800 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: '#0f172a', color: '#fff', padding: '15px' }}
                      itemStyle={{ fontWeight: 800 }}
                    />
                    <Area yAxisId="left" type="monotone" dataKey="count" name="הזמנות" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorCount)" />
                    <Area yAxisId="right" type="monotone" dataKey="revenue" name="הכנסה" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
                    <Area yAxisId="right" type="monotone" dataKey="commission" name="עמלה" stroke="#facc15" strokeWidth={3} strokeDasharray="6 6" fill="transparent" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-1">
              <SystemHealth currentView={currentView} bridgeStatus={bridgeStatus} />
            </div>
          </div>
        )}
      </div>

      <div className="flex space-x-6 space-x-reverse border-b border-white/5 mt-12 mb-8 gap-2 overflow-x-auto whitespace-nowrap pb-1 scrollbar-hide items-center" dir="rtl">
        <TabButton active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} label="ניהול משלוחים" icon={ClipboardIcon} />
        <TabButton active={activeTab === 'scheduled'} onClick={() => setActiveTab('scheduled')} label={`תור עתידי (${futureRides.length})`} icon={Timer} />
        <TabButton active={activeTab === 'drivers'} onClick={() => setActiveTab('drivers')} label="צי נהגים" icon={Car} />
        <TabButton active={activeTab === 'map'} onClick={() => setActiveTab('map')} label="מפה חיה" icon={MapPin} />
        <TabButton active={activeTab === 'heatmap'} onClick={() => setActiveTab('heatmap')} label="מוקדי ביקוש" icon={Zap} />
        <TabButton active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} label="אנליטיקה" icon={TrendingUp} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'scheduled' ? (
            <div className="bg-[#1E293B] rounded-[3rem] shadow-2xl border border-white/5 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 mb-20">
              <div className="p-8 border-b border-white/5 flex justify-between items-center">
                <h3 className="text-2xl font-black text-white flex items-center gap-3">
                  <span className="w-1.5 h-6 bg-orange-500 rounded-full"></span>
                  תור נסיעות עתידיות
                </h3>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  {futureRides.length} נסיעות מתוכננות
                </div>
              </div>
              <div className="p-6">
                {futureRides.length === 0 ? (
                  <div className="text-center py-16 text-slate-500">
                    <Timer size={48} className="mx-auto mb-4 text-slate-600" />
                    <p className="font-black text-lg">אין נסיעות מתוכננות</p>
                    <p className="text-xs mt-2">נסיעות המתוכננות ליותר מ-20 דקות מעכשיו יופיעו כאן</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {futureRides.map(ride => {
                      const pickupTime = ride.pickupDatetime ? new Date(ride.pickupDatetime) : null;
                      const minutesUntil = pickupTime ? Math.round((pickupTime.getTime() - Date.now()) / 60000) : 0;
                      const hoursUntil = Math.floor(minutesUntil / 60);
                      const minsLeft = minutesUntil % 60;

                      return (
                        <div key={ride.orderId} className="bg-slate-900/40 p-6 rounded-[2rem] border border-white/5 hover:border-orange-500/30 transition-all group">
                          <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] text-slate-500 font-black tracking-widest uppercase">#{ride.orderId}</span>
                              <span className="px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                                {ride.driverName ? 'משובץ' : 'ממתין לשיבוץ'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-xl border border-white/5">
                              <Clock size={14} className="text-orange-400" />
                              <span className="text-sm font-black text-white">
                                {hoursUntil > 0 ? `${hoursUntil} שעות ${minsLeft} דק'` : `${minutesUntil} דק'`}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-start gap-4 mb-4">
                            <div className="flex flex-col items-center gap-1 mt-1.5">
                              <div className="w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20"></div>
                              <div className="w-px h-8 bg-white/10"></div>
                              <div className="w-3 h-3 rounded-full bg-blue-500 ring-4 ring-blue-500/20"></div>
                            </div>
                            <div className="flex-1">
                              <p className="font-black text-white text-base">{ride.pickupAddress}</p>
                              <p className="text-sm text-slate-500 font-medium mt-2">{ride.destinationAddress}</p>
                            </div>
                            <div className="text-left shrink-0">
                              <p className="text-2xl font-black text-[#FACC15]">₪{ride.price}</p>
                              <p className="text-[10px] text-slate-500 font-bold mt-1">
                                {pickupTime?.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t border-white/5">
                            <div className="text-xs text-slate-500">
                              {ride.driverName ? (
                                <span className="flex items-center gap-2">
                                  <Car size={14} /> נהג: <span className="text-white font-black">{ride.driverName}</span>
                                </span>
                              ) : (
                                <span className="text-orange-400">🔸 נדרש שיבוץ נהג</span>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="accent"
                                size="sm"
                                className="font-black text-xs shadow-lg shadow-accent-400/10"
                                onClick={() => handleSmartAssign(ride.orderId)}
                                disabled={smartAssignLoading && smartAssignOrderId === ride.orderId}
                                isLoading={smartAssignLoading && smartAssignOrderId === ride.orderId}
                                leftIcon={<Sparkles size={14} />}
                              >
                                שיבוץ חכם
                              </Button>
                              <button
                                onClick={() => handleEditOrder(ride.orderId)}
                                className="bg-slate-800 text-white px-4 py-2.5 rounded-xl font-black text-xs hover:bg-slate-700 transition-all border border-white/5 flex items-center gap-2"
                              >
                                <ArrowLeftRight size={14} /> פרטים
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'analytics' ? (
            <AdminAnalytics />
          ) : activeTab === 'drivers' ? (
            <div className="bg-[#1E293B] rounded-[3rem] shadow-2xl border border-white/5 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 mb-20">
              <div className="p-8 border-b border-white/5 flex justify-between items-center">
                <h3 className="text-2xl font-black text-white flex items-center gap-3">
                  <span className="w-1.5 h-6 bg-amber-500 rounded-full"></span>
                  ביצועי צי הנהגים
                </h3>
                <div className="flex items-center gap-4">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">סה"כ {drivers.length} נהגים</div>
                  <Link 
                    to="/manual-add-driver"
                    className="bg-amber-500 hover:bg-amber-400 text-slate-900 px-4 py-2 rounded-xl font-black text-xs flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20 active:scale-95 no-underline"
                  >
                    <UserPlus size={14} />
                    הוספת נהג
                  </Link>
                </div>
              </div>
              <DriversTable
                drivers={drivers}
                onDownloadReport={handleDownloadReport}
                isGeneratingReport={isGeneratingReport}
                isLoading={isLoading}
                onRefresh={handleRefresh}
              />
            </div>
          ) : activeTab === 'map' ? (
            <React.Suspense fallback={<div className="h-64 flex items-center justify-center bg-slate-900 rounded-3xl animate-pulse text-white">טוען מפה...</div>}>
              <div className="card h-[calc(100vh-280px)] min-h-[500px] overflow-hidden border-none shadow-2xl relative">
                <LiveMap
                  orders={mapData.orders}
                  drivers={mapData.drivers}
                  passengers={Object.values(passengerLocations)}
                  globalMode={true}
                  apiKey={settings.googleMapsApiKey || settings['GOOGLE_MAPS_API_KEY']}
                  heatmapData={heatmapData}
                  showHeatmap={false}
                  onSmartAssignClick={handleSmartAssign}
                />
                {/* Map Floating HUD */}
                <div className="absolute top-6 right-6 z-[1000] flex flex-col gap-3">
                  <div className="bg-white/90 backdrop-blur-md p-4 rounded-3xl shadow-2xl border border-white/50 flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">נסיעות פעילות</span>
                      <span className="text-xl font-black text-slate-900">{mapData.orders.length}</span>
                    </div>
                    <div className="w-px h-8 bg-slate-200"></div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">נהגים מחוברים</span>
                      <span className="text-xl font-black text-slate-900">{mapData.drivers.filter(d => d.lat && d.lng).length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </React.Suspense>
          ) : activeTab === 'heatmap' ? (
            <React.Suspense fallback={<div className="h-64 flex items-center justify-center bg-slate-900 rounded-3xl animate-pulse text-white">מנתח אזורי ביקוש...</div>}>
              <div className="card h-[calc(100vh-280px)] min-h-[500px] overflow-hidden border-none shadow-2xl relative">
                <LiveMap
                  orders={[]}
                  drivers={mapData.drivers}
                  globalMode={true}
                  heatmapData={heatmapData}
                  showHeatmap={true}
                />
                {/* Heatmap Floating HUD */}
                <div className="absolute top-6 right-6 z-[1000] flex flex-col gap-3">
                  <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-3xl shadow-2xl border border-slate-700 flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">מפת אזורי ביקוש</span>
                    <span className="text-xs text-white">מראה את {heatmapData.length} המיקומים החמים ביותר בחודש האחרון</span>
                    {isFetchingHeatmap && <div className="text-[10px] text-amber-400 mt-1 animate-pulse">מעדכן נתונים...</div>}
                  </div>
                </div>
              </div>
            </React.Suspense>
          ) : (
            <div className="bg-[#1E293B] rounded-[3.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.5)] border border-white/5 overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-700 mb-24 relative">
              <div className="p-10 border-b border-white/5 flex justify-between items-center relative z-10">
                <div>
                  <h3 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                    <span className="w-1.5 h-6 bg-primary-500 rounded-full"></span>
                    ניהול הזמנות אחרונות
                  </h3>
                  <p className="text-slate-500 text-xs font-medium mt-1">מציג נתוני אמת מכל המקורות</p>
                </div>
                <div className="flex items-center gap-4">
                  {/* Filters can go here if needed in future */}
                </div>
              </div>
              <div className="relative z-10 transition-all">
                <OrdersTable
                  orders={orders}
                  isLoading={isLoading}
                  onEdit={handleEditOrder}
                  onRefresh={handleRefresh}
                  stationPaymentPhone={settings.stationPaymentPhone || settings['STATION_PAYMENT_PHONE']}
                  messageStatuses={messageStatuses}
                />
              </div>
              {/* Subtle background glow for the table container */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 blur-[100px] -z-0"></div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {isDailyReportModalOpen && (
        <ConfirmationModal
          isOpen={isDailyReportModalOpen}
          onClose={() => setIsDailyReportModalOpen(false)}
          onConfirm={confirmDailyReport}
          title="הפקת דוח הכנסות יומי"
          message="האם להפיק עכשיו דוח הכנסות יומי? הפעולה עשויה לקחת מספר שניות."
          type="info"
          confirmText="הפק דוח"
          cancelText="ביטול"
          isLoading={isDailyReportLoading}
        />
      )}

      {selectedOrderId && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100] p-2 sm:p-4">
          <div className="bg-slate-50 rounded-t-3xl sm:rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl h-[92dvh] sm:h-[85vh] relative text-right" dir="rtl">
            <React.Suspense fallback={<div className="h-full flex items-center justify-center">טוען...</div>}>
              <OrderDetailsModal
                orderId={selectedOrderId}
                onClose={() => setSelectedOrderId(null)}
                onUpdate={() => fetchData(false)}
                googleMapsApiKey={settings.googleMapsApiKey || settings['GOOGLE_MAPS_API_KEY']}
              />
            </React.Suspense>
          </div>
        </div>
      )}

      {isCreateOrderModalOpen && (
        <React.Suspense fallback={<div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center"><Plus className="animate-spin text-white" /></div>}>
          <CreateOrderModal
            onClose={() => setIsCreateOrderModalOpen(false)}
            onSuccess={() => {
              setIsCreateOrderModalOpen(false);
              fetchData(false);
            }}
          />
        </React.Suspense>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          duration={8000}
        />
      )}

      {/* AI Briefing Modal */}
      <AnimatePresence>
        {aiBriefing && (
          <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="bg-[#1E293B] border border-primary-500/30 p-8 rounded-[2rem] shadow-2xl max-w-xl w-full text-white relative max-h-[90vh] overflow-y-auto"
               dir="rtl"
             >
                <div className="absolute top-4 left-4 p-2 bg-white/5 rounded-full cursor-pointer hover:bg-white/10" onClick={() => setAiBriefing(null)}>
                   <XCircle size={24} className="text-slate-400" />
                </div>
                <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
                   <Sparkles className="text-primary-400" size={28} />
                   סיכום מנהלים AI
                </h2>
                <div className="text-slate-300 leading-relaxed whitespace-pre-wrap font-medium">
                   {aiBriefing}
                </div>
                <button onClick={() => setAiBriefing(null)} className="w-full mt-8 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition-all">סגור</button>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
