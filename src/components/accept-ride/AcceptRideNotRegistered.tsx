import React from 'react';
import { User, Zap } from 'lucide-react';

interface AcceptRideNotRegisteredProps {
    goToRegistration: () => void;
}

export const AcceptRideNotRegistered: React.FC<AcceptRideNotRegisteredProps> = ({ goToRegistration }) => {
    return (
        <div className="text-center animate-in slide-in-from-bottom duration-300">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6">
                <User className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">אינך רשום במערכת</h2>
            <p className="text-gray-500 text-sm sm:text-base mb-5 sm:mb-8">
                כדי לקבל את הנסיעה, עליך לבצע רישום קצר וחד-פעמי.
            </p>
            <button onClick={goToRegistration} className="w-full h-12 sm:h-14 bg-yellow-400 text-slate-900 rounded-xl font-bold hover:bg-yellow-500 transition shadow-lg shadow-yellow-200 flex items-center justify-center gap-2">
                <Zap size={18} />
                הרשמה מהירה
            </button>
        </div>
    );
};
