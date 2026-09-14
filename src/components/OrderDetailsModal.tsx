import React, { useState, useEffect } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { Button } from './ui/Button';
import { getOrderStatus, markPaymentCompleted, resendOrderDetails, unassignDriver, updateOrder, compareIds, getDrivers, assignDriver } from '../api/adminApi';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, X, User, MessageSquare, Phone, MapPin, UserX, XCircle, Save, Pencil, Trash2, CheckCircle, Send, Calculator, Users, Filter, Check, Sparkles } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { LiveMap } from './LiveMap';
import { z } from 'zod';
import { Driver, Order } from '../types';
import { CityAutocomplete } from './CityAutocomplete';
import { GooglePlacesAutocomplete } from './GooglePlacesAutocomplete';
import { Toast } from './Toast';

// Validation Schema
const orderSchema = z.object({
    customerName: z.string().min(1, 'חובה להזין שם לקוח'),
    customerPhone: z.string().min(9, 'חובה להזין טלפון').regex(/^\d{9,12}$/, 'מספר טלפון לא תקין'),
    pickupAddress: z.string().min(1, 'חובה להזין כתובת איסוף'),
    pickupExactAddress: z.string().optional(),
    pickupNotes: z.string().optional(),
    destinationAddress: z.string().min(1, 'חובה להזין כתובת יעד'),
    destinationExactAddress: z.string().optional(),
    destinationNotes: z.string().optional(),
    price: z.number().min(0, 'מחיר לא תקין'),
    pickupDate: z.string(),
    pickupTime: z.string(),
});

type OrderFormValues = z.infer<typeof orderSchema>;

interface OrderDetailsModalProps {
    orderId: string;
    onClose: () => void;
    onUpdate: () => void;
    googleMapsApiKey?: string;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ orderId, onClose, onUpdate, googleMapsApiKey }) => {
    const focusTrapRef = useFocusTrap(true);
    const [order, setOrder] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [isCalculating, setIsCalculating] = useState(false);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [isDriversLoading, setIsDriversLoading] = useState(false);
    const [showDriversList, setShowDriversList] = useState(false);
    const [filterByArea, setFilterByArea] = useState(true);
    const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
    const [isSmartAssigning, setIsSmartAssigning] = useState(false);

    const { control, register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<OrderFormValues>({
        resolver: zodResolver(orderSchema)
    });

    const calculatePriceExplicit = async () => {
        const data = watch();

        if (!data.pickupAddress || !data.destinationAddress) {
            setToast({ message: 'חובה לבחור עיר איסוף ויעד לפני חישוב', type: 'error' });
            return;
        }

        setIsCalculating(true);
        try {
            const res = await import('../api/adminApi').then(m => m.calculatePrice({
                pickupAddress: data.pickupAddress,
                pickupExactAddress: data.pickupExactAddress || '',
                destinationAddress: data.destinationAddress,
                destinationExactAddress: data.destinationExactAddress || '',
                pickupDate: data.pickupDate,
                pickupTime: data.pickupTime
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

    useEffect(() => {
        loadOrder();
    }, [orderId]);

    const loadOrder = async () => {
        setIsLoading(true);
        const res = await getOrderStatus(orderId);
        if (res.ok && res.data) {
            setOrder(res.data);
            if (!res.data.driverId) {
                loadDrivers();
            }

            // Prepare form data from order
            const dt = res.data.pickupDatetime ? new Date(res.data.pickupDatetime) : new Date();
            reset({
                customerName: res.data.customerName,
                customerPhone: res.data.customerPhone,
                pickupAddress: res.data.pickupAddress,
                pickupExactAddress: res.data.pickupExactAddress || '',
                pickupNotes: res.data.pickupNotes || '',
                destinationAddress: res.data.destinationAddress,
                destinationExactAddress: res.data.destinationExactAddress || '',
                destinationNotes: res.data.destinationNotes || '',
                price: Number(res.data.price) || 0,
                pickupDate: !isNaN(dt.getTime()) ? dt.toISOString().split('T')[0] : '',
                pickupTime: !isNaN(dt.getTime()) ? dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''
            });
        }
        setIsLoading(false);
    };

    const loadDrivers = async () => {
        setIsDriversLoading(true);
        try {
            const res = await getDrivers();
            if (res.ok && res.data) {
                setDrivers(res.data.items);
            }
        } catch (e) {
            console.error("Failed to load drivers", e);
        } finally {
            setIsDriversLoading(false);
        }
    };

    const handleAssignManual = async () => {
        if (!selectedDriver || !order) return;

        setIsLoading(true);
        try {
            const res = await assignDriver({
                orderId: order.orderId,
                phone: selectedDriver.phone,
                driverName: selectedDriver.driverName
            });

            if (res.ok) {
                setToast({ message: `נהג ${selectedDriver.driverName} שויך בהצלחה`, type: 'success' });
                setShowDriversList(false);
                setSelectedDriver(null);
                onUpdate();
                loadOrder();
            } else {
                setToast({ message: 'שגיאה בשיוך: ' + res.error, type: 'error' });
            }
        } catch (e) {
            setToast({ message: 'שגיאה בתקשורת לשיוך נהג', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSmartAssignManual = async () => {
        if (!order || drivers.length === 0) return setToast({ message: 'אין נתונים או נהגים זמינים לשיבוץ חכם', type: 'error' });
        setIsSmartAssigning(true);

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

        const availableDrivers = drivers.filter(d => d.isOnline && d.lat && d.lng);
        if (availableDrivers.length === 0) {
            setIsSmartAssigning(false);
            return setToast({ message: 'אין נהגים באוויר לשיבוץ', type: 'warning' });
        }

        const driversWithContext = availableDrivers.map(d => ({
            ...d,
            distance: (pickupLat && pickupLng) ? haversine(pickupLat, pickupLng, d.lat!, d.lng!) : 0
        }));

        try {
            const { aiRecommendDriver } = await import('../services/aiService');
            const aiRec = await aiRecommendDriver(order, driversWithContext);
            if (aiRec && aiRec.driverPhone) {
                const chosen = availableDrivers.find(d => String(d.phone) === String(aiRec.driverPhone));
                if (chosen) {
                    const res = await assignDriver({ orderId: order.orderId, phone: chosen.phone, driverName: chosen.driverName });
                    if (res.ok) {
                        setToast({ message: `שובץ ${chosen.driverName} 🎯 | AI: ${aiRec.reason}`, type: 'success' });
                        onUpdate();
                        loadOrder();
                    } else {
                        setToast({ message: 'שגיאה: ' + (res.error || 'לא ניתן לשבץ'), type: 'error' });
                    }
                } else {
                    setToast({ message: 'ה-AI בחר נהג שלא נמצא ברשימה הפעילה', type: 'error' });
                }
            }
        } catch (e: any) {
            setToast({ message: 'כשל בפענוח ה-AI לשיוך חכם. ודא חיבור תקין.', type: 'error' });
        } finally {
            setIsSmartAssigning(false);
        }
    };

    const handleSave = async (data: OrderFormValues) => {
        if (!order) return;

        // Construct ISO datetime
        const pickupDatetime = `${data.pickupDate}T${data.pickupTime}`;

        // Validation: Verify valid date
        if (isNaN(new Date(pickupDatetime).getTime())) {
            setToast({ message: 'תאריך או שעה לא תקינים', type: 'error' });
            return;
        }

        const updates = {
            ...data,
            pickupDatetime
        };

        const res = await updateOrder(order.orderId, updates);
        if (res.ok) {
            setEditMode(false);
            onUpdate();
            loadOrder();
            setToast({ message: 'ההזמנה עודכנה בהצלחה', type: 'success' });
        } else {
            setToast({ message: 'שגיאה בעדכון: ' + res.error, type: 'error' });
        }
    };

    const handleUnassign = async () => {
        if (!confirm('האם אתה בטוח שברצונך לבטל את שיוך הנהג? הפעולה תשלח את ההזמנה מחדש לקבוצות.')) return;
        const res = await unassignDriver(orderId);
        if (res.ok) {
            onUpdate();
            loadOrder();
            setToast({ message: 'שיוך בוטל בהצלחה', type: 'success' });
        } else {
            setToast({ message: 'שגיאה: ' + res.error, type: 'error' });
        }
    };

    const handleCancelOrder = async () => {
        if (!confirm('האם לבטל את ההזמנה כליל?')) return;
        const res = await updateOrder(orderId, { status: 'cancelled' });
        if (res.ok) {
            onUpdate();
            onClose();
        } else {
            setToast({ message: 'שגיאה: ' + res.error, type: 'error' });
        }
    };

    const handleApprovePayment = async () => {
        if (!order || !order.driverId) return setToast({ message: 'לא ניתן לאשר תשלום ללא נהג משויך', type: 'error' });
        if (!confirm('האם לאשר שבוצע תשלום עמלה עבור הזמנה זו?')) return;

        // Optimistic Update
        const originalOrder = { ...order };
        setOrder({ ...order, paymentCompleted: true, status: 'paid' }); // Optimistic UI

        try {
            const res = await markPaymentCompleted({
                orderId: order.orderId,
                phone: order.driverPhone || order.customerPhone || ''
            });

            if (res.ok) {
                setToast({ message: 'תשלום אושר בהצלחה', type: 'success' });
                onUpdate();
            } else {
                throw new Error(res.error || 'Unknown error');
            }
        } catch (e: any) {
            setOrder(originalOrder); // Revert
            setToast({ message: 'שגיאה באישור תשלום: ' + e.message, type: 'error' });
        }
    };

    const handleResend = async () => {
        if (!confirm('האם לשלוח את פרטי ההזמנה מחדש לקבוצות בווטסאפ?')) return;
        const res = await resendOrderDetails(orderId);
        if (res.ok) {
            setToast({ message: 'הפרטים נשלחו בהצלחה!', type: 'success' });
        } else {
            setToast({ message: 'שגיאה בשליחה: ' + res.error, type: 'error' });
        }
    };

    const openWhatsApp = (phone: string, text = '') => {
        if (!phone) return;
        window.open(`https://wa.me/${phone.replace(/^0/, '972').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
    };

    if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;
    if (!order) return <div className="p-8 text-center text-red-500">הזמנה לא נמצאה</div>;

    return (
        <div className="flex flex-col h-full bg-slate-50" role="dialog" aria-modal="true" aria-labelledby="order-details-title" ref={focusTrapRef}>
            <header className="bg-slate-900 text-white p-6 flex justify-between items-center sticky top-0 z-10 shrink-0">
                <div>
                    <h2 id="order-details-title" className="text-2xl font-bold flex items-center gap-2">
                        {order.orderId}
                        <span className={`text-xs px-2 py-1 rounded-full text-slate-900 ${order.status === 'assigned' || order.status === 'confirmed' ? 'bg-blue-300' :
                            order.status === 'paid' ? 'bg-indigo-300' :
                                order.status === 'waiting_approval' ? 'bg-orange-300' :
                                    order.status === 'in_progress' || order.status === 'on_route' ? 'bg-blue-400' :
                                        order.status === 'broadcasted' ? 'bg-purple-300' :
                                            order.status === 'completed' ? 'bg-green-400' :
                                                order.status === 'cancelled' ? 'bg-red-400' : 'bg-yellow-400'
                            }`}>
                            {/* Hebrew Status mapping could be extracted to specific function */}
                            {order.status}
                        </span>
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">נוצר ב: {new Date(order.createdAt || '').toLocaleString('he-IL')}</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full"><X /></button>
            </header>

            <form onSubmit={handleSubmit(handleSave)} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6">
                {/* Customer Section */}
                <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="font-bold text-gray-500 uppercase text-xs flex items-center gap-2"><User size={14} /> פרטי לקוח</h3>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => openWhatsApp(order.customerPhone)} className="p-2 bg-green-100 text-green-700 rounded-full hover:bg-green-200"><MessageSquare size={16} /></button>
                            <a href={`tel:${order.customerPhone}`} className="p-2 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200"><Phone size={16} /></a>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-gray-400 block mb-1">שם לקוח</label>
                            {editMode ? (
                                <>
                                    <input {...register('customerName')} className="w-full p-2 border rounded" />
                                    {errors.customerName && <p className="text-red-500 text-xs">{errors.customerName.message}</p>}
                                </>
                            ) : (
                                <p className="font-bold text-lg">{order.customerName}</p>
                            )}
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 block mb-1">טלפון</label>
                            {editMode ? (
                                <>
                                    <input {...register('customerPhone')} className="w-full p-2 border rounded" />
                                    {errors.customerPhone && <p className="text-red-500 text-xs">{errors.customerPhone.message}</p>}
                                </>
                            ) : (
                                <p className="font-mono text-lg">{order.customerPhone}</p>
                            )}
                        </div>
                    </div>
                </section>

                {/* Ride Details */}
                <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-gray-500 uppercase text-xs mb-4 flex items-center gap-2"><MapPin size={14} /> פרטי נסיעה</h3>
                    <div className="space-y-4">
                        <div className="flex gap-3">
                            <div className="mt-1"><MapPin className="text-green-500" size={16} /></div>
                            <div className="flex-1 space-y-2">
                                <label className="text-xs text-gray-400 block">איסוף</label>
                                {editMode ? (
                                    <>
                                        <Controller
                                            name="pickupAddress"
                                            control={control}
                                            render={({ field }) => (
                                                <CityAutocomplete value={field.value} onChange={field.onChange} onSelect={(v) => field.onChange(v.name)} searchType="city" placeholder="עיר איסוף" />
                                            )}
                                        />
                                        <Controller
                                            name="pickupExactAddress"
                                            control={control}
                                            render={({ field }) => (
                                                <GooglePlacesAutocomplete
                                                    apiKey={googleMapsApiKey || ''}
                                                    value={field.value || ''}
                                                    onChange={field.onChange}
                                                    onSelect={(place) => {
                                                        field.onChange(place.address);
                                                        // We don't have lat/lng fields in this form schema but we could add them
                                                    }}
                                                    placeholder="רחוב ומספר (Google)"
                                                    className="text-sm"
                                                    cityContext={order.pickupAddress}
                                                />
                                            )}
                                        />
                                        <input {...register('pickupNotes')} className="w-full p-2 border rounded bg-yellow-50 text-xs" placeholder="הערות איסוף" />
                                    </>
                                ) : (
                                    <>
                                        <p className="font-medium">{order.pickupAddress}</p>
                                        {order.pickupExactAddress && <p className="text-sm text-slate-600">🏠 {order.pickupExactAddress}</p>}
                                        {order.pickupNotes && <p className="text-xs text-gray-500 bg-yellow-50 p-1 rounded">הערה: {order.pickupNotes}</p>}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* TRIP MAP PREVIEW */}
                        {order.pickupLat && order.pickupLng && (
                            <div className="h-48 my-4 rounded-2xl border border-slate-100 overflow-hidden shadow-inner">
                                <LiveMap
                                    pickup={{ lat: Number(order.pickupLat), lng: Number(order.pickupLng), address: order.pickupAddress }}
                                    destination={order.destinationLat ? { lat: Number(order.destinationLat), lng: Number(order.destinationLng), address: order.destinationAddress } : undefined}
                                    status={order.status}
                                />
                            </div>
                        )}

                        <div className="flex gap-3">
                            <div className="mt-1"><MapPin className="text-red-500" size={16} /></div>
                            <div className="flex-1 space-y-2">
                                <label className="text-xs text-gray-400 block">יעד</label>
                                {editMode ? (
                                    <>
                                        <Controller
                                            name="destinationAddress"
                                            control={control}
                                            render={({ field }) => (
                                                <CityAutocomplete value={field.value} onChange={field.onChange} onSelect={(v) => field.onChange(v.name)} searchType="city" placeholder="עיר יעד" />
                                            )}
                                        />
                                        <Controller
                                            name="destinationExactAddress"
                                            control={control}
                                            render={({ field }) => (
                                                <GooglePlacesAutocomplete
                                                    apiKey={googleMapsApiKey || ''}
                                                    value={field.value || ''}
                                                    onChange={field.onChange}
                                                    onSelect={(place) => {
                                                        field.onChange(place.address);
                                                    }}
                                                    placeholder="רחוב ומספר (Google)"
                                                    className="text-sm"
                                                    cityContext={order.destinationAddress}
                                                />
                                            )}
                                        />
                                        <input {...register('destinationNotes')} className="w-full p-2 border rounded bg-yellow-50 text-xs" placeholder="הערות יעד" />
                                    </>
                                ) : (
                                    <>
                                        <p className="font-medium">{order.destinationAddress}</p>
                                        {order.destinationExactAddress && <p className="text-sm text-slate-600">🏢 {order.destinationExactAddress}</p>}
                                        {order.destinationNotes && <p className="text-xs text-gray-500 bg-yellow-50 p-1 rounded">הערה: {order.destinationNotes}</p>}
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-4 pt-4 border-t border-slate-50">
                            <div className="flex-1">
                                <label className="text-xs text-gray-400 block mb-1">מועד איסוף</label>
                                {editMode ? (
                                    <div className="flex gap-2">
                                        <input type="date" {...register('pickupDate')} className="p-2 border rounded flex-1" />
                                        <input type="time" {...register('pickupTime')} className="p-2 border rounded w-24" />
                                    </div>
                                ) : (
                                    <p className="font-mono text-lg font-bold" dir="ltr">
                                        {new Date(order.pickupDatetime || '').toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 block mb-1">מחיר</label>
                                {editMode ? (
                                    <div className="flex flex-col gap-2">
                                        <input type="number" {...register('price', { valueAsNumber: true })} className="w-full p-2 border rounded font-bold" disabled={isCalculating} />
                                        <Button
                                            type="button"
                                            onClick={calculatePriceExplicit}
                                            isLoading={isCalculating}
                                            variant="accent"
                                            size="sm"
                                            className="w-full"
                                            leftIcon={<Calculator size={14} />}
                                        >
                                            חשב מחיר אוטומטי
                                        </Button>
                                    </div>
                                ) : (
                                    <p className="font-mono text-lg font-bold text-green-600">{order.price} ₪</p>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Driver Section */}
                <section className={`p-6 rounded-2xl shadow-sm border ${order.driverId ? 'bg-blue-50 border-blue-100' : 'bg-amber-50 border-amber-100'}`}>
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="font-bold uppercase text-xs flex items-center gap-2 text-slate-700">
                            {order.driverId ? <><User size={14} className="text-blue-600" /> נהג משויך</> : <><Loader2 size={14} className="animate-spin text-amber-600" /> מחפש נהג...</>}
                        </h3>
                        {order.driverId ? (
                            <div className="flex gap-2">
                                <button type="button" onClick={handleUnassign} title="בטל שיוך נהג" className="p-2 bg-red-100 text-red-700 rounded-full hover:bg-red-200"><UserX size={16} /></button>
                                <button type="button" onClick={() => openWhatsApp(order.driverPhone || '')} className="p-2 bg-green-100 text-green-700 rounded-full hover:bg-green-200"><MessageSquare size={16} /></button>
                                <a href={`tel:${order.driverPhone}`} className="p-2 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200"><Phone size={16} /></a>
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleSmartAssignManual}
                                    className="text-xs py-1 px-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-full font-bold hover:bg-blue-100 transition flex items-center gap-1 shadow-sm disabled:opacity-50"
                                    disabled={isSmartAssigning}
                                >
                                    {isSmartAssigning ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} שיוך AI
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowDriversList(!showDriversList)}
                                    className="text-xs py-1 px-3 bg-white border border-amber-200 text-amber-700 rounded-full font-bold hover:bg-amber-50 transition flex items-center gap-1"
                                >
                                    <Users size={12} /> שיוך ידני
                                </button>
                            </div>
                        )}
                    </div>

                    {order.driverId ? (
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-xl font-bold border border-blue-100 shadow-sm text-slate-700">
                                {order.driverName?.[0]}
                            </div>
                            <div>
                                <p className="font-bold text-lg">{order.driverName}</p>
                                <p className="text-sm text-slate-500 font-mono">{order.driverCarPlate} • {order.driverPhone}</p>
                            </div>
                        </div>
                    ) : showDriversList ? (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-bold text-amber-800">בחר נהג מהרשימה:</p>
                                <button
                                    type="button"
                                    onClick={() => setFilterByArea(!filterByArea)}
                                    className={`text-[10px] px-2 py-0.5 rounded flex items-center gap-1 transition ${filterByArea ? 'bg-amber-200 text-amber-800' : 'bg-slate-200 text-slate-600'}`}
                                >
                                    <Filter size={10} /> {filterByArea ? 'סינון לפי אזור פועל' : 'מציג את כל הנהגים'}
                                </button>
                            </div>

                            <div className="max-h-48 overflow-y-auto border border-amber-200 rounded-xl bg-white/50">
                                {isDriversLoading ? (
                                    <div className="p-4 text-center"><Loader2 className="animate-spin mx-auto text-amber-500" size={20} /></div>
                                ) : (
                                    drivers
                                        .filter(d => !filterByArea || (d.serviceArea && d.serviceArea.includes(order.pickupAddress)))
                                        .map(d => (
                                            <button
                                                key={d.driverId}
                                                type="button"
                                                onClick={() => setSelectedDriver(d)}
                                                className={`w-full p-2 text-right text-xs border-b border-amber-50 last:border-0 hover:bg-amber-100 transition flex items-center justify-between ${selectedDriver?.driverId === d.driverId ? 'bg-amber-100 font-bold' : ''}`}
                                            >
                                                <span>{d.driverName} <span className="text-slate-400 font-mono">({d.phone})</span></span>
                                                {selectedDriver?.driverId === d.driverId && <Check size={14} className="text-amber-600" />}
                                            </button>
                                        ))
                                )}
                                {!isDriversLoading && drivers.length === 0 && <p className="p-4 text-center text-xs text-slate-400">לא נמצאו נהגים</p>}
                            </div>

                            {selectedDriver && (
                                <button
                                    type="button"
                                    onClick={handleAssignManual}
                                    className="w-full py-2 bg-amber-600 text-white rounded-lg font-bold text-xs hover:bg-amber-700 transition shadow-sm flex items-center justify-center gap-2"
                                >
                                    <CheckCircle size={14} /> שייך את {selectedDriver.driverName}
                                </button>
                            )}
                        </div>
                    ) : (
                        order.status === 'cancelled' ? (
                            <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-center font-bold flex flex-col items-center gap-2">
                                <XCircle size={24} />
                                <p>הזמנה זו בוטלה</p>
                            </div>
                        ) : (
                            <p className="text-sm text-amber-700 font-medium">ההזמנה ממתינה לשיבוץ נהג.</p>
                        )
                    )}
                </section>
            </form>

            <footer className="p-6 bg-white border-t border-slate-100 flex flex-wrap gap-3 shrink-0">
                {editMode ? (
                    <>
                        <button type="button" onClick={handleSubmit(handleSave)} disabled={isSubmitting} className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition flex justify-center items-center gap-2">
                            {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} שמור שינויים
                        </button>
                        <button type="button" onClick={() => { setEditMode(false); reset(); }} className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition">ביטול</button>
                    </>
                ) : (
                    <>

                        <button
                            type="button"
                            onClick={() => {
                                reset(); // Reset to last loaded values 
                                setEditMode(true);
                            }}
                            className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition flex justify-center items-center gap-2"
                        >
                            <Pencil size={18} /> עריכה
                        </button>
                        {order.status !== 'cancelled' && (
                            <button type="button" onClick={handleCancelOrder} className="px-6 py-3 bg-red-50 text-red-600 border border-red-100 rounded-xl font-bold hover:bg-red-100 transition flex items-center gap-2"><Trash2 size={18} /> ביטול</button>
                        )}
                    </>
                )}

                {!editMode && order.driverId && order.status !== 'completed' && order.status !== 'cancelled' && (!order.paymentCompleted || String(order.paymentCompleted) === 'WAITING_APPROVAL') && (
                    <button type="button" onClick={handleApprovePayment} className={`md:flex-1 px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition w-full md:w-auto ${String(order.paymentCompleted) === 'WAITING_APPROVAL' ? 'bg-orange-500 text-white hover:bg-orange-600 shadow-md transform hover:scale-105' : 'bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100'}`}>
                        <CheckCircle size={18} /> {String(order.paymentCompleted) === 'WAITING_APPROVAL' ? 'אשר תשלום (ממתין)' : 'אישור תשלום'}
                    </button>
                )}

                {!editMode && order.status !== 'cancelled' && (
                    <button type="button" onClick={handleResend} className="px-4 py-3 bg-blue-50 text-blue-600 border border-blue-100 rounded-xl font-bold hover:bg-blue-100 transition flex items-center gap-2" title="שלח שוב לשיבוץ">
                        <Send size={18} />
                    </button>
                )}
            </footer>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};
