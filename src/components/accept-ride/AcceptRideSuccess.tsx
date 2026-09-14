import React from 'react';
import { CheckCircle, Zap, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AcceptRideSuccessProps {
    orderId: string | null;
    confirmedPhone: string;
    tgUser: any;
    phoneNumber: string;
    handleClose: () => void;
}

export const AcceptRideSuccess: React.FC<AcceptRideSuccessProps> = ({
    orderId,
    confirmedPhone,
    tgUser,
    phoneNumber,
    handleClose
}) => {
    const navigate = useNavigate();

    return (
        <div className="text-center animate-in zoom-in duration-300">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6 ring-4 ring-emerald-500/10">
                <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-500" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2">הנסיעה שלך!</h2>
            <p className="text-gray-500 text-sm sm:text-base mb-5 sm:mb-6">
                הנסיעה שוריינה עבורך! כדי לקבל את פרטי הלקוח המלאים והכתובת המדויקת, יש להסדיר את עמלת התחנה.
            </p>

            <div className="bg-orange-50 border border-orange-100 p-3 sm:p-4 rounded-xl mb-5 sm:mb-6 animate-pulse">
                <p className="text-orange-800 font-bold text-xs sm:text-sm flex items-center justify-center gap-2">
                    <Zap size={16} />
                    שימו לב: חובה להסדיר תשלום תוך 5 דקות!
                </p>
            </div>

            <button
                onClick={() => {
                    const targetPhone = confirmedPhone || phoneNumber || (tgUser?.phone_number) || '';
                    if (targetPhone) {
                        localStorage.setItem('driver_phone', targetPhone);
                    }
                    navigate(`/ride/${orderId}?phone=${targetPhone}`);
                }}
                className="w-full mb-3 h-14 sm:h-20 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 rounded-2xl font-bold text-base sm:text-xl shadow-lg shadow-amber-400/25 hover:from-amber-300 hover:to-amber-400 transition flex items-center justify-center gap-3"
            >
                <DollarSign size={22} />
                תשלום עמלה (לחץ כאן)
            </button>

            <button
                onClick={handleClose}
                className="w-full h-12 sm:h-16 bg-blue-600 text-white rounded-2xl font-bold text-base sm:text-lg hover:bg-blue-700 transition shadow-lg shadow-blue-500/20"
            >
                סגור חלונית
            </button>
        </div>
    );
};
