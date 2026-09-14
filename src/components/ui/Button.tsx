import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/ui';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    isLoading?: boolean;
    variant?: 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost' | 'outline';
    size?: 'xs' | 'sm' | 'md' | 'lg';
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
}

/** Aligns with design-system.json + .btn-* utilities in index.css */
const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary:
        'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/25 hover:from-primary-600 hover:to-primary-700 focus-visible:ring-primary-400',
    secondary:
        'bg-surface-100 hover:bg-surface-200 text-slate-800 border border-slate-200/80 focus-visible:ring-primary-300',
    accent:
        'bg-gradient-to-r from-accent-400 to-accent-500 text-slate-900 shadow-lg shadow-accent-400/25 hover:from-accent-500 hover:to-accent-600 focus-visible:ring-accent-400',
    danger:
        'bg-danger-500 hover:bg-danger-600 text-white shadow-lg shadow-danger-500/20 focus-visible:ring-danger-400',
    ghost:
        'bg-transparent hover:bg-slate-100 text-slate-700 focus-visible:ring-slate-300',
    outline:
        'bg-white border-2 border-slate-200 text-slate-700 hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50/50 focus-visible:ring-primary-300',
};

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
    xs: 'px-2 py-1 text-xs gap-1 rounded-lg',
    sm: 'px-3 py-1.5 text-sm gap-1.5 rounded-xl',
    md: 'px-4 py-2.5 text-sm gap-2 rounded-xl',
    lg: 'px-6 py-3 text-base gap-2 rounded-xl font-bold',
};

export const Button: React.FC<ButtonProps> = ({
    children,
    isLoading = false,
    variant = 'primary',
    size = 'md',
    leftIcon,
    rightIcon,
    className = '',
    disabled,
    ...props
}) => {
    return (
        <button
            {...props}
            disabled={disabled || isLoading}
            className={cn(
                'inline-flex items-center justify-center font-semibold transition-all duration-200',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                'active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
                variantClasses[variant],
                sizeClasses[size],
                className
            )}
        >
            {isLoading ? (
                <Loader2 className="animate-spin w-4 h-4 shrink-0" aria-hidden />
            ) : leftIcon ? (
                <span className="shrink-0">{leftIcon}</span>
            ) : null}
            {children}
            {rightIcon && !isLoading && <span className="shrink-0">{rightIcon}</span>}
        </button>
    );
};

export default Button;
