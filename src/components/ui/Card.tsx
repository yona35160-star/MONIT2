import React, { HTMLAttributes } from 'react';
import { cn } from '../../utils/ui';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'glass' | 'dark' | 'gradient';
    hover?: boolean;
    padding?: 'none' | 'sm' | 'md' | 'lg';
}

const variantClasses = {
    default: 'bg-white border border-slate-100/80 shadow-card',
    glass: 'bg-white/70 backdrop-blur-xl border border-white/50 shadow-card',
    dark: 'bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 shadow-2xl text-slate-100',
    gradient: 'bg-gradient-to-br from-white to-slate-50/80 border border-slate-100',
};

const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-6',
};

export const Card: React.FC<CardProps> = ({
    variant = 'default',
    hover = false,
    padding = 'md',
    className,
    children,
    ...props
}) => (
    <div
        {...props}
        className={cn(
            'rounded-3xl transition-all duration-300',
            variantClasses[variant],
            paddingClasses[padding],
            hover && 'hover:shadow-card-hover hover:-translate-y-0.5',
            className
        )}
    >
        {children}
    </div>
);

export default Card;
