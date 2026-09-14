import React, { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../utils/ui';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    inputSize?: 'md' | 'lg';
    invalid?: boolean;
    label?: string;
    hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ inputSize = 'md', invalid, label, hint, className, id, ...props }, ref) => {
        const inputId = id || props.name;
        return (
            <div className="w-full">
                {label && (
                    <label htmlFor={inputId} className="block text-sm font-bold text-slate-600 mb-1.5">
                        {label}
                    </label>
                )}
                <input
                    {...props}
                    id={inputId}
                    ref={ref}
                    aria-invalid={invalid || undefined}
                    className={cn(
                        'w-full bg-white border-2 rounded-xl text-slate-800 placeholder:text-slate-400',
                        'focus:outline-none focus:ring-4 transition-all duration-200',
                        inputSize === 'lg' ? 'px-5 py-4 text-lg rounded-2xl' : 'px-4 py-3',
                        invalid
                            ? 'border-danger-400 focus:border-danger-500 focus:ring-danger-100'
                            : 'border-slate-200 focus:border-primary-400 focus:ring-primary-100',
                        className
                    )}
                />
                {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
            </div>
        );
    }
);

Input.displayName = 'Input';
export default Input;
