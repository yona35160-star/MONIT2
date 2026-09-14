import React, { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { cn } from '../../utils/ui';

export type AlertTone = 'error' | 'success' | 'warning' | 'info';

interface AlertBannerProps {
    tone?: AlertTone;
    children: ReactNode;
    className?: string;
    /** compact inline form (login / forms) */
    compact?: boolean;
}

const toneClasses: Record<AlertTone, string> = {
    error: 'bg-danger-50 border-danger-100 text-danger-600',
    success: 'bg-success-50 border-success-100 text-success-700',
    warning: 'bg-warning-50 border-warning-100 text-warning-700',
    info: 'bg-primary-50 border-primary-100 text-primary-700',
};

const darkToneClasses: Record<AlertTone, string> = {
    error: 'bg-danger/10 border-danger/20 text-danger',
    success: 'bg-success/10 border-success/20 text-success',
    warning: 'bg-warning/10 border-warning/20 text-warning',
    info: 'bg-primary-500/10 border-primary-500/20 text-primary-300',
};

const icons: Record<AlertTone, React.ElementType> = {
    error: AlertCircle,
    success: CheckCircle2,
    warning: AlertTriangle,
    info: Info,
};

export const AlertBanner: React.FC<AlertBannerProps & { dark?: boolean }> = ({
    tone = 'error',
    children,
    className,
    compact = false,
    dark = false,
}) => {
    const Icon = icons[tone];
    return (
        <div
            role={tone === 'error' ? 'alert' : 'status'}
            className={cn(
                'flex items-start gap-2 border font-bold',
                compact ? 'text-sm p-2.5 rounded-xl' : 'text-sm p-4 rounded-2xl',
                dark ? darkToneClasses[tone] : toneClasses[tone],
                className
            )}
        >
            <Icon className="shrink-0 mt-0.5" size={compact ? 16 : 18} aria-hidden />
            <div className="flex-1 leading-snug">{children}</div>
        </div>
    );
};

export default AlertBanner;
