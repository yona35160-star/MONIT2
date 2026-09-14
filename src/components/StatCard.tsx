import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export const StatCardSkeleton = () => (
    <div className="bg-[#1E293B] border border-[#334155] rounded-3xl p-6 animate-pulse">
        <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-white/5"></div>
            <div className="w-16 h-5 rounded-full bg-white/5"></div>
        </div>
        <div className="space-y-2">
            <div className="h-3 w-20 rounded bg-white/5"></div>
            <div className="h-8 w-28 rounded-lg bg-white/5"></div>
        </div>
    </div>
);

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ElementType;
    colorClass?: string;
    iconBgClass?: string;
    trend?: number;
    subtitle?: string;
    subValue?: string | number;
}

export const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    icon: Icon,
    colorClass = 'text-blue-400',
    iconBgClass = 'bg-blue-500/15',
    trend,
    subtitle,
    subValue
}) => (
    <div className="bg-[#1E293B]/80 backdrop-blur-sm border border-[#334155] rounded-3xl p-5 sm:p-6 flex flex-col justify-between group relative overflow-hidden min-h-[140px] hover:border-[#475569] hover:-translate-y-0.5 transition-all duration-300">
        {/* Background Decoration */}
        <div className="absolute -top-4 -left-4 w-24 h-24 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {/* Header Row */}
        <div className="flex items-center justify-between mb-4 relative z-10">
            <div className={`p-3 sm:p-4 rounded-2xl ${iconBgClass} ${colorClass} transition-transform duration-300 group-hover:scale-110`}>
                <Icon size={22} className="sm:w-6 sm:h-6" />
            </div>

            {trend !== undefined && (
                <span className={`
                    text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 
                    ${trend > 0
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : trend < 0
                            ? 'bg-red-500/15 text-red-400'
                            : 'bg-white/5 text-slate-400'
                    }
                `}>
                    {trend > 0 ? <TrendingUp size={12} /> : trend < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                    {Math.abs(trend)}%
                </span>
            )}
        </div>

        {/* Value Section */}
        <div className="relative z-10">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
            <h3 className="text-2xl sm:text-3xl font-black text-white leading-none tracking-tight">{value}</h3>
            {subValue && (
                <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-400">{subValue}</span>
                </div>
            )}
            {subtitle && (
                <p className="text-xs text-slate-500 mt-1 font-medium">{subtitle}</p>
            )}
        </div>

        {/* Large Background Icon */}
        <div className="absolute -bottom-4 -right-4 opacity-[0.04] group-hover:opacity-[0.08] group-hover:scale-110 transition-all duration-500 pointer-events-none text-white">
            <Icon size={100} />
        </div>
    </div>
);
