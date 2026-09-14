import React, { useState } from 'react';
import { Info, Copy, Smartphone, XCircle, Loader2, Check } from 'lucide-react';

interface BitInstructionsProps {
    financeData: any;
    isSubmitting: boolean;
    onCopyPhone: () => void;
    onSubmit: () => void;
}

export const BitInstructions: React.FC<BitInstructionsProps> = ({ financeData, isSubmitting, onCopyPhone, onSubmit }) => {

    const handleOpenApp = (app: 'bit' | 'paybox') => {
        const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
        const isAndroid = /android/i.test(userAgent);
        const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;

        const config = {
            bit: {
                scheme: 'bit://',
                androidPkg: 'com.bnhp.bit',
                iosId: '1135050012',
                web: 'https://www.bitpay.co.il',
                storeWebAndroid: 'https://play.google.com/store/apps/details?id=com.bnhp.payments.paymentsapp&hl=en',
                storeWebIOS: 'https://apps.apple.com/il/app/bit-%D7%91%D7%99%D7%98/id1182007739'
            },
            paybox: {
                scheme: 'payboxapp://',
                androidPkg: 'com.payboxapp',
                iosId: '925640366',
                web: 'https://www.payboxapp.com/',
                storeWebAndroid: 'https://play.google.com/store/apps/details?id=com.payboxapp',
                storeWebIOS: 'https://apps.apple.com/il/app/paybox-%D7%AA%D7%A9%D7%9C%D7%95%D7%9E%D7%99%D7%9D-%D7%95%D7%94%D7%A2%D7%91%D7%A8%D7%AA-%D7%9B%D7%A1%D7%A3/id895491053'
            }
        }[app];

        if (isAndroid || isIOS) {
            const now = Date.now();
            const storeLink = isAndroid ? config.storeWebAndroid : config.storeWebIOS;

            setTimeout(() => {
                if (Date.now() - now < 2500) {
                    window.location.href = storeLink;
                }
            }, 1000);

            window.location.href = config.scheme;
        } else {
            window.open(config.web, '_blank');
        }
    };

    return (
        <div className="mt-6 p-6 bg-slate-50 rounded-3xl border border-slate-200 animate-in slide-in-from-top-4">
            <div className="flex items-center gap-2 text-slate-800 font-bold mb-3">
                <Info size={18} className="text-slate-400" />
                <span>הוראות תשלום:</span>
            </div>
            <p className="text-sm text-slate-600 mb-4">יש להעביר <strong>₪{Math.round(financeData?.commission || 0)}</strong> למספר הבא:</p>

            <div className="flex items-center gap-3 mb-6 relative">
                <input
                    readOnly
                    value={financeData?.paymentPhone || ''}
                    className="w-full text-xl sm:text-2xl font-black text-slate-900 tracking-widest text-center bg-white py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none tabular-nums"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">לחץ להעתקה</div>
                <button onClick={onCopyPhone} className="p-4 bg-slate-900 text-white rounded-xl shadow-md hover:bg-slate-800 transition shrink-0"><Copy size={20} /></button>
            </div>

            {/* Smart App Buttons */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                    onClick={() => handleOpenApp('bit')}
                    className="py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition flex items-center justify-center gap-2"
                >
                    <Smartphone size={18} />
                    פתח Bit
                </button>
                <button
                    onClick={() => handleOpenApp('paybox')}
                    className="py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition flex items-center justify-center gap-2"
                >
                    <Smartphone size={18} />
                    פתח Paybox
                </button>
            </div>

            <div className="text-center mb-4">
                <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); window.open('https://www.bitpay.co.il', '_blank'); }}
                    className="text-xs text-blue-500 underline"
                >
                    האפליקציה לא נפתחת? לחץ כאן
                </a>
            </div>

            <div className="p-3 bg-red-50 text-red-700 text-[10px] rounded-lg font-bold flex gap-2 mb-4">
                <XCircle size={14} className="shrink-0" />
                <span>שימו לב: חובה להוסיף את המספר לאנשי הקשר לפני השליחה כדי שהתשלום יעבור בהצלחה.</span>
            </div>

            <button
                onClick={onSubmit}
                disabled={isSubmitting}
                className={`w-full py-4 rounded-2xl font-black text-lg transition shadow-lg flex items-center justify-center gap-2
                    ${isSubmitting ? 'bg-slate-300 text-slate-500' : 'bg-slate-900 text-white hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98]'}`}
            >
                {isSubmitting ? (
                    <>
                        <Loader2 className="animate-spin" />
                        מעדכן...
                    </>
                ) : (
                    <>
                        <Check size={24} />
                        ביצעתי העברה - סגור חלון
                    </>
                )}
            </button>
        </div>
    );
};
