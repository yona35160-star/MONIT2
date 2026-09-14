import React from 'react';
import { Loader2, ShieldCheck, Phone, Car, Ban, Unlock, RefreshCw, HandCoins } from 'lucide-react';
import { Driver } from '../types';
import { TableSkeleton, CardSkeleton } from './Skeleton';
import { updateDriverStatus, clearDriverDebt } from '../api/adminApi';

interface DriversTableProps {
    drivers: Driver[];
    onDownloadReport: (driverId: string) => void;
    isGeneratingReport: string | null;
    isLoading?: boolean;
    onRefresh?: () => void;
}

export const DriversTable: React.FC<DriversTableProps> = ({ drivers, onDownloadReport, isGeneratingReport, isLoading = false, onRefresh }) => {
    const [actionLoading, setActionLoading] = React.useState<string | null>(null);

    const handleToggleBlock = async (d: Driver) => {
        if (!confirm(`האם אתה בטוח שברצונך ${d.status === 'blocked' ? 'לשחרר' : 'לחסום'} את הנהג ${d.driverName}?`)) return;
        setActionLoading(d.driverId + '-status');
        const res = await updateDriverStatus(d.driverId, d.status === 'blocked' ? 'active' : 'blocked');
        if (res.ok) {
            if (onRefresh) onRefresh();
        } else alert("שגיאה בעדכון הסטטוס: " + res.error);
        setActionLoading(null);
    };

    const handleClearDebt = async (d: Driver) => {
        if (!confirm(`האם לאפס את חוב העמלות של ${d.driverName}?`)) return;
        setActionLoading(d.driverId + '-debt');
        const res = await clearDriverDebt(d.driverId);
        if (res.ok) {
            if (onRefresh) onRefresh();
            alert('החוב אופס בהצלחה!');
        } else alert("שגיאה באיפוס: " + res.error);
        setActionLoading(null);
    };
    if (isLoading) {
        return (
            <>
                <div className="hidden lg:block table-container p-4">
                    <TableSkeleton rows={5} cols={6} />
                </div>
                <div className="lg:hidden">
                    <CardSkeleton count={3} />
                </div>
            </>
        );
    }

    if (drivers.length === 0) {
        return (
            <div className="card p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Car className="text-slate-400" size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">אין נהגים פעילים</h3>
                <p className="text-slate-500 text-sm">הוסף נהגים חדשים כדי להתחיל</p>
            </div>
        );
    }

    return (
        <>
            <div className="hidden lg:block overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right border-collapse">
                        <thead>
                            <tr className="bg-[#1E293B] border-b border-white/5">
                                <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">שם הנהג</th>
                                <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">טלפון</th>
                                <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">סטטוס</th>
                                <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">היום</th>
                                <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">סה"כ</th>
                                <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">הכנסה נטו</th>
                                <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">חוב למערכת</th>
                                <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">מסמכים</th>
                                <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">פעולות</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {drivers.map(d => (
                                <tr key={d.driverId} className="transition-all hover:bg-white/[0.02]">
                                    <td className="px-6 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-[1.25rem] bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-400 font-black text-xl shadow-xl">
                                                {d.driverName?.[0]}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-black text-white text-base">{d.driverName}</span>
                                                <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{d.carType || 'מונית'}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6 font-mono text-slate-400 font-bold" dir="ltr">{d.phone}</td>
                                    <td className="px-6 py-6">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${d.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500 border border-white/5'}`}>
                                            {d.status === 'active' ? 'ONLINE' : 'OFFLINE'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-6 text-slate-300 font-black text-lg">{d.todayRides || 0}</td>
                                    <td className="px-6 py-6 text-slate-300 font-black text-lg">{d.totalRides || 0}</td>
                                    <td className="px-6 py-6 font-black text-emerald-400 text-xl">₪{(d.totalRevenue || 0).toLocaleString()}</td>
                                    {/* Simulated Debt: 15% of total revenue if undefined */}
                                    <td className="px-6 py-6 font-black text-rose-400 text-xl">₪{d.debt !== undefined ? d.debt.toLocaleString() : Math.round((d.totalRevenue || 0) * 0.15).toLocaleString()}</td>
                                    <td className="px-6 py-6">
                                        <div className="flex items-center gap-2">
                                            {[
                                                { label: 'ביטוח', expiry: d.insuranceExpiry },
                                                { label: 'רישיון', expiry: d.licenseExpiry },
                                                { label: 'רכב', expiry: d.carDocExpiry }
                                            ].map((doc, idx) => {
                                                const status = (() => {
                                                    if (!doc.expiry) return 'bg-slate-800 text-slate-600';
                                                    const days = Math.ceil((new Date(doc.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                                                    if (days <= 0) return 'bg-red-500/20 text-red-500 border border-red-500/30';
                                                    if (days <= 30) return 'bg-amber-500/20 text-amber-500 border border-amber-500/30';
                                                    return 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30';
                                                })();
                                                return (
                                                    <div key={idx} className={`px-2 py-0.5 rounded text-[9px] font-bold ${status}`} title={`${doc.label}: ${doc.expiry || 'חסר'}`}>
                                                        {doc.label}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => handleToggleBlock(d)}
                                                disabled={actionLoading === d.driverId + '-status'}
                                                className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all shadow-xl disabled:opacity-50 ${d.status === 'blocked' ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white' : 'bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white'}`}
                                                title={d.status === 'blocked' ? 'שחרר חסימה' : 'חסום נהג'}
                                            >
                                                {actionLoading === d.driverId + '-status' ? <Loader2 size={16} className="animate-spin" /> : (d.status === 'blocked' ? <Unlock size={16} /> : <Ban size={16} />)}
                                            </button>
                                            <button
                                                onClick={() => handleClearDebt(d)}
                                                disabled={actionLoading === d.driverId + '-debt'}
                                                className="w-10 h-10 flex items-center justify-center bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white rounded-xl transition-all shadow-xl disabled:opacity-50"
                                                title="אפס חוב עמלות"
                                            >
                                                {actionLoading === d.driverId + '-debt' ? <Loader2 size={16} className="animate-spin" /> : <HandCoins size={16} />}
                                            </button>
                                            <button
                                                onClick={() => onDownloadReport(d.driverId)}
                                                disabled={isGeneratingReport === d.driverId}
                                                className="w-10 h-10 flex items-center justify-center bg-primary-500/10 text-primary-400 hover:bg-primary-500 hover:text-white rounded-xl transition-all shadow-xl disabled:opacity-50"
                                                title="הפק דוח חודשי"
                                            >
                                                {isGeneratingReport === d.driverId ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="lg:hidden space-y-5 px-4 pb-10">
                {drivers.map(d => (
                    <div key={d.driverId} className="bg-[#1E293B] rounded-[2.5rem] p-8 shadow-2xl border border-white/5 relative overflow-hidden group">
                        {/* Driver Info */}
                        <div className="flex items-center justify-between mb-8 relative z-10">
                            <div className="flex items-center gap-5">
                                <div className="w-16 h-16 rounded-[1.5rem] bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-400 font-black text-2xl shadow-xl shadow-primary-500/5">
                                    {d.driverName?.[0]}
                                </div>
                                <div>
                                    <h3 className="font-black text-white text-lg tracking-tight">{d.driverName}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`w-2 h-2 rounded-full ${d.status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-slate-600'}`}></span>
                                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
                                            {d.status === 'active' ? 'Online' : 'Offline'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => onDownloadReport(d.driverId)}
                                disabled={isGeneratingReport === d.driverId}
                                className="w-14 h-14 bg-white/5 text-primary-400 hover:bg-primary-500 hover:text-white rounded-2xl transition-all shadow-xl disabled:opacity-50 flex items-center justify-center"
                            >
                                {isGeneratingReport === d.driverId ? <Loader2 size={24} className="animate-spin" /> : <ShieldCheck size={24} />}
                            </button>
                        </div>

                        {/* Bento Grid Stats for Mobile */}
                        <div className="grid grid-cols-2 gap-4 relative z-10">
                            <div className="bg-[#0F172A]/50 p-5 rounded-[1.5rem] border border-white/5 col-span-2 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Phone size={18} className="text-slate-500" />
                                    <span className="text-slate-300 font-black tracking-widest" dir="ltr">{d.phone}</span>
                                </div>
                                <a href={`tel:${d.phone}`} className="text-primary-400 font-black text-xs uppercase tracking-widest">חייג</a>
                            </div>
                            <div className="bg-[#0F172A]/50 p-5 rounded-[1.5rem] border border-white/5 text-center transition-all hover:bg-white/5">
                                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">פעילות היום</p>
                                <p className="text-2xl font-black text-white">{d.todayRides || 0}</p>
                            </div>
                            <div className="bg-[#0F172A]/50 p-5 rounded-[1.5rem] border border-white/5 text-center transition-all hover:bg-white/5">
                                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">סה"כ הכנסה</p>
                                <p className="text-xl font-black text-emerald-400">₪{(d.totalRevenue || 0).toLocaleString()}</p>
                            </div>
                            <div className="bg-[#0F172A]/50 p-5 rounded-[1.5rem] border border-white/5 text-center transition-all flex flex-col items-center justify-center min-h-[80px]">
                                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">חוב עמלות</p>
                                <div className="flex items-center gap-2">
                                    <p className="text-xl font-black text-rose-400">₪{d.debt !== undefined ? d.debt.toLocaleString() : Math.round((d.totalRevenue || 0) * 0.15).toLocaleString()}</p>
                                    <button onClick={() => handleClearDebt(d)} disabled={actionLoading === d.driverId + '-debt'} className="p-1.5 bg-rose-500/10 text-rose-400 rounded-lg hover:bg-rose-500 hover:text-white">
                                        <HandCoins size={14} />
                                    </button>
                                </div>
                            </div>
                            <div className="bg-[#0F172A]/50 p-5 rounded-[1.5rem] border border-white/5 text-center flex flex-col justify-center items-center min-h-[80px]">
                                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-2">פעולות נהג</p>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => handleToggleBlock(d)}
                                        disabled={actionLoading === d.driverId + '-status'}
                                        className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all shadow-xl disabled:opacity-50 ${d.status === 'blocked' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}
                                        title={d.status === 'blocked' ? 'שחרר חסימה' : 'חסום'}
                                    >
                                        {actionLoading === d.driverId + '-status' ? <Loader2 size={16} className="animate-spin" /> : (d.status === 'blocked' ? <Unlock size={16} /> : <Ban size={16} />)}
                                    </button>
                                    <button
                                        onClick={() => onDownloadReport(d.driverId)}
                                        disabled={isGeneratingReport === d.driverId}
                                        className="w-10 h-10 flex items-center justify-center bg-primary-500/10 text-primary-400 rounded-xl transition-all shadow-xl disabled:opacity-50"
                                    >
                                        {isGeneratingReport === d.driverId ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                        {/* Card background decoration */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 blur-3xl -z-0"></div>
                    </div>
                ))}
            </div>
        </>
    );
};
