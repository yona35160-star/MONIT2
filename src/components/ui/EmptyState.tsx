import React, { ReactNode } from 'react';
import { AlertCircle, Inbox, WifiOff, SearchX } from 'lucide-react';
import { cn } from '../../utils/ui';
import { Button } from './Button';

export type EmptyStateTone = 'empty' | 'error' | 'offline' | 'search';

interface EmptyStateProps {
    tone?: EmptyStateTone;
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
    icon?: ReactNode;
    className?: string;
    /** dark glass surfaces (driver/admin) */
    dark?: boolean;
}

const toneIcon: Record<EmptyStateTone, React.ElementType> = {
    empty: Inbox,
    error: AlertCircle,
    offline: WifiOff,
    search: SearchX,
};

export const EmptyState: React.FC<EmptyStateProps> = ({
    tone = 'empty',
    title,
    description,
    actionLabel,
    onAction,
    icon,
    className,
    dark = false,
}) => {
    const Icon = toneIcon[tone];
    return (
        <div
            className={cn(
                'text-center p-10 rounded-[2.5rem] border border-dashed',
                dark
                    ? 'glass-dark border-white/10 text-slate-200'
                    : 'bg-white/80 border-slate-200 text-slate-800 shadow-card',
                className
            )}
            role={tone === 'error' ? 'alert' : 'status'}
        >
            <div
                className={cn(
                    'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 border',
                    tone === 'error' && (dark ? 'bg-danger/20 border-danger/30 text-danger' : 'bg-danger-50 border-danger-100 text-danger-500'),
                    tone === 'offline' && (dark ? 'bg-warning/20 border-warning/30 text-warning' : 'bg-warning-50 border-warning-100 text-warning-500'),
                    (tone === 'empty' || tone === 'search') && (dark ? 'bg-slate-800/50 border-white/5 text-slate-500' : 'bg-slate-50 border-slate-100 text-slate-400')
                )}
            >
                {icon ?? <Icon size={28} aria-hidden />}
            </div>
            <p className={cn('font-black text-sm tracking-wide', dark ? 'text-slate-300' : 'text-slate-800')}>{title}</p>
            {description && (
                <p className={cn('text-xs mt-2 font-medium leading-relaxed max-w-xs mx-auto', dark ? 'text-slate-500' : 'text-slate-500')}>
                    {description}
                </p>
            )}
            {actionLabel && onAction && (
                <div className="mt-6 flex justify-center">
                    <Button variant={tone === 'error' ? 'primary' : 'accent'} size="md" onClick={onAction}>
                        {actionLabel}
                    </Button>
                </div>
            )}
        </div>
    );
};

export default EmptyState;
