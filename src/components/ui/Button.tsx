import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    isLoading?: boolean;
    variant?: 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost';
    size?: 'xs' | 'sm' | 'md' | 'lg';
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
}

const variantClasses: Record<string, string> = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-800',
    accent: 'bg-yellow-400 hover:bg-yellow-500 text-gray-900',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    ghost: 'bg-transparent hover:bg-gray-100 text-gray-700',
};

const sizeClasses: Record<string, string> = {
    xs: 'px-2 py-1 text-xs gap-1',
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2',
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
    const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed';
    const variantCls = variantClasses[variant] ?? variantClasses.primary;
    const sizeCls = sizeClasses[size] ?? sizeClasses.md;

    return (
        <button
            {...props}
            disabled={disabled || isLoading}
            className={`${base} ${variantCls} ${sizeCls} ${className}`}
        >
            {isLoading ? (
                <Loader2 className="animate-spin w-4 h-4 shrink-0" />
            ) : leftIcon ? (
                <span className="shrink-0">{leftIcon}</span>
            ) : null}
            {children}
            {rightIcon && !isLoading && (
                <span className="shrink-0">{rightIcon}</span>
            )}
        </button>
    );
};

export default Button;
