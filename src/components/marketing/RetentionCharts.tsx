import React from 'react';
import { MessageSquare, Calendar, Star, Users, Lightbulb } from 'lucide-react';

interface RetentionData {
    messagesSent: {
        end_ride: number;
        airport_7d: number;
        vip_3rd_ride: number;
    };
    whatsappOrders: number;
}

interface RetentionChartsProps {
    retention: RetentionData;
    insights: string[];
}

export const RetentionCharts: React.FC<RetentionChartsProps> = ({ retention, insights }) => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Retention Stats */}
            <div className="lg:col-span-2 bg-white p-5 rounded-xl shadow border border-slate-100">
                <h3 className="font-bold mb-4 flex items-center gap-2 text-slate-800">
                    <MessageSquare className="text-green-500" size={20} /> שימור לקוחות בוואטסאפ
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 relative overflow-hidden group">
                        <span className="block text-sm text-blue-600 font-bold mb-1 relative z-10">הודעות "סיום נסיעה"</span>
                        <span className="text-3xl font-black text-blue-900 relative z-10">{retention.messagesSent.end_ride}</span>
                        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4 group-hover:scale-110 transition">
                            <MessageSquare size={80} />
                        </div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 relative overflow-hidden group">
                        <span className="block text-sm text-purple-600 font-bold mb-1 relative z-10">תזכורות נתב"ג (7 ימים)</span>
                        <span className="text-3xl font-black text-purple-900 relative z-10">{retention.messagesSent.airport_7d}</span>
                        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4 group-hover:scale-110 transition">
                            <Calendar size={80} />
                        </div>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 relative overflow-hidden group">
                        <span className="block text-sm text-amber-600 font-bold mb-1 relative z-10">שדרוג ל-VIP</span>
                        <span className="text-3xl font-black text-amber-900 relative z-10">{retention.messagesSent.vip_3rd_ride}</span>
                        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4 group-hover:scale-110 transition">
                            <Star size={80} />
                        </div>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 relative overflow-hidden group">
                        <span className="block text-sm text-emerald-600 font-bold mb-1 relative z-10">הזמנות מבוט</span>
                        <span className="text-3xl font-black text-emerald-900 relative z-10">{retention.whatsappOrders}</span>
                        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4 group-hover:scale-110 transition">
                            <Users size={80} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Insights Panel */}
            <div className="bg-gradient-to-br from-primary-50 to-white p-5 rounded-xl shadow border border-primary-100">
                <h3 className="font-bold mb-4 flex items-center text-primary-800 gap-2">
                    <Lightbulb className="text-yellow-500 fill-yellow-500" size={20} /> תובנות חכמות
                </h3>
                <ul className="space-y-3">
                    {insights.map((insight, idx) => (
                        <li key={idx} className="text-sm bg-white/80 p-3 rounded-lg shadow-sm border border-primary-50 leading-relaxed text-slate-700">
                            {insight}
                        </li>
                    ))}
                    {insights.length === 0 && <li className="text-sm text-gray-500 italic">אין תובנות חדשות כרגע. המערכת לומדת...</li>}
                </ul>
            </div>
        </div>
    );
};
