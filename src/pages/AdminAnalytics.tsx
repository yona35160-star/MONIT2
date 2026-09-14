import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { Download, TrendingUp, BarChart3, PieChart as PieChartIcon, Zap, Users, ArrowUpRight, DollarSign, Calendar } from 'lucide-react';
import { Order } from '../types';
import { getRevenueStats, getDemandHeatmap, getDriverLeaderboard, generateCommissionReport } from '../api/adminApi';
import { motion } from 'framer-motion';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const AdminAnalytics = () => {
    const historicalOrders: Order[] = useSelector((state: any) => state.orders.historicalOrders || []);

    const [period, setPeriod] = useState<'week' | 'month'>('week');
    const [revenueData, setRevenueData] = useState<any>(null);
    const [demandData, setDemandData] = useState<any[]>([]);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);

    useEffect(() => {
        const fetchAllStats = async () => {
            setLoading(true);
            try {
                const [revRes, demandRes, leaderRes] = await Promise.all([
                    getRevenueStats(period),
                    getDemandHeatmap(),
                    getDriverLeaderboard()
                ]);

                if (revRes.ok) setRevenueData(revRes.data);
                if (demandRes.ok) setDemandData(demandRes.data);
                if (leaderRes.ok) setLeaderboard(leaderRes.data);
            } catch (error) {
                console.error("Failed to fetch analytics", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAllStats();
    }, [period]);

    const handleDownloadReport = async () => {
        setIsDownloading(true);
        try {
            const endDate = new Date();
            const startDate = new Date();
            if (period === 'week') startDate.setDate(endDate.getDate() - 7);
            else startDate.setMonth(endDate.getMonth() - 1);

            const res = await generateCommissionReport({
                driverId: 'all',
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            });

            if (res.ok && res.data) {
                const data = res.data;
                const headers = ['ID', 'תאריך', 'נהג', 'מחיר', 'עמלה'];
                const rows = data.items.map((i: any) => [
                    i.id,
                    i.date,
                    i.driver,
                    i.price,
                    i.commission
                ]);

                let csv = '\uFEFF'; 
                csv += headers.join(',') + '\n';
                rows.forEach((r: any) => csv += r.join(',') + '\n');

                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `TaxiWork_Report_${period}_${new Date().toISOString().split('T')[0]}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (error) {
            console.error("Download failed", error);
        } finally {
            setIsDownloading(false);
        }
    };

    const processPieData = () => {
        let completed = 0, cancelled = 0;
        historicalOrders.forEach(o => {
            if (o.status === 'completed') completed++;
            else if (o.status === 'cancelled') cancelled++;
        });

        const total = completed + cancelled || 1;
        return [
            { name: 'הושלמו', value: completed, color: '#10b981', percent: Math.round((completed/total)*100) },
            { name: 'בוטלו', value: cancelled, color: '#ef4444', percent: Math.round((cancelled/total)*100) }
        ];
    };

    const pieData = processPieData();
    const barData = revenueData?.chartData || [];

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-[#1E293B] border border-white/10 p-4 rounded-2xl shadow-2xl backdrop-blur-md">
                    <p className="text-slate-400 text-xs font-black mb-2 uppercase tracking-tighter">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-3 mb-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                            <span className="text-white font-bold text-sm">{entry.name}:</span>
                            <span className="text-white font-black text-sm">₪{entry.value.toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-10 pb-20" dir="rtl">
            {/* Action Bar */}
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-gradient-to-br from-[#1E293B] to-[#0F172A] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden"
            >
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-indigo-500/20 rounded-lg">
                            <BarChart3 className="text-indigo-400" size={24} />
                        </div>
                        <h2 className="text-3xl font-black text-white tracking-tight">אנליטיקה עסקית</h2>
                    </div>
                    <p className="text-slate-400 font-medium">סקירה מקיפה של ביצועי התחנה ורווחיות נהגים</p>
                </div>

                <div className="flex flex-wrap gap-4 w-full lg:w-auto relative z-10">
                    <div className="bg-slate-900/50 p-1.5 rounded-2xl flex items-center border border-white/10 backdrop-blur-md">
                        <button
                            onClick={() => setPeriod('week')}
                            className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all duration-300 ${period === 'week' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'text-slate-400 hover:text-white'}`}
                        >
                            שבועי
                        </button>
                        <button
                            onClick={() => setPeriod('month')}
                            className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all duration-300 ${period === 'month' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'text-slate-400 hover:text-white'}`}
                        >
                            חודשי
                        </button>
                    </div>

                    <button
                        onClick={handleDownloadReport}
                        disabled={isDownloading}
                        className="flex items-center gap-3 bg-white text-slate-900 hover:bg-slate-100 disabled:opacity-50 px-8 py-3 rounded-2xl font-black transition-all shadow-xl active:scale-95"
                    >
                        {isDownloading ? <Zap className="animate-spin" size={18} /> : <Download size={18} />}
                        ייצוא נתונים
                    </button>
                </div>
                
                {/* Decorative background glow */}
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 blur-[100px] pointer-events-none"></div>
            </motion.div>

            {/* Core Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'מחזור עסקאות', value: `₪${revenueData?.totalRevenue?.toLocaleString() || 0}`, icon: DollarSign, color: 'from-emerald-500/20 to-emerald-500/5', iconColor: 'text-emerald-400' },
                    { label: 'עמלות תחנה', value: `₪${revenueData?.totalCommission?.toLocaleString() || 0}`, icon: Zap, color: 'from-amber-500/20 to-amber-500/5', iconColor: 'text-amber-400' },
                    { label: 'נסיעות שהושלמו', value: revenueData?.rideCount || 0, icon: TrendingUp, color: 'from-indigo-500/20 to-indigo-500/5', iconColor: 'text-indigo-400' },
                    { label: 'נהגים פעילים', value: leaderboard.length, icon: Users, color: 'from-purple-500/20 to-purple-500/5', iconColor: 'text-purple-400' },
                ].map((stat, i) => (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={i} 
                        className={`bg-gradient-to-br ${stat.color} p-8 rounded-[2rem] border border-white/5 shadow-xl relative group overflow-hidden`}
                    >
                        <div className="flex flex-col gap-4 relative z-10">
                            <div className={`w-12 h-12 rounded-2xl bg-slate-900/60 flex items-center justify-center ${stat.iconColor} border border-white/5 shadow-inner`}>
                                <stat.icon size={24} />
                            </div>
                            <div>
                                <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">{stat.label}</p>
                                <p className="text-3xl font-black text-white tracking-tight">{stat.value}</p>
                            </div>
                        </div>
                        <ArrowUpRight className="absolute top-6 left-6 text-white/10 group-hover:text-white/30 transition-colors" size={24} />
                    </motion.div>
                ))}
            </div>

            {/* Primary Analysis Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Revenue Trend Chart */}
                <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="lg:col-span-2 bg-[#1E293B] p-8 md:p-10 rounded-[2.5rem] shadow-2xl border border-white/5 relative overflow-hidden"
                >
                    <div className="flex justify-between items-center mb-10">
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-8 bg-indigo-500 rounded-full"></div>
                            <h3 className="text-2xl font-black text-white">מגמות הכנסה ועמלה</h3>
                        </div>
                        <div className="flex items-center gap-4 text-[10px] font-black text-slate-500 tracking-widest uppercase">
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> הכנסה</div>
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500"></div> עמלה</div>
                        </div>
                    </div>

                    <div className="h-[450px] w-full mt-4" dir="ltr">
                        {loading ? (
                            <div className="w-full h-full flex items-center justify-center"><Zap className="animate-spin text-indigo-500" /></div>
                        ) : barData.length === 0 ? (
                            <div className="w-full h-full flex flex-col items-center justify-center space-y-4 opacity-50">
                                <BarChart3 size={64} className="text-slate-600" />
                                <p className="text-slate-400 font-bold">אין נתונים זמינים לתקופה זו</p>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                    <defs>
                                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorComm" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis 
                                        dataKey="date" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} 
                                        dy={15}
                                    />
                                    <YAxis 
                                        yAxisId="left"
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#10b981', fontSize: 12, fontWeight: 700 }} 
                                        tickFormatter={(val) => `₪${val}`}
                                    />
                                    <YAxis 
                                        yAxisId="right"
                                        orientation="right"
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#f59e0b', fontSize: 12, fontWeight: 700 }} 
                                        tickFormatter={(val) => `₪${val}`}
                                    />
                                    <RechartsTooltip content={<CustomTooltip />} />
                                    <Legend verticalAlign="top" height={36}/>
                                    <Area 
                                        yAxisId="left"
                                        type="monotone" 
                                        dataKey="revenue" 
                                        name="הכנסה ברוטו (₪)" 
                                        stroke="#10b981" 
                                        strokeWidth={4} 
                                        fillOpacity={1} 
                                        fill="url(#colorRev)" 
                                        animationDuration={1500}
                                    />
                                    <Area 
                                        yAxisId="right"
                                        type="monotone" 
                                        dataKey="commission" 
                                        name="עמלת תחנה (₪)" 
                                        stroke="#f59e0b" 
                                        strokeWidth={4} 
                                        fillOpacity={1} 
                                        fill="url(#colorComm)" 
                                        animationDuration={2000}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </motion.div>

                {/* Status Breakdown */}
                <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-[#1E293B] p-8 md:p-10 rounded-[2.5rem] shadow-2xl border border-white/5 flex flex-col"
                >
                    <h3 className="text-2xl font-black text-white flex items-center gap-3 mb-10">
                        <PieChartIcon className="text-orange-500" size={28} />
                        יחס המרה
                    </h3>
                    
                    <div className="flex-1 min-h-[300px] w-full flex items-center justify-center relative" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={110}
                                    paddingAngle={10}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <RechartsTooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-4xl font-black text-white">{pieData[0].percent}%</span>
                            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">הצלחה</span>
                        </div>
                    </div>

                    <div className="space-y-4 mt-8 pt-8 border-t border-white/5">
                        {pieData.map((d, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                                    <span className="text-sm font-bold text-slate-300">{d.name}</span>
                                </div>
                                <span className="text-sm font-black text-white">{d.value}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* Performance Leaderboard */}
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#1E293B] p-10 rounded-[2.5rem] shadow-2xl border border-white/5"
            >
                <div className="flex justify-between items-center mb-10">
                    <h3 className="text-2xl font-black text-white flex items-center gap-3">
                        <Users className="text-indigo-500" size={28} />
                        מובילי ביצועים
                    </h3>
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 py-2 bg-slate-900/50 rounded-xl border border-white/5">דירוג נהגים מובילים</div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead>
                            <tr className="text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-white/5">
                                <th className="pb-6 pr-6">נהג</th>
                                <th className="pb-6">נסיעות</th>
                                <th className="pb-6">מחזור כולל</th>
                                <th className="pb-6">דירוג לקוחות</th>
                                <th className="pb-6">סטטוס אחרון</th>
                            </tr>
                        </thead>
                        <tbody className="text-white">
                            {leaderboard.slice(0, 8).map((d, i) => (
                                <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-all duration-300 group">
                                    <td className="py-6 pr-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-black text-sm border border-indigo-500/20 shadow-lg group-hover:scale-110 transition-transform">
                                                {d.name.charAt(0)}
                                            </div>
                                            <span className="font-bold text-lg">{d.name}</span>
                                        </div>
                                    </td>
                                    <td className="py-6">
                                        <span className="bg-slate-900/60 px-4 py-1.5 rounded-xl text-indigo-400 font-black border border-white/5 shadow-inner">{d.rides}</span>
                                    </td>
                                    <td className="py-6 font-black text-xl tracking-tight">₪{d.revenue.toLocaleString()}</td>
                                    <td className="py-6">
                                        <div className="flex items-center gap-1.5 bg-amber-500/10 w-fit px-4 py-1.5 rounded-xl border border-amber-500/20">
                                            <span className="text-amber-500 font-black">{d.rating}</span>
                                            <span className="text-amber-500/50">★</span>
                                        </div>
                                    </td>
                                    <td className="py-6">
                                        <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
                                            <Calendar size={14} className="opacity-50" />
                                            {d.lastActive}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    );
};

export default AdminAnalytics;
