import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { requestOTP, verifyOTP } from '../api/passengerApi';
import { normalizePhone, isValidPhone } from '../utils/phone';
import { Car, User, MapPin, Bell, ArrowLeft, Loader2, LogIn, UserPlus, AlertCircle, LogOut, RefreshCw, Star, Clock, ShieldCheck, MapIcon, ChevronLeft } from 'lucide-react';
import { RateRide } from '../pages/RateRide';

// Lazy-loaded pages
const CustomerOrder = lazy(() => import('../pages/CustomerOrder').then(m => ({ default: m.CustomerOrder })));
const OrderStatus = lazy(() => import('../pages/OrderStatus').then(m => ({ default: m.OrderStatus })));
const PassengerProfile = lazy(() => import('../pages/PassengerProfile').then(m => ({ default: m.PassengerProfile })));
const RideDetails = lazy(() => import('../pages/RideDetails').then(m => ({ default: m.RideDetails })));
const PrivacyPolicy = lazy(() => import('../pages/PrivacyPolicy').then(m => ({ default: m.PrivacyPolicy })));
const SmartUIPreview = lazy(() => import('../pages/SmartUIPreview').then(m => ({ default: m.SmartUIPreview })));
const CompareTaxis = lazy(() => import('../pages/CompareTaxis').then(m => ({ default: m.CompareTaxis })));
const FAQ = lazy(() => import('../pages/FAQ').then(m => ({ default: m.FAQ })));
const Blog = lazy(() => import('../pages/Blog').then(m => ({ default: m.Blog })));
const BlogPost = lazy(() => import('../pages/BlogPost').then(m => ({ default: m.BlogPost })));
const About = lazy(() => import('../pages/About').then(m => ({ default: m.About })));
const LoadingSpinner = () => (
    <div className="flex h-screen w-screen items-center justify-center bg-white fixed inset-0 z-50">
        <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 font-bold animate-pulse">טוען...</p>
        </div>
    </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const isLoggedIn = !!localStorage.getItem('taxi_passenger_phone');
    return isLoggedIn ? <>{children}</> : <Navigate to="/" replace />;
};

// ==========================================
// REDESIGNED: Passenger Landing Page (Native Mobile UX)
// ==========================================
const PassengerLanding: React.FC = () => {
    const navigate = useNavigate();
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [authStep, setAuthStep] = useState<'welcome' | 'phone' | 'otp'>('welcome');
    const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
    const [phone, setPhone] = useState('');
    const [name, setName] = useState('');
    const [otp, setOtp] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [resendCooldown, setResendCooldown] = useState(0);

    useEffect(() => {
        const stored = localStorage.getItem('taxi_passenger_phone');
        if (stored) setIsLoggedIn(true);
    }, []);

    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendCooldown]);

    const handleSendCode = async () => {
        if (authMode === 'register' && (!name || name.length < 2)) {
            setError('נא להזין שם מלא');
            return;
        }
        if (!isValidPhone(phone)) {
            setError('מספר טלפון לא תקין');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const resp = await requestOTP(phone);
            if (resp.ok) {
                setAuthStep('otp');
                setResendCooldown(60);
            } else {
                setError(resp.error || 'שגיאה בשליחת הקוד');
            }
        } catch {
            setError('שגיאה בתקשורת לשליחת קוד');
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyCode = async () => {
        if (otp.length !== 6) {
            setError('נא להזין קוד בן 6 ספרות');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const resp = await verifyOTP(phone, otp);
            if (resp.ok) {
                const localPhone = normalizePhone(phone);
                localStorage.setItem('taxi_passenger_phone', localPhone);
                if (resp.data?.token) {
                    localStorage.setItem('taxi_passenger_token', resp.data.token);
                }
                if (authMode === 'register') {
                    localStorage.setItem('taxi_passenger_profile', JSON.stringify({
                        name, phone: localPhone, totalRides: 0, memberSince: new Date().toISOString()
                    }));
                }
                setIsLoggedIn(true);
                navigate('/order');
            } else {
                setError(resp.error || 'קוד שגוי');
            }
        } catch {
            setError('שגיאה באימות קוד');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('taxi_passenger_phone');
        localStorage.removeItem('taxi_passenger_token');
        localStorage.removeItem('taxi_passenger_profile');
        setIsLoggedIn(false);
        setAuthStep('welcome');
        setPhone('');
        setOtp('');
    };

    // Dashboard State
    if (isLoggedIn) {
        const profile = JSON.parse(localStorage.getItem('taxi_passenger_profile') || '{"name": "נוסע"}');
        return (
            <div className="min-h-screen bg-[#F8FAFC] pb-24 font-sans text-slate-900" dir="rtl">
                {/* Status Bar Spacer */}
                <div className="h-10 bg-slate-900"></div>

                {/* Header */}
                <div className="bg-slate-900 text-white px-6 pb-12 pt-4 rounded-b-[2.5rem] shadow-2xl relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-yellow-400 opacity-10 rounded-full blur-3xl"></div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-yellow-400 rounded-2xl flex items-center justify-center text-slate-900 shadow-lg">
                                    <Car size={24} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">TAXIPRO</p>
                                    <h1 className="text-xl font-black">שלום, {profile.name.split(' ')[0]}</h1>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                                    <Bell size={18} />
                                </button>
                                <button onClick={handleLogout} className="w-10 h-10 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center">
                                    <LogOut size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Star className="text-yellow-400" size={18} fill="currentColor" />
                                <span className="text-sm font-bold">4.9 דירוג אישי</span>
                            </div>
                            <div className="h-4 w-[1px] bg-white/10"></div>
                            <div className="flex items-center gap-3">
                                <Clock className="text-blue-400" size={18} />
                                <span className="text-sm font-bold">{profile.totalRides || 0} נסיעות</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Actions */}
                <div className="px-6 -mt-8 relative z-20 space-y-4">
                    <Link to="/order" className="group bg-yellow-400 p-6 rounded-3xl shadow-xl shadow-yellow-400/20 flex items-center gap-5 active:scale-95 transition-all">
                        <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-yellow-400 shadow-inner">
                            <MapPin size={32} strokeWidth={2.5} />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-2xl font-black text-slate-900 leading-tight">לאן נוסעים?</h2>
                            <p className="text-slate-700 text-sm font-bold">הזמן מונית עכשיו בקליק</p>
                        </div>
                        <div className="w-10 h-10 bg-white/30 rounded-full flex items-center justify-center text-slate-900 group-hover:translate-x-[-5px] transition-transform">
                            <ChevronLeft size={24} strokeWidth={3} />
                        </div>
                    </Link>

                    <div className="grid grid-cols-2 gap-4">
                        <Link to="/track-order" className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center text-center gap-2 active:scale-95 transition-all">
                            <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center mb-1">
                                <Clock size={24} />
                            </div>
                            <span className="font-black text-sm">מעקב נסיעה</span>
                            <span className="text-[10px] text-slate-400 font-bold">צפה בהזמנות פעילות</span>
                        </Link>
                        <Link to="/profile" className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center text-center gap-2 active:scale-95 transition-all">
                            <div className="w-12 h-12 bg-purple-50 text-purple-500 rounded-xl flex items-center justify-center mb-1">
                                <User size={24} />
                            </div>
                            <span className="font-black text-sm">הפרופיל שלי</span>
                            <span className="text-[10px] text-slate-400 font-bold">הגדרות והיסטוריה</span>
                        </Link>
                    </div>
                </div>

                {/* Secondary Section */}
                <div className="px-6 mt-8">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">מבצעים בשבילך</h3>
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-6 text-white relative overflow-hidden shadow-lg shadow-indigo-500/20">
                        <div className="relative z-10">
                            <h4 className="text-xl font-black mb-1">הפץ את הבשורה!</h4>
                            <p className="text-white/70 text-sm font-medium mb-4">שתף את האפליקציה עם חברים וקבל 20% הנחה בנסיעה הבאה</p>
                            <button className="bg-white text-indigo-600 px-5 py-2 rounded-xl text-sm font-black shadow-lg">שתף עכשיו</button>
                        </div>
                        <ShieldCheck className="absolute -bottom-6 -left-6 w-32 h-32 text-white/10 rotate-12" />
                    </div>
                </div>

                {/* Bottom Nav */}
                <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 pb-safe z-50 px-6">
                    <div className="flex justify-between py-4">
                        <button className="flex flex-col items-center gap-1 text-yellow-500">
                            <div className="w-12 h-6 bg-yellow-100 rounded-full flex items-center justify-center mb-0.5">
                                <Car size={20} strokeWidth={2.5} />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-wider">ראשי</span>
                        </button>
                        <Link to="/order" className="flex flex-col items-center gap-1 text-slate-400 hover:text-yellow-500 transition-colors">
                            <MapIcon size={20} />
                            <span className="text-[10px] font-bold uppercase tracking-wider">הזמנה</span>
                        </Link>
                        <Link to="/profile" className="flex flex-col items-center gap-1 text-slate-400 hover:text-yellow-500 transition-colors">
                            <User size={20} />
                            <span className="text-[10px] font-bold uppercase tracking-wider">פרופיל</span>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // Auth Flow (Native App Style)
    return (
        <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col p-8 overflow-hidden relative" dir="rtl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400/10 rounded-full blur-[100px]"></div>
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-[120px]"></div>

            {authStep === 'welcome' && (
                <div className="flex-1 flex flex-col justify-between relative z-10">
                    <div className="pt-20">
                        <div className="w-20 h-20 bg-yellow-400 rounded-3xl flex items-center justify-center text-slate-900 mb-8 shadow-2xl shadow-yellow-400/20 rotate-6 translate-x-1">
                            <Car size={40} strokeWidth={2.5} />
                        </div>
                        <h1 className="text-5xl font-black mb-4 leading-tight">הצטרפו למהפכת <br /><span className="text-yellow-400">הנסיעות</span>.</h1>
                        <p className="text-slate-400 text-lg font-medium">הזמנת מונית נוחה, בטוחה ומהירה <br />ישר מהוואטסאפ שלך.</p>
                    </div>
                    <div className="space-y-4 pb-10">
                        <button onClick={() => { setAuthMode('login'); setAuthStep('phone'); }} className="w-full py-5 bg-yellow-400 text-slate-900 rounded-2xl font-black text-xl shadow-xl shadow-yellow-400/10 active:scale-95 transition-all">התחברות כמנוי</button>
                        <button onClick={() => { setAuthMode('register'); setAuthStep('phone'); }} className="w-full py-5 bg-white/5 border border-white/10 rounded-2xl font-black text-xl hover:bg-white/10 active:scale-95 transition-all">הירשם כנוסע חדש</button>
                    </div>
                </div>
            )}

            {(authStep === 'phone' || authStep === 'otp') && (
                <div className="flex-1 flex flex-col relative z-10">
                    <button onClick={() => setAuthStep(authStep === 'otp' ? 'phone' : 'welcome')} className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-12">
                        <ArrowLeft className="rotate-180" size={24} />
                    </button>

                    <div className="flex-1">
                        <h2 className="text-3xl font-black mb-2 leading-tight">
                            {authStep === 'phone' ? (authMode === 'register' ? 'בואו נכיר!' : 'ברוכים השבים!') : 'אימות קוד'}
                        </h2>
                        <p className="text-slate-400 font-medium mb-12">
                            {authStep === 'phone' ? 'הזינו את מספר הטלפון להמשך' : `נשלח עבורכם קוד לוואטסאפ: ${phone}`}
                        </p>

                        <div className="space-y-6">
                            {authStep === 'phone' && authMode === 'register' && (
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3">שם מלא</label>
                                    <input value={name} onChange={e => setName(e.target.value)} placeholder="ישראל ישראלי" className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-xl font-bold outline-none focus:ring-2 focus:ring-yellow-400/50 transition-all placeholder-slate-600" />
                                </div>
                            )}

                            {authStep === 'phone' && (
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3">מספר טלפון</label>
                                    <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" dir="ltr" placeholder="05X-XXXXXXX" className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-2xl font-black outline-none focus:ring-2 focus:ring-yellow-400/50 transition-all text-center tracking-widest placeholder-slate-600" />
                                </div>
                            )}

                            {authStep === 'otp' && (
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3">קוד אימות (6 ספרות)</label>
                                    <input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} maxLength={6} type="tel" dir="ltr" autoFocus className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-4xl font-black outline-none focus:ring-2 focus:ring-yellow-400/50 transition-all text-center tracking-widest placeholder-slate-600" />
                                </div>
                            )}

                            {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm font-bold flex items-center gap-3"><AlertCircle size={18} /> {error}</div>}
                        </div>
                    </div>

                    <div className="pb-10 space-y-4">
                        <button
                            onClick={authStep === 'phone' ? handleSendCode : handleVerifyCode}
                            disabled={isLoading}
                            className="w-full py-5 bg-yellow-400 text-slate-900 rounded-2xl font-black text-xl shadow-xl shadow-yellow-400/10 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {isLoading ? <Loader2 className="animate-spin" /> : (authStep === 'phone' ? 'המשך לוואטסאפ' : 'אמת והמשך')}
                        </button>
                        {authStep === 'otp' && (
                            <button onClick={handleLogout} className="w-full py-3 text-slate-500 font-bold hover:text-white transition-colors">שינוי מספר טלפון</button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ==========================================
// Main Passenger App Shell
// ==========================================
export const PassengerApp: React.FC = () => {
    useEffect(() => {
        import('../api/passengerApi').then(({ initializeApiUrl }) => {
            const saved = localStorage.getItem('taxi_app_script_url');
            if (saved) initializeApiUrl(saved);
        });
    }, []);

    return (
        <HelmetProvider>
            <ErrorBoundary>
                <BrowserRouter>
                    <Suspense fallback={<LoadingSpinner />}>
                        <Routes>
                            <Route path="/" element={<PassengerLanding />} />
                            <Route path="/order" element={<ProtectedRoute><CustomerOrder /></ProtectedRoute>} />
                            <Route path="/track-order" element={<ProtectedRoute><OrderStatus /></ProtectedRoute>} />
                            <Route path="/profile" element={<ProtectedRoute><PassengerProfile /></ProtectedRoute>} />
                            <Route path="/rate-ride" element={<ProtectedRoute><RateRide /></ProtectedRoute>} />
                            <Route path="/ride/:orderId" element={<ProtectedRoute><RideDetails /></ProtectedRoute>} />
                            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                            <Route path="/about" element={<About />} />
                            <Route path="/smart-preview" element={<SmartUIPreview />} />
                            
                            {/* SEO Public Routes */}
                            <Route path="/compare" element={<Suspense fallback={<LoadingSpinner />}><CompareTaxis /></Suspense>} />
                            <Route path="/faq" element={<Suspense fallback={<LoadingSpinner />}><FAQ /></Suspense>} />
                            <Route path="/blog" element={<Suspense fallback={<LoadingSpinner />}><Blog /></Suspense>} />
                            <Route path="/blog/:slug" element={<Suspense fallback={<LoadingSpinner />}><BlogPost /></Suspense>} />
                            
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </Suspense>
                </BrowserRouter>
            </ErrorBoundary>
        </HelmetProvider>
    );
};
