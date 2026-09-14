import React from 'react';
import { Zap, DollarSign, ShieldCheck } from 'lucide-react';

interface SystemHealthProps {
    currentView: { revenue: number; orders: number; commission: number; chartData: any[] };
    bridgeStatus?: { online: boolean; last_heartbeat?: string };
}

export const SystemHealth: React.FC<SystemHealthProps> = ({ currentView, bridgeStatus }) => {
    const isExplicitOffline = bridgeStatus && bridgeStatus.online === false;
    const isOnline = bridgeStatus && bridgeStatus.online === true;

    return (
        <div className="bg-[#1E293B] p-10 rounded-[2.5rem] shadow-2xl border border-white/5 text-white flex flex-col justify-between h-full relative overflow-hidden group">
            {/* Background Glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary-500/10 blur-[80px] group-hover:bg-primary-500/20 transition-all duration-700"></div>

            <div className="relative z-10">
                <h3 className="text-2xl font-black mb-1 tracking-tight">ביצועי מערכת</h3>
                <p className="text-slate-500 text-sm mb-10 font-medium">נתוני אופטימיזציה בזמן אמת</p>

                <div className="space-y-6">
                    <div className="flex justify-between items-center bg-[#0F172A]/50 backdrop-blur-md p-6 rounded-[1.5rem] border border-white/5 transition-all hover:border-white/10">
                        <div>
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">ממוצע הזמנות / יום</p>
                            <p className="text-3xl font-black text-white">
                                {currentView.chartData.length > 0
                                    ? (currentView.chartData.reduce((a, b: any) => a + b.count, 0) / currentView.chartData.length).toFixed(1)
                                    : '0.0'}
                            </p>
                        </div>
                        <div className="p-4 bg-primary-500/10 text-primary-400 rounded-2xl"><Zap size={24} className="fill-primary-400/20" /></div>
                    </div>

                    <div className="flex justify-between items-center bg-[#0F172A]/50 backdrop-blur-md p-6 rounded-[1.5rem] border border-white/5 transition-all hover:border-white/10">
                        <div>
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">הכנסה נטו לצי</p>
                            <p className="text-3xl font-black text-emerald-400">
                                {((currentView.revenue || 0) - (currentView.commission || 0)).toLocaleString()} ₪
                            </p>
                        </div>
                        <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-2xl"><DollarSign size={24} /></div>
                    </div>

                    <div className="bg-gradient-to-br from-primary-600 to-primary-800 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden group/card items-center flex justify-between">
                        <div className="relative z-10 w-full">
                            <p className="text-primary-200 text-[10px] font-black uppercase tracking-[0.2em] mb-2">רווח תחנה צפוי</p>
                            <h4 className="text-4xl font-black text-white mb-4">{(currentView.commission || 0).toLocaleString()} ₪</h4>
                            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                                <div
                                    className="bg-white h-full transition-all duration-1000 shadow-[0_0_10px_#fff]"
                                    style={{ width: `${Math.min(100, (currentView.commission / (currentView.revenue || 1)) * 100 * 5)}%` }}
                                ></div>
                            </div>
                        </div>
                        <ShieldCheck className="absolute -bottom-4 -right-4 text-white/5 group-hover/card:scale-110 group-hover/card:rotate-6 transition-all duration-700" size={120} />
                    </div>
                </div>
            </div>

            <div className="mt-12 pt-8 border-t border-white/5 relative z-10">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-[10px] text-slate-500 font-black mb-2 uppercase tracking-widest">סטטוס תשתית ענן</p>
                        <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${
                                isExplicitOffline
                                    ? 'bg-red-500 shadow-[0_0_10px_#ef4444]'
                                    : isOnline
                                        ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]'
                                        : 'bg-amber-400 shadow-[0_0_10px_#fbbf24]'
                            } animate-pulse`}></div>
                            <span className="text-sm font-black text-white uppercase tracking-tight">
                                {isExplicitOffline
                                    ? 'תקלת סנכרון פעילה'
                                    : isOnline
                                        ? 'מחובר ואופרטיבי'
                                        : 'סטטוס לא מדווח (ללא ניטור)'}
                            </span>
                        </div>
                    </div>
                    {bridgeStatus?.last_heartbeat && (
                        <div className="text-[10px] font-bold text-slate-600 bg-slate-900/50 px-3 py-2 rounded-xl border border-white/5">
                            Last DB Sync: {new Date(bridgeStatus.last_heartbeat).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
