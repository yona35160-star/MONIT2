import React from 'react';
import { RefreshCw, Plus, Clipboard as ClipboardIcon } from 'lucide-react';
import { ServerStatusWidget } from './ServerStatusWidget';
import { SystemStatusIndicator } from './SystemStatusIndicator';

interface DashboardHeaderProps {
    statsPeriod: 'today' | 'weekly' | 'monthly';
    setStatsPeriod: (period: 'today' | 'weekly' | 'monthly') => void;
    settings: any;
    handleDailyReport: () => void;
    handleRefresh: () => void;
    isLoading: boolean;
    setIsCreateOrderModalOpen: (open: boolean) => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
    statsPeriod,
    setStatsPeriod,
    settings,
    handleDailyReport,
    handleRefresh,
    isLoading,
    setIsCreateOrderModalOpen
}) => {
    return (
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-primary-600 rounded-[1.5rem] flex items-center justify-center text-white font-black text-3xl shadow-2xl shadow-primary-500/20 rotate-3">TX</div>
                <div>
                    <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter">ניהול תחנה</h1>
                    <p className="text-slate-500 text-sm md:text-lg font-medium leading-none mt-1">לוח בקרה אופרטיבי • {new Date().toLocaleDateString('he-IL')}</p>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="flex gap-1.5 bg-[#0F172A] rounded-2xl p-1.5 border border-white/5 mr-4 shadow-inner">
                    {(['today', 'weekly', 'monthly'] as const).map(p => (
                        <button
                            key={p}
                            onClick={() => setStatsPeriod(p)}
                            className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${statsPeriod === p
                                ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20'
                                : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            {p === 'today' ? 'היום' : p === 'weekly' ? 'שבועי' : 'חודשי'}
                        </button>
                    ))}
                </div>

                <SystemStatusIndicator />
                <div className="hidden md:block"><ServerStatusWidget serverSpot={settings.serverSpot || settings['SERVER_SPOT']} /></div>
                <div className="md:hidden"><ServerStatusWidget serverSpot={settings.serverSpot || settings['SERVER_SPOT']} compact={true} /></div>

                <div className="flex-grow md:flex-grow-0"></div>

                <button onClick={handleDailyReport} className="p-3 bg-[#1E293B] rounded-full shadow-sm border border-[#334155] text-primary-400 hover:bg-[#334155] transition" title="דוח יומי">
                    <ClipboardIcon size={20} />
                </button>

                <button
                    onClick={handleRefresh}
                    disabled={isLoading}
                    className="p-4 bg-[#1E293B] hover:bg-slate-800 text-slate-400 hover:text-primary-400 rounded-[1.25rem] transition-all border border-white/5 shadow-2xl disabled:opacity-50 group"
                    title="רענון נתונים"
                >
                    <RefreshCw size={22} className={isLoading ? 'animate-spin' : 'group-active:rotate-180 transition-transform duration-500'} />
                </button>

                <button onClick={() => setIsCreateOrderModalOpen(true)} className="px-8 py-4 bg-primary-600 text-white rounded-[1.25rem] font-black flex items-center gap-3 hover:bg-primary-500 transition-all shadow-2xl shadow-primary-500/30 active:scale-95 text-lg">
                    <Plus size={24} /> <span>הזמנה חדשה</span>
                </button>
            </div>
        </header>
    );
};
