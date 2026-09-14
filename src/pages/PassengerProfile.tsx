import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sendToBackend } from '../api/passengerApi';
import { Order } from '../types';
import {
    User, Phone, MapPin, Car, Star,
    History, Settings, LogOut, Calendar,
    Bell, Shield, Info, Loader2, CheckCircle, XCircle, Home,
    ChevronRight, Edit3
} from 'lucide-react';

interface PassengerData {
    name: string;
    phone: string;
    email?: string;
    totalRides: number;
    memberSince?: string;
}

type TabType = 'overview' | 'history' | 'notifications' | 'settings' | 'about';

export const PassengerProfile: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [passenger, setPassenger] = useState<PassengerData | null>(null);
    const [rides, setRides] = useState<Order[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [editName, setEditName] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [error, setError] = useState('');

    const handleGoogleCallback = async (response: any) => {
        setIsLoading(true);
        setError('');
        try {
            const base64Url = response.credential.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const profile = JSON.parse(window.atob(base64));

            const res = await sendToBackend<any>('loginWithGoogle', {
                type: 'passenger',
                profile: profile
            });

            if (res.ok && res.data) {
                const data = res.data;
                const newPassenger = {
                    name: profile.name,
                    phone: data.phone || '',
                    email: profile.email,
                    totalRides: 0,
                    memberSince: new Date().toLocaleDateString('he-IL')
                };
                localStorage.setItem('taxi_passenger_profile', JSON.stringify(newPassenger));
                localStorage.setItem('taxi_passenger_phone', data.phone || '');
                localStorage.setItem('taxi_passenger_token', data.token || '');
                setPassenger(newPassenger);
                setEditName(profile.name);
                setEditEmail(profile.email);
            } else {
                setError(res.error || 'שגיאה בהתחברות עם גוגל');
            }
        } catch (err) {
            console.error(err);
            setError('תקלה באימות גוגל');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const stored = localStorage.getItem('taxi_passenger_profile');
        if (stored) {
            try {
                const data = JSON.parse(stored);
                setPassenger(data);
                setEditName(data.name || '');
                setEditEmail(data.email || '');
            } catch { }
        }

        if (!stored) {
            const initializeGoogle = () => {
                if ((window as any).google) {
                    (window as any).google.accounts.id.initialize({
                        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
                        callback: handleGoogleCallback
                    });
                    const btnContainer = document.getElementById('googleBtnPassenger');
                    if (btnContainer) {
                        (window as any).google.accounts.id.renderButton(btnContainer, {
                            theme: 'outline', size: 'large', width: '100%', text: 'signup_with'
                        });
                    }
                }
            };
            const interval = setInterval(() => {
                if ((window as any).google) {
                    initializeGoogle();
                    clearInterval(interval);
                }
            }, 500);
            return () => clearInterval(interval);
        }

        const loadHistory = async () => {
            setIsLoading(true);
            const phone = localStorage.getItem('taxi_passenger_phone');
            if (phone) {
                const res = await sendToBackend<{ items: Order[] }>('getCustomerOrders', { phone });
                if (res.ok && res.data) {
                    setRides(res.data.items || []);
                }
            }
            const notifStr = localStorage.getItem('taxi_passenger_notifications');
            if (notifStr) {
                try { setNotifications(JSON.parse(notifStr)); } catch { }
            }
            setIsLoading(false);
        };

        loadHistory();
    }, [passenger?.phone]);

    const handleSaveProfile = useCallback(() => {
        const updated = { ...passenger, name: editName, email: editEmail };
        localStorage.setItem('taxi_passenger_profile', JSON.stringify(updated));
        setPassenger(updated as PassengerData);
        setEditMode(false);
    }, [passenger, editName, editEmail]);

    const handleLogout = () => {
        localStorage.removeItem('taxi_passenger_profile');
        localStorage.removeItem('taxi_passenger_phone');
        localStorage.removeItem('taxi_passenger_token');
        localStorage.removeItem('taxi_passenger_notifications');
        setPassenger(null);
        navigate('/profile');
    };

    const getStatusBadge = (status: string) => {
        const map: Record<string, { label: string; color: string }> = {
            pending: { label: 'ממתין', color: 'bg-amber-100 text-amber-700' },
            broadcasted: { label: 'מחפש נהג', color: 'bg-blue-100 text-blue-700' },
            assigned: { label: 'נהג שובץ', color: 'bg-indigo-100 text-indigo-700' },
            in_progress: { label: 'בנסיעה', color: 'bg-green-100 text-green-700' },
            completed: { label: 'הושלם', color: 'bg-emerald-100 text-emerald-700' },
            cancelled: { label: 'בוטל', color: 'bg-red-100 text-red-700' },
        };
        const item = map[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
        return <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${item.color}`}>{item.label}</span>;
    };

    const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
        { id: 'overview', label: 'סקירה', icon: User },
        { id: 'history', label: 'נסיעות', icon: History },
        { id: 'notifications', label: 'התראות', icon: Bell },
        { id: 'settings', label: 'הגדרות', icon: Settings },
        { id: 'about', label: 'אודות', icon: Info },
    ];

    return (
        <div className="min-h-screen bg-slate-50 font-sans" dir="rtl">
            {/* Premium Header */}
            <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-2xl border-b border-slate-100/80 shadow-sm">
                <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
                    <Link to="/" className="p-2 rounded-xl hover:bg-slate-100 transition text-slate-600">
                        <Home size={22} />
                    </Link>
                    <h1 className="text-lg font-black tracking-tight text-slate-900">הפרופיל שלי</h1>
                    {passenger && (
                        <button onClick={handleLogout} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition" title="התנתק">
                            <LogOut size={20} />
                        </button>
                    )}
                    {!passenger && <div className="w-9" />}
                </div>
            </div>

            <div className="max-w-lg mx-auto px-4 pb-32">
                {/* Hero Avatar Section */}
                <div className="relative text-center py-10">
                    {/* Gradient blob behind avatar */}
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 w-40 h-40 bg-amber-300/20 rounded-full blur-3xl pointer-events-none" />
                    <div className="relative inline-flex flex-col items-center">
                        <div className="w-28 h-28 rounded-[2rem] bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-amber-200 overflow-hidden ring-4 ring-white">
                            {passenger?.email ? (
                                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(passenger.name)}&background=F59E0B&color=fff&size=128&bold=true`} alt={passenger.name} className="w-full h-full object-cover" />
                            ) : (
                                <User size={44} className="text-white" strokeWidth={2.5} />
                            )}
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">{passenger?.name || 'שלום, אורח'}</h2>
                        {passenger && (
                            <div className="flex items-center gap-4 mt-3">
                                <div className="flex items-center gap-1.5 text-sm font-bold text-slate-500">
                                    <Car size={14} className="text-amber-500" />
                                    <span>{passenger.totalRides || 0} נסיעות</span>
                                </div>
                                {passenger.phone && (
                                    <>
                                        <span className="text-slate-200">•</span>
                                        <span className="text-sm font-bold text-slate-500 dir-ltr">{passenger.phone}</span>
                                    </>
                                )}
                            </div>
                        )}
                        {!passenger && (
                            <div className="mt-6 space-y-4 w-full max-w-sm">
                                <p className="text-sm text-slate-500 font-medium">התחבר כדי לשמור נסיעות ולצבור הטבות</p>
                                <div id="googleBtnPassenger" className="w-full flex justify-center" />
                                {error && <p className="text-red-500 text-xs font-bold bg-red-50 p-2 rounded-xl">{error}</p>}
                            </div>
                        )}
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-1 p-1.5 bg-slate-100/80 rounded-2xl mb-8 shadow-inner">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all duration-300 ${activeTab === tab.id
                                ? 'bg-white text-amber-600 shadow-md scale-105'
                                : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            <tab.icon size={17} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <div className="relative">
                            <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
                                <Loader2 className="animate-spin text-amber-500" size={32} />
                            </div>
                        </div>
                        <p className="text-sm font-bold text-slate-400">טוען נתונים...</p>
                    </div>
                ) : (
                    <>
                        {/* Overview Tab */}
                        {activeTab === 'overview' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                {/* Quick Actions */}
                                <div className="grid grid-cols-2 gap-4">
                                    <Link
                                        to="/order"
                                        className="group p-6 rounded-3xl bg-gradient-to-br from-amber-400 to-amber-500 text-slate-900 text-center shadow-xl shadow-amber-200 hover:shadow-amber-300 hover:-translate-y-1 transition-all duration-300"
                                    >
                                        <Car size={30} className="mx-auto mb-3 drop-shadow-lg" strokeWidth={2.5} />
                                        <p className="font-black text-sm leading-tight">הזמן מונית</p>
                                    </Link>
                                    <Link
                                        to="/track-order"
                                        className="group p-6 rounded-3xl bg-white border border-slate-100 text-slate-700 text-center shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                                    >
                                        <MapPin size={30} className="mx-auto mb-3 text-blue-500" strokeWidth={2.5} />
                                        <p className="font-black text-sm text-slate-800 leading-tight">עקוב אחרי נסיעה</p>
                                    </Link>
                                </div>

                                {/* Recent Rides */}
                                <div>
                                    <div className="flex items-center justify-between mb-4 px-1">
                                        <h3 className="font-black text-slate-900 text-base">נסיעות אחרונות</h3>
                                        {rides.length > 0 && (
                                            <button onClick={() => setActiveTab('history')} className="text-xs font-black text-amber-600 hover:underline">
                                                הכל ({rides.length})
                                            </button>
                                        )}
                                    </div>
                                    {rides.length === 0 ? (
                                        <div className="p-10 rounded-3xl border-2 border-dashed border-slate-200 text-center">
                                            <Car size={36} className="mx-auto mb-3 text-slate-300" />
                                            <p className="text-sm text-slate-400 font-bold">אין נסיעות עדיין</p>
                                            <Link to="/order" className="text-amber-500 text-sm font-black mt-3 inline-block hover:underline">
                                                הזמן את הנסיעה הראשונה שלך ←
                                            </Link>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {rides.slice(0, 3).map((ride, i) => (
                                                <Link
                                                    key={ride.orderId || i}
                                                    to={`/ride/${ride.orderId}`}
                                                    className="block p-5 rounded-2xl bg-white border border-slate-100 hover:border-amber-200 hover:shadow-lg transition-all group"
                                                >
                                                    <div className="flex items-center justify-between mb-3">
                                                        <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg">#{ride.orderId}</span>
                                                        {getStatusBadge(ride.status)}
                                                    </div>
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex flex-col items-center gap-1 mt-1.5 shrink-0">
                                                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                                                            <div className="w-px h-5 bg-slate-200" />
                                                            <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-bold text-slate-800 truncate group-hover:text-amber-600 transition-colors">{ride.pickupAddress}</p>
                                                            <p className="text-xs text-slate-400 truncate mt-2">{ride.destinationAddress}</p>
                                                        </div>
                                                        <p className="font-black text-lg text-slate-900 shrink-0">₪{ride.price}</p>
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* History Tab */}
                        {activeTab === 'history' && (
                            <div className="space-y-3 animate-in fade-in duration-300">
                                <h3 className="font-black text-slate-900 text-base mb-5 flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                                        <History size={16} />
                                    </div>
                                    היסטוריית נסיעות
                                </h3>
                                {rides.length === 0 ? (
                                    <div className="p-14 rounded-3xl border-2 border-dashed border-slate-200 text-center">
                                        <History size={40} className="mx-auto mb-4 text-slate-300" />
                                        <p className="font-bold text-slate-400">אין היסטוריית נסיעות</p>
                                    </div>
                                ) : (
                                    rides.map((ride, i) => (
                                        <Link
                                            key={ride.orderId || i}
                                            to={`/ride/${ride.orderId}`}
                                            className="block p-5 rounded-2xl bg-white border border-slate-100 hover:border-amber-200 hover:shadow-md transition-all"
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg">#{ride.orderId}</span>
                                                    {getStatusBadge(ride.status)}
                                                </div>
                                                <span className="text-[10px] text-slate-400 font-bold">{ride.pickupDatetime?.split('T')[0] || ''}</span>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="flex flex-col items-center gap-1 mt-1.5 shrink-0">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                                    <div className="w-px h-5 bg-slate-200" />
                                                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-slate-800 truncate">{ride.pickupAddress}</p>
                                                    <p className="text-xs text-slate-400 truncate mt-1.5">{ride.destinationAddress}</p>
                                                </div>
                                                <p className="font-black text-lg text-slate-900 shrink-0">₪{ride.price}</p>
                                            </div>
                                            {ride.driverName && (
                                                <div className="mt-3 pt-3 border-t border-slate-50 flex items-center gap-2">
                                                    <Car size={13} className="text-slate-400" />
                                                    <span className="text-xs font-bold text-slate-400">נהג: {ride.driverName}</span>
                                                </div>
                                            )}
                                        </Link>
                                    ))
                                )}
                            </div>
                        )}

                        {/* Notifications Tab */}
                        {activeTab === 'notifications' && (
                            <div className="space-y-3 animate-in fade-in duration-300">
                                <h3 className="font-black text-slate-900 text-base mb-5 flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                                        <Bell size={16} />
                                    </div>
                                    התראות
                                </h3>
                                {notifications.length === 0 ? (
                                    <div className="p-14 rounded-3xl border-2 border-dashed border-slate-200 text-center">
                                        <Bell size={40} className="mx-auto mb-4 text-slate-300" />
                                        <p className="font-bold text-slate-400">אין התראות חדשות</p>
                                        <p className="text-xs text-slate-300 mt-2">כל עדכוני הנסיעות יופיעו כאן</p>
                                    </div>
                                ) : (
                                    notifications.map((notif, i) => (
                                        <div key={i} className="p-4 rounded-2xl bg-white border border-slate-100 flex items-start gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${notif.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
                                                notif.type === 'error' ? 'bg-red-100 text-red-600' :
                                                    'bg-blue-100 text-blue-600'
                                                }`}>
                                                {notif.type === 'success' ? <CheckCircle size={18} /> : notif.type === 'error' ? <XCircle size={18} /> : <Bell size={18} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-800">{notif.title}</p>
                                                <p className="text-xs text-slate-400 mt-1">{notif.message}</p>
                                                <p className="text-[10px] text-slate-300 mt-2">{notif.time}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* Settings Tab */}
                        {activeTab === 'settings' && (
                            <div className="space-y-5 animate-in fade-in duration-300">
                                <h3 className="font-black text-slate-900 text-base mb-5 flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                                        <Settings size={16} />
                                    </div>
                                    הגדרות
                                </h3>

                                {/* Profile Edit */}
                                <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                                    <div className="p-5 border-b border-slate-50 flex items-center justify-between">
                                        <h4 className="font-black text-sm text-slate-800">פרטים אישיים</h4>
                                        {!editMode && (
                                            <button onClick={() => setEditMode(true)} className="flex items-center gap-1.5 text-xs font-black text-amber-600 bg-amber-50 px-3 py-1.5 rounded-xl hover:bg-amber-100 transition-colors">
                                                <Edit3 size={12} /> ערוך
                                            </button>
                                        )}
                                    </div>
                                    <div className="p-5 space-y-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">שם מלא</label>
                                            <input
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                disabled={!editMode}
                                                className="w-full p-3.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-sm text-slate-800 outline-none focus:ring-2 focus:ring-amber-400/40 disabled:opacity-60 transition"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">אימייל</label>
                                            <input
                                                value={editEmail}
                                                onChange={e => setEditEmail(e.target.value)}
                                                disabled={!editMode}
                                                type="email"
                                                className="w-full p-3.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-sm text-slate-800 outline-none focus:ring-2 focus:ring-amber-400/40 disabled:opacity-60 transition"
                                            />
                                        </div>
                                        {editMode && (
                                            <div className="flex gap-3 pt-1">
                                                <button onClick={handleSaveProfile} className="flex-1 py-3 bg-amber-400 text-slate-900 rounded-xl font-black text-sm hover:bg-amber-500 transition shadow-md shadow-amber-100">
                                                    שמור שינויים
                                                </button>
                                                <button onClick={() => setEditMode(false)} className="px-5 py-3 bg-slate-100 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200 transition">
                                                    ביטול
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Logout */}
                                <button
                                    onClick={handleLogout}
                                    className="w-full py-4 bg-red-50 text-red-500 rounded-2xl font-black text-sm hover:bg-red-100 transition flex items-center justify-center gap-2 border border-red-100"
                                >
                                    <LogOut size={18} /> התנתק מהחשבון
                                </button>
                            </div>
                        )}

                        {/* About Tab */}
                        {activeTab === 'about' && (
                            <div className="space-y-5 animate-in fade-in duration-300">
                                {/* Brand Card */}
                                <div className="p-8 rounded-3xl bg-gradient-to-br from-amber-400 to-amber-500 text-slate-900 text-center shadow-xl shadow-amber-200">
                                    <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-amber-400 font-black text-2xl mx-auto mb-4 shadow-2xl">TX</div>
                                    <h3 className="text-2xl font-black tracking-tight">1515<span className="text-slate-900/60 font-black"> מונית</span></h3>
                                    <p className="text-xs text-slate-800/60 mt-1 font-mono">גרסה 1.0.0</p>
                                </div>

                                {/* Company info */}
                                <div className="bg-white p-6 rounded-3xl border border-slate-100 space-y-4 shadow-sm">
                                    <h4 className="font-black text-slate-900">אודות החברה</h4>
                                    <p className="text-sm leading-relaxed text-slate-500">
                                        מערכת הזמנת מוניות מתקדמת המציעה חוויית נסיעה ברמה הגבוהה ביותר,
                                        עם שקיפות מלאה במחירים ושירות 24/7.
                                    </p>
                                    <div className="space-y-3 pt-1">
                                        <div className="flex items-center gap-3 py-2">
                                            <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                                                <Phone size={14} />
                                            </div>
                                            <span className="text-sm font-bold text-slate-700">מוקד שירות: *1515</span>
                                        </div>
                                        <div className="flex items-center gap-3 py-2 border-t border-slate-50">
                                            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                                                <MapPin size={14} />
                                            </div>
                                            <span className="text-sm font-bold text-slate-700">ישראל, 24/7</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Links */}
                                <div className="grid grid-cols-2 gap-3">
                                    <Link to="/privacy-policy" className="p-5 rounded-2xl bg-white border border-slate-100 text-center text-sm font-bold text-slate-600 hover:border-amber-200 hover:shadow-md transition-all">
                                        <Shield size={22} className="mx-auto mb-2 text-slate-400" />
                                        מדיניות פרטיות
                                    </Link>
                                    <Link to="/services" className="p-5 rounded-2xl bg-white border border-slate-100 text-center text-sm font-bold text-slate-600 hover:border-amber-200 hover:shadow-md transition-all">
                                        <Star size={22} className="mx-auto mb-2 text-slate-400" />
                                        השירותים שלנו
                                    </Link>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Bottom Navigation Bar */}
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-2xl border-t border-slate-100 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.06)]">
                <div className="max-w-lg mx-auto flex justify-around py-2">
                    <Link to="/" className="flex flex-col items-center gap-1 py-2 px-4 text-slate-400 hover:text-amber-500 transition-colors">
                        <Car size={22} />
                        <span className="text-[9px] font-black uppercase tracking-widest">ראשי</span>
                    </Link>
                    <Link to="/order-taxi" className="flex flex-col items-center gap-1 py-2 px-4 text-slate-400 hover:text-amber-500 transition-colors">
                        <MapPin size={22} />
                        <span className="text-[9px] font-black uppercase tracking-widest">הזמנה</span>
                    </Link>
                    <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1 py-2 px-4 transition-colors ${activeTab === 'history' ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}>
                        <History size={22} />
                        <span className="text-[9px] font-black uppercase tracking-widest">היסטוריה</span>
                    </button>
                    <button onClick={() => setActiveTab('overview')} className={`flex flex-col items-center gap-1 py-2 px-4 transition-colors ${activeTab === 'overview' ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}>
                        <User size={22} />
                        <span className="text-[9px] font-black uppercase tracking-widest">פרופיל</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
