
import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { getOrderStatus } from '../api/passengerApi';
import { listenToOrder } from '../services/firebase';
import { OrderStatusResponse } from '../types'; // This matches RideDetailsData
import { LiveMap } from '../components/LiveMap';
import { Loader2, Car, User, Clock, CheckCircle, Search, MapPin, XCircle, Home, Phone, Shield, Share2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { RadarScanner } from '../components/RadarScanner';
import { Button, Card, Input, Spinner } from '../components/ui';

const RideTimeline = ({ status }: { status: string }) => {
    const steps = [
        { id: 'pending', label: 'מחפש' },
        { id: 'assigned', label: 'בדרך אליך' },
        { id: 'arrived', label: 'הגיע' },
        { id: 'in_progress', label: 'בנסיעה' },
        { id: 'completed', label: 'הושלם' },
    ];

    // Normalize status terminology for the timeline
    let normalizedStatus = status === 'confirmed' ? 'assigned' : (status === 'on_route' ? 'in_progress' : status);

    // Ensure "cancelled" or other strange states don't break the UI
    let currentIndex = steps.findIndex(s => s.id === normalizedStatus);
    const activeIndex = currentIndex >= 0 ? currentIndex : 0;

    return (
        <div className="flex justify-between items-center relative w-full pt-2 pb-6 px-4" dir="rtl">
            {/* Background Line */}
            <div className="absolute top-[14px] left-6 right-6 h-1.5 bg-slate-100 rounded-full z-0"></div>
            {/* Active Progress Line */}
            <div
                className="absolute top-[14px] right-6 h-1.5 bg-success rounded-full z-0 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                style={{ width: `calc(${(activeIndex / (steps.length - 1)) * 100}% - ${activeIndex === 0 ? '0px' : '30px'})` }} // Adjust for padding
            ></div>

            {steps.map((step, idx) => {
                const isCompleted = idx < activeIndex;
                const isActive = idx === activeIndex;

                let stateClass = 'bg-white border-slate-200'; // Upcoming
                if (isCompleted) stateClass = 'bg-success border-success scale-110 shadow-lg shadow-success/20';
                if (isActive) stateClass = 'bg-white border-success ring-4 ring-success/20 shadow-[0_0_15px_rgba(16,185,129,0.3)] scale-125';
                if (status === 'cancelled') stateClass = 'bg-danger border-danger';

                return (
                    <div key={step.id} className="relative z-10 flex flex-col items-center">
                        <div className={`w-3.5 h-3.5 rounded-full border-[3px] transition-all duration-700 ${stateClass}`} />
                        <span className={`absolute -bottom-6 text-[10px] font-black whitespace-nowrap transition-colors duration-500 tracking-tight ${isActive && status !== 'cancelled' ? 'text-success' : isCompleted ? 'text-slate-600' : 'text-slate-300'}`}>
                            {status === 'cancelled' && isActive ? 'בוטל' : step.label}
                        </span>
                    </div>
                )
            })}
        </div>
    );
};

export const OrderStatus: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const urlOrderId = searchParams.get('orderId');
    const [orderId, setOrderId] = useState(urlOrderId || '');
    const [data, setData] = useState<any | null>(null); // Use any to merge OrderStatusResponse and Firebase Order
    const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    // Fetch Initial Data
    const fetchStatus = async (id: string) => {
        if (!id) return;
        setStatus('loading');
        try {
            const res = await getOrderStatus(id);
            if (res.ok && res.data) {
                setData(res.data);
                setStatus('idle');
            } else {
                setStatus('error');
                setErrorMsg(res.error || 'הזמנה לא נמצאה');
            }
        } catch (e) {
            setStatus('error');
            setErrorMsg('שגיאת תקשורת');
        }
    };

    useEffect(() => {
        if (urlOrderId) {
            setOrderId(urlOrderId);
            fetchStatus(urlOrderId);
        }
    }, [urlOrderId]);

    // Real-time Updates — bind once per orderId (do not re-subscribe on fetch status)
    useEffect(() => {
        if (!orderId) return;
        let cancelled = false;

        const unsubscribe = listenToOrder(orderId, (updatedOrder) => {
            if (cancelled || !updatedOrder) return;
            setData((prev: any) => {
                const nextLoc = updatedOrder.driverLocation || (updatedOrder as any).driver_location;
                const prevLoc = prev?.driverLocation || prev?.driver_location;
                const locUnchanged = prevLoc && nextLoc &&
                    Math.abs(Number(prevLoc.lat) - Number(nextLoc.lat)) < 0.00008 &&
                    Math.abs(Number(prevLoc.lng) - Number(nextLoc.lng)) < 0.00008;
                const statusUnchanged = prev?.status === updatedOrder.status;
                const stampUnchanged = (prev?.updatedAt || '') === (updatedOrder.updatedAt || '');
                if (prev && locUnchanged && statusUnchanged && stampUnchanged) return prev;

                return {
                    ...prev,
                    ...updatedOrder,
                    pickupLat: updatedOrder.pickupLat || prev?.pickupLat,
                    pickupLng: updatedOrder.pickupLng || prev?.pickupLng,
                    destinationLat: updatedOrder.destinationLat || prev?.destinationLat,
                    destinationLng: updatedOrder.destinationLng || prev?.destinationLng,
                    driver: { ...prev?.driver, ...updatedOrder.driver },
                    driverLocation: nextLoc || prevLoc
                };
            });
        });

        return () => {
            cancelled = true;
            unsubscribe();
        };
    }, [orderId]);

    const handleManualSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setSearchParams({ orderId });
    };

    const getStatusDisplay = (s: string) => {
        switch (s) {
            case 'pending': return { text: 'מחפש נהג...', color: 'bg-accent text-slate-900', icon: Loader2, animate: true };
            case 'confirmed':
            case 'assigned': return { text: 'נהג בדרך', color: 'bg-primary text-white', icon: Car, animate: false };
            case 'arrived': return { text: 'נהג ממתין', color: 'bg-orange-500 text-white', icon: MapPin, animate: true, pulse: true };
            case 'on_route':
            case 'in_progress': return { text: 'בנסיעה', color: 'bg-primary-600 text-white', icon: MapPin, animate: false };
            case 'completed': return { text: 'הושלם', color: 'bg-success text-white', icon: CheckCircle, animate: false };
            case 'cancelled': return { text: 'בוטל', color: 'bg-danger text-white', icon: XCircle, animate: false };
            default: return { text: 'ממתין', color: 'bg-slate-500 text-white', icon: Clock, animate: false };
        }
    };

    // Prepare Map Props
    const mapProps = data ? {
        pickup: (data.pickupLat && data.pickupLng) ? { lat: Number(data.pickupLat), lng: Number(data.pickupLng), address: data.pickupAddress } : undefined,
        destination: (data.destinationLat && data.destinationLng) ? { lat: Number(data.destinationLat), lng: Number(data.destinationLng), address: data.destinationAddress } : undefined,
        driver: (() => {
            const loc = data.driverLocation || (data as any).driver_location;
            return loc ? { lat: Number(loc.lat), lng: Number(loc.lng), heading: loc.heading } : undefined;
        })(),
        status: data.status
    } : {};

    const st = data ? getStatusDisplay(data.status) : null;
    const isArrived = data?.status === 'arrived';

    return (
        <div className="bg-customer h-screen flex flex-col overflow-hidden font-sans" dir="rtl">
            {/* Header / Search (only if no data) */}
            {!data && (
                <div className="flex-1 flex flex-col items-center justify-center p-6">
                    <Card variant="glass" padding="lg" className="w-full max-w-md rounded-3xl">
                        <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white mb-6 mx-auto shadow-xl shadow-slate-200">
                            <Search size={32} />
                        </div>
                        <h1 className="text-2xl font-black text-center text-slate-800 mb-2">מעקב הזמנה</h1>
                        <p className="text-center text-slate-500 mb-8">הזן את מספר ההזמנה לצפייה בסטטוס</p>

                        {status === 'loading' ? (
                            <Spinner role="passenger" fullScreen={false} label="טוען הזמנה..." />
                        ) : (
                        <form onSubmit={handleManualSearch} className="space-y-4">
                            <Input
                                inputSize="lg"
                                className="font-black text-center"
                                placeholder="מספר הזמנה (לדוגמה 1020)"
                                value={orderId}
                                onChange={e => setOrderId(e.target.value)}
                                invalid={status === 'error'}
                            />
                            <Button type="submit" size="lg" variant="primary" className="w-full text-lg shadow-xl">
                                חפש הזמנה
                            </Button>
                        </form>
                        )}
                        {status === 'error' && <p className="text-danger mt-4 text-center font-bold bg-danger/5 p-2 rounded-lg">{errorMsg}</p>}
                    </Card>
                </div>
            )}

            {/* Premium Status View */}
            {data && (
                <>
                    {/* Top Section: Map */}
                    <div className="relative h-[55%] bg-slate-200">
                        <LiveMap {...mapProps} className="h-full w-full" />

                        {/* Floating Status Badge */}
                        <motion.div
                            initial={{ y: -20, opacity: 0 }}
                            animate={{
                                y: 0,
                                opacity: 1,
                                scale: isArrived ? [1, 1.05, 1] : 1
                            }}
                            transition={{
                                scale: isArrived ? { repeat: Infinity, duration: 2 } : { duration: 0.5 }
                            }}
                            className={`absolute top-6 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-3 px-6 py-3 rounded-full shadow-2xl ${st?.color} transition-all duration-500 ${isArrived ? 'ring-4 ring-orange-200/50' : ''}`}
                        >
                            {st && <st.icon className={`w-5 h-5 ${st.animate ? 'animate-spin' : ''} ${st.pulse ? 'animate-pulse' : ''}`} />}
                            <span className="font-black text-lg tracking-wide">{st?.text}</span>
                        </motion.div>

                        {/* Order ID Badge */}
                        <div className="absolute top-6 right-6 z-[500] glass-premium px-4 py-1.5 rounded-full text-xs font-black text-slate-600">
                            #{data.orderId}
                        </div>

                        <Link to="/" className="absolute top-6 left-6 z-[500] w-12 h-12 glass-premium rounded-full flex items-center justify-center text-slate-700 hover:scale-110 active:scale-95 transition-all">
                            <Home size={22} />
                        </Link>
                    </div>

                    {/* Bottom Section: Details Card (Draggable look) */}
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ type: "spring", damping: 20, stiffness: 100 }}
                        className="flex-1 glass-premium rounded-t-[2.5rem] -mt-10 relative z-10 flex flex-col"
                    >
                        <div className="w-12 h-1.5 bg-slate-200/50 rounded-full mx-auto mt-4 mb-2"></div>

                        <div className="flex-1 overflow-y-auto px-6 pb-6">
                            {/* Driver Card */}
                            {data.driver ? (
                                <div className="bg-white/40 backdrop-blur-sm p-5 rounded-2xl border border-white/20 flex items-center gap-4 mb-6 shadow-sm">
                                    <div className="relative">
                                        <div className="w-14 h-14 bg-gradient-to-tr from-slate-900 to-slate-800 rounded-full flex items-center justify-center text-white shadow-lg overflow-hidden">
                                            {data.driver.photo ? <img src={data.driver.photo} alt={data.driver.name} className="w-full h-full object-cover" /> : <Car size={24} />}
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-success border-2 border-white rounded-full flex items-center justify-center">
                                            <CheckCircle size={10} className="text-white" />
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-black text-lg text-slate-900 leading-none mb-1">{data.driver.name}</h3>
                                        <p className="text-sm text-slate-500 font-bold">
                                            {data.driver.carModel} • {data.driver.plateNumber}
                                        </p>
                                        <div className="flex items-center gap-1 mt-1.5">
                                            <div className="flex gap-0.5">
                                                {[1, 2, 3, 4, 5].map(i => <span key={i} className="text-accent text-[10px]">★</span>)}
                                            </div>
                                            <span className="text-slate-400 text-[10px] font-black">(5.0)</span>
                                        </div>
                                    </div>
                                    <a href={`tel:${data.driver.phone}`} className="w-12 h-12 bg-success hover:bg-success/90 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-success/20 transition-all active:scale-95">
                                        <Phone size={22} />
                                    </a>
                                </div>
                            ) : (
                                <div className="mb-6">
                                    <RadarScanner text="מאתר נהגים באזורך..." className="p-4" />
                                </div>
                            )}

                            {/* Animated Timeline */}
                            <div className="mb-8 bg-white/30 rounded-2xl p-2 border border-white/20">
                                <RideTimeline status={data.status} />
                            </div>

                            {/* Trip Route */}
                            <div className="space-y-6 relative pl-3">
                                {/* Dotted Line */}
                                <div className="absolute top-2 right-[7px] bottom-10 w-0.5 bg-slate-200 border-l border-dashed border-slate-300 opacity-50"></div>

                                <div className="flex gap-4 relative">
                                    <div className="w-4 h-4 rounded-full bg-success border-[3px] border-white ring-4 ring-success/10 mt-1 relative z-10 shadow-sm shrink-0"></div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-0.5">איסוף</p>
                                        <p className="font-black text-slate-800 text-lg leading-tight">{data.pickupAddress}</p>
                                        <p className="text-slate-500 text-xs font-bold mt-0.5">{data.pickupDatetime}</p>
                                    </div>
                                </div>

                                <div className="flex gap-4 relative">
                                    <div className="w-4 h-4 rounded-full bg-danger border-[3px] border-white ring-4 ring-danger/10 mt-1 relative z-10 shadow-sm shrink-0"></div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-0.5">יעד</p>
                                        <p className="font-black text-slate-800 text-lg leading-tight">{data.destinationAddress}</p>
                                        {data.price && (
                                            <div className="inline-flex items-center px-3 py-1 bg-white/50 border border-white/30 rounded-full text-xs font-black text-slate-700 mt-2 shadow-sm">
                                                ₪{data.price} <span className="opacity-30 mx-2">|</span> {data.paymentMethod === 'credit' ? 'אשראי' : 'מזומן'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Viral Growth Loop: Share Trip */}
                            <div className="mt-8 grid grid-cols-2 gap-3 pb-4">
                                <button 
                                    onClick={() => {
                                        if (navigator.share) {
                                            navigator.share({
                                                title: 'המונית שלי בדרך!',
                                                text: `הזמנתי מונית ב-TAXIPRO, עקבו אחרי כאן:`,
                                                url: window.location.href
                                            });
                                        } else {
                                            // Fallback to clipboard
                                            navigator.clipboard.writeText(window.location.href);
                                            alert('הקישור הועתק ללוח!');
                                        }
                                    }}
                                    className="btn-premium py-4 rounded-2xl text-slate-900 flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/10"
                                >
                                    <Share2 size={18} /> שתף נסיעה
                                </button>
                                <button className="btn-outline py-4 rounded-2xl text-slate-600">
                                    <Shield size={16} className="inline ml-2" /> עזרה
                                </button>
                            </div>
                            
                            {data.status === 'pending' && (
                                <div className="mt-2 text-center">
                                    <button className="text-danger/60 font-bold text-xs hover:text-danger px-4 py-2 opacity-50">
                                        ביטול הזמנה
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </div>
    );
};
