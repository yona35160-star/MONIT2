import React from 'react';
import { Smartphone, CreditCard, CheckCircle } from 'lucide-react';

interface PaymentMethodSelectorProps {
    paymentMethod: 'bit' | 'paybox' | 'paypal' | null;
    setPaymentMethod: (method: 'bit' | 'paybox' | 'paypal') => void;
}

export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({ paymentMethod, setPaymentMethod }) => {
    return (
        <div className="space-y-4">
            <p className="text-sm font-bold text-slate-700 mr-2">בחר אמצעי תשלום:</p>

            <div className="grid grid-cols-1 gap-3">
                <button
                    onClick={() => setPaymentMethod('bit')}
                    className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${paymentMethod === 'bit' ? 'border-yellow-400 bg-yellow-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center text-yellow-600"><Smartphone size={20} /></div>
                        <div className="text-right">
                            <p className="font-extrabold text-slate-900">Bit / Paybox</p>
                            <p className="text-[10px] text-slate-500">תשלום מהיר בנייד</p>
                        </div>
                    </div>
                    {paymentMethod === 'bit' && <CheckCircle size={20} className="text-yellow-600" />}
                </button>

                <button
                    onClick={() => setPaymentMethod('paypal')}
                    className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${paymentMethod === 'paypal' ? 'border-blue-400 bg-blue-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600"><CreditCard size={20} /></div>
                        <div className="text-right">
                            <p className="font-extrabold text-slate-900">פאיפל / כרטיס אשראי</p>
                            <p className="text-[10px] text-slate-500">סליקה מאובטחת</p>
                        </div>
                    </div>
                    {paymentMethod === 'paypal' && <CheckCircle size={20} className="text-blue-600" />}
                </button>
            </div>
        </div>
    );
};
