import React from 'react';
import { Car, User, ArrowLeft } from 'lucide-react';
import { ThemeToggle } from '../ThemeToggle';
import { cn } from '../../utils/ui';

export type RideRole = 'passenger' | 'driver';

interface RolePickerProps {
    onSelect: (role: RideRole) => void;
    className?: string;
}

const roles: Array<{
    id: RideRole;
    title: string;
    subtitle: string;
    accent: string;
    iconWrap: string;
    Icon: typeof User;
}> = [
    {
        id: 'passenger',
        title: 'נוסע',
        subtitle: 'הזמנה, מעקב חי ודירוג',
        accent: 'hover:border-primary-500/60 hover:shadow-glow-primary',
        iconWrap: 'bg-primary-500 text-slate-950 shadow-glow-primary',
        Icon: User,
    },
    {
        id: 'driver',
        title: 'נהג',
        subtitle: 'תור נסיעות, ניווט ופורטל',
        accent: 'hover:border-primary-400/60 hover:shadow-glow-primary',
        iconWrap: 'bg-primary-500 text-slate-950 shadow-glow-primary',
        Icon: Car,
    },
];

/** מסך בחירת תפקיד — אפליקציית נסיעה (theme-aware via --tp-*) */
export const RolePicker: React.FC<RolePickerProps> = ({ onSelect, className }) => {
    return (
        <div
            className={cn(
                'relative min-h-screen flex flex-col items-center justify-center gap-8 p-6',
                className
            )}
            style={{
                background: 'radial-gradient(ellipse at top, var(--tp-bg-elevated, #21262d) 0%, var(--tp-bg, #0d1117) 55%)',
                color: 'var(--tp-text, #e6edf3)',
            }}
            dir="rtl"
        >
            <div className="absolute top-4 left-4 z-10">
                <ThemeToggle />
            </div>

            <div className="text-center space-y-3 max-w-md">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/15 border border-primary-500/30 text-primary-400 text-[11px] font-black tracking-widest uppercase">
                    TAXIPRO
                </div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight" style={{ color: 'var(--tp-text)' }}>
                    אפליקציית נסיעה
                </h1>
                <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--tp-text-secondary)' }}>
                    בחרו תפקיד להמשך. אפשר להחליף בכל רגע מסרגל העליון.
                </p>
            </div>

            <div className="w-full max-w-md grid gap-4">
                {roles.map(({ id, title, subtitle, accent, iconWrap, Icon }) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => onSelect(id)}
                        className={cn(
                            'group text-right w-full rounded-[1.75rem] border backdrop-blur-xl p-5',
                            'transition-all duration-200 active:scale-[0.98]',
                            accent
                        )}
                        style={{
                            backgroundColor: 'color-mix(in srgb, var(--tp-bg-subtle, #161b22) 92%, transparent)',
                            borderColor: 'var(--tp-border, #30363d)',
                            color: 'var(--tp-text)',
                        }}
                    >
                        <div className="flex items-center gap-4">
                            <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center shrink-0', iconWrap)}>
                                <Icon size={28} strokeWidth={2.5} aria-hidden />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xl font-black tracking-tight">{title}</div>
                                <div className="text-sm font-medium mt-0.5" style={{ color: 'var(--tp-text-secondary)' }}>
                                    {subtitle}
                                </div>
                            </div>
                            <ArrowLeft
                                className="shrink-0 opacity-50 group-hover:opacity-100 transition-opacity"
                                size={20}
                                aria-hidden
                                style={{ color: 'var(--tp-text)' }}
                            />
                        </div>
                    </button>
                ))}
            </div>

            <p className="text-[11px] font-bold" style={{ color: 'var(--tp-text-muted)' }}>
                מרכז שליטה לצוות התחנה: הפעילו SETUP.bat / npm run dev:ops
            </p>
        </div>
    );
};

interface RoleShellProps {
    role: RideRole;
    onSwitch: () => void;
    children: React.ReactNode;
}

/** סרגל תפקיד קבוע מעל אפליקציית הנסיעה */
export const RoleShell: React.FC<RoleShellProps> = ({ role, onSwitch, children }) => {
    const isPassenger = role === 'passenger';
    return (
        <div className="min-h-screen flex flex-col" dir="rtl" style={{ background: 'var(--tp-bg)', color: 'var(--tp-text)' }}>
            <div
                className="sticky top-0 z-[200] flex items-center justify-between gap-3 px-4 py-2.5 border-b backdrop-blur-xl"
                style={{
                    backgroundColor: isPassenger
                        ? 'color-mix(in srgb, var(--tp-bg-subtle) 95%, transparent)'
                        : 'color-mix(in srgb, var(--tp-bg) 95%, transparent)',
                    borderColor: 'var(--tp-border)',
                    color: 'var(--tp-text)',
                }}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <span
                        className={cn(
                            'w-2.5 h-2.5 rounded-full shrink-0',
                            isPassenger ? 'bg-primary-400' : 'bg-primary-500'
                        )}
                        aria-hidden
                    />
                    <div className="text-sm font-black truncate">
                        אפליקציית נסיעה · {isPassenger ? 'נוסע' : 'נהג'}
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <ThemeToggle />
                    <button
                        type="button"
                        onClick={onSwitch}
                        className="text-xs font-black px-3 py-1.5 rounded-xl border transition-colors"
                        style={{
                            borderColor: 'var(--tp-border)',
                            color: 'var(--tp-text-secondary)',
                            backgroundColor: 'transparent',
                        }}
                    >
                        החלף תפקיד
                    </button>
                </div>
            </div>
            <div className="flex-1 min-h-0">{children}</div>
        </div>
    );
};

export default RolePicker;
