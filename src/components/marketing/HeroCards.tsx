import React from 'react';
import { Phone, CheckCircle, DollarSign, UserCheck } from 'lucide-react';

interface HeroMetrics {
    calls: { value: number };
    conversion: { value: number };
    cpc: { value: number };
    returning: { value: number; vipCount: number };
}

interface HeroCardsProps {
    metrics: HeroMetrics;
}

export const HeroCards: React.FC<HeroCardsProps> = ({ metrics }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded shadow hover:shadow-md transition">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                        <Phone size={20} />
                    </div>
                    <h3 className="text-gray-500 text-sm font-bold">שיחות</h3>
                </div>
                <p className="text-2xl font-bold text-slate-800">{metrics.calls.value}</p>
            </div>

            <div className="bg-white p-4 rounded shadow hover:shadow-md transition">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                        <CheckCircle size={20} />
                    </div>
                    <h3 className="text-gray-500 text-sm font-bold">שיעור המרה</h3>
                </div>
                <p className={`text-2xl font-bold ${metrics.conversion.value >= 60 ? 'text-green-600' : 'text-red-600'}`}>
                    {metrics.conversion.value}%
                </p>
            </div>

            <div className="bg-white p-4 rounded shadow hover:shadow-md transition">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600">
                        <DollarSign size={20} />
                    </div>
                    <h3 className="text-gray-500 text-sm font-bold">עלות לשיחה (CPC)</h3>
                </div>
                <p className={`text-2xl font-bold ${metrics.cpc.value <= 15 ? 'text-green-600' : 'text-red-600'}`}>
                    ₪{metrics.cpc.value}
                </p>
            </div>

            <div className="bg-white p-4 rounded shadow hover:shadow-md transition">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600">
                        <UserCheck size={20} />
                    </div>
                    <h3 className="text-gray-500 text-sm font-bold">לקוחות חוזרים</h3>
                </div>
                <p className="text-2xl font-bold text-slate-800">{metrics.returning.value}%</p>
                <p className="text-xs text-slate-400 font-medium bg-slate-100 inline-block px-2 py-0.5 rounded-full mt-1">
                    VIP: {metrics.returning.vipCount}
                </p>
            </div>
        </div>
    );
};
