import React from 'react';
import { Lock, AlertTriangle } from 'lucide-react';

interface AcceptRideErrorProps {
    status: 'taken' | 'error';
    errorMessage: string;
    takenDetails: { by: string };
    handleClose: () => void;
}

export const AcceptRideError: React.FC<AcceptRideErrorProps> = ({
    status,
    errorMessage,
    takenDetails,
    handleClose
}) => {
    return (
        <div className="text-center animate-in shake duration-300">
            <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6 ring-4 ${status === 'taken' ? 'bg-orange-500/20 ring-orange-500/10' : 'bg-red-500/20 ring-red-500/10'}`}>
                {status === 'taken' ? <Lock className="w-10 h-10 sm:w-12 sm:h-12 text-orange-500" /> : <AlertTriangle className="w-10 h-10 sm:w-12 sm:h-12 text-red-500" />}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">
                {status === 'taken' ? 'הנסיעה נתפסה' : 'שגיאה'}
            </h2>
            <p className="text-gray-500 text-sm sm:text-base mb-5 sm:mb-8">
                {status === 'taken'
                    ? `ההזמנה נלקחה על ידי הנהג: ${takenDetails.by}`
                    : errorMessage}
            </p>

            <div className="bg-red-50 text-red-600 p-3 sm:p-4 rounded-xl font-bold mb-4 flex items-center gap-2 text-xs sm:text-sm">
                <AlertTriangle size={18} />
                {status === 'taken' ? 'נסיעה זו כבר אינה זמינה' : 'אירעה שגיאה בטעינת הנסיעה'}
            </div>

            <button
                onClick={handleClose}
                className="w-full h-14 sm:h-20 bg-slate-900 text-white rounded-2xl font-bold text-base sm:text-xl hover:bg-slate-800 transition mb-3 flex items-center justify-center"
            >
                סגור חלון
            </button>

            <button
                onClick={handleClose}
                className="w-full py-3 sm:py-4 text-slate-500 font-bold hover:text-slate-800 transition text-sm underline"
            >
                חזרה לדף הבית
            </button>
        </div>
    );
};
