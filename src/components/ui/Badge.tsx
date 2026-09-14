import React, { HTMLAttributes } from 'react';
import { cn } from '../../utils/ui';
import { getStatusConfig } from '../../utils/statusConfig';

type BadgeVariant = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    variant?: BadgeVariant;
    /** When set, colors come from STATUS_CONFIG (preferred for order states). */
    status?: string;
    pulse?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
    primary: 'bg-primary-100 text-primary-700',
    success: 'bg-success-100 text-success-700',
    warning: 'bg-warning-100 text-warning-700',
    danger: 'bg-danger-100 text-danger-600',
    neutral: 'bg-slate-100 text-slate-600',
};

export const Badge: React.FC<BadgeProps> = ({
    variant = 'neutral',
    status,
    pulse,
    className,
    children,
    ...props
}) => {
    if (status) {
        const cfg = getStatusConfig(status);
        const shouldPulse = pulse ?? cfg.pulse;
        return (
            <span
                {...props}
                className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full',
                    cfg.bg,
                    cfg.text,
                    className
                )}
            >
                {cfg.dot && (
                    <span
                        className={cn('w-1.5 h-1.5 rounded-full', cfg.dot, shouldPulse && 'animate-pulse')}
                        aria-hidden
                    />
                )}
                {children ?? cfg.label}
            </span>
        );
    }

    return (
        <span
            {...props}
            className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full',
                variantClasses[variant],
                className
            )}
        >
            {children}
        </span>
    );
};

export default Badge;
