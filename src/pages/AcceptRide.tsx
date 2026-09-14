
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { acceptRideByPhone, sendToBackend } from '../api/driverApi';
import { Phone, Loader2, CheckCircle, XCircle, AlertTriangle, ShieldCheck, User, Zap, Lock, DollarSign, MapPin } from 'lucide-react';
import { normalizePhone } from '../utils/phone';
import { hapticFeedback } from '../utils/haptics';

import { DriverMap } from '../components/DriverMap';
import { DriverIdentityForm } from '../components/accept-ride/DriverIdentityForm';
import { AcceptRideSuccess } from '../components/accept-ride/AcceptRideSuccess';
import { AcceptRideError } from '../components/accept-ride/AcceptRideError';
import { AcceptRideNotRegistered } from '../components/accept-ride/AcceptRideNotRegistered';

export const AcceptRide: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const orderId = searchParams.get('orderId');

    // Offer Data for Map
    const [offerData, setOfferData] = useState<any>(null);

    // State for User Identity
    const [identityType, setIdentityType] = useState<'telegram' | 'phone' | null>(null);
    const [tgUser, setTgUser] = useState<any>(null);
    const [phoneNumber, setPhoneNumber] = useState('');

    // State for Consent
    const [agreedToTerms, setAgreedToTerms] = useState(false);

    // Flow State
    const [status, setStatus] = useState<'identifying' | 'consent_required' | 'submitting' | 'success' | 'taken' | 'error' | 'not_registered'>('identifying');
    const [errorMessage, setErrorMessage] = useState('');
    const [takenDetails, setTakenDetails] = useState({ by: '' });
    const [confirmedPhone, setConfirmedPhone] = useState('');

    useEffect(() => {
        if (!orderId) {
            setStatus('error');
            setErrorMessage('מספר הזמנה חסר בקישור.');
            return;
        }
        const detectedPhone = identifyUser();
        fetchOffer(detectedPhone);
    }, [orderId]);

    const fetchOffer = async (resolvedPhone?: string) => {
        if (!orderId) return;
        try {
            // Use phone passed directly from identifyUser (avoids React state race condition)
            const urlPhone = searchParams.get('phone');
            const storedPhone = localStorage.getItem('driver_phone');
            const phone = resolvedPhone || urlPhone || storedPhone || '';

            const res = await sendToBackend<any>('getOfferDetails', { orderId, phone });
            if (res.ok && res.data) {
                setOfferData(res.data);
            }
        } catch (e) {
            console.warn("Failed to load offer map", e);
        }
    };

    const identifyUser = (): string => {
        // 1. Check for Telegram WebApp
        const tg = (window as any).Telegram?.WebApp;
        if (tg && tg.initDataUnsafe?.user) {
            const user = tg.initDataUnsafe.user;
            setIdentityType('telegram');
            setTgUser(user);
            tg.expand(); // Open full screen in Telegram
            setStatus('consent_required');
            return ''; // Telegram identity — no phone needed
        }

        // 2. Check for Phone in URL (WhatsApp Private Link) or LocalStorage
        const urlPhone = searchParams.get('phone');
        const storedPhone = localStorage.getItem('driver_phone');
        const rawPhone = urlPhone || storedPhone;
        const detectedPhone = normalizePhone(rawPhone || '');

        if (detectedPhone) {
            setPhoneNumber(detectedPhone);
            setIdentityType('phone');
            setStatus('consent_required');
        } else {
            // No identity found - require manual input
            setIdentityType(null); // Explicit 'null' to prompt for input
            setPhoneNumber('');
            setStatus('consent_required');
        }
        return detectedPhone;
    };

    const closeWebApp = () => {
        if ((window as any).Telegram?.WebApp) {
            (window as any).Telegram.WebApp.close();
        } else {
            navigate('/');
        }
    };

    const handleConfirmAndAccept = async () => {
        if (!agreedToTerms) {
            setErrorMessage('חובה לאשר את תנאי השימוש כדי להמשיך.');
            setStatus('error');
            return;
        }

        if ((!identityType || identityType === 'phone') && normalizePhone(phoneNumber).length < 9) {
            setErrorMessage('נא להזין מספר טלפון תקין.');
            setStatus('error');
            return;
        }

        setStatus('submitting');

        try {
            let res;

            if (identityType === 'telegram') {
                res = await sendToBackend('acceptByTelegramWebApp', {
                    orderId,
                    telegramId: String(tgUser.id)
                });
            } else {
                // Phone Flow - use normalized phone
                const normalizedPhone = normalizePhone(phoneNumber);
                res = await acceptRideByPhone({ orderId: orderId!, phone: normalizedPhone });

                if (res.ok) {
                    // Only save on success
                    localStorage.setItem('driver_phone', normalizedPhone);
                }
            }

            handleResponse(res);

        } catch (e) {
            setStatus('error');
            setErrorMessage('שגיאת תקשורת עם השרת.');
        }
    };

    const handleResponse = (res: any) => {
        if (res.ok) {
            const driverName = res.data?.driverName || res.driverName || 'נהג';
            const customerPhone = res.data?.customerPhone || res.data?.customer_phone;
            import('../api/api').then(({ notifyLocalWhatsApp }) => {
                notifyLocalWhatsApp({
                    text: `❌ *הזמנה ${orderId} נתפסה!*\nנלקחה על ידי הנהג: ${driverName}\n\nתודה!`
                });
                if (customerPhone) {
                    notifyLocalWhatsApp({
                        jid: customerPhone,
                        role: 'passenger',
                        text: `✨ *הנסיעה שלך בדרך!* ✨\n\nנהג אישר את הזמנתך (נסיעה ${orderId})\n👤 *נהג:* ${driverName}\nתודה שבחרת בנו! 🚕`
                    });
                }
            });
            setStatus('success');
            if (res.driverPhone) setConfirmedPhone(res.driverPhone);
            // Universal haptic feedback
            hapticFeedback.success();
        } else if (res.error === 'NOT_REGISTERED' || res.error === 'DRIVER_NOT_ACTIVE') {
            setStatus('not_registered');
        } else if (res.error && res.error.startsWith('TAKEN')) {
            setStatus('taken');
            // Extract driver name if available "TAKEN: John Doe"
            const parts = res.error.split(':');
            const drvName = parts.length > 1 ? parts[1].trim() : 'נהג אחר';
            setTakenDetails({ by: drvName });
        } else {
            setStatus('error');
            setErrorMessage(res.error || 'שגיאה לא ידועה');
        }
    };

    const goToRegistration = () => {
        const query = new URLSearchParams();
        query.set('orderId', orderId || '');

        if (identityType === 'telegram' && tgUser) {
            query.set('telegramId', String(tgUser.id));
            query.set('name', `${tgUser.first_name || ''} ${tgUser.last_name || ''}`);
            if (tgUser.username) query.set('username', tgUser.username);
        } else {
            if (phoneNumber) query.set('phone', phoneNumber);
        }

        query.set('skipAuthCheck', 'true');
        navigate(`/register-driver?${query.toString()}`);
    };

    const handleClose = () => {
        if ((window as any).Telegram?.WebApp) {
            (window as any).Telegram.WebApp.close();
        } else {
            window.close();
            // Fallback - Safe UI Update
            window.location.href = '/';
        }
    };


    // --- RENDER ---

    if (status === 'identifying' || status === 'submitting') {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4" dir="rtl">
                <Loader2 className="animate-spin mb-4 text-white" size={48} />
                <p className="font-bold text-lg text-slate-300 animate-pulse">
                    {status === 'identifying' ? 'מזהה משתמש...' : 'מאשר נסיעה מול המערכת...'}
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 flex items-start sm:items-center justify-center p-2 sm:p-4 font-sans" dir="rtl">
            <div className="bg-slate-800 text-white p-4 sm:p-8 rounded-2xl sm:rounded-3xl w-full max-w-md shadow-2xl relative overflow-hidden border border-slate-700 mt-2 sm:mt-0">

                {/* Header / Brand */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-yellow-400 to-orange-500"></div>

                <div className="mb-4 sm:mb-6 text-center">
                    <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-mono font-bold tracking-wider">
                        הזמנה #{orderId}
                    </span>
                </div>

                {/* Map Preview */}
                {offerData && offerData.googleMapsApiKey && (
                    <div className="mb-4 sm:mb-6 rounded-xl overflow-hidden shadow-sm sm:shadow-md border border-gray-200">
                        <DriverMap
                            apiKey={offerData.googleMapsApiKey}
                            pickupLat={offerData.pickupLat}
                            pickupLng={offerData.pickupLng}
                            destLat={offerData.destLat}
                            destLng={offerData.destLng}
                            showUserLocation={false}
                            className="h-36 sm:h-40"
                        />
                        <div className="bg-gray-50 p-2 sm:p-3 text-[11px] sm:text-xs text-gray-500 flex flex-col sm:flex-row gap-1 sm:gap-0 justify-between sm:items-center">
                            <span className="flex items-center gap-1"><MapPin size={12} className="text-blue-500" /> {offerData.pickup_address}</span>
                            <span className="flex items-center gap-1"><MapPin size={12} className="text-red-500" /> {offerData.destination_address}</span>
                        </div>
                    </div>
                )}

                {/* --- CONSENT & CONFIRMATION SCREEN --- */}
                {status === 'consent_required' && (
                    <DriverIdentityForm
                        identityType={identityType}
                        tgUser={tgUser}
                        phoneNumber={phoneNumber}
                        setPhoneNumber={setPhoneNumber}
                        setIdentityType={setIdentityType}
                        agreedToTerms={agreedToTerms}
                        setAgreedToTerms={setAgreedToTerms}
                        handleConfirmAndAccept={handleConfirmAndAccept}
                    />
                )}

                {/* --- SUCCESS STATE --- */}
                {status === 'success' && (
                    <AcceptRideSuccess
                        orderId={orderId}
                        confirmedPhone={confirmedPhone}
                        tgUser={tgUser}
                        phoneNumber={phoneNumber}
                        handleClose={handleClose}
                    />
                )}

                {/* --- ERROR / TAKEN STATE --- */}
                {(status === 'error' || status === 'taken') && (
                    <AcceptRideError
                        status={status}
                        errorMessage={errorMessage}
                        takenDetails={takenDetails}
                        handleClose={handleClose}
                    />
                )}

                {/* --- NOT REGISTERED STATE --- */}
                {status === 'not_registered' && (
                    <AcceptRideNotRegistered goToRegistration={goToRegistration} />
                )}

                <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-100 text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest">Secured by TaxiPro Enterprise</p>
                </div>
            </div>
        </div >
    );
};
