import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { sendToBackend, markPaymentCompleted, toCamelCase, compareIds } from '../api/adminApi'; // Added markPaymentCompleted
import { RideDetailsData } from '../types';
import { hapticFeedback } from '../utils/haptics';
import { ImpactStyle } from '@capacitor/haptics';
import { startBackgroundTracking, stopBackgroundTracking } from '../services/location';
import { createDeferredCleanup } from '../utils/perf';

import {
    MapPin,
    ArrowRight,
    Download,
    Zap,
    Briefcase,
    MessageSquare,
    ChevronDown,
    Map,
    Plus,
    Navigation,
    Phone,
    CheckCircle,
    Loader2,
    XCircle,
    Clock,
    User,
    DollarSign,
    Smartphone,
    ChevronRight,
    Copy,
    CreditCard,
    ExternalLink
} from 'lucide-react';
import { Toast } from '../components/Toast';

// Safe Telegram Access
const tg = (window as any).Telegram?.WebApp;

export const RideDetails: React.FC = () => {
    const { orderId } = useParams<{ orderId: string }>();
    const [searchParams] = useSearchParams();
    const [data, setData] = useState<RideDetailsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [completing, setCompleting] = useState(false);
    const [starting, setStarting] = useState(false);

    // Payment State
    const [paymentReported, setPaymentReported] = useState(false);
    const [isFlipped, setIsFlipped] = useState(false); // For Bit/Paybox accordion
    const [showMarketing, setShowMarketing] = useState(false);

    const [timeLeft, setTimeLeft] = useState<string | null>(null);
    const [expired, setExpired] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    // Get phone from query param (from Telegram link) or localStorage
    const getDriverPhone = () => {
        const urlPhone = searchParams.get('phone');
        // Handle "null" or "undefined" as strings
        if (urlPhone && urlPhone !== 'null' && urlPhone !== 'undefined') {
            return urlPhone;
        }

        const stored = localStorage.getItem('driver_phone');
        if (stored && stored !== 'null' && stored !== 'undefined') {
            return stored;
        }

        // Final Fallback: If we have data and it has a driver phone, use it
        if (data && (data as any).driver?.phone) {
            return (data as any).driver.phone;
        }

        return '';
    };

    // Eagerly save phone if present in URL
    useEffect(() => {
        const p = searchParams.get('phone');
        if (p) localStorage.setItem('driver_phone', p);
    }, [searchParams]);

    // Calculate time left effect
    useEffect(() => {
        if (!data || data.paymentCompleted || data.status === 'completed') return;

        // Calculate target end time based on server data to handle clock skew
        let targetTime: number;

        if (data.serverTime && data.updatedAt) {
            const serverTime = data.serverTime;
            const updatedTime = new Date(data.updatedAt).getTime();
            const duration = 5 * 60 * 1000;
            const elapsed = serverTime - updatedTime;
            const remaining = duration - elapsed;
            targetTime = Date.now() + remaining;
        } else {
            // Fallback
            const startTime = data.updatedAt ? new Date(data.updatedAt).getTime() : new Date().getTime();
            targetTime = startTime + (5 * 60 * 1000);
        }

        const intervalId = setInterval(() => {
            const now = Date.now();
            const diff = targetTime - now;

            if (diff <= 0) {
                clearInterval(intervalId); // Ensure cleanup
                setTimeLeft("00:00");
                setExpired(true); // Trigger Modal
            } else {
                const m = Math.floor(diff / 60000);
                const s = Math.floor((diff % 60000) / 1000);
                setTimeLeft(`${m}:${s.toString().padStart(2, '0')}`);
            }
        }, 1000);

        return () => clearInterval(intervalId);
    }, [data?.updatedAt, data?.paymentCompleted, orderId]);

    // Firebase Real-time Listener
    useEffect(() => {
        if (!orderId) return;
        let isMounted = true;
        const deferred = createDeferredCleanup();
        let sawFirebase = false;

        import('../services/firebase').then(({ listenToOrder }) => {
            const unsub = listenToOrder(orderId, (updatedOrder) => {
                if (!isMounted) return;

                if (updatedOrder) {
                    sawFirebase = true;
                    const val = toCamelCase(updatedOrder);
                    setData(prev => {
                        const incomingUpdateTime = val.updatedAt ? new Date(val.updatedAt).getTime() : 0;
                        const currentUpdateTime = prev?.updatedAt ? new Date(prev.updatedAt).getTime() : 0;
                        const isStale = incomingUpdateTime > 0 && currentUpdateTime > 0 && incomingUpdateTime < currentUpdateTime;
                        const isStatusRegression = (prev?.status === 'waiting_approval' && val.status === 'assigned');

                        if (isStale || isStatusRegression) return prev;

                        return ({
                            ...(prev || {}),
                            ...val,
                            orderId: orderId!,
                            serverTime: Date.now(),
                            paymentPhone: prev?.paymentPhone || val.paymentPhone,
                            paypalEmail: prev?.paypalEmail || val.paypalEmail
                        } as RideDetailsData);
                    });
                    setLoading(false);
                    setError(null);
                }
            });
            deferred.attach(unsub);
        });

        // Slow GAS fallback only while assignment/payment is pending
        const pollInterval = setInterval(() => {
            const currentPhone = getDriverPhone();
            setData(currentData => {
                if (currentData && (currentData.status === 'assigned' || currentData.status === 'waiting_approval')) {
                    setTimeout(() => {
                        if (!isMounted) return;
                        sendToBackend<RideDetailsData>('getOrderDetails', { orderId: orderId!, phone: currentPhone })
                            .then(res => {
                                if (res.ok && res.data && isMounted) {
                                    setData(prev => (prev ? { ...prev, ...res.data } : res.data) as RideDetailsData);
                                }
                            });
                    }, 0);
                }
                return currentData;
            });
        }, 20000);

        sendToBackend<RideDetailsData>('getOrderDetails', { orderId, phone: getDriverPhone() })
            .then(res => {
                if (res.ok && res.data) {
                    if (isMounted) {
                        setData(prev => (prev ? { ...prev, ...res.data } : res.data) as RideDetailsData);
                        setLoading(false);
                        if (searchParams.get('paymentReported')) setPaymentReported(true);
                    }
                } else if (isMounted && !sawFirebase) {
                    if (res.error?.includes('Unauthorized')) setError('אין לך הרשאה לצפות בהזמנה זו.');
                    else setError(res.error || 'שגיאה בטעינת הנתונים');
                    setLoading(false);
                }
            });

        return () => {
            isMounted = false;
            deferred.flush();
            clearInterval(pollInterval);
        };
    }, [orderId]);

    // Location Tracking (Premium Background Geolocation)
    useEffect(() => {
        const shouldTrack = data && (data.status === 'assigned' || data.status === 'arrived' || data.status === 'in_progress' || data.status === 'on_route' || data.status === 'paid');
        if (!shouldTrack || !orderId) return;

        let cancelled = false;
        let watcherId: string | undefined;

        const start = async () => {
            const id = await startBackgroundTracking(orderId, data?.driverId);
            if (cancelled) {
                if (id) stopBackgroundTracking(id);
                return;
            }
            watcherId = id;
        };

        start();

        return () => {
            cancelled = true;
            if (watcherId) stopBackgroundTracking(watcherId);
        };
    }, [data?.status, orderId, data?.driverId]);

    // Telegram Init
    useEffect(() => {
        if (tg) {
            tg.ready();
            tg.expand();
            // Enable closing confirmation
            tg.enableClosingConfirmation();
        }
    }, []);

    const handleClose = () => {
        if (tg) tg.close();
        else window.close();
    };

    const handleStartRide = async () => {
        hapticFeedback.impact(ImpactStyle.Heavy);
        setStarting(true);
        const response = await sendToBackend('updateOrder', {
            orderId,
            phone: getDriverPhone(),
            updates: { status: 'in_progress' }
        });
        if (response.ok) {
            const nowIso = new Date().toISOString();
            setData(prev => prev ? ({
                ...prev,
                status: 'in_progress',
                updatedAt: nowIso // Optimistic timestamp to block stale Firebase data
            }) : null);
            setToast({ message: 'הנסיעה החלה! המפה החיה הופעלה.', type: 'success' });
            hapticFeedback.success();
        } else {
            setToast({ message: 'שגיאה בהתחלת הנסיעה: ' + response.error, type: 'error' });
            hapticFeedback.error();
        }
        setStarting(false);
    };

    const handleComplete = async () => {
        hapticFeedback.impact(ImpactStyle.Heavy);
        setCompleting(true);
        const phone = getDriverPhone();
        const response = await sendToBackend('completeOrder', { orderId, phone });
        if (response.ok) {
            // [FIX] BUG #11: Merge response data (commission, driverProfit, fullPrice) into state
            setData(prev => prev ? ({ ...prev, status: 'completed', ...(response.data || {}) }) : null);
            hapticFeedback.success();
        } else {
            setToast({ message: 'שגיאה בסיום הנסיעה: ' + response.error, type: 'error' });
            hapticFeedback.error();
        }
        setCompleting(false);
    };

    const handleArrived = async () => {
        hapticFeedback.impact(ImpactStyle.Heavy);
        const response = await sendToBackend('updateOrder', {
            orderId,
            phone: getDriverPhone(),
            updates: { status: 'arrived' }
        });
        if (response.ok) {
            const nowIso = new Date().toISOString();
            setData(prev => prev ? ({
                ...prev,
                status: 'arrived',
                updatedAt: nowIso // Optimistic timestamp to block stale Firebase data
            }) : null);
            setToast({ message: 'הודעה נשלחה ללקוח: הנהג ממתין!', type: 'success' });
            hapticFeedback.success();
        } else {
            setToast({ message: 'שגיאה: ' + response.error, type: 'error' });
            hapticFeedback.error();
        }
    };

    const handleMarkPayment = async () => {
        const phone = getDriverPhone();
        if (!phone) {
            setToast({ message: 'חסר מספר טלפון מזהה', type: 'error' });
            hapticFeedback.error();
            return;
        }
        hapticFeedback.impact(ImpactStyle.Medium);
        setLoading(true); // Temp loading
        try {
            const res = await markPaymentCompleted({ orderId: orderId!, phone });
            if (res.ok) {
                setPaymentReported(true);
                setToast({ message: 'דיווח תשלום התקבל! בבדיקה...', type: 'success' });
                // Optimistically update status to waiting view
                setData(prev => prev ? ({ ...prev, status: 'waiting_approval' }) : null);
                hapticFeedback.success();
            } else {
                setToast({ message: 'שגיאה: ' + res.error, type: 'error' });
                hapticFeedback.error();
            }
        } catch (e) {
            setToast({ message: 'שגיאת תקשורת', type: 'error' });
            hapticFeedback.error();
        }
        setLoading(false);
    };

    const handleCopyPhone = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (data?.paymentPhone) {
            navigator.clipboard.writeText(data.paymentPhone);
            setToast({ message: 'המספר הועתק!', type: 'success' });
            tg?.HapticFeedback?.selectionChanged();
        }
    };

    const handleOpenApp = (app: 'bit' | 'paybox') => {
        const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
        const isAndroid = /android/i.test(userAgent);
        const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;

        const config = {
            bit: {
                scheme: 'bit://',
                web: 'https://www.bitpay.co.il',
                storeWebAndroid: 'https://play.google.com/store/apps/details?id=com.bnhp.payments.paymentsapp',
                storeWebIOS: 'https://apps.apple.com/il/app/bit-%D7%91%D7%99%D7%98/id1182007739'
            },
            paybox: {
                scheme: 'payboxapp://',
                web: 'https://www.payboxapp.com/',
                storeWebAndroid: 'https://play.google.com/store/apps/details?id=com.payboxapp',
                storeWebIOS: 'https://apps.apple.com/il/app/paybox/id895491053'
            }
        }[app];

        if (isAndroid || isIOS) {
            const now = Date.now();
            window.location.href = config.scheme;
            setTimeout(() => {
                if (Date.now() - now < 2500) window.location.href = isAndroid ? config.storeWebAndroid : config.storeWebIOS;
            }, 1000);
        } else {
            window.open(config.web, '_blank');
        }
    };

    const getPaypalLink = () => {
        if (!data || !data.commission || !data.paypalEmail) return '#';
        const amount = Math.round(Number(data.commission));
        return `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${encodeURIComponent(data.paypalEmail)}&currency_code=ILS&amount=${amount}&item_name=${encodeURIComponent(`Order ${orderId}`)}`;
    };

    const getGreeting = () => {
        const h = new Date().getHours();
        if (h >= 5 && h < 12) return 'בוקר טוב! ☀️';
        if (h >= 12 && h < 17) return 'צהריים טובים! 😎';
        if (h >= 17 && h < 21) return 'ערב טוב! 🌆';
        return 'לילה טוב! 🌙';
    };

    const openWaze = (address?: string) => {
        if (!address) return;
        window.open(`https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`, '_blank');
    };

    const callCustomer = () => {
        if (data?.customerPhone) {
            window.open(`tel:${data.customerPhone}`, '_self');
        }
    };

    // --- RENDER HELPERS ---

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                <p className="text-gray-600 font-medium">טוען פרטי נסיעה...</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 p-6 text-center">
                <XCircle className="w-16 h-16 text-red-500 mb-4" />
                <h2 className="text-xl font-bold text-gray-800 mb-2">לא נמצאה נסיעה פעילה</h2>
                <p className="text-gray-600 mb-6">{error || 'הנסיעה בוטלה או פג תוקפה.'}</p>
                <button onClick={handleClose} className="px-6 py-2 bg-gray-800 text-white rounded-lg">סגור</button>
            </div>
        );
    }

    const normalizedStatus = (data.status || '').toLowerCase();
    const isPaid = normalizedStatus === 'paid' || normalizedStatus === 'in_progress' || normalizedStatus === 'completed' ||
        normalizedStatus === 'arrived' || normalizedStatus === 'on_route' ||
        data.paymentCompleted === true || String(data.paymentCompleted).toLowerCase() === 'true';
    const currentStatus = data.status || '';
    const paymentReportedInOrder = data.paymentReported === true || data.paymentStatus === 'WAITING_APPROVAL';
    const isWaiting = currentStatus === 'waiting_approval' || (currentStatus === 'assigned' && (paymentReported || paymentReportedInOrder));

    // --- VIEW 1: WAITING APPROVAL ---
    // --- VIEW 1: WAITING APPROVAL & ACTIVE RIDE ---
    if (isWaiting && !isPaid) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col animate-in fade-in pb-10" dir="rtl">
                {/* Status Announcement Banner */}
                <div className="bg-amber-100 border-b border-amber-200 px-6 py-4 flex items-center gap-4 animate-pulse">
                    <div className="bg-amber-500 p-2 rounded-full text-white">
                        <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-amber-900">התשלום בבדיקה...</h2>
                        <p className="text-[10px] text-amber-800">המסך יתעדכן אוטומטית ברגע שהסדרן יאשר.</p>
                    </div>
                    {data.paymentPhone && (
                        <a href={`https://wa.me/${data.paymentPhone.replace(/\D/g, '')}?text=${encodeURIComponent('שילמתי על הזמנה ' + orderId)}`}
                            className="mr-auto bg-green-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm flex items-center gap-1">
                            <MessageSquare size={12} /> הודעה לסדרן
                        </a>
                    )}
                </div>

                {/* Modern Header (Same as View 5) */}
                <div className="bg-slate-900 text-white p-6 pb-10 rounded-b-[2.5rem] shadow-xl relative overflow-hidden">
                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                                פרטי נסיעה
                            </h1>
                            <div className="flex items-center gap-4 mt-2">
                                <span className="text-slate-400 text-sm font-mono tracking-wide">#{orderId}</span>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-lg border border-white/10 text-xs font-bold">
                                        <User size={12} className="text-blue-400" />
                                        <span>x {data.passengers || 1}</span>
                                    </div>
                                    <div className="flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-lg border border-white/10 text-xs font-bold">
                                        <Briefcase size={12} className="text-amber-400" />
                                        <span>x {data.luggage || 0}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="text-left font-inter">
                            <div className="text-2xl font-black text-white">₪{Number(data.price).toLocaleString()}</div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-right">סוע"כ עסקאות</p>
                        </div>
                    </div>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                </div>

                {/* 4 COLOR BLOCKS GRID (Same as View 5) */}
                <div className="px-5 mt-2 grid grid-cols-2 gap-4">
                    <InfoBlock
                        title="פרטי נסיעה"
                        icon={<Map size={24} />}
                        color="bg-emerald-500"
                        textColor="text-emerald-50"
                        content={
                            <div className="space-y-4 pt-2">
                                <div>
                                    <p className="text-[10px] uppercase font-black opacity-60 mb-1">מאיפה?</p>
                                    <p className="text-sm font-bold leading-tight">{data.pickupExactAddress || data.pickupAddress}</p>
                                    <button onClick={() => openWaze(data.pickupExactAddress || data.pickupAddress)} className="mt-2 w-full py-2 bg-white/20 rounded-xl text-xs font-black flex items-center justify-center gap-2">
                                        <Navigation size={14} /> נווט לאיסוף
                                    </button>
                                </div>
                                <div className="pt-2 border-t border-white/10">
                                    <p className="text-[10px] uppercase font-black opacity-60 mb-1">לאן?</p>
                                    <p className="text-sm font-bold leading-tight">{data.destinationExactAddress || data.destinationAddress}</p>
                                    <button onClick={() => openWaze(data.destinationExactAddress || data.destinationAddress)} className="mt-2 w-full py-2 bg-white/10 rounded-xl text-xs font-black flex items-center justify-center gap-2">
                                        <Navigation size={14} /> נווט ליעד
                                    </button>
                                </div>
                            </div>
                        }
                    />
                    <InfoBlock
                        title="הערות"
                        icon={<MessageSquare size={24} />}
                        color="bg-amber-400"
                        textColor="text-amber-900"
                        content={
                            <div className="space-y-3 pt-2">
                                {data.notes ? <div className="p-2 bg-white/20 rounded-lg"><p className="text-[10px] font-black uppercase opacity-60 mb-0.5">כללי:</p><p className="text-xs font-bold">{data.notes}</p></div> : null}
                                {data.pickupNotes ? <div className="p-2 bg-white/10 rounded-lg"><p className="text-[10px] font-black uppercase opacity-60 mb-0.5">באיסוף:</p><p className="text-xs">{data.pickupNotes}</p></div> : null}
                                {data.destinationNotes ? <div className="p-2 bg-white/10 rounded-lg"><p className="text-[10px] font-black uppercase opacity-60 mb-0.5">ביעד:</p><p className="text-xs">{data.destinationNotes}</p></div> : null}
                                {!data.notes && !data.pickupNotes && !data.destinationNotes && <p className="text-xs opacity-50 italic">אין הערות מיוחדות</p>}
                            </div>
                        }
                    />
                    <InfoBlock
                        title="תוספות"
                        icon={<Plus size={24} />}
                        color="bg-blue-600"
                        textColor="text-blue-50"
                        content={
                            <div className="grid grid-cols-1 gap-3 pt-2">
                                <div className="flex items-center justify-between p-2 bg-white/10 rounded-lg"><div className="flex items-center gap-2"><User size={14} /><span className="text-xs font-bold">נוסעים</span></div><span className="text-lg font-black">{data.passengers || 1}</span></div>
                                <div className="flex items-center justify-between p-2 bg-white/10 rounded-lg"><div className="flex items-center gap-2"><Briefcase size={14} /><span className="text-xs font-bold">מזוודות</span></div><span className="text-lg font-black">{data.luggage || 0}</span></div>
                                {data.flightNumber && <div className="p-2 bg-white/10 rounded-lg"><p className="text-[10px] font-black uppercase opacity-60">מספר טיסה:</p><p className="text-sm font-black">{data.flightNumber}</p></div>}
                            </div>
                        }
                    />
                    <div onClick={callCustomer} className="bg-orange-500 text-white rounded-3xl p-5 shadow-lg active:scale-95 transition-all flex flex-col items-center justify-center gap-3 text-center">
                        <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center"><Phone size={30} fill="currentColor" /></div>
                        <h4 className="font-black text-lg">חייג ללקוח</h4>
                        <p className="text-[10px] font-bold opacity-80">{data.customerName}</p>
                    </div>
                </div>

                <div className="mt-8 px-5 pb-10 flex flex-col items-center justify-center text-center">
                    <div className="mb-4 text-slate-400 animate-pulse">
                        <Smartphone size={40} className="mx-auto opacity-20" />
                        <p className="mt-2 text-xs font-black uppercase tracking-widest">ממתין לאישור תשלום...</p>
                    </div>
                </div>
            </div>
        );
    }

    // --- VIEW 2: COMPLETED (INVOICE & TRIP SUMMARY) ---
    if (showMarketing) {
        return <MarketingView data={data} handleClose={handleClose} />;
    }

    // --- VIEW 2: COMPLETED (INVOICE & TRIP SUMMARY) ---
    if (currentStatus === 'completed') {
        const dist = data.distanceKm || 0;
        const dur = data.duration || '0 דקות';
        const price = Number(String(data.price).replace(/[^\d.]/g, '')) || 0;
        const comm = Number(data.commission) || 0;
        const profit = price - comm;

        return (
            <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center animate-in zoom-in duration-500">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-100 rounded-full mb-4 text-emerald-600 shadow-inner">
                        <CheckCircle size={40} />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">נסיעה מצוינת!</h1>
                    <p className="text-slate-500 font-medium">הנתונים נרשמו במערכת בהצלחה</p>
                </div>

                <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden mb-8 border border-slate-100">
                    <div className="h-2 bg-gradient-to-r from-blue-500 to-emerald-500"></div>
                    <div className="p-8">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-black text-xl text-slate-800">סיכום רווחים</h3>
                            <span className="text-slate-400 font-mono text-xs">#{orderId}</span>
                        </div>

                        <div className="space-y-4 mb-8">
                            <div className="flex justify-between items-center text-lg">
                                <span className="text-slate-500 font-semibold">מחיר נסיעה</span>
                                <span className="font-bold text-slate-900">₪{price.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm text-slate-400">
                                <span>עמלת תחנה</span>
                                <span className="font-bold">- ₪{comm.toLocaleString()}</span>
                            </div>
                            <div className="pt-4 border-t-2 border-dashed border-slate-100 flex justify-between items-center">
                                <span className="text-slate-900 font-black text-xl">הרווח שלך</span>
                                <div className="text-3xl font-black text-emerald-600 flex items-baseline gap-1">
                                    <span className="text-lg">₪</span>{profit.toLocaleString()}
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden group">
                            <div className="relative z-10 flex items-center justify-between">
                                <div>
                                    <p className="text-blue-300 text-[10px] font-black uppercase tracking-widest mb-1">הכנסה יומית</p>
                                    <p className="text-2xl font-black">₪{Math.round(Number(data.totalRevenue || profit)).toLocaleString()}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-emerald-300 text-[10px] font-black uppercase tracking-widest mb-1">נסיעות היום</p>
                                    <p className="text-2xl font-black text-emerald-400">{data.totalRides || '1'}</p>
                                </div>
                            </div>
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16"></div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-4 w-full max-w-md">
                    <button
                        onClick={() => {
                            tg?.HapticFeedback?.notificationOccurred('success');
                            setShowMarketing(true);
                        }}
                        className="py-5 bg-blue-600 text-white rounded-[2rem] font-bold shadow-xl hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-3 text-lg"
                    >
                        <Zap size={20} /> מוכן לנסיעה הבאה!
                    </button>

                    <button
                        onClick={() => window.print()}
                        className="py-4 bg-white border border-slate-200 text-slate-600 rounded-[1.5rem] font-bold flex items-center justify-center gap-2"
                    >
                        <Download size={18} /> הורד קבלה
                    </button>
                </div>
            </div>
        );
    }

    // --- VIEW 5: ACTIVE RIDE CONTROL (4 BLOCKS REDESIGN) ---
    if (isPaid && (data.status === 'assigned' || data.status === 'paid' || data.status === 'arrived' || data.status === 'on_route' || data.status === 'in_progress')) {
        const isActuallyInProgress = data.status === 'in_progress';

        return (
            <div className="min-h-screen bg-slate-50 flex flex-col animate-in fade-in pb-10" dir="rtl">
                {/* Modern Header */}
                <div className="bg-slate-900 text-white p-6 pb-10 rounded-b-[2.5rem] shadow-xl relative overflow-hidden">
                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                                {isActuallyInProgress ? 'נסיעה פעילה' : 'פרטי נסיעה'}
                            </h1>
                            <div className="flex items-center gap-4 mt-2">
                                <span className="text-slate-400 text-sm font-mono tracking-wide">#{orderId}</span>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-lg border border-white/10 text-xs font-bold">
                                        <User size={12} className="text-blue-400" />
                                        <span>x {data.passengers || 1}</span>
                                    </div>
                                    <div className="flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-lg border border-white/10 text-xs font-bold">
                                        <Briefcase size={12} className="text-amber-400" />
                                        <span>x {data.luggage || 0}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="text-left font-inter">
                            <div className="text-2xl font-black text-white">₪{Number(data.price).toLocaleString()}</div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-right">סוע"כ עסקאות</p>
                        </div>
                    </div>

                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                </div>

                {/* 4 COLOR BLOCKS GRID */}
                <div className="px-5 mt-2 grid grid-cols-2 gap-4">
                    {/* 1. Details Block (Green) */}
                    <InfoBlock
                        title="פרטי נסיעה"
                        icon={<Map size={24} />}
                        color="bg-emerald-500"
                        textColor="text-emerald-50"
                        content={
                            <div className="space-y-4 pt-2">
                                <div>
                                    <p className="text-[10px] uppercase font-black opacity-60 mb-1">מאיפה?</p>
                                    <p className="text-sm font-bold leading-tight">{data.pickupExactAddress || data.pickupAddress}</p>
                                    <button onClick={() => openWaze(data.pickupExactAddress || data.pickupAddress)} className="mt-2 w-full py-2 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition">
                                        <Navigation size={14} /> נווט לאיסוף
                                    </button>
                                </div>
                                <div className="pt-2 border-t border-white/10">
                                    <p className="text-[10px] uppercase font-black opacity-60 mb-1">לאן?</p>
                                    <p className="text-sm font-bold leading-tight">{data.destinationExactAddress || data.destinationAddress}</p>
                                    <button onClick={() => openWaze(data.destinationExactAddress || data.destinationAddress)} className="mt-2 w-full py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition">
                                        <Navigation size={14} /> נווט ליעד
                                    </button>
                                </div>
                            </div>
                        }
                    />

                    {/* 2. Messages Block (Yellow) */}
                    <InfoBlock
                        title="הערות"
                        icon={<MessageSquare size={24} />}
                        color="bg-amber-400"
                        textColor="text-amber-900"
                        content={
                            <div className="space-y-3 pt-2">
                                {data.notes ? (
                                    <div className="p-2 bg-white/20 rounded-lg">
                                        <p className="text-[10px] font-black uppercase opacity-60 mb-0.5">כללי:</p>
                                        <p className="text-xs font-bold">{data.notes}</p>
                                    </div>
                                ) : null}
                                {data.pickupNotes ? (
                                    <div className="p-2 bg-white/10 rounded-lg">
                                        <p className="text-[10px] font-black uppercase opacity-60 mb-0.5">באיסוף:</p>
                                        <p className="text-xs">{data.pickupNotes}</p>
                                    </div>
                                ) : null}
                                {data.destinationNotes ? (
                                    <div className="p-2 bg-white/10 rounded-lg">
                                        <p className="text-[10px] font-black uppercase opacity-60 mb-0.5">ביעד:</p>
                                        <p className="text-xs">{data.destinationNotes}</p>
                                    </div>
                                ) : null}
                                {!data.notes && !data.pickupNotes && !data.destinationNotes && (
                                    <p className="text-xs opacity-50 italic">אין הערות מיוחדות</p>
                                )}
                            </div>
                        }
                    />

                    {/* 3. Additions Block (Blue) */}
                    <InfoBlock
                        title="תוספות"
                        icon={<Plus size={24} />}
                        color="bg-blue-600"
                        textColor="text-blue-50"
                        content={
                            <div className="grid grid-cols-1 gap-3 pt-2">
                                <div className="flex items-center justify-between p-2 bg-white/10 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <User size={14} />
                                        <span className="text-xs font-bold">נוסעים</span>
                                    </div>
                                    <span className="text-lg font-black">{data.passengers || 1}</span>
                                </div>
                                <div className="flex items-center justify-between p-2 bg-white/10 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <Briefcase size={14} />
                                        <span className="text-xs font-bold">מזוודות</span>
                                    </div>
                                    <span className="text-lg font-black">{data.luggage || 0}</span>
                                </div>
                                {data.flightNumber && (
                                    <div className="p-2 bg-white/10 rounded-lg">
                                        <p className="text-[10px] font-black uppercase opacity-60">מספר טיסה:</p>
                                        <p className="text-sm font-black">{data.flightNumber}</p>
                                    </div>
                                )}
                            </div>
                        }
                    />

                    {/* 4. Call Block (Orange) */}
                    <div
                        onClick={callCustomer}
                        className="bg-orange-500 text-white rounded-3xl p-5 shadow-lg active:scale-95 transition-all flex flex-col items-center justify-center gap-3 text-center"
                    >
                        <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                            <Phone size={30} fill="currentColor" />
                        </div>
                        <h4 className="font-black text-lg">חייג ללקוח</h4>
                        <p className="text-[10px] font-bold opacity-80">{data.customerName}</p>
                    </div>
                </div>

                {/* BOTTOM ACTIONS (DRIVER HUD) */}
                <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-slate-900 via-slate-900/90 to-transparent flex flex-col gap-4 w-full z-50 pointer-events-none pb-8 sm:pb-5">
                    <div className="max-w-md mx-auto w-full pointer-events-auto">
                        {!isActuallyInProgress ? (
                            <>
                                {currentStatus !== 'arrived' ? (
                                    <button
                                        onClick={handleArrived}
                                        className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-2xl shadow-[0_0_30px_rgba(249,115,22,0.4)] active:scale-95 transition-all flex items-center justify-center gap-3 border-4 border-orange-500 animate-[bounce-soft_2s_infinite]"
                                    >
                                        <MapPin className="w-8 h-8 text-orange-400" /> הגעתי לכתובת
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleStartRide}
                                        disabled={starting}
                                        className="w-full py-6 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-[2rem] font-black text-2xl shadow-[0_0_30px_rgba(16,185,129,0.5)] active:scale-95 transition-all flex items-center justify-center gap-3 border-4 border-emerald-400 animate-[pulse-soft_2s_infinite]"
                                    >
                                        {starting ? <Loader2 className="animate-spin w-8 h-8" /> : <ArrowRight className="w-8 h-8" />}
                                        התחל נסיעה
                                    </button>
                                )}
                            </>
                        ) : (
                            <button
                                onClick={handleComplete}
                                disabled={completing}
                                className="w-full py-6 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[2rem] font-black text-2xl shadow-[0_10px_40px_-10px_rgba(16,185,129,0.5)] active:scale-95 transition-all flex items-center justify-center gap-3 border-4 border-emerald-400"
                            >
                                {completing ? <Loader2 className="animate-spin w-8 h-8" /> : <CheckCircle className="w-8 h-8" />}
                                סיימתי נסיעה
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // --- VIEW 4: PAYMENT (DEFAULT FALLBACK) ---
    return (
        <div className={`min-h-screen pb-10 transition-colors duration-700 bg-slate-50`}>
            {/* Header Status Bar */}
            <div className={`p-6 pb-12 rounded-b-[2.5rem] shadow-lg transition-all duration-700 relative overflow-hidden bg-slate-900`}>
                <div className="relative z-10 text-white text-center">
                    <h1 className="text-2xl font-black mb-1">הסדרת תשלום</h1>
                    <p className="opacity-80 text-sm font-mono tracking-wide">#{orderId}</p>

                    <div className="mt-4 inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20">
                        <Clock className={`w-4 h-4 ${Number(timeLeft?.split(':')[0]) < 2 ? 'animate-bounce text-red-300' : ''}`} />
                        <span className="font-mono font-bold text-lg">{timeLeft}</span>
                    </div>
                </div>

                {/* Decoration Circles */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12"></div>
            </div>

            <div className="max-w-md mx-auto px-5 -mt-8 relative z-20 space-y-5">
                {/* --- PAYMENT CARD --- */}
                <div className="bg-white rounded-[2rem] shadow-xl p-1 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                    {/* Amount Banner */}
                    <div className="bg-gradient-to-r from-yellow-400 to-amber-500 p-6 rounded-[1.8rem] text-center text-slate-900 shadow-inner mb-2 relative overflow-hidden group">
                        <div className="relative z-10">
                            <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-1">עמלה לתשלום</p>
                            <div className="text-5xl font-black tracking-tighter flex items-center justify-center gap-1">
                                <span className="text-2xl opacity-60">₪</span>{Math.round(Number(data.commission))}
                            </div>
                        </div>
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                    </div>

                    {/* Payment Methods */}
                    <div className="p-4 space-y-3">
                        {/* Bit/Paybox Accordion */}
                        <div className="border border-slate-100 rounded-2xl overflow-hidden transition-all shadow-sm hover:shadow-md">
                            <div onClick={() => setIsFlipped(!isFlipped)} className="flex items-center justify-between p-4 cursor-pointer bg-white">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center"><Smartphone size={20} /></div>
                                    <div className="text-right">
                                        <h4 className="font-bold text-slate-800">Bit / Paybox</h4>
                                        <p className="text-[10px] text-slate-400">העברה למספר</p>
                                    </div>
                                </div>
                                <ChevronRight size={18} className={`text-slate-300 transition-transform ${isFlipped ? 'rotate-90' : ''}`} />
                            </div>

                            {isFlipped && (
                                <div className="p-4 bg-slate-50 border-t border-slate-100 animate-in slide-in-from-top-2">
                                    <div onClick={handleCopyPhone} className="bg-white border border-dashed border-slate-300 p-3 rounded-xl flex items-center justify-between cursor-pointer active:scale-95 transition mb-4">
                                        <span className="font-mono font-bold text-lg text-slate-700 tracking-wider">
                                            {data.paymentPhone || 'Loading...'}
                                        </span>
                                        <div className="bg-slate-100 p-2 rounded-lg text-slate-400"><Copy size={14} /></div>
                                    </div>

                                    <div className="flex gap-2 mb-4">
                                        <button onClick={() => handleOpenApp('bit')} className="flex-1 py-2 bg-blue-100 text-blue-700 font-bold rounded-lg text-sm hover:bg-blue-200">Bit</button>
                                        <button onClick={() => handleOpenApp('paybox')} className="flex-1 py-2 bg-yellow-100 text-yellow-700 font-bold rounded-lg text-sm hover:bg-yellow-200">Paybox</button>
                                    </div>

                                    <button onClick={handleMarkPayment} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-slate-800 flex items-center justify-center gap-2">
                                        <CheckCircle size={16} className="text-green-400" /> עשיתי העברה
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* PayPal Link */}
                        <a href={getPaypalLink()} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 transition">
                            <div className="w-10 h-10 bg-primary-50 text-primary-600 rounded-full flex items-center justify-center"><CreditCard size={20} /></div>
                            <div className="text-right flex-1">
                                <h4 className="font-bold text-slate-800">אשראי / PayPal</h4>
                                <p className="text-[10px] text-slate-400">תשלום מהיר ומאובטח</p>
                            </div>
                            <ExternalLink size={16} className="text-slate-300" />
                        </a>
                    </div>
                </div>

            </div>

            {/* Expiration Modal */}
            {expired && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in">
                    <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full text-center shadow-2xl">
                        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Clock className="w-10 h-10 text-red-500" />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mb-2">נגמר הזמן</h2>
                        <p className="text-slate-500 mb-6">הזמן לתשלום עבר וההזמנה חזרה למאגר.</p>
                        <button onClick={handleClose} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold">סגור</button>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

// --- MARKETING VIEW COMPONENT ---
const MarketingView: React.FC<{ data: RideDetailsData, handleClose: () => void }> = ({ data, handleClose }) => {
    const [timeLeft, setTimeLeft] = useState(30);
    const navigate = useNavigate();

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleClose();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [handleClose]);

    const getDynamicGreeting = () => {
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay(); // 0=Sunday, 5=Friday, 6=Shabbat

        // Shabbat/Friday logic (Primitive but helpful)
        if (day === 5 && hour >= 15) return 'שבת שלום ומבורכת! 🕯️🕯️';
        if (day === 6 && hour < 20) return 'שבת שלום! 🛐';
        if (day === 0 && hour < 10) return 'שבוע טוב ומוצלח! 🚀';

        if (hour >= 5 && hour < 12) return 'בוקר טוב ומלא בעבודה! ☀️';
        if (hour >= 12 && hour < 17) return 'צהריים מצוינים! 😎';
        if (hour >= 17 && hour < 21) return 'ערב נעים ושקט! 🌆';
        return 'לילה טוב ופרנסה בשפע! 🌙';
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-700">
            <div className="w-24 h-24 bg-gradient-to-tr from-blue-500 to-emerald-500 rounded-3xl rotate-12 flex items-center justify-center shadow-2xl mb-8 animate-bounce transition-transform">
                <Zap size={48} className="text-white fill-white" />
            </div>

            <h1 className="text-4xl font-black mb-4 tracking-tighter">{getDynamicGreeting()}</h1>
            <p className="text-slate-400 text-lg mb-12 max-w-xs mx-auto">
                היית נהדר היום! המערכת זוכרת את כל הביצועים שלך.
            </p>

            <div className="grid grid-cols-2 gap-4 w-full max-w-sm mb-12">
                <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] backdrop-blur-sm">
                    <p className="text-blue-400 text-[10px] font-black uppercase mb-1">סה"כ נסיעות</p>
                    <p className="text-3xl font-black">{data.totalRides || '1'}</p>
                </div>
                <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] backdrop-blur-sm">
                    <p className="text-emerald-400 text-[10px] font-black uppercase mb-1">רווח מצטבר</p>
                    <p className="text-3xl font-black">₪{Math.round(Number(data.totalRevenue || 0)).toLocaleString()}</p>
                </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 p-6 rounded-[2.5rem] w-full max-w-sm mb-12">
                <p className="text-blue-300 font-bold mb-2">💡 טיפ לפרנסה:</p>
                <p className="text-sm leading-relaxed text-blue-100">
                    מומלץ לבדוק את קבוצת הווטסאפ של התחנה ברגע זה. נסיעות חדשות מחכות רק לך!
                </p>
            </div>

            <div className="space-y-4 w-full max-w-xs">
                <button
                    onClick={handleClose}
                    className="w-full py-4 bg-white text-slate-900 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all"
                >
                    צא מהמערכת
                </button>
                <p className="text-slate-500 text-xs animate-pulse">
                    המסך ייסגר אוטומטית בעוד {timeLeft} שניות...
                </p>
            </div>
        </div>
    );
};

const InfoBlock: React.FC<{
    title: string,
    icon: React.ReactNode,
    color: string,
    textColor: string,
    content: React.ReactNode
}> = ({ title, icon, color, textColor, content }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div
            onClick={() => setIsOpen(!isOpen)}
            className={`${color} ${textColor} rounded-3xl p-5 shadow-lg transition-all duration-300 flex flex-col items-center text-center cursor-pointer ${isOpen ? 'col-span-2' : ''}`}
        >
            <div className="bg-white/10 p-3 rounded-2xl mb-2">
                {icon}
            </div>
            <h4 className="font-black text-sm whitespace-nowrap">{title}</h4>

            {isOpen ? (
                <div className="w-full mt-4 animate-in slide-in-from-top-2 duration-300 text-right">
                    {content}
                    <div className="mt-4 flex justify-center">
                        <ChevronDown size={20} className="rotate-180 opacity-50" />
                    </div>
                </div>
            ) : (
                <div className="mt-auto pt-2">
                    <ChevronDown size={16} className="opacity-30" />
                </div>
            )}
        </div>
    );
};




