import React, { useState, useEffect, useCallback } from 'react';
import { debounce } from 'lodash';
import { MessageSquare, Save, Send, X, Loader2, Calculator } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { Button } from './ui/Button';
import { GooglePlacesAutocomplete } from './GooglePlacesAutocomplete';
import { CityAutocomplete } from './CityAutocomplete';
import { Toast } from './Toast';
import { createOrder } from '../api/adminApi';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const createOrderSchema = z.object({
    customerName: z.string().min(1, 'חובה להזין שם לקוח'),
    customerPhone: z.string().transform((s) => s.replace(/\D/g, '')).pipe(z.string().regex(/^0\d{8,9}$/, 'מספר טלפון לא תקין')),
    pickupAddress: z.string().min(1, 'חובה לבחור עיר איסוף'),
    pickupExactAddress: z.string().optional(),
    pickupNotes: z.string().optional(),
    pickupLat: z.number(),
    pickupLng: z.number(),
    destinationAddress: z.string().min(1, 'חובה לבחור עיר יעד'),
    destinationExactAddress: z.string().optional(),
    destinationNotes: z.string().optional(),
    destLat: z.number(),
    destLng: z.number(),
    pickupDate: z.string(),
    pickupTime: z.string(),
    price: z.number().min(1, 'מחיר חייב להיות גדול מ-0'),
    notes: z.string().optional(),
    passengers: z.string().optional().default('1'),
    luggage: z.string().optional().default('0'),
    flightNumber: z.string().optional(),
    paymentMethod: z.string().optional().default('cash'),
    notificationChannels: z.array(z.string())
});

type CreateOrderForm = z.infer<typeof createOrderSchema>;

interface CreateOrderModalProps {
    onClose: () => void;
    onSuccess: () => void;
    googleMapsApiKey?: string;
    embedded?: boolean;
}

export const CreateOrderModal: React.FC<CreateOrderModalProps> = ({ onClose, onSuccess, googleMapsApiKey = '', embedded = false }) => {
    const focusTrapRef = useFocusTrap(!embedded);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);

    const { register, control, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<CreateOrderForm>({
        resolver: zodResolver(createOrderSchema) as any,
        defaultValues: {
            customerName: '',
            customerPhone: '',
            pickupAddress: '',
            pickupExactAddress: '',
            pickupNotes: '',
            pickupLat: 0,
            pickupLng: 0,
            destinationAddress: '',
            destinationExactAddress: '',
            destinationNotes: '',
            destLat: 0,
            destLng: 0,
            pickupDate: (() => {
                const d = new Date(Date.now() + 5 * 60000);
                const offset = d.getTimezoneOffset() * 60000;
                const local = new Date(d.getTime() - offset);
                return local.toISOString().split('T')[0];
            })(),
            pickupTime: new Date(Date.now() + 5 * 60000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
            price: 100,
            notes: '',
            passengers: '1',
            luggage: '0',
            flightNumber: '',
            paymentMethod: 'cash',
            notificationChannels: ['whatsapp', 'telegram']
        }
    });

    const calculatePriceExplicit = async () => {
        const [pickupLat, pickupLng, destLat, destLng, pickupAddr, destAddr, pickupExact, destExact] = watch(['pickupLat', 'pickupLng', 'destLat', 'destLng', 'pickupAddress', 'destinationAddress', 'pickupExactAddress', 'destinationExactAddress']);
        const date = watch('pickupDate');
        const time = watch('pickupTime');

        if (!pickupAddr || !destAddr) {
            setToast({ message: 'חובה לבחור עיר איסוף ויעד לפני חישוב', type: 'error' });
            return;
        }

        setIsCalculating(true);
        try {
            const res = await import('../api/adminApi').then(m => m.calculatePrice({
                pickupAddress: pickupAddr,
                pickupExactAddress: pickupExact || '',
                destinationAddress: destAddr,
                destinationExactAddress: destExact || '',
                pickupLat, pickupLng, destLat, destLng,
                pickupDate: date,
                pickupTime: time
            }));

            if (res.ok && res.data && res.data.price) {
                setValue('price', res.data.price);
                setToast({ message: `המחיר המחושב הוא ${res.data.price} ₪`, type: 'success' });
            } else {
                setToast({ message: 'חישוב מחיר נכשל: ' + (res.error || 'שגיאה בשרת'), type: 'error' });
            }
        } catch (e) {
            console.error("Price calc failed", e);
            setToast({ message: 'שגיאה בתקשורת לחישוב מחיר', type: 'error' });
        } finally {
            setIsCalculating(false);
        }
    };

    const onSubmit = async (data: any) => {
        try {
            const res = await createOrder({
                ...data,
                // COMPREHENSIVE FIX: Send separated fields to backend
                // pickupAddress -> City (from CityAutocomplete)
                // pickupExactAddress -> Street/Number (from GooglePlacesAutocomplete)
                pickupAddress: data.pickupAddress,
                pickupExactAddress: data.pickupExactAddress,
                destinationAddress: data.destinationAddress,
                destinationExactAddress: data.destinationExactAddress,
                notificationChannels: data.notificationChannels
            } as any);

            if (res.ok) {
                const orderId = (res.data as any)?.orderId || (res.data as any)?.order_id || 'חדשה';
                const { notifyLocalWhatsApp, formatNewRideGroupMessage } = await import('../api/api');
                const wa = await notifyLocalWhatsApp({
                    text: formatNewRideGroupMessage({
                        orderId,
                        pickupAddress: data.pickupAddress,
                        destinationAddress: data.destinationAddress,
                        price: data.price,
                        pickupDate: data.pickupDate,
                        pickupTime: data.pickupTime,
                        notes: data.notes
                    })
                });
                await notifyLocalWhatsApp({
                    jid: data.customerPhone,
                    role: 'dispatcher',
                    text: `🚖 *ההזמנה שלך נקלטה*\nמספר: ${orderId}\n📍 ${data.pickupAddress} → ${data.destinationAddress}\n💰 ${data.price} ₪\nנעדכן אותך כשנהג יאשר.`
                });
                setToast({
                    message: wa.queued
                        ? 'הזמנה נוצרה. הודעות הווטסאפ ממתינות לסריקת QR'
                        : wa.ok
                            ? 'הזמנה נוצרה ונשלחה לקבוצה וללקוח'
                            : `הזמנה נוצרה. ווטסאפ: ${wa.error || 'סרוק QR בגשר'}`,
                    type: wa.ok || wa.queued ? 'success' : 'error'
                });
                setTimeout(() => {
                    onSuccess();
                    onClose();
                }, 1500);
            } else {
                setToast({ message: 'שגיאה ביצירת הזמנה: ' + res.error, type: 'error' });
            }
        } catch (err) {
            setToast({ message: 'שגיאה: ' + (err as Error).message, type: 'error' });
        }
    };
    return (
        <div className={embedded ? 'relative' : 'fixed inset-0 bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100] p-2 sm:p-4 animate-in fade-in'} role="dialog" aria-modal={!embedded} aria-labelledby="modal-title">
            <div ref={focusTrapRef} className="bg-white rounded-t-3xl sm:rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[94dvh] sm:max-h-[95vh] mx-auto">
                <header className="p-8 bg-[#0F172A] border-b border-white/5 flex justify-between items-center relative overflow-hidden">
                    <div className="relative z-10">
                        <h2 id="modal-title" className="text-3xl font-black text-white tracking-tight">הזמנה חדשה</h2>
                        <p className="text-slate-500 font-bold text-xs uppercase tracking-[0.2em] mt-1">מרכז שיגור חכם</p>
                    </div>
                    {!embedded && (
                    <button onClick={onClose} className="bg-white/5 hover:bg-white/10 p-3 rounded-2xl text-slate-400 hover:text-white transition-all relative z-10" aria-label="סגור">
                        <X size={24} />
                    </button>
                    )}
                    {/* Header accent */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 blur-[100px] -z-0"></div>
                </header>

                <form onSubmit={handleSubmit(onSubmit)} className="p-8 overflow-y-auto space-y-10 bg-[#1E293B]">
                    {/* Customer Info Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">שם הלקוח</label>
                            <input {...register('customerName')} className="w-full bg-[#0F172A] border border-white/5 rounded-2xl p-4 text-white font-bold outline-none focus:ring-2 focus:ring-primary-500/50 transition-all placeholder:text-slate-600" placeholder="ישראל ישראלי" />
                            {errors.customerName && <p className="text-rose-400 text-[10px] font-black uppercase tracking-wider px-1">{errors.customerName.message}</p>}
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">טלפון ליצירת קשר</label>
                            <input {...register('customerPhone')} className="w-full bg-[#0F172A] border border-white/5 rounded-2xl p-4 text-white font-mono font-bold outline-none focus:ring-2 focus:ring-primary-500/50 transition-all placeholder:text-slate-600" type="tel" placeholder="050-000-0000" />
                            {errors.customerPhone && <p className="text-rose-400 text-[10px] font-black uppercase tracking-wider px-1">{errors.customerPhone.message}</p>}
                        </div>
                    </div>

                    {/* Route Selection - Bento Grid Style */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 bg-[#0F172A]/50 rounded-[2rem] border border-white/5">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 mb-2 px-1">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_#10b981]"></div>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">נקודת איסוף</span>
                            </div>
                            <Controller
                                name="pickupAddress"
                                control={control}
                                render={({ field }) => (
                                    <CityAutocomplete
                                        value={field.value || ''}
                                        onChange={field.onChange}
                                        onSelect={(city: any) => {
                                            const cityName = city.hebrew || city.name || city.english || city;
                                            field.onChange(cityName);
                                            if (city.lat && city.lng) {
                                                setValue('pickupLat', city.lat);
                                                setValue('pickupLng', city.lng);
                                            }
                                        }}
                                        searchType="city"
                                        placeholder="עיר איסוף..."
                                    />
                                )}
                            />
                            <Controller
                                name="pickupExactAddress"
                                control={control}
                                render={({ field }) => (
                                    <GooglePlacesAutocomplete
                                        apiKey={googleMapsApiKey}
                                        value={field.value || ''}
                                        onChange={field.onChange}
                                        onSelect={(place) => {
                                            field.onChange(place.address);
                                            setValue('pickupLat', place.lat);
                                            setValue('pickupLng', place.lng);
                                        }}
                                        placeholder="רחוב ומספר (Google)..."
                                        cityContext={watch('pickupAddress')}
                                    />
                                )}
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-3 mb-2 px-1">
                                <div className="w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_8px_#f43f5e]"></div>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">יעד נסיעה</span>
                            </div>
                            <Controller
                                name="destinationAddress"
                                control={control}
                                render={({ field }) => (
                                    <CityAutocomplete
                                        value={field.value || ''}
                                        onChange={field.onChange}
                                        onSelect={(city: any) => {
                                            const cityName = city.hebrew || city.name || city.english || city;
                                            field.onChange(cityName);
                                            if (city.lat && city.lng) {
                                                setValue('destLat', city.lat);
                                                setValue('destLng', city.lng);
                                            }
                                        }}
                                        searchType="city"
                                        placeholder="עיר יעד..."
                                    />
                                )}
                            />
                            <Controller
                                name="destinationExactAddress"
                                control={control}
                                render={({ field }) => (
                                    <GooglePlacesAutocomplete
                                        apiKey={googleMapsApiKey}
                                        value={field.value || ''}
                                        onChange={field.onChange}
                                        onSelect={(place) => {
                                            field.onChange(place.address);
                                            setValue('destLat', place.lat);
                                            setValue('destLng', place.lng);
                                        }}
                                        placeholder="רחוב ומספר (Google)..."
                                        cityContext={watch('destinationAddress')}
                                    />
                                )}
                            />
                        </div>
                    </div>

                    {/* Logistics & Pricing */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">תאריך איסוף</label>
                            <input {...register('pickupDate')} type="date" className="w-full bg-[#0F172A] border border-white/5 rounded-2xl p-4 text-white font-bold outline-none focus:ring-2 focus:ring-primary-500/50 transition-all cursor-pointer" />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">שעת איסוף</label>
                            <input {...register('pickupTime')} type="time" className="w-full bg-[#0F172A] border border-white/5 rounded-2xl p-4 text-white font-bold outline-none focus:ring-2 focus:ring-primary-500/50 transition-all cursor-pointer" />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">תעריף משוער (₪)</label>
                            <div className="relative group">
                                <input
                                    {...register('price', { valueAsNumber: true })}
                                    type="number"
                                    className="w-full bg-primary-500/10 border border-primary-500/30 rounded-2xl p-4 text-primary-400 font-black text-xl outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                                    disabled={isCalculating}
                                />
                                <button
                                    type="button"
                                    onClick={calculatePriceExplicit}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-primary-500 text-white p-2 rounded-xl shadow-lg hover:scale-110 active:scale-95 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                                    disabled={isCalculating}
                                    title="חשב מחיר חכם"
                                >
                                    {isCalculating ? <Loader2 size={18} className="animate-spin" /> : <Calculator size={18} />}
                                </button>
                            </div>
                            {errors.price && <p className="text-rose-400 text-[10px] font-black uppercase px-1">{errors.price.message}</p>}
                        </div>
                    </div>

                    {/* Additional Options HUD */}
                    <div className="p-8 bg-[#0F172A]/30 rounded-[2.5rem] border border-white/5 space-y-8">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">נוסעים</label>
                                <input {...register('passengers')} type="number" min="1" max="8" className="w-full bg-[#0F172A] border border-white/5 rounded-xl p-3 text-white font-bold text-sm outline-none focus:ring-1 focus:ring-primary-500" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">מזוודות</label>
                                <input {...register('luggage')} type="number" min="0" max="10" className="w-full bg-[#0F172A] border border-white/5 rounded-xl p-3 text-white font-bold text-sm outline-none focus:ring-1 focus:ring-primary-500" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">טיסה</label>
                                <input {...register('flightNumber')} type="text" className="w-full bg-[#0F172A] border border-white/5 rounded-xl p-3 text-white font-bold text-sm outline-none focus:ring-1 focus:ring-primary-500 uppercase placeholder:text-slate-700" placeholder="LY123" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">תשלום</label>
                                <select {...register('paymentMethod')} className="w-full bg-[#0F172A] border border-white/5 rounded-xl p-3 text-white font-bold text-sm outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer appearance-none">
                                    <option value="cash">מזומן (Cash)</option>
                                    <option value="credit">אשראי (Card)</option>
                                    <option value="bit">ביט (Bit)</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">הערות תפעוליות</label>
                            <textarea {...register('notes')} className="w-full bg-[#0F172A] border border-white/5 rounded-2xl p-4 text-white text-sm h-24 outline-none focus:ring-2 focus:ring-primary-500/50 resize-none transition-all" placeholder="הערות חשובות לנהג..." />
                        </div>

                        {/* Channels Selection */}
                        <div className="pt-4 border-t border-white/5">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">שידור מבצעי</label>
                            <Controller
                                name="notificationChannels"
                                control={control}
                                render={({ field }) => (
                                    <div className="flex gap-6">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={field.value.includes('whatsapp')}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    const newValue = checked ? [...field.value, 'whatsapp'] : field.value.filter(c => c !== 'whatsapp');
                                                    field.onChange(newValue);
                                                }}
                                                className="w-6 h-6 rounded-lg bg-emerald-500/10 border-white/10 text-emerald-500 focus:ring-emerald-500/50"
                                            />
                                            <span className="text-sm font-black text-slate-400 group-hover:text-emerald-400 transition-colors flex items-center gap-2 italic">
                                                <MessageSquare size={16} /> WhatsApp
                                            </span>
                                        </label>
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={field.value.includes('telegram')}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    const newValue = checked ? [...field.value, 'telegram'] : field.value.filter(c => c !== 'telegram');
                                                    field.onChange(newValue);
                                                }}
                                                className="w-6 h-6 rounded-lg bg-primary-500/10 border-white/10 text-primary-500 focus:ring-primary-500/50"
                                            />
                                            <span className="text-sm font-black text-slate-400 group-hover:text-primary-400 transition-colors flex items-center gap-2 italic">
                                                <Send size={16} /> Telegram
                                            </span>
                                        </label>
                                    </div>
                                )}
                            />
                        </div>
                    </div>

                    <div className="pt-10 flex justify-end gap-5 items-center">
                        <button type="button" onClick={onClose} className="px-8 py-4 text-slate-500 font-black uppercase text-xs tracking-widest hover:text-white transition-colors">ביטול</button>
                        <button
                            type="submit"
                            disabled={isSubmitting || isCalculating}
                            className="bg-primary-600 hover:bg-primary-500 text-white px-12 py-4 rounded-2xl font-black text-lg tracking-tight shadow-[0_20px_40px_rgba(79,70,229,0.3)] transition-all flex items-center gap-3 disabled:opacity-50 disabled:scale-95"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={24} className="animate-spin" />
                                    <span>מעבד...</span>
                                </>
                            ) : (
                                <>
                                    <Save size={24} />
                                    <span>שדר הזמנה</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};
