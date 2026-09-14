
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDriverPortalData, sendToBackend, acceptRideByPhone, updateDriverProfile } from '../api/driverApi';
import { Toast } from '../components/Toast';
import { DriverPortalData, Order, Driver } from '../types';
import { LiquidSwipe } from '../components/LiquidSwipe';
import { DynamicIslandAlert, AlertData } from '../components/DynamicIslandAlert';
import { PredictiveHeatmap } from '../components/PredictiveHeatmap';
import { DriverMap } from '../components/DriverMap';
import { LogOut, User, DollarSign, List, Check, Shield, BarChart, Edit3, Loader2, Star, AlertCircle, Bell, Clock, TrendingUp, FileText, MapPin, Calendar, Download, Send, Settings, Headset, Menu, Home, ChevronLeft, Briefcase, UserCircle, Car, Zap } from 'lucide-react';

interface DriverPortalProps {
  onLogout: () => void;
}

const StatusIndicator: React.FC<{ icon: any, label: string, status: 'success' | 'danger' | 'warning' }> = ({ icon: Icon, label, status }) => (
    <div className="flex items-center gap-1.5">
        <div className={`p-1 rounded-md ${status === 'success' ? 'bg-success/20 text-success' : status === 'warning' ? 'bg-warning/20 text-warning' : 'bg-danger/20 text-danger'}`}>
            <Icon size={12} strokeWidth={3} />
        </div>
        <span className={`text-[9px] font-black uppercase tracking-widest ${status === 'success' ? 'text-success' : status === 'warning' ? 'text-warning' : 'text-danger'}`}>{label}</span>
    </div>
);

export const DriverPortal: React.FC<DriverPortalProps> = ({ onLogout }) => {
  const [data, setData] = useState<DriverPortalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [dynamicAlerts, setDynamicAlerts] = useState<AlertData[]>([]);
   const [isOnline, setIsOnline] = useState(true);
   const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
   const [activeRide, setActiveRide] = useState<Order | null>(null);
   const [lastLocSync, setLastLocSync] = useState<number | null>(null);
   const [apiStatus, setApiStatus] = useState<'online' | 'offline' | 'checking'>('checking');
   const [gpsStatus, setGpsStatus] = useState<'searching' | 'active' | 'error'>('searching');

  // Queue State
  const [pendingRides, setPendingRides] = useState<Order[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Driver>>({});
  const [isSaving, setIsSaving] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      setIsLoading(true);
      const res = await getDriverPortalData();
      if (!isMounted) return;

      if (res.ok && res.data) {
        setData(res.data);
        // Initialize edit form with current data
        setEditForm({
          driverName: res.data.driver.driverName,
          phone: res.data.driver.phone,
          serviceArea: res.data.driver.serviceArea,
          licenseNumber: res.data.driver.licenseNumber,
          taxiPlateNumber: res.data.driver.taxiPlateNumber
        });
      } else {
        onLogout();
        navigate('/');
      }
      setIsLoading(false);
    };
    fetchData();
    return () => { isMounted = false; };
  }, [navigate]);

  // Pending Rides Polling
  const fetchQueue = useCallback(async () => {
    setIsLoadingQueue(true);
    const res = await sendToBackend<{ items: Order[] }>('getOrders', { page: 1, pageSize: 50 });
    if (res.ok && res.data) {
      const open = (res.data.items || []).filter((o) => {
        const s = String(o.status || '').toLowerCase();
        return s === 'pending' || s === 'broadcasted';
      });
      setPendingRides(open);
    }
    setIsLoadingQueue(false);
  }, []);

  useEffect(() => {
    if (!isOnline || !data?.driver?.driverId) return;

    fetchQueue();
    const poll = setInterval(fetchQueue, 15000);

    let unsub = () => {};
    import('../services/firebase').then(({ listenToPendingRides }) => {
      unsub = listenToPendingRides((rides) => {
        if (rides && rides.length > 0) setPendingRides(rides);
      });
    });

    return () => {
      clearInterval(poll);
      unsub();
    };
  }, [isOnline, data?.driver?.driverId, fetchQueue]);

  const handleAcceptRide = async (orderId: string) => {
    if (!data?.driver?.phone) return;
    setAcceptingId(orderId);
    try {
      const res = await acceptRideByPhone({ orderId, phone: data.driver.phone });
      if (res.ok) {
        const { notifyLocalWhatsApp } = await import('../api/api');
        notifyLocalWhatsApp({
          text: `❌ *הזמנה ${orderId} נתפסה!*\nנלקחה על ידי הנהג: ${data.driver.driverName || 'נהג'}\n\nתודה!`
        });
        setToast({ message: `נסיעה ${orderId} התקבלה בהצלחה! 🎉`, type: 'success' });
        // Redirect to active ride view
        navigate(`/complete-ride?orderId=${orderId}&phone=${data.driver.phone}`);
      } else {
        setToast({ message: res.error || 'הנסיעה כבר נתפסה', type: 'error' });
      }
    } catch {
      setToast({ message: 'שגיאת תקשורת', type: 'error' });
    }
    setAcceptingId(null);
  };

  // [GETT-Level Quality] Background Tracking & Status Sync
  const lastSyncTime = React.useRef<number>(Date.now());
  const lastLocation = React.useRef<{ lat: number, lng: number } | null>(null);

  // Sync Status with robustness
  const syncStatus = useCallback(async (loc?: { lat: number, lng: number }, retryCount = 0) => {
    if (!data?.driver?.driverId) return;
    
    const finalLoc = loc || lastLocation.current || undefined;
    if (finalLoc) setGpsStatus('active');

    try {
      const { updateDriverStatus } = await import('../services/firebase');
      await updateDriverStatus(data.driver.driverId, isOnline, finalLoc);
      lastSyncTime.current = Date.now();
      setLastLocSync(Date.now());
      setApiStatus('online');
    } catch (e) {
      console.error("Sync Status Failed:", e);
      setApiStatus('offline');
      if (retryCount < 2) {
          setTimeout(() => syncStatus(loc, retryCount + 1), 3000);
      }
    }
  }, [data?.driver?.driverId, isOnline]);

  useEffect(() => {
    if (!data?.driver?.driverId) return;

    let watchId: number;
    let heartbeatTimer: any;

    const startHeartbeat = () => {
      // Clear any existing timer
      if (heartbeatTimer) clearTimeout(heartbeatTimer);
      
      // Heartbeat loop (30s)
      heartbeatTimer = setTimeout(async () => {
        if (isOnline) {
          await syncStatus(location || undefined);
          startHeartbeat(); // Recursive call
        }
      }, 30000);
    };

    if (isOnline) {
      // 1. Continuous Tracking
      if ("geolocation" in navigator) {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setLocation(newLoc);
            lastLocation.current = newLoc;
            setGpsStatus('active');
            syncStatus(newLoc);
          },
          (err) => {
            console.warn("Loc failed:", err.message);
            setGpsStatus('error');
            syncStatus();
          },
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
        );
      }

      // 2. Start Heartbeat Loop
      startHeartbeat();

      // 3. Visibility Change Handler (Immediate sync on wake)
      const handleVisibility = () => {
        if (document.visibilityState === 'visible') {
           syncStatus(location || undefined);
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);

      return () => {
        if (watchId) navigator.geolocation.clearWatch(watchId);
        if (heartbeatTimer) clearTimeout(heartbeatTimer);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    } else {
      // Mark as offline immediately
      syncStatus();
    }
  }, [data?.driver?.driverId, isOnline, location, syncStatus]);

  // Active Ride Listener
  useEffect(() => {
    if (!data?.driver?.phone) return;
    let unsub = () => {};
    import('../services/firebase').then(({ listenToActiveRideForDriver }) => {
      unsub = listenToActiveRideForDriver(data.driver.phone, (order) => {
        setActiveRide(order);
      });
    });
    return () => unsub();
  }, [data?.driver?.phone]);

  // Connection Status (Offline/Online)
  const [isConnected, setIsConnected] = useState(true);

  // Connection Listener
  useEffect(() => {
    let unsub = () => { };
    import('../services/firebase').then(({ listenToConnectionStatus }) => {
      unsub = listenToConnectionStatus((connected) => {
        setIsConnected(connected);
        if (!connected) {
          setToast({ message: 'חיבור לרשת נותק 🔌', type: 'error' });
        } else {
          // Optional: setToast({ message: 'מחובר מחדש 🟢', type: 'success' });
        }
      });
    });
    return () => unsub();
  }, []);

  // Notifications Listener
  useEffect(() => {
    if (!data?.driver?.driverId) return;

    let unsub = () => { };
    import('../services/firebase').then(({ listenToNotifications }) => {
      unsub = listenToNotifications(data.driver.driverId, (notifs) => {
        if (notifs.length > 0) {
          const latest = notifs[0];
          const now = Date.now();
          // Only toast if created in the last 15 seconds to avoid spam on load
          if (latest.createdAt && now - latest.createdAt < 15000) {
            setToast({ message: `${latest.title || 'הודעה'}: ${latest.body || ''}`, type: 'success' });
            setDynamicAlerts(prev => [...prev, {
              id: Math.random().toString(),
              type: latest.title?.includes('נסיעה') ? 'new_order' : 'info',
              title: latest.title || 'הודעה',
              subtitle: latest.body
            }]);
            
            // Auto dismiss dynamic alert
            setTimeout(() => {
              setDynamicAlerts(prev => prev.filter(a => a.id !== latest.id));
            }, 5000);
          }
        }
      });
    });

    return () => unsub();
  }, [data?.driver?.driverId]);

  const handleLogout = () => {
    onLogout();
    navigate('/driver/login');
  };

  const handleSaveProfile = async () => {
    if (!editForm) return;
    setIsSaving(true);
    try {
      // Map frontend keys to backend expected keys if necessary, 
      // but our backend handles the mapping based on the keys we send if they match 'driverName' etc.
      // Wait, backend expects: driverName, phone, serviceArea, licenseNumber, taxiPlateNumber
      // Our `editForm` has snake_case keys from the Driver type... let's map them.

      const payload = {
        driverName: editForm.driverName,
        phone: editForm.phone,
        serviceArea: editForm.serviceArea,
        licenseNumber: editForm.licenseNumber,
        taxiPlateNumber: editForm.taxiPlateNumber
      };

      const res = await updateDriverProfile(payload);

      if (res.ok) {
        setToast({ message: 'הפרופיל עודכן בהצלחה!', type: 'success' });
        setIsEditing(false);
        // Update local state to reflect changes immediately
        if (data) {
          setData({
            ...data,
            driver: { ...data.driver, ...editForm }
          });
        }
      } else {
        setToast({ message: 'שגיאה בעדכון: ' + res.error, type: 'error' });
      }
    } catch (e) {
      setToast({ message: 'שגיאת תקשורת', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  const { driver, stats, recentRides } = data;

  return (
    <div className="bg-driver min-h-screen flex flex-col relative pb-32 md:pb-0 font-sans" dir="rtl">
      <DynamicIslandAlert 
        alerts={dynamicAlerts} 
        onDismiss={(id) => setDynamicAlerts(prev => prev.filter(a => a.id !== id))} 
      />
      {/* Connection Stability Bar */}
      <div className="bg-[#1E293B]/80 backdrop-blur-xl border-b border-white/5 px-4 py-2 flex items-center justify-between sticky top-0 z-[60]">
        <div className="flex gap-4">
            <StatusIndicator 
                icon={Zap} 
                label="שרת" 
                status={apiStatus === 'online' ? 'success' : apiStatus === 'checking' ? 'warning' : 'danger'} 
            />
            <StatusIndicator 
                icon={MapPin} 
                label="GPS" 
                status={gpsStatus === 'active' ? 'success' : gpsStatus === 'searching' ? 'warning' : 'danger'} 
            />
            <StatusIndicator 
                icon={Shield} 
                label="רשת" 
                status={isConnected ? 'success' : 'danger'} 
            />
        </div>
        {lastLocSync && (
            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                סנכרון אחרון: {new Date(lastLocSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
        )}
      </div>

      {!isConnected && (
        <div className="bg-danger text-white p-3 text-center text-[10px] font-black flex items-center justify-center gap-3 animate-pulse fixed top-0 w-full z-[100] shadow-2xl backdrop-blur-xl border-b border-white/10 tracking-widest uppercase">
          <Loader2 size={16} className="animate-spin" /> חיבור נותק - מנסה להתחבר מחדש...
        </div>
      )}

      {/* Modern Header for Driver */}
      <header className="bg-slate-900/50 backdrop-blur-md border-b border-white/5 px-6 py-5 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary-600/20 text-primary-400 flex items-center justify-center border border-primary-500/20 shadow-lg shadow-primary-900/40 cursor-pointer hover:bg-primary-600/30 transition-all active:scale-90">
            <Menu size={22} />
          </div>
          <div>
            {/* [FIX IMP-006] Dynamic title from driver data instead of hardcoded */}
            <h1 className="text-xl font-black tracking-tight text-white leading-tight">{driver.driverName || 'פורטל נהג'}</h1>
            <p className="text-[10px] font-black text-primary-400 uppercase tracking-widest">{driver.serviceArea || 'אזור כללי'}</p>
          </div>
        </div>
        <div className="text-2xl font-black italic text-accent drop-shadow-[0_0_10px_rgba(245,158,11,0.3)] tracking-tighter">1515</div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto w-full max-w-2xl mx-auto">

        {activeTab === 'home' && (
          <div className="p-6 space-y-8 animate-in fade-in duration-500">
            {/* Active Ride Banner */}
            {activeRide && (
              <div 
                onClick={() => navigate(`/complete-ride?orderId=${activeRide.orderId}&phone=${driver.phone}`)}
                className="bg-primary-600 p-6 rounded-[2.5rem] shadow-2xl shadow-primary-500/40 flex items-center justify-between border border-primary-400/30 cursor-pointer hover:scale-[1.02] active:scale-95 transition-all group overflow-hidden relative"
              >
                <div className="flex items-center gap-5 relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-white backdrop-blur-md border border-white/20 animate-pulse">
                    <Zap size={28} />
                  </div>
                  <div>
                    <p className="text-white font-black text-xl tracking-tight leading-none">נסיעה פעילה בביצוע</p>
                    <p className="text-primary-200 text-[10px] font-black uppercase tracking-widest mt-2 flex items-center gap-2">
                       {activeRide.pickupAddress} <ChevronLeft size={10} /> 
                    </p>
                  </div>
                </div>
                <div className="bg-white text-primary-600 px-6 py-3 rounded-2xl font-black text-xs shadow-xl relative z-10">
                  נהל נסיעה
                </div>
                <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-colors" />
              </div>
            )}

            {/* Online Toggle Card */}
            <div className={`p-6 rounded-[2.5rem] border transition-all duration-500 flex items-center justify-between ${isOnline ? 'bg-success/5 border-success/20 shadow-[0_0_40px_rgba(16,185,129,0.1)]' : 'bg-slate-800/40 border-slate-700/50'}`}>
              <div className="flex items-center gap-5">
                <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all duration-700 ${isOnline ? 'bg-success text-white shadow-[0_0_30px_rgba(16,185,129,0.4)]' : 'bg-slate-700 text-slate-500'}`}>
                  <Car size={32} strokeWidth={2.5} className={isOnline ? 'animate-bounce' : ''} />
                </div>
                <div>
                  <p className={`font-black text-xl tracking-tight ${isOnline ? 'text-success' : 'text-slate-400'}`}>{isOnline ? 'מחובר וזמין' : 'במצב לא מקוון'}</p>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{isOnline ? 'מוכן לקבל נסיעות' : 'התחבר כדי לקבל עבודות'}</p>
                </div>
              </div>
              <button
                onClick={() => setIsOnline(!isOnline)}
                className={`px-8 py-3.5 rounded-2xl font-black text-sm transition-all duration-300 shadow-2xl ${isOnline ? 'bg-white text-slate-900 hover:scale-105 active:scale-95' : 'btn-premium-accent'}`}
              >
                {isOnline ? 'צא' : 'התחבר'}
              </button>
            </div>

            {/* Live Map & Heatmap Preview */}
            <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl h-64 border border-white/5 bg-slate-800/50">
                <DriverMap 
                    pickupLat={location?.lat || 32.0853} 
                    pickupLng={location?.lng || 34.7818} 
                    className="h-full opacity-50 grayscale transition-all duration-1000" 
                />
                <PredictiveHeatmap active={isOnline} points={pendingRides.map(r => ({ lat: r.pickupLat, lng: r.pickupLng }))} />
            </div>

            {/* Business/Reports Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-2 py-1">
                <div className="p-2 rounded-xl bg-slate-800/50 text-slate-400 border border-white/5"><Briefcase size={16} /></div>
                <span className="font-black text-slate-200 text-sm tracking-wide uppercase">אפ בי ווב בע"מ</span>
                <button className="mr-auto text-slate-600 hover:text-white transition-colors"><Edit3 size={14} /></button>
              </div>
              {/* [FIX IMP-005] Report buttons now trigger real actions */}
              <div className="grid grid-cols-3 gap-4">
                <DashboardTile icon={FileText} label={"הנפקת חשבונית"} onClick={() => {
                  setActiveTab('finance');
                  setToast({ message: 'עבור לטאב הכספים לצפייה בחשבוניות', type: 'success' });
                }} />
                <DashboardTile icon={Calendar} label={'דו"ח חודשי'} onClick={() => setActiveTab('finance')} />
                <DashboardTile icon={Calendar} label={'דו"ח יומי'} onClick={() => setActiveTab('finance')} />
                <DashboardTile icon={Download} label={"ייצוא קובץ CSV"} onClick={() => {
                  // Export ride history as CSV
                  if (!recentRides || recentRides.length === 0) {
                    setToast({ message: 'אין נסיעות לייצוא', type: 'error' }); return;
                  }
                  const headers = ['מספר הזמנה', 'כתובת איסוף', 'יעד', 'מחיר', 'סטטוס', 'תאריך'];
                  const rows = recentRides.map(r => [
                    r.orderId, r.pickupAddress, r.destinationAddress,
                    r.price, r.status, r.createdAt || ''
                  ]);
                  const csv = [headers, ...rows].map(row => row.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n');
                  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = `rides_${driver.driverName}_${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click(); URL.revokeObjectURL(url);
                  setToast({ message: 'הקובץ הורד בהצלחה ✅', type: 'success' });
                }} />
                <DashboardTile icon={Calendar} label={'דו"ח חודשי מפורט'} onClick={() => setActiveTab('finance')} />
                <DashboardTile icon={Send} label={'שלח דו"ח יומי'} onClick={async () => {
                  setToast({ message: 'שולח דו"ח יומי... 📤', type: 'success' });
                  const res = await sendToBackend('getDailyReport', {});
                  setToast({ message: res.ok ? 'הדו"ח נשלח ✅' : (res.error || 'שגיאה בשליחה'), type: res.ok ? 'success' : 'error' });
                }} />
              </div>
            </div>

            {/* Driver/Personal Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-2 py-1">
                <div className="p-2 rounded-xl bg-slate-800/50 text-slate-400 border border-white/5"><UserCircle size={16} /></div>
                <span className="font-black text-slate-200 text-sm tracking-wide uppercase">{driver.driverName}</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <DashboardTile icon={Car} label="המונית שלי" onClick={() => setActiveTab('profile')} highlight />
                <DashboardTile icon={Edit3} label={"עדכון חשבונית"} onClick={() => setActiveTab('profile')} />
                <DashboardTile icon={Bell} label={"האפליקציות שלי"} onClick={() => setActiveTab('dashboard')} />
                <DashboardTile icon={Calendar} label={"דו\"ח יומי"} onClick={() => setActiveTab('finance')} />
                <DashboardTile icon={Calendar} label={"דו\"ח חודשי"} onClick={() => setActiveTab('finance')} />
                <DashboardTile icon={Send} label={"שלח דו\"ח יומי"} onClick={() => setActiveTab('finance')} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="p-6 space-y-8 animate-in slide-in-from-left duration-500">
            <div className="flex items-center gap-3 px-2">
              <div className="p-2 rounded-xl bg-primary-600/20 text-primary-400 border border-primary-500/20"><BarChart size={20} /></div>
              <h2 className="text-xl font-black text-white tracking-tight">ביצועים היום</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <StatCard icon={DollarSign} title="הכנסות היום" value={`₪${(stats.totalEarnings || 0).toLocaleString()}`} highlight />
              <StatCard icon={List} title="נסיעות" value={stats.totalRides} />
              <StatCard icon={Check} title="אחוז אישור" value={`${stats.completionRate}%`} />
              <StatCard icon={Star} title="דירוג" value={(driver.averageRating || 0).toFixed(1)} />
            </div>
          </div>
        )}

        {/* QUEUE TAB - Pending Rides */}
        {activeTab === 'queue' && (
          <div className="p-6 min-h-full animate-in slide-in-from-left duration-500">
            <div className="flex items-center justify-between mb-8 px-2">
              <h2 className="text-2xl font-black text-white flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-primary-600/20 text-primary-400 border border-primary-500/20 shadow-xl shadow-primary-900/20"><Bell size={24} /></div> נסיעות בתור
              </h2>
              <span className="text-[10px] font-black text-primary-400 bg-primary-900/40 px-5 py-2 rounded-full border border-primary-500/20 uppercase tracking-widest shadow-inner">
                {pendingRides.length} זמינות
              </span>
            </div>

            {isLoadingQueue ? (
              <div className="flex justify-center py-24"><Loader2 className="animate-spin text-primary-500" size={48} /></div>
            ) : pendingRides.length === 0 ? (
              <div className="text-center p-20 glass-dark rounded-[3.5rem] border border-dashed border-white/5 mt-4 group">
                <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mx-auto mb-8 border border-white/5 group-hover:scale-110 transition-transform duration-500">
                  <Clock size={40} className="text-slate-600" />
                </div>
                <p className="font-black uppercase text-sm text-slate-400 tracking-widest">אין נסיעות ממתינות</p>
                <p className="text-[11px] mt-2 text-slate-600 font-bold">נסיעות חדשות יופיעו כאן אוטומטית</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5">
                {pendingRides.map(ride => (
                  <div key={ride.orderId} className="glass-dark p-7 rounded-[2rem] border border-white/5 hover:border-primary-500/30 transition-all group relative overflow-hidden">
                    <div className="flex justify-between items-center mb-6">
                      <div className="text-[10px] text-slate-500 font-black tracking-widest uppercase">הזמנה #{ride.orderId}</div>
                      <OrderBadge status={ride.status} />
                    </div>
                    <div className="mb-8 relative">
                      <div className="absolute top-2 right-1.5 bottom-2 w-0.5 bg-slate-800 border-l border-dashed border-slate-700 opacity-30"></div>
                      <div className="flex items-start gap-5 mb-5 relative z-10">
                        <div className="w-3.5 h-3.5 rounded-full bg-success ring-4 ring-success/10 mt-1 shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.3)]"></div>
                        <p className="font-black text-slate-200 text-lg leading-tight tracking-tight">{ride.pickupAddress}</p>
                      </div>
                      <div className="flex items-start gap-5 relative z-10">
                        <div className="w-3.5 h-3.5 rounded-full bg-primary-500 ring-4 ring-primary-500/10 mt-1 shrink-0 shadow-[0_0_10px_rgba(37,99,235,0.3)]"></div>
                        <p className="text-base text-slate-400 font-bold tracking-tight">{ride.destinationAddress}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-8 pt-8 border-t border-white/5">
                      <div className="text-4xl font-black text-white tracking-tighter drop-shadow-lg">₪{ride.price}</div>
                      <div className="w-56">
                        {acceptingId === ride.orderId ? (
                          <div className="h-14 bg-slate-800 rounded-full flex items-center justify-center shadow-inner">
                            <Loader2 className="animate-spin text-primary-500" size={24} />
                          </div>
                        ) : (
                          <LiquidSwipe 
                            onAccept={() => handleAcceptRide(ride.orderId)}
                            text="החלק לאישור"
                            successText="מאושר!"
                          />
                        )}
                      </div>
                    </div>
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'rides' && (
          <div className="p-6 animate-in slide-in-from-left duration-500">
            <div className="flex items-center gap-3 px-2 mb-8 uppercase tracking-widest text-slate-500 font-black text-xs">
              <Clock size={16} />
              <h2>היסטוריית נסיעות</h2>
            </div>
            <div className="space-y-4">
              {recentRides.map(ride => (
                <div key={ride.orderId} onClick={() => navigate(`/ride/${ride.orderId}?phone=${driver.phone}`)} className="glass-dark p-6 rounded-[1.5rem] border border-white/5 hover:bg-white/5 cursor-pointer transition-all active:scale-[0.98] group">
                  <div className="flex justify-between items-center mb-5">
                    <span className="text-[10px] text-slate-600 font-black uppercase tracking-widest">#{ride.orderId}</span>
                    <OrderBadge status={ride.status} />
                  </div>
                  <div className="flex justify-between items-end">
                    <div className="flex-1 pl-4">
                      <p className="font-black text-slate-200 text-base truncate mb-1 group-hover:text-primary-400 transition-colors">{ride.pickupAddress}</p>
                      <p className="text-[10px] text-slate-500 truncate font-black uppercase tracking-widest">{ride.destinationAddress}</p>
                    </div>
                    <span className="text-2xl font-black text-primary-400 tracking-tighter">₪{ride.price}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'finance' && (
          <div className="p-6 space-y-6 animate-in slide-in-from-left duration-500">
            <div className="flex items-center gap-3 px-2 mb-4 uppercase tracking-widest text-slate-500 font-black text-xs">
              <TrendingUp size={16} />
              <h2>סיכום כספים</h2>
            </div>
            <div className="glass-dark p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
              <div className="grid grid-cols-2 gap-8">
                <div className="text-center space-y-2">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">הכנסות היום</p>
                  <p className="text-4xl font-black text-primary-400 tracking-tighter drop-shadow-lg">₪{(stats.totalEarnings || 0).toLocaleString()}</p>
                </div>
                <div className="text-center space-y-2 border-r border-white/5">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">אחוז השלמה</p>
                  <p className="text-4xl font-black text-white tracking-tighter">{stats.completionRate}%</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="p-6 animate-in slide-in-from-left duration-500">
            <div className="glass-dark p-8 rounded-[2.5rem] border border-white/5">
              <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-primary-400 border border-white/5 shadow-xl">
                    <User size={28} />
                  </div>
                  <h2 className="text-2xl font-black text-white tracking-tight">פרופיל אישי</h2>
                </div>
                <button onClick={() => setIsEditing(!isEditing)} className="text-primary-400 text-xs font-black uppercase tracking-widest bg-primary-600/10 px-4 py-2 rounded-full border border-primary-500/20 hover:bg-primary-600/20 transition-all">{isEditing ? 'ביטול' : 'עריכה'}</button>
              </div>

              {isEditing ? (
                <div className="space-y-6">
                  <EditField label="שם מלא" value={editForm.driverName} onChange={v => setEditForm({ ...editForm, driverName: v })} />
                  <EditField label="אזור שירות" value={editForm.serviceArea} onChange={v => setEditForm({ ...editForm, serviceArea: v })} />
                  <button onClick={handleSaveProfile} disabled={isSaving} className="btn-premium w-full py-5 rounded-2xl text-base shadow-2xl disabled:opacity-50 mt-4">
                    {isSaving ? <Loader2 className="animate-spin mx-auto" /> : 'שמור שינויים'}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <InfoRow label="שם נהג" value={driver.driverName} />
                  <InfoRow label="טלפון" value={driver.phone} />
                  <InfoRow label="מספר מונית" value={driver.taxiPlateNumber} />
                  <div className="flex justify-between items-center p-6 bg-accent/10 rounded-[1.5rem] mt-8 border border-accent/20 shadow-xl shadow-accent/5">
                    <div className="flex items-center gap-3 text-accent">
                      <Star size={24} fill="currentColor" className="drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                      <span className="font-black text-lg tracking-tight">דירוג נהג</span>
                    </div>
                    <span className="text-3xl font-black text-accent tracking-tighter">{driver.averageRating?.toFixed(1) || '5.0'}</span>
                  </div>
                </div>
              )}
            </div>
            <button onClick={handleLogout} className="w-full mt-8 p-5 rounded-2xl border border-danger/20 text-danger font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:bg-danger/5 transition-all active:scale-95">
              <LogOut size={16} /> התנתקות מהמערכת
            </button>
          </div>
        )}
      </main>

      {/* Bottom Navigation (Premium Glass Dark) */}
      <nav className="fixed bottom-0 w-full bg-slate-900/80 backdrop-blur-3xl border-t border-white/5 flex justify-around p-5 pb-safe z-50 shadow-[0_-15px_40px_rgba(0,0,0,0.5)]">
        <button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center gap-2 transition-all duration-500 ${activeTab === 'profile' ? 'text-primary-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}>
          <UserCircle size={26} strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
          <span className="text-[9px] font-black uppercase tracking-widest leading-none">פרופיל</span>
        </button>
        <button className="flex flex-col items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors">
          <Headset size={26} strokeWidth={2} />
          <span className="text-[9px] font-black uppercase tracking-widest leading-none">עזרה</span>
        </button>
        <button onClick={() => setActiveTab('queue')} className={`flex flex-col items-center gap-2 transition-all duration-500 ${activeTab === 'queue' ? 'text-primary-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}>
          <div className="relative">
            <Bell size={26} strokeWidth={activeTab === 'queue' ? 2.5 : 2} />
            {pendingRides.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger text-white text-[9px] font-black rounded-full flex items-center justify-center ring-4 ring-slate-900 shadow-lg">{pendingRides.length}</span>}
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest leading-none">תור</span>
        </button>
        <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-2 transition-all duration-500 ${activeTab === 'home' ? 'text-primary-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}>
          <Home size={26} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
          <span className="text-[9px] font-black uppercase tracking-widest leading-none">ראשי</span>
        </button>
      </nav>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

// Redesigned Dashboard Tile
const DashboardTile: React.FC<{ icon: React.ElementType, label: string, onClick?: () => void, highlight?: boolean }> = ({ icon: Icon, label, onClick, highlight }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center p-5 rounded-3xl transition-all active:scale-95 text-center gap-3 h-36 group relative overflow-hidden ${highlight ? 'bg-primary-600 text-white shadow-[0_15px_35px_rgba(37,99,235,0.4)] border border-primary-500' : 'glass-dark border-white/5 hover:border-white/10 hover:bg-white/5'}`}
  >
    <div className={`${highlight ? 'text-white' : 'text-primary-400 group-hover:text-primary-300 group-hover:scale-110'} transition-all duration-500`}>
      <Icon size={34} strokeWidth={highlight ? 2.5 : 2} />
    </div>
    <span className={`text-[10px] font-black leading-tight block px-1 uppercase tracking-tight ${highlight ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>{label}</span>
    {!highlight && <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />}
  </button>
);

// Helper Components
const StatCard: React.FC<{ icon: React.ElementType, title: string, value: string | number, highlight?: boolean }> = ({ icon: Icon, title, value, highlight }) => (
  <div className={`p-8 rounded-[2.5rem] flex flex-col items-center gap-4 text-center transition-all duration-500 shadow-2xl ${highlight ? 'bg-primary-600/10 border-primary-500/30' : 'glass-dark border-white/5 shadow-inner'}`}>
    <div className={`p-4 rounded-2xl ${highlight ? 'bg-primary-600 text-white shadow-xl shadow-primary-900/40' : 'bg-slate-800 text-primary-400 border border-slate-700'}`}><Icon size={26} /></div>
    <div>
      <p className="text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest leading-none">{title}</p>
      <p className={`text-2xl font-black tracking-tighter ${highlight ? 'text-white' : 'text-slate-200'}`}>{value}</p>
    </div>
  </div>
);

const InfoRow: React.FC<{ label: string, value?: string | number }> = ({ label, value }) => (
  <div className="flex items-center justify-between py-6 border-b border-white/5 last:border-0 px-2 group">
    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-400 transition-colors">{label}</p>
    <p className="text-base font-black text-slate-200 group-hover:text-white transition-colors">{value || '-'}</p>
  </div>
);

const EditField: React.FC<{ label: string, value?: string | number, onChange?: (val: string) => void, disabled?: boolean }> = ({ label, value, onChange, disabled }) => (
  <div className="space-y-3">
    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mr-2">{label}</label>
    <input
      type="text"
      value={value || ''}
      disabled={disabled}
      onChange={e => onChange?.(e.target.value)}
      className="w-full p-5 rounded-[1.5rem] bg-slate-900/80 border border-white/10 text-white outline-none focus:ring-4 focus:ring-primary-600/30 transition-all font-black text-lg placeholder:text-slate-700 shadow-inner"
    />
  </div>
);

const OrderBadge: React.FC<{ status: string }> = ({ status }) => {
  const normalizedStatus = (status || '').toLowerCase();

  const styles = {
    completed: 'bg-success/10 text-success border-success/20',
    cancelled: 'bg-danger/10 text-danger border-danger/20',
    active: 'bg-primary-600/10 text-primary-400 border-primary-500/20',
    on_route: 'bg-primary-500/10 text-primary-400 border-primary-500/20',
    // [FIX BUG-003] Added missing statuses
    assigned: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    confirmed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    arrived: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    in_progress: 'bg-primary-500/10 text-primary-400 border-primary-500/20',
    pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    broadcasted: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    waiting_approval: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    paid: 'bg-success/10 text-success border-success/20',
  }[normalizedStatus] || 'bg-slate-800 text-slate-400 border-slate-700';

  const labels = {
    completed: 'בוצעה',
    cancelled: 'בוטלה',
    active: 'לקריאה',
    on_route: 'בדרך',
    // [FIX BUG-003] Added missing Hebrew labels
    assigned: 'נקבע נהג',
    confirmed: 'אושרה',
    arrived: 'הגיע',
    in_progress: 'בביצוע',
    pending: 'ממתין',
    broadcasted: 'שודרה',
    waiting_approval: 'ממתין לאישור',
    paid: 'שולם',
  }[normalizedStatus] || status;

  return (
    <span className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full border shadow-sm ${styles}`}>
      {labels}
    </span>
  );
};


