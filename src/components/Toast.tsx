import React from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
    message: string;
    type?: ToastType;
    onClose: () => void;
    duration?: number;
}

const getToastStyles = (type: ToastType) => {
    switch (type) {
        case 'success':
            return {
                container: 'bg-white border-l-4 border-l-success-500',
                iconBg: 'bg-success-100',
                icon: CheckCircle,
                iconColor: 'text-success-600',
                textColor: 'text-success-800'
            };
        case 'error':
            return {
                container: 'bg-white border-l-4 border-l-danger-500',
                iconBg: 'bg-danger-100',
                icon: XCircle,
                iconColor: 'text-danger-600',
                textColor: 'text-danger-800'
            };
        case 'warning':
            return {
                container: 'bg-white border-l-4 border-l-warning-500',
                iconBg: 'bg-warning-100',
                icon: AlertTriangle,
                iconColor: 'text-warning-600',
                textColor: 'text-warning-800'
            };
        default:
            return {
                container: 'bg-white border-l-4 border-l-primary-500',
                iconBg: 'bg-primary-100',
                icon: Info,
                iconColor: 'text-primary-600',
                textColor: 'text-primary-800'
            };
    }
};

export const Toast: React.FC<ToastProps> = ({ message, type = 'info', onClose, duration = 4000 }) => {
    const styles = getToastStyles(type);
    const Icon = styles.icon;

    React.useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(onClose, duration);
            return () => clearTimeout(timer);
        }
    }, [duration, onClose]);

    return (
        <div className="fixed top-4 left-4 right-4 sm:right-auto sm:left-6 sm:max-w-md z-[9999] animate-slide-down">
            <div className={`
                ${styles.container}
                rounded-2xl shadow-card-lg p-4 
                flex items-start gap-3
                backdrop-blur-sm
            `}>
                <div className={`${styles.iconBg} p-2 rounded-xl shrink-0`}>
                    <Icon className={styles.iconColor} size={18} />
                </div>
                <p className={`${styles.textColor} font-semibold text-sm leading-relaxed flex-1 pt-0.5`}>
                    {message}
                </p>
                <button
                    onClick={onClose}
                    className="text-slate-400 hover:text-slate-600 transition shrink-0 p-1 -mt-1 -mr-1 rounded-lg hover:bg-slate-100"
                    aria-label="סגור"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
};

interface ConfirmModalProps {
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = 'אישור',
    cancelText = 'ביטול',
    isDestructive = false
}) => {
    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div
                className="modal-content max-w-sm mx-4"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 sm:p-8 text-center">
                    <div className={`
                        w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center
                        ${isDestructive ? 'bg-danger-100' : 'bg-warning-100'}
                    `}>
                        <AlertTriangle className={`w-8 h-8 ${isDestructive ? 'text-danger-600' : 'text-warning-600'}`} />
                    </div>

                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-3">{title}</h3>
                    <p className="text-slate-600 mb-8 leading-relaxed text-sm sm:text-base">{message}</p>

                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition text-sm sm:text-base"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={onConfirm}
                            className={`
                                flex-1 py-3 rounded-xl font-bold transition shadow-lg text-sm sm:text-base
                                ${isDestructive
                                    ? 'bg-danger-500 text-white hover:bg-danger-600 shadow-danger-500/20'
                                    : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20'
                                }
                            `}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
