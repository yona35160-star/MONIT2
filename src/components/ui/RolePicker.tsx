import React from 'react';
import { Car, User, ArrowLeft } from 'lucide-react';
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
        accent: 'hover:border-accent-400/60 hover:shadow-glow-accent',
        iconWrap: 'bg-accent-400 text-slate-900 shadow-glow-accent',
        Icon: User,
    },
    {
        id: 'driver',
        title: 'נהג',
        subtitle: 'תור נסיעות, ניווט ופורטל',
        accent: 'hover:border-primary-400/60 hover:shadow-glow-primary',
        iconWrap: 'bg-primary-500 text-white shadow-glow-primary',
        Icon: Car,
    },
];

/** מסך בחירת תפקיד — אפליקציית נסיעה (Wave Unify) */
export const RolePicker: React.FC<RolePickerProps> = ({ onSelect, className }) => {
    return (
        <div
            className={[
                'min-h-screen flex flex-col items-center justify-center gap-8 p-6',
                'bg-[radial-gradient(ellipse_at_top,_#1e293b_0%,_#020617_55%)] text-white',
                className || '',
            ].join(' ')}
            dir="rtl"
        >
            <div className="text-center space-y-3 max-w-md">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-400/15 border border-accent-400/30 text-accent-300 text-[11px] font-black tracking-widest uppercase">
                    TAXIPRO
                </div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight">אפליקציית נסיעה</h1>
                <p className="text-slate-400 text-sm font-medium leading-relaxed">
                    בחרו תפקיד להמשך. אפשר להחליף בכל רגע מסרגל העליון.
                </p>
            </div>

            <div className="w-full max-w-md grid gap-4">
                {roles.map(({ id, title, subtitle, accent, iconWrap, Icon }) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => onSelect(id)}
                        className={[
                            'group text-right w-full rounded-[1.75rem] border border-white/10 bg-slate-900/70 backdrop-blur-xl p-5',
                            'transition-all duration-200 active:scale-[0.98]',
                            accent,
                        ].join(' ')}
                    >
                        <div className="flex items-center gap-4">
                            <div className={['w-14 h-14 rounded-2xl flex items-center justify-center shrink-0', iconWrap].join(' ')}>
                                <Icon size={28} strokeWidth={2.5} aria-hidden />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xl font-black tracking-tight">{title}</div>
                                <div className="text-sm text-slate-400 font-medium mt-0.5">{subtitle}</div>
                            </div>
                            <ArrowLeft
                                className="text-slate-600 group-hover:text-white transition-colors shrink-0"
                                size={20}
                                aria-hidden
                            />
                        </div>
                    </button>
                ))}
            </div>

            <p className="text-[11px] text-slate-600 font-bold">
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
        <div className="min-h-screen flex flex-col" dir="rtl">
            <div
                className={[
                    'sticky top-0 z-[200] flex items-center justify-between gap-3 px-4 py-2.5 border-b backdrop-blur-xl',
                    isPassenger
                        ? 'bg-white/95 text-slate-900 border-slate-200'
                        : 'bg-slate-950/95 text-white border-slate-800',
                ].join(' ')}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <span
                        className={[
                            'w-2.5 h-2.5 rounded-full shrink-0',
                            isPassenger ? 'bg-accent-400' : 'bg-primary-400',
                        ].join(' ')}
                        aria-hidden
                    />
                    <div className="text-sm font-black truncate">
                        אפליקציית נסיעה · {isPassenger ? 'נוסע' : 'נהג'}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onSwitch}
                    className={[
                        'text-xs font-black px-3 py-1.5 rounded-xl border transition-colors shrink-0',
                        isPassenger
                            ? 'border-slate-200 text-slate-600 hover:bg-slate-50'
                            : 'border-slate-700 text-accent-300 hover:bg-slate-900',
                    ].join(' ')}
                >
                    החלף תפקיד
                </button>
            </div>
            <div className="flex-1 min-h-0">{children}</div>
        </div>
    );
};

export default RolePicker;
