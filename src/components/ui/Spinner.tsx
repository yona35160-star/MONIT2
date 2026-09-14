import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/ui';

type SpinnerRole = 'passenger' | 'driver' | 'admin';

interface SpinnerProps {
    role?: SpinnerRole;
    label?: string;
    fullScreen?: boolean;
    className?: string;
}

const roleShell: Record<SpinnerRole, string> = {
    passenger: 'bg-white text-slate-400',
    driver: 'bg-[#0F172A] text-slate-500',
    admin: 'bg-[var(--admin-bg,#0F172A)] text-[var(--admin-text-muted,#64748B)]',
};

const roleAccent: Record<SpinnerRole, string> = {
    passenger: 'border-accent-400 border-t-transparent',
    driver: 'text-accent-400',
    admin: 'text-[var(--admin-active-text,#FBB924)]',
};

export const Spinner: React.FC<SpinnerProps> = ({
    role = 'passenger',
    label = 'טוען...',
    fullScreen = true,
    className,
}) => {
    const body = (
        <div className={cn('flex flex-col items-center gap-4', className)}>
            {role === 'passenger' ? (
                <div
                    className={cn('w-12 h-12 border-4 rounded-full animate-spin', roleAccent.passenger)}
                    role="status"
                    aria-label={label}
                />
            ) : (
                <Loader2 className={cn('w-10 h-10 animate-spin', roleAccent[role])} aria-hidden />
            )}
            <p className="font-bold animate-pulse">{label}</p>
        </div>
    );

    if (!fullScreen) return body;

    return (
        <div
            className={cn(
                'flex h-screen w-screen items-center justify-center fixed inset-0 z-50',
                roleShell[role]
            )}
        >
            {body}
        </div>
    );
};

export default Spinner;
