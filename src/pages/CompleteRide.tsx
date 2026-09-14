
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { completeOrder, sendToBackend, getSystemSettings } from '../api/driverApi';
import { Check, CheckCircle, Loader2, XCircle, Clock, MapPin, DollarSign, Smartphone, CreditCard, ExternalLink, ShieldCheck, Info, Sparkles, Copy } from 'lucide-react';
import { Toast } from '../components/Toast';
import { FinanceSummary } from '../components/complete-ride/FinanceSummary';
import { PaymentMethodSelector } from '../components/complete-ride/PaymentMethodSelector';
import { BitInstructions } from '../components/complete-ride/BitInstructions';
import { InvoiceCard } from '../components/complete-ride/InvoiceCard';

const getGreeting = () => {
    const hour = new Date().getHours();
    const day = new Date().getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday

    if (day === 5 && hour >= 16) return 'שבת שלום ומבורכת!';
    if (day === 6 && hour <= 20) return 'שבת שלום!';
    if (day === 6 && hour > 20) return 'שבוע טוב ומבורך!';

    if (hour >= 5 && hour < 12) return 'בוקר אור ויום מוצלח!';
    if (hour >= 12 && hour < 17) return 'צהריים טובים והמשך יום פורה!';
    if (hour >= 17 && hour < 21) return 'ערב טוב וסע בזהירות!';
    return 'לילה טוב ומשמרת בטוחה!';
};

export const CompleteRide: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const orderId = searchParams.get('orderId');
    const phone = searchParams.get('phone');

    const [status, setStatus] = useState<'confirming' | 'submitting' | 'success' | 'payment_required' | 'error' | 'waiting_approval'>('confirming');
    const [errorMessage, setErrorMessage] = useState('');
    const [financeData, setFinanceData] = useState<any>(null);
    const [completionData, setCompletionData] = useState<any>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'bit' | 'paybox' | 'paypal' | null>(null);
    const [systemSettings, setSystemSettings] = useState<any>(null);

    const [orderStatus, setOrderStatus] = useState<string>('');
    const [isLoadingStatus, setIsLoadingStatus] = useState(true);
    const isSubmitting = status === 'submitting';

    useEffect(() => {
        if (!orderId || !phone) {
            setStatus('error');
            setErrorMessage('פרטי נסיעה חסרים. אנא ודא שהגעת מהקישור שקיבלת בוואטסאפ.');
            return;
        }

        // Fetch Order Status on Mount
        const fetchStatus = async () => {
            try {
                // Fetch Settings parallel with Status
                getSystemSettings().then(res => {
                    if (res.ok && res.data) setSystemSettings(res.data);
                });

                // We use 'getOrderStatus' which aligns with backend
                const res = await sendToBackend<any>('getOrderStatus', { orderId });
                if (res.ok && res.data) {
                    setOrderStatus(res.data.status?.toLowerCase() || '');

                    // Logic: If completed -> show finance. If on_route/confirmed -> show actions.
                    if (res.data.status === 'completed') {
                        setCompletionData(res.data); // Assuming we can get summary? 
                        // Actually order object might not have full finance computed unless we calc it?
                        // Let's rely on user action or re-fetching if 'completed'.
                        // For now, if completed, we might just say "Already Completed".
                    }
                }
            } catch (e) {
                console.error("Status fetch failed", e);
            } finally {
                setIsLoadingStatus(false);
            }
        };
        fetchStatus();
    }, [orderId, phone]);

    const handleStartRide = async () => {
        setStatus('submitting');
        try {
            const res = await sendToBackend<any>('updateOrder', {
                orderId,
                phone,
                updates: { status: 'on_route' }
            });
            if (res.ok) {
                setOrderStatus('on_route');
                setStatus('confirming'); // Go back to main screen but now status is on_route
            } else {
                setErrorMessage('שגיאה בעדכון סטטוס יציאה');
                setStatus('error');
            }
        } catch (e) {
            setErrorMessage('שגיאת תקשורת');
            setStatus('error');
        }
    };

    const handleComplete = async () => {
        if (!orderId || !phone) return;

        setStatus('submitting');
        try {
            const res = await sendToBackend<any>('completeOrder', { orderId, phone });

            if (res.ok) {
                // If SUCCESS (paid and verified), Close Window as requested
                if ((window as any).Telegram?.WebApp) {
                    (window as any).Telegram.WebApp.close();
                } else {
                    window.close();
                    // Fallback
                    window.location.href = '/driver/portal';
                }
            } else {

                if (res.error?.includes('ממתין')) {
                    // If waiting for approval, show waiting screen instead of error
                    setStatus('confirming');
                    setErrorMessage('התשלום שלך נקלט וממתין לאישור. אנא נסה שוב בעוד דקה.');
                } else if (res.error?.includes('תשלום') || res.error?.includes('commission')) {
                    // Payment required flow
                    setStatus('payment_required');
                    // We need finance data to show payment screen
                    // Assuming res.data contains finance info in this case
                    if (res.data) setFinanceData(res.data);
                } else {
                    setErrorMessage(res.error || 'אירעה שגיאה. נסה שנית.');
                    setStatus('error');
                }
            }
        } catch (e) {
            setErrorMessage('שגיאת תקשורת: ' + (e as Error).message);
            setStatus('error');
        }
    };

    // ... (helper functions like getPaypalLink stay same) ...
    const getPaypalLink = () => {
        if (!financeData) return '#';
        const amount = Math.round(financeData.commission);
        const email = financeData.paypalEmail;
        return `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${encodeURIComponent(email)}&currency_code=ILS&amount=${amount}&item_name=Ride_Commission_${orderId}`;
    };

    const handlePaymentReport = async () => {
        setStatus('submitting');
        try {
            // Re-try completion to check status or trigger 'waiting'
            const res = await sendToBackend<any>('completeOrder', { orderId, phone });

            if (res.ok) {
                setStatus('success');
                setCompletionData(res.data);
            } else {
                // If waiting for approval, we enter WAITING state instead of error
                if (res.error?.includes('ממתין') || res.error?.includes('waiting')) {
                    setStatus('waiting_approval');
                } else {
                    setErrorMessage(res.error || 'שגיאה באימות התשלום');
                    setStatus('error');
                }
            }
        } catch (e) {
            setErrorMessage('שגיאת תקשורת');
            setStatus('error');
        }
    };

    // REALTIME: Listen for Order Updates (replaces polling)
    useEffect(() => {
        if (!orderId) return;

        let unsubscribe: (() => void) | undefined;
        let isMounted = true;

        import('../services/firebase').then(({ listenToOrder }) => {
            if (!isMounted) return;

            unsubscribe = listenToOrder(orderId, (updatedOrder) => {
                if (!updatedOrder) return;

                // Sync Status
                if (updatedOrder.status) {
                    setOrderStatus(updatedOrder.status);
                }

                // Auto-advance if payment completed
                if (status === 'waiting_approval') {
                    // Check if status changed to 'paid' or 'completed'
                    if (updatedOrder.paymentCompleted || updatedOrder.status === 'paid' || updatedOrder.status === 'completed') {
                        setStatus('success');
                        setCompletionData(updatedOrder); // Assuming order has finance data attached now
                    }
                }
            });
        });

        return () => {
            isMounted = false;
            if (unsubscribe) unsubscribe();
        };
    }, [orderId, status]);

    const handleCopyPhone = () => {
        if (financeData?.paymentPhone) {
            navigator.clipboard.writeText(financeData.paymentPhone);
            setToast({ message: 'מספר הטלפון הועתק! מומלץ להוסיף לאנשי הקשר לפני שליחת התשלום.', type: 'success' });
        }
    }



    if (status === 'submitting' || isLoadingStatus) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4" dir="rtl">
                <Loader2 className="animate-spin mb-4 text-white" size={48} />
                <p className="font-bold text-lg text-slate-300">
                    {isLoadingStatus ? 'טוען נתונים...' : 'מעדכן סטטוס נסיעה...'}
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans" dir="rtl">
            <div className="bg-slate-800 text-white p-8 rounded-[2.5rem] w-full max-w-lg shadow-2xl border border-slate-700 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500"></div>

                {status === 'confirming' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">

                        {/* START RIDE BUTTON - Show if Confirmed or Pending */}
                        {(orderStatus === 'confirmed' || orderStatus === 'pending') && (
                            <div className="mb-8 p-6 bg-blue-50 rounded-[2rem] border border-blue-100">
                                <h2 className="text-2xl font-black text-slate-900 mb-2">יצאת לדרך?</h2>
                                <p className="text-gray-500 mb-6 font-medium">עדכן יציאה כדי למנוע ביטול נסיעה</p>
                                <button
                                    onClick={handleStartRide}
                                    className="w-full h-20 bg-amber-500 text-slate-900 rounded-2xl font-bold text-xl shadow-xl hover:bg-amber-400 transition flex items-center justify-center gap-3"
                                >
                                    <MapPin />
                                    התחל נסיעה
                                </button>
                            </div>
                        )}

                        {/* COMPLETE RIDE SECTION - Only visible when ON_ROUTE */}
                        {orderStatus === 'on_route' && (
                            <div className="mb-8 animate-in slide-in-from-bottom duration-500">
                                <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <CheckCircle className="w-10 h-10 text-yellow-600" />
                                </div>
                                <h2 className="text-3xl font-black text-slate-900 mb-2">סיום נסיעה</h2>
                                <p className="text-gray-500 mb-8 font-medium">האם הגעת ליעד וברצונך לסגור את הזמנה <strong>#{orderId}</strong>?</p>

                                <button
                                    onClick={handleComplete}
                                    className="w-full h-20 bg-amber-500 text-slate-900 rounded-2xl font-bold text-xl shadow-xl hover:bg-amber-400 transition transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
                                >
                                    <ShieldCheck />
                                    כן, סיימתי את הנסיעה
                                </button>
                            </div>
                        )}

                        <button
                            onClick={() => navigate('/driver/portal')}
                            className="w-full mt-4 py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold hover:bg-gray-200 transition"
                        >
                            ביטול וחזרה
                        </button>
                    </div>
                )}

                {/* ... Rest of existing render (payment_required, success, error) ... */}
                {status === 'payment_required' && (
                    <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="text-green-600" size={32} />
                            </div>
                            <h2 className="text-2xl font-black text-slate-900">הנסיעה שוריינה בהצלחה!</h2>
                            <p className="text-slate-500">נא להסדיר עמלה כדי לקבל אישור יציאה לדרך.</p>
                        </div>

                        {/* Finance Summary Card */}
                        <FinanceSummary financeData={financeData} />

                        {/* Payment Methods */}
                        <PaymentMethodSelector paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} />

                        {/* Bit/Paybox Instructions Block */}
                        {paymentMethod === 'bit' && (
                            <BitInstructions
                                financeData={financeData}
                                isSubmitting={isSubmitting}
                                onCopyPhone={handleCopyPhone}
                                onSubmit={handlePaymentReport}
                            />
                        )}

                        {/* Paypal Block */}
                        {paymentMethod === 'paypal' && (
                            <div className="mt-6 p-6 bg-blue-50 rounded-3xl border border-blue-100 animate-in slide-in-from-top-4">
                                <p className="text-sm text-blue-800 font-bold mb-4 text-center">מעבר לסליקה מאובטחת של PayPal</p>
                                <a
                                    href={getPaypalLink()}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-blue-200 hover:bg-blue-700 transition"
                                >
                                    <ExternalLink size={18} />
                                    שלם ₪{Math.round(financeData?.commission || 0)} כעת
                                </a>
                            </div>
                        )}

                        <div className="mt-8">
                            {/* Debt Flow Button - Controlled by Settings */}
                            {systemSettings?.ENABLE_DEBT_FLOW ? (
                                <button
                                    onClick={() => setStatus('success')}
                                    className="w-full py-4 text-slate-400 font-bold hover:text-slate-600 transition text-sm underline"
                                >
                                    המשך ללא תשלום כעת (העמלה תירשם בחוב)
                                </button>
                            ) : (
                                <div className="text-center p-4 bg-gray-50 rounded-xl border border-gray-100 mt-4">
                                    <p className="text-xs text-gray-500 flex items-center justify-center gap-2">
                                        <ShieldCheck size={12} />
                                        חובה להסדיר תשלום כדי לסיים את הנסיעה
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {status === 'waiting_approval' && (
                    <div className="text-center animate-in zoom-in duration-300">
                        <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-amber-500/20">
                            <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
                        </div>
                        <h2 className="text-2xl font-black text-white mb-2">ממתין לאישור מנהל...</h2>
                        <p className="text-slate-400 mb-6 font-medium">
                            התשלום דווח והוא בבדיקה מול המוקד. <br />
                            אנא המתן, האישור מתקבל בדרך כלל תוך דקה.
                        </p>
                        <div className="p-4 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl text-sm font-bold animate-pulse">
                            ממתין לעדכון בזמן אמת...
                        </div>
                    </div>
                )}

                {status === 'success' && (
                    <InvoiceCard
                        orderId={orderId}
                        paymentMethod={paymentMethod}
                        financeData={financeData}
                        onClose={() => {
                            if ((window as any).Telegram?.WebApp) {
                                (window as any).Telegram.WebApp.close();
                            } else {
                                window.close();
                            }
                        }}
                    />
                )}

                {status === 'error' && (
                    <div className="text-center animate-in shake duration-300">
                        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <XCircle className="w-10 h-10 text-red-600" />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mb-2">
                            {(errorMessage.includes('תשלום') || errorMessage.includes('עמלת')) ? 'דרוש תשלום' : 'שגיאה'}
                        </h2>
                        <p className="text-gray-500 mb-8 font-medium">{errorMessage}</p>

                        {(errorMessage.includes('תשלום') || errorMessage.includes('עמלת')) && (
                            <button
                                onClick={() => navigate(`/payment?orderId=${orderId}&phone=${phone}`)}
                                className="w-full h-20 bg-yellow-400 text-slate-900 rounded-2xl font-bold text-xl hover:bg-yellow-500 transition shadow-lg shadow-yellow-200 flex items-center justify-center gap-2 mb-4"
                            >
                                <DollarSign size={20} />
                                מעבר לתשלום עמלה
                            </button>
                        )}

                        <button
                            onClick={() => {
                                if ((window as any).Telegram?.WebApp) {
                                    (window as any).Telegram.WebApp.close();
                                } else {
                                    window.close();
                                }
                            }}
                            className="w-full py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition"
                        >
                            סגור חלון
                        </button>
                    </div>
                )}


            </div>

            {/* Toast Notification */}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div >
    );
};
