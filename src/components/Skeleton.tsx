import React from 'react';

interface SkeletonProps {
    className?: string;
    width?: string | number;
    height?: string | number;
    circle?: boolean;
    variant?: 'text' | 'rect' | 'circle' | 'card';
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', width, height, circle, variant = 'rect' }) => {
    const style: React.CSSProperties = {};
    if (width) style.width = width;
    if (height) style.height = height;

    let variantClasses = "rounded-xl";
    if (circle || variant === 'circle') variantClasses = "rounded-full";
    if (variant === 'text') variantClasses = "rounded h-4";
    if (variant === 'card') variantClasses = "rounded-2xl";

    return (
        <div
            className={`skeleton ${variantClasses} ${className}`}
            style={style}
        >
            &nbsp;
        </div>
    );
};

// Card-style skeleton for mobile
export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
    <div className="space-y-4">
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
                <div className="flex items-center justify-between mb-3">
                    <Skeleton width={80} height={20} variant="rect" />
                    <Skeleton width={60} height={24} variant="rect" />
                </div>
                <div className="space-y-2">
                    <Skeleton width="70%" height={16} variant="text" />
                    <Skeleton width="50%" height={14} variant="text" />
                </div>
                <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
                    <Skeleton className="flex-1" height={40} variant="rect" />
                    <Skeleton className="flex-1" height={40} variant="rect" />
                </div>
            </div>
        ))}
    </div>
);

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 4 }) => (
    <div className="w-full space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex gap-4 border-b border-slate-100 pb-4 last:border-0 items-center">
                {Array.from({ length: cols }).map((__, j) => (
                    <div key={j} className="flex-1">
                        <Skeleton
                            height={j === 0 ? "1rem" : "1.5rem"}
                            variant={j === 0 ? 'text' : 'rect'}
                            width={j === 0 ? "50%" : "100%"}
                        />
                    </div>
                ))}
            </div>
        ))}
    </div>
);

// Stat Card Skeleton
export const StatCardSkeleton: React.FC = () => (
    <div className="card p-5 sm:p-6 animate-pulse">
        <div className="flex items-center justify-between mb-4">
            <Skeleton width={48} height={48} variant="rect" className="!rounded-2xl" />
            <Skeleton width={50} height={20} variant="rect" className="!rounded-full" />
        </div>
        <div className="space-y-2">
            <Skeleton width={80} height={12} variant="text" />
            <Skeleton width={100} height={28} variant="rect" />
        </div>
    </div>
);

// Page skeleton
export const PageSkeleton: React.FC = () => (
    <div className="space-y-6 animate-pulse">
        {/* Header */}
        <div className="flex items-center justify-between">
            <div className="space-y-2">
                <Skeleton width={200} height={28} variant="rect" />
                <Skeleton width={300} height={16} variant="text" />
            </div>
            <Skeleton width={120} height={42} variant="rect" />
        </div>

        {/* Stat Cards */}
        <div className="grid-responsive-4">
            {Array.from({ length: 4 }).map((_, i) => (
                <StatCardSkeleton key={i} />
            ))}
        </div>

        {/* Table */}
        <div className="card p-6">
            <TableSkeleton rows={5} cols={6} />
        </div>
    </div>
);
