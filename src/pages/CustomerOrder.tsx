import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sendToBackend, calculatePrice, getSystemSettings } from '../api/passengerApi';
import { CreateOrderPayload, SystemSettings } from '../types';
import { User, Phone, Calendar, Clock, ArrowRight, CheckCircle, Car, Search, Loader2, DollarSign, Users, Briefcase, Plane, CreditCard, MapPin } from 'lucide-react';
import { CityAutocomplete } from '../components/CityAutocomplete';
import { GooglePlacesAutocomplete } from '../components/GooglePlacesAutocomplete';
import { ShakeInput } from '../components/ShakeInput';
import { BiddingSlider } from '../components/BiddingSlider';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';

const customerOrderSchema = z.object({
    customerName: z.string().min(2, 'שם מלא חייב להכיל לפחות 2 תווים'),
    customerPhone: z.string().min(10, 'מספר טלפון לא תקין').regex(/^05\d-?\d{7}$/, 'מספר חייב להתחיל ב-05'),
    pickupAddress: z.string().min(1, 'נא לבחור עיר איסוף'),
    pickupExactAddress: z.string().default(''),
    pickupNotes: z.string().default(''),
    destinationAddress: z.string().min(1, 'נא לבחור עיר יעד'),
    destinationExactAddress: z.string().default(''),
    destinationNotes: z.string().default(''),
    pickupDate: z.string(),
    pickupTime: z.string(),
    pickupLat: z.number().optional(),
    pickupLng: z.number().optional(),
    destLat: z.number().optional(),
    destLng: z.number().optional(),
    passengers: z.string().default('1'),
    luggage: z.string().default('0'),
    flightNumber: z.string().optional(),
    paymentMethod: z.enum(['cash', 'credit', 'bit']).default('cash')
});

type CustomerOrderForm = z.infer<typeof customerOrderSchema>;

export const CustomerOrder: React.FC = () => {
    const navigate = useNavigate();
    const debounceTimer = useRef<number | null>(null);

    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [orderId, setOrderId] = useState('');
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string>('');

    // Wizard Step State
    const [step, setStep] = useState(1);

    // Price State
    const [price, setPrice] = useState<number>(0);
    const [tipAmount, setTipAmount] = useState<number>(0);
    const [distanceText, setDistanceText] = useState<string>('');
    const [durationText, setDurationText] = useState<string>('');
    const [isCalculating, setIsCalculating] = useState(false);

    // [QA FIX] Helper to get current Israel time + offset in minutes
    const getIsraelTimeDefaults = (offsetMinutes = 2) => {
        // Create date object in current machine time
        const now = new Date();
        // Add offset
        const future = new Date(now.getTime() + (offsetMinutes * 60 * 1000));

        // Format to Israel Timezone strings
        const dateStr = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Jerusalem',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(future); // YYYY-MM-DD

        const timeStr = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Jerusalem',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).format(future); // HH:mm

        return { date: dateStr, time: timeStr };
    };

    const timeDefaults = getIsraelTimeDefaults(2);

    const { register, control, handleSubmit, watch, setValue, trigger, formState: { errors } } = useForm<CustomerOrderForm>({
        resolver: zodResolver(customerOrderSchema) as any,
        defaultValues: {
            customerName: '',
            customerPhone: '',
            pickupAddress: '',
            pickupExactAddress: '',
            pickupNotes: '',
            destinationAddress: '',
            destinationExactAddress: '',
            destinationNotes: '',
            pickupDate: timeDefaults.date,
            pickupTime: timeDefaults.time,
            passengers: '1',
            luggage: '0',
            flightNumber: '',
            paymentMethod: 'cash'
        }
    });

    // Fetch API Key on Mount
    useEffect(() => {
        getSystemSettings().then(res => {
            if (res.ok && res.data) {
                const settingsData = res.data as SystemSettings;
                setGoogleMapsApiKey(settingsData.GOOGLE_MAPS_API_KEY || settingsData.GOOGLEMAPSAPIKEY || '');
            }
        });
    }, []);

    const watchedFields = watch();

    // AUTO-CALCULATE PRICE EFFECT (only when core route fields change)
    useEffect(() => {
        const { pickupAddress, destinationAddress, pickupExactAddress, destinationExactAddress, pickupLat, pickupLng, destLat, destLng } = watchedFields;

        // Require at least cities + either exact addresses or coordinates
        const hasRoute =
            pickupAddress &&
            destinationAddress &&
            (
                (pickupLat && pickupLng && destLat && destLng) ||
                (pickupExactAddress && destinationExactAddress)
            );

        if (!hasRoute) {
            return;
        }

        if (debounceTimer.current) window.clearTimeout(debounceTimer.current);

        debounceTimer.current = window.setTimeout(async () => {
            await handleManualCompute(true);
        }, 1500);
    }, [
        watchedFields.pickupAddress,
        watchedFields.destinationAddress,
        watchedFields.pickupExactAddress,
        watchedFields.destinationExactAddress,
        watchedFields.pickupLat,
        watchedFields.pickupLng,
        watchedFields.destLat,
        watchedFields.destLng
    ]);

    // Helper to construct full address for calculation
    const getFullAddress = (city: string, notes: string) => {
        if (!notes) return city;
        return `${notes}, ${city}`;
    };

    const handleManualCompute = async (isAuto = false) => {
        const { pickupAddress, destinationAddress, pickupExactAddress, destinationExactAddress, pickupDate, pickupTime, pickupLat, pickupLng, destLat, destLng } = watchedFields;

        if (!pickupAddress || !destinationAddress) {
            if (!isAuto) setErrorMessage('נא להזין עיר מוצא ועיר יעד לפני חישוב המחיר.');
            return;
        }

        setErrorMessage('');
        if (!isAuto) setIsLoading(true);
        setIsCalculating(true);

        const fullPickup = getFullAddress(pickupAddress, pickupExactAddress || '');
        const fullDest = getFullAddress(destinationAddress, destinationExactAddress || '');

        try {
            const res = await calculatePrice({
                pickupAddress,
                pickupExactAddress,
                destinationAddress,
                destinationExactAddress,
                pickupDate,
                pickupTime,
                pickupLat,
                pickupLng,
                destLat,
                destLng
            });
            if (res.ok && res.data) {
                setPrice(res.data.price || 0);
                setDistanceText(res.data.distanceKm ? `${res.data.distanceKm} ק״מ` : '');
                setDurationText(res.data.duration || '');
            } else {
                if (!isAuto) setErrorMessage(res.error || 'שגיאה בחישוב מחיר');
            }
        } catch (e) {
            if (!isAuto) setErrorMessage('שגיאת תקשורת בחישוב מחיר');
        } finally {
            if (!isAuto) setIsLoading(false);
            setIsCalculating(false);
        }
    };

    const onSubmit = async (data: CustomerOrderForm) => {
        setIsLoading(true);
        setStatus('idle');
        setErrorMessage('');

        try {
            const finalPrice = price + tipAmount;
            const payload: CreateOrderPayload = { ...data, price: finalPrice };
            const res = await sendToBackend<{ orderId: string }>('createOrder', payload);
            if (res.ok && res.data) {
                const { notifyLocalWhatsApp, formatNewRideGroupMessage } = await import('../api/api');
                await notifyLocalWhatsApp({
                    text: formatNewRideGroupMessage({
                        orderId: res.data.orderId,
                        pickupAddress: data.pickupAddress,
                        destinationAddress: data.destinationAddress,
                        price: finalPrice,
                        pickupDate: data.pickupDate,
                        pickupTime: data.pickupTime,
                        notes: data.pickupNotes
                    })
                });
                setStatus('success');
                setOrderId(res.data.orderId || 'חדשה');
            } else {
                setStatus('error');
                setErrorMessage(res.error || 'אירעה שגיאה בשליחת ההזמנה, אנא נסה שנית.');
            }
        } catch (e) {
            setStatus('error');
            setErrorMessage('שגיאת תקשורת, אנא נסה שוב מאוחר יותר.');
        } finally {
            setIsLoading(false);
        }
    };

    if (status === 'success') {
        return (
            <div className="bg-customer flex items-center justify-center p-6" dir="rtl">
                <div className="glass-premium p-10 rounded-[3rem] max-w-md w-full text-center animate-in zoom-in duration-500">
                    <div className="w-28 h-28 bg-accent-500/20 rounded-full flex items-center justify-center mx-auto mb-8 ring-8 ring-accent-500/10 animate-pulse">
                        <CheckCircle className="text-slate-900 w-14 h-14" />
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">הזמנתך הושלמה!</h2>
                    <p className="text-slate-500 mb-8 font-medium leading-relaxed">
                        מספר הזמנה: <span className="font-mono font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-lg">{orderId}</span><br />
                        הנסיעה שלך בדרכה לנהגים. ניצור איתך קשר תוך דקות ספורות.
                    </p>
                    <div className="flex flex-col gap-4">
                        <button onClick={() => navigate(`/track-order?orderId=${orderId}`)} className="btn-premium w-full text-lg shadow-xl">
                            <Search size={20} /> עקוב אחר הנהג
                        </button>
                        <button onClick={() => window.location.reload()} className="btn-premium-accent w-full text-lg shadow-xl">
                            הזמן נסיעה נוספת
                        </button>
                        <Link to="/" className="w-full py-4 text-slate-400 font-bold hover:text-slate-900 transition text-center block">
                            חזור לדף הבית
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const nextStep = async () => {
        if (step === 1) {
            const isValid = await trigger(['pickupAddress', 'destinationAddress']);
            if (isValid) setStep(2);
        } else if (step === 2) {
            const isValid = await trigger(['pickupDate', 'pickupTime']);
            if (isValid) setStep(3);
        }
    };

    const prevStep = () => {
        if (step > 1) setStep(step - 1);
    };

    return (
        <div className="bg-customer pt-8 pb-32 px-4 font-sans" dir="rtl">
            <div className="max-w-xl mx-auto glass-premium rounded-[3rem] overflow-hidden">
                {/* Header & Progress Bar */}
                <div className="pt-8 pb-10 px-8 text-slate-900 relative">
                    <Link to="/" className="absolute right-6 top-6 text-slate-400 hover:text-slate-900 transition bg-slate-50 p-2.5 rounded-full">
                        <ArrowRight size={22} />
                    </Link>
                    <div className="text-center mt-4 mb-8">
                        <h1 className="text-3xl font-black mb-2 tracking-tight">הזמנת מונית</h1>
                        <p className="text-slate-500 text-sm font-medium">נסיעה בטוחה ומהירה מחכה לך</p>
                    </div>

                    {/* Progress Steps - Premium Style */}
                    <div className="flex justify-between items-center relative z-10 px-4">
                        {/* Step 1 */}
                        <div className="flex flex-col items-center gap-3 z-10 relative">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black transition-all duration-500 ${step >= 1 ? 'bg-accent-500 text-slate-900 shadow-[0_10px_20px_rgba(245,158,11,0.3)] scale-110' : 'bg-slate-50 text-slate-400'}`}>1</div>
                            <span className={`text-[11px] font-black uppercase tracking-widest ${step >= 1 ? 'text-slate-900' : 'text-slate-400'}`}>איפה?</span>
                        </div>
                        {/* Line 1 */}
                        <div className="flex-1 px-4">
                            <div className={`h-1.5 rounded-full transition-all duration-700 ${step >= 2 ? 'bg-accent-500' : 'bg-slate-100'}`}></div>
                        </div>
                        {/* Step 2 */}
                        <div className="flex flex-col items-center gap-3 z-10 relative">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black transition-all duration-500 ${step >= 2 ? 'bg-accent-500 text-slate-900 shadow-[0_10px_20px_rgba(245,158,11,0.3)] scale-110' : 'bg-slate-50 text-slate-400'}`}>2</div>
                            <span className={`text-[11px] font-black uppercase tracking-widest ${step >= 2 ? 'text-slate-900' : 'text-slate-400'}`}>מתי?</span>
                        </div>
                        {/* Line 2 */}
                        <div className="flex-1 px-4">
                            <div className={`h-1.5 rounded-full transition-all duration-700 ${step >= 3 ? 'bg-accent-500' : 'bg-slate-100'}`}></div>
                        </div>
                        {/* Step 3 */}
                        <div className="flex flex-col items-center gap-3 z-10 relative">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black transition-all duration-500 ${step >= 3 ? 'bg-accent-500 text-slate-900 shadow-[0_10px_20px_rgba(245,158,11,0.3)] scale-110' : 'bg-slate-50 text-slate-400'}`}>3</div>
                            <span className={`text-[11px] font-black uppercase tracking-widest ${step >= 3 ? 'text-slate-900' : 'text-slate-400'}`}>פרטים</span>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-6 sm:p-8 relative min-h-[450px] flex flex-col overflow-hidden">
                    <AnimatePresence mode="wait">
                        {/* STEP 1: WHERE */}
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ x: 50, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -50, opacity: 0 }}
                                transition={{ duration: 0.4, ease: "easeOut" }}
                                className="space-y-6 flex-1"
                            >
                                <div className="space-y-4">
                                    <div className="bento-card bg-white/50 border-white/20">
                                        <div className="flex items-center justify-between mb-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm"><ArrowRight size={16} className="rotate-180" /></div>
                                                <h3 className="font-black text-slate-800 text-lg">מאיפה לאסוף אותך?</h3>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    if (!navigator.geolocation) {
                                                        setErrorMessage('זיהוי מיקום לא נתמך בדפדפן זה');
                                                        return;
                                                    }
                                                    setIsLoading(true);
                                                    navigator.geolocation.getCurrentPosition(async (pos) => {
                                                        const { latitude, longitude } = pos.coords;
                                                        setValue('pickupLat', latitude);
                                                        setValue('pickupLng', longitude);

                                                        // Reverse Geocode
                                                        const res = await sendToBackend<any>('searchAddress', { lat: latitude, lon: longitude, q: '' });
                                                        if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
                                                            const first = res.data[0];
                                                            // Attempt to extract city and street
                                                            setValue('pickupExactAddress', first.display_name);
                                                        }
                                                        setIsLoading(false);
                                                    }, (err) => {
                                                        console.error(err);
                                                        setErrorMessage('לא הצלחנו לזהות את המיקום שלך. וודא שהרשאות המיקום מאושרות.');
                                                        setIsLoading(false);
                                                    });
                                                }}
                                                className="flex items-center gap-1.5 text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl hover:bg-emerald-100 transition-colors"
                                            >
                                                <MapPin size={14} /> זהה מיקום
                                            </button>
                                        </div>
                                        <div className="space-y-4">
                                            <Controller
                                                name="pickupAddress"
                                                control={control}
                                                render={({ field }) => (
                                                    <CityAutocomplete label="עיר" value={field.value} onChange={field.onChange} onSelect={(res) => field.onChange(res.name)} placeholder="בחר עיר..." searchType="city" />
                                                )}
                                            />
                                            {errors.pickupAddress && <p className="text-red-500 text-xs font-bold">{errors.pickupAddress?.message}</p>}
                                            <Controller
                                                name="pickupExactAddress"
                                                control={control}
                                                render={({ field }) => (
                                                    <GooglePlacesAutocomplete label="כתובת מדויקת (רחוב ומספר)" value={field.value || ''} onChange={field.onChange} onSelect={(res) => { field.onChange(res.address); setValue('pickupLat', res.lat); setValue('pickupLng', res.lng); if (res.city) setValue('pickupAddress', res.city); }} placeholder="הזן רחוב ומספר..." apiKey={googleMapsApiKey} cityContext={watch('pickupAddress')} required={false} />
                                                )}
                                            />
                                        </div>
                                    </div>

                                    <div className="bento-card bg-white/50 border-white/20">
                                        <div className="flex items-center gap-3 mb-5">
                                            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm"><MapPin size={16} /></div>
                                            <h3 className="font-black text-slate-800 text-lg">לאן נוסעים?</h3>
                                        </div>
                                        <div className="space-y-4">
                                            <Controller
                                                name="destinationAddress"
                                                control={control}
                                                render={({ field }) => (
                                                    <CityAutocomplete label="עיר" value={field.value} onChange={field.onChange} onSelect={(res) => field.onChange(res.name)} placeholder="בחר עיר..." searchType="city" />
                                                )}
                                            />
                                            {errors.destinationAddress && <p className="text-red-500 text-xs font-bold">{errors.destinationAddress?.message}</p>}
                                            <Controller
                                                name="destinationExactAddress"
                                                control={control}
                                                render={({ field }) => (
                                                    <GooglePlacesAutocomplete label="כתובת מדויקת (רחוב ומספר)" value={field.value || ''} onChange={field.onChange} onSelect={(res) => { field.onChange(res.address); setValue('destLat', res.lat); setValue('destLng', res.lng); }} placeholder="הזן רחוב ומספר..." apiKey={googleMapsApiKey} cityContext={watch('destinationAddress')} required={false} />
                                                )}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button type="button" onClick={nextStep} className="btn-premium w-full mt-10 text-xl shadow-[0_20px_40px_-10px_rgba(37,99,235,0.3)]">
                                    המשך לשלב הבא <ArrowRight size={20} className="rotate-180" />
                                </button>
                            </motion.div>
                        )}

                        {/* STEP 2: WHEN */}
                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ x: 50, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -50, opacity: 0 }}
                                transition={{ duration: 0.4, ease: "easeOut" }}
                                className="space-y-8 flex-1"
                            >
                                <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                                    <h3 className="font-black text-2xl text-slate-800 mb-8 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shadow-sm"><Calendar size={20} /></div> מתי לאסוף אותך?
                                    </h3>

                                    <div className="space-y-6">
                                        <div>
                                            <label className="block text-xs font-black text-slate-500 mb-2 uppercase tracking-widest">תאריך איסוף</label>
                                            <ShakeInput isInvalid={!!errors.pickupDate} {...register('pickupDate')} type="date" className="w-full p-5 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-[#FACC15]/20 outline-none font-bold text-slate-800 shadow-sm transition-all" />
                                            {errors.pickupDate && <p className="text-red-500 text-xs mt-2 font-bold">{errors.pickupDate?.message}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-slate-500 mb-2 uppercase tracking-widest">שעת איסוף</label>
                                            <ShakeInput isInvalid={!!errors.pickupTime} {...register('pickupTime')} type="time" className="w-full p-5 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-[#FACC15]/20 outline-none font-bold text-slate-800 shadow-sm transition-all" />
                                            {errors.pickupTime && <p className="text-red-500 text-xs mt-2 font-bold">{errors.pickupTime?.message}</p>}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-4 mt-8">
                                    <button type="button" onClick={prevStep} className="btn-outline w-1/4 rounded-[1.5rem] py-5">
                                        חזור
                                    </button>
                                    <button type="button" onClick={nextStep} className="btn-premium w-3/4 text-xl shadow-[0_20px_40px_-10px_rgba(37,99,235,0.3)]">
                                        להמשך <ArrowRight size={20} className="rotate-180" />
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 3: DETAILS */}
                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ x: 50, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -50, opacity: 0 }}
                                transition={{ duration: 0.4, ease: "easeOut" }}
                                className="space-y-8 flex-1"
                            >
                                <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
                                    <h3 className="font-black text-2xl text-slate-800 mb-4">פרטים אחרונים</h3>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-xs font-black text-slate-500 mb-2 uppercase tracking-widest">שם מלא</label>
                                            <ShakeInput isInvalid={!!errors.customerName} {...register('customerName')} placeholder="שם הלקוח" className={`w-full p-4 bg-white border ${errors.customerName ? 'border-red-500' : 'border-slate-200'} rounded-2xl focus:ring-4 focus:ring-[#FACC15]/20 outline-none font-bold text-slate-800 shadow-sm transition-all`} />
                                            {errors.customerName && <p className="text-red-500 text-xs mt-2 font-bold">{errors.customerName.message}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-slate-500 mb-2 uppercase tracking-widest">טלפון נייד</label>
                                            <ShakeInput isInvalid={!!errors.customerPhone} {...register('customerPhone')} type="tel" placeholder="050..." className={`w-full p-4 bg-white border ${errors.customerPhone ? 'border-red-500' : 'border-slate-200'} rounded-2xl focus:ring-4 focus:ring-[#FACC15]/20 outline-none font-bold text-slate-800 shadow-sm text-center tracking-widest transition-all`} dir="ltr" />
                                            {errors.customerPhone && <p className="text-red-500 text-xs mt-2 font-bold">{errors.customerPhone.message}</p>}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                                        <div className="col-span-1">
                                            <label className="block text-xs font-black text-slate-500 mb-2 uppercase tracking-widest flex items-center gap-1"><Users size={12} /> נוסעים</label>
                                            <select {...register('passengers')} className="w-full p-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-[#FACC15]/20 outline-none font-bold text-slate-800 shadow-sm">
                                                {[1, 2, 3, 4, '5+'].map(num => <option key={num} value={num}>{num}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-span-1">
                                            <label className="block text-xs font-black text-slate-500 mb-2 uppercase tracking-widest flex items-center gap-1"><Briefcase size={12} /> מזוודות</label>
                                            <select {...register('luggage')} className="w-full p-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-[#FACC15]/20 outline-none font-bold text-slate-800 shadow-sm">
                                                {[0, 1, 2, 3, 4, '5+'].map(num => <option key={num} value={num}>{num}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-xs font-black text-slate-500 mb-2 uppercase tracking-widest flex items-center gap-1"><Plane size={12} /> טיסה (אופצ')</label>
                                            <input {...register('flightNumber')} placeholder="LY001" className="w-full p-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-[#FACC15]/20 outline-none font-bold text-slate-800 shadow-sm" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-slate-500 mb-2 uppercase tracking-widest leading-none">הערות כלליות</label>
                                        <textarea {...register('pickupNotes')} placeholder="הערות לנהג (השאר ריק אם אין)" className="w-full p-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-[#FACC15]/20 outline-none font-bold text-slate-800 h-24 shadow-sm transition-all" />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-slate-500 mb-2 uppercase tracking-widest flex items-center gap-1"><CreditCard size={12} /> אמצעי תשלום</label>
                                        <select {...register('paymentMethod')} className="w-full p-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-[#FACC15]/20 outline-none font-bold text-slate-900 shadow-sm appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23475569%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:1rem] bg-[right_1rem_center] bg-no-repeat">
                                            <option value="cash">מזומן לנהג</option>
                                            <option value="bit">ביט / פייבוקס</option>
                                            <option value="credit">כרטיס אשראי</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Price Calculation Dashboard - Premium */}
                                <motion.div
                                    layout
                                    initial={{ scale: 0.95, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="bg-gradient-to-br from-amber-50 to-amber-100/30 border border-amber-200/50 rounded-[2.5rem] p-8 sm:p-10 shadow-sm"
                                >
                                    {price > 0 ? (
                                        <motion.div
                                            initial={{ y: 10, opacity: 0 }}
                                            animate={{ y: 0, opacity: 1 }}
                                            className="text-center"
                                        >
                                            <div className="mb-6">
                                                <BiddingSlider basePrice={price} onBidChange={setTipAmount} />
                                            </div>
                                            <p className="text-sm font-black uppercase tracking-widest text-amber-600 mb-3">סה״כ לתשלום משוער</p>
                                            <p className="text-6xl font-black text-slate-900 tracking-tighter mb-5">₪{price + tipAmount}</p>
                                            <div className="flex gap-4 text-sm font-bold text-amber-800/60 justify-center font-mono bg-white/50 py-3 px-6 rounded-full w-fit mx-auto">
                                                <span>{distanceText || '--'}</span> <span className="opacity-30">|</span> <span>{durationText || '--'}</span>
                                            </div>
                                            <button type="button" onClick={() => handleManualCompute(false)} className="text-xs text-blue-600 font-bold hover:underline mt-8 flex items-center justify-center gap-1 mx-auto">
                                                <Search size={14} /> עדכן מחיר (שינוי יעד)
                                            </button>
                                        </motion.div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => handleManualCompute(false)}
                                            disabled={isLoading}
                                            className="btn-premium-accent w-full text-xl shadow-[0_20px_40px_-5px_rgba(245,158,11,0.4)]"
                                        >
                                            {isLoading || isCalculating ? <><Loader2 className="animate-spin" size={28} /> מחשב נתונים...</> : <><DollarSign size={28} /> צפה במחיר סופי</>}
                                        </button>
                                    )}
                                </motion.div>

                                {status === 'error' && (
                                    <div className="bg-red-50 text-red-600 p-5 rounded-2xl text-sm text-center border border-red-100 font-bold flex items-center justify-center gap-2">
                                        <CheckCircle size={18} className="rotate-45" /> {errorMessage || 'אירעה שגיאה, נסה שוב.'}
                                    </div>
                                )}

                                <div className="flex gap-4 mt-8">
                                    <button type="button" onClick={prevStep} className="btn-outline w-1/4 rounded-[1.5rem] py-5">
                                        חזור
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isLoading || isCalculating || price <= 0}
                                        className={`btn-premium w-3/4 text-xl ${isLoading || isCalculating || price <= 0 ? 'opacity-50 grayscale cursor-not-allowed' : 'shadow-[0_20px_40px_-10px_rgba(37,99,235,0.3)]'}`}
                                    >
                                        {isLoading ? 'שולח...' : price <= 0 ? 'נא לחשב מחיר' : <><CheckCircle size={28} /> הזמן מונית עכשיו</>}
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </form>

                {/* E-E-A-T & Trust Signals Section */}
                <div className="border-t border-slate-100 bg-slate-50 p-6 sm:p-8 text-center rounded-b-[3rem] mt-2 relative z-10">
                    <div className="flex flex-wrap justify-center gap-4 mb-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold bg-white px-3 py-1.5 rounded-xl shadow-sm border border-slate-100">
                            <CheckCircle size={14} className="text-emerald-500" />
                            <span>נהגים מורשים בלבד</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold bg-white px-3 py-1.5 rounded-xl shadow-sm border border-slate-100">
                            <Search size={14} className="text-blue-500" />
                            <span>שקיפות מחיר מלאה</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold bg-white px-3 py-1.5 rounded-xl shadow-sm border border-slate-100">
                            <Clock size={14} className="text-amber-500" />
                            <span>זמינות וחיפוש ב-360°</span>
                        </div>
                    </div>
                    <p className="text-slate-400 text-[11px] max-w-sm mx-auto leading-relaxed font-medium">
                        TAXIPRO מחויבת לאמנת השירות בישראל. כל נהגי הרשת מסומנים ומפוקחים למען ביטחונך. <Link to="/about" className="text-blue-500 font-bold hover:underline">קרא עוד אודותינו</Link>.
                    </p>
                </div>
            </div>
        </div>
    );
};

