import React from 'react';
import { DollarSign, Calendar, CheckCircle, XCircle, UserX, Clock } from 'lucide-react';
import { StatCard, StatCardSkeleton } from './StatCard';
import { DashboardStats } from '../types';

interface StatsCardsProps {
    stats: DashboardStats | null;
    currentView: { revenue: number; orders: number; commission: number; chartData: any[] };
    statsPeriod: 'today' | 'weekly' | 'monthly';
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats, currentView, statsPeriod }) => {
    if (!stats || !currentView) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
            <StatCard
                title={statsPeriod === 'today' ? "מחזור היום" : statsPeriod === 'weekly' ? "מחזור שבועי" : "מחזור חודשי"}
                value={`${(currentView.revenue || 0).toLocaleString()} ₪`}
                subValue={`צפי עמלה: ${(currentView.commission || 0).toLocaleString()} ₪`}
                icon={DollarSign}
                colorClass="text-emerald-400"
                iconBgClass="bg-emerald-500/10"
            />
            <StatCard
                title={statsPeriod === 'today' ? "הזמנות היום" : statsPeriod === 'weekly' ? "הזמנות שבועיות" : "הזמנות חודשיות"}
                value={currentView.orders || 0}
                icon={Calendar}
                colorClass="text-primary-400"
                iconBgClass="bg-primary-500/10"
            />
            <StatCard title="נסיעות שהושלמו" value={stats.completedCount} icon={CheckCircle} colorClass="text-blue-400" iconBgClass="bg-blue-500/10" />
            <StatCard title="נסיעות שבוטלו" value={stats.cancelledCount} icon={XCircle} colorClass="text-red-400" iconBgClass="bg-red-500/10" />
            <StatCard title="שיעור ביטולים" value={`${((stats.cancelledCount / (Math.max(stats.totalOrders || 1, 1))) * 100).toFixed(1)}%`} icon={UserX} colorClass="text-slate-400" iconBgClass="bg-slate-500/10" />
            <StatCard title="זמן מענה" value={`${stats.averagePickupTime || 0} דק'`} icon={Clock} colorClass="text-amber-400" iconBgClass="bg-amber-500/10" />
        </div>
    );
};
