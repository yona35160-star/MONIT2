import React from 'react';
import { CheckCircle, Sparkles, ShieldCheck, Smartphone, Info } from 'lucide-react';

interface InvoiceCardProps {
    orderId: string | null;
    paymentMethod: 'bit' | 'paybox' | 'paypal' | null;
    financeData: any;
    onClose: () => void;
}

export const InvoiceCard: React.FC<InvoiceCardProps> = ({ orderId, paymentMethod, financeData, onClose }) => {
    return (
        <div className="animate-in zoom-in duration-500 max-w-md mx-auto">
            <div className="text-center mb-6">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-200 relative">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                    <Sparkles className="absolute -top-2 -right-2 text-yellow-400 w-6 h-6 animate-pulse" />
                </div>
                <h2 className="text-3xl font-black text-slate-900 mb-1">תשלום התקבל!</h2>
                <p className="text-slate-500 font-medium">הנסיעה נסגרה והועברה לארכיון</p>
            </div>

            {/* Invoice Card */}
            <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-slate-100 relative">
                {/* Receipt Header */}
                <div className="bg-slate-900 text-white p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -mr-16 -mt-16 pointer-events-none"></div>
                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <ShieldCheck size={16} className="text-green-400" />
                                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">קבלה דיגיטלית</span>
                            </div>
                            <h3 className="text-2xl font-black">הזמנה #{orderId}</h3>
                        </div>
                        <div className="text-left">
                            <div className="text-xs text-slate-400 font-bold mb-1">תאריך</div>
                            <div className="font-mono text-lg">{new Date().toLocaleDateString('he-IL')}</div>
                        </div>
                    </div>
                </div>

                {/* Receipt Body */}
                <div className="p-6">
                    {/* Route Summary */}
                    <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center shrink-0">
                            <Smartphone className="text-slate-400" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 font-bold">אמצעי תשלום</p>
                            <p className="text-lg font-black text-slate-900">
                                {paymentMethod === 'bit' ? 'Bit / Paybox' : paymentMethod === 'paypal' ? 'PayPal' : 'תשלום דיגיטלי'}
                            </p>
                        </div>
                    </div>

                    {/* Financial Breakdown */}
                    <div className="space-y-3 mb-6">
                        <div className="flex justify-between items-center text-slate-500">
                            <span className="font-medium">מחיר נסיעה ברוטו</span>
                            <span className="font-bold">₪{financeData?.fullPrice || '0'}</span>
                        </div>
                        <div className="flex justify-between items-center text-red-500 bg-red-50 p-2 rounded-lg">
                            <span className="font-bold flex items-center gap-1"><Info size={14} /> עמלת תחנה (שולם)</span>
                            <span className="font-bold">- ₪{Math.round(financeData?.commission || 0)}</span>
                        </div>
                        <div className="h-px bg-slate-200 my-2"></div>
                        <div className="flex justify-between items-center text-slate-900 text-xl">
                            <span className="font-black">רווח נהג נקי</span>
                            <span className="font-black text-green-600">₪{Math.round(financeData?.driverProfit || 0)}</span>
                        </div>
                    </div>

                    {/* Footer Note */}
                    <div className="bg-slate-50 p-4 rounded-xl text-center">
                        <p className="text-xs text-slate-400 leading-relaxed">
                            מסמך זה מהווה אסמכתא שגרתית לתשלום עמלת תחנה. <br />
                            הנסיעה נרשמה במערכת {new Date().getFullYear()}.
                        </p>
                    </div>
                </div>
            </div>

            <div className="mt-8 text-center">
                <button
                    onClick={onClose}
                    className="text-slate-400 text-sm font-bold hover:text-slate-600 transition"
                >
                    סגור חלון
                </button>
            </div>
        </div>
    );
};
