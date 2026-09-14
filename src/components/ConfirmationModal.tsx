import React from 'react';
import { AlertTriangle, CheckCircle, X, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info' | 'success';
    isLoading?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen, onClose, onConfirm, title, message,
    confirmText = 'אישור', cancelText = 'ביטול',
    type = 'warning', isLoading = false
}) => {
    if (!isOpen) return null;

    const colors = {
        danger: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
        warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
        info: 'bg-primary-500/10 text-primary-400 border border-primary-500/20',
        success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
    };

    const icons = {
        danger: AlertTriangle,
        warning: AlertTriangle,
        info: AlertTriangle,
        success: CheckCircle
    };

    const Icon = icons[type];

    return (
        <div className="fixed inset-0 bg-[#020617]/80 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="bg-[#1E293B] rounded-[2.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.6)] w-full max-w-md border border-white/5 overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-10 text-center">
                    <div className={`w-20 h-20 rounded-[1.5rem] mx-auto flex items-center justify-center mb-8 shadow-2xl ${colors[type]}`}>
                        <Icon size={36} />
                    </div>
                    <h3 className="text-2xl font-black text-white mb-3 tracking-tight">{title}</h3>
                    <p className="text-slate-400 font-medium leading-relaxed px-2">
                        {message}
                    </p>
                </div>

                <div className="p-8 pt-0 flex gap-4">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 px-6 rounded-2xl bg-white/5 text-slate-400 font-black hover:bg-white/10 hover:text-white transition-all border border-white/5"
                        disabled={isLoading}
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`flex-1 py-4 px-6 rounded-2xl font-black text-white transition-all shadow-xl shadow-primary-500/10 flex items-center justify-center gap-2 ${type === 'danger' ? 'bg-rose-600 hover:bg-rose-500' :
                            type === 'success' ? 'bg-emerald-600 hover:bg-emerald-500' :
                                'bg-primary-600 hover:bg-primary-500'
                            }`}
                    >
                        {isLoading && <Loader2 size={18} className="animate-spin" />}
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};
