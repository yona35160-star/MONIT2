import React, { useState, useEffect } from 'react';
import { Zap, XCircle, RefreshCw, X, FolderOpen } from 'lucide-react';
import { Toast } from './Toast';
import { getSystemHealth, openBridgeFolder } from '../api/adminApi';

interface ServerStatusWidgetProps {
    serverSpot?: string;
    compact?: boolean;
}

export const ServerStatusWidget: React.FC<ServerStatusWidgetProps> = ({ serverSpot, compact }) => {
    const [status, setStatus] = useState<{ connected: boolean; qr: string | null; lastUpdate: string; userData?: any } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [showFolderInstructions, setShowFolderInstructions] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    const checkHealth = async (silent = true) => {
        if (!silent) setIsLoading(true);
        const res = await getSystemHealth();
        if (res.ok && res.data) {
            setStatus(res.data);
            if (res.data.qr && !res.data.connected) {
                setIsQrModalOpen(true);
                setShowFolderInstructions(false);
            } else {
                setIsQrModalOpen(false);
            }
            setError(null);
        } else {
            setStatus(null);
            setError(res.error || 'השרת לא זמין');
        }
        if (!silent) setIsLoading(false);
    };

    useEffect(() => {
        checkHealth();
        const interval = setInterval(() => checkHealth(true), 30000);
        return () => clearInterval(interval);
    }, []);

    const handleOpenFolder = async () => {
        const res = await openBridgeFolder();
        if (!res.ok) {
            setShowFolderInstructions(true);
        } else {
            setToast({ message: '📂 התיקייה נפתחה במחשב השרת!', type: 'success' });
        }
    };

    const handleStartLogic = () => {
        setShowFolderInstructions(true);
    };

    if (!status && !error && isLoading) return <div className="animate-pulse bg-gray-200 h-8 w-32 rounded-lg"></div>;

    return (
        <>
            <div className="flex items-center gap-3 bg-white p-2 pr-4 pl-2 rounded-xl shadow-sm border border-slate-100">
                <div className="flex flex-col items-end">
                    <span className="text-xs font-bold text-slate-500 uppercase">
                        {status?.userData?.name || status?.userData?.id?.split(':')[0] || 'סטטוס שרת'}
                    </span>
                    <div className="flex items-center gap-1.5">
                        {status?.connected ? (
                            <>
                                <span className="text-xs font-black text-green-600">מחובר (v{status.userData?.version || '220'})</span>
                                <span className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                </span>
                            </>
                        ) : (
                            <div
                                className="flex items-center gap-1 cursor-pointer group relative"
                                onClick={() => {
                                    if (status?.qr) setIsQrModalOpen(true);
                                    else setShowFolderInstructions(true);
                                }}
                            >
                                <div className="flex flex-col items-end">
                                    <span className="text-xs font-black text-red-500 flex items-center gap-1">
                                        {status?.qr ? 'התנתק - סרוק שוב' : (error ? 'שגיאת חיבור' : 'מנותק/כבוי')} <XCircle size={10} />
                                    </span>
                                    {error && (
                                        <span className="text-[10px] text-red-400 opacity-0 group-hover:opacity-100 transition-opacity absolute top-full right-0 mt-1 bg-white p-1 shadow border rounded whitespace-nowrap z-50">
                                            {(error.includes('Bridge Unreachable') || error.includes('הגשר המקומי לא מגיב') || error.includes('השרת לא זמין')) ? 'השרת לא זמין בכתובת המוגדרת' : error}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex gap-1">
                    <button
                        onClick={status?.connected ? handleOpenFolder : handleStartLogic}
                        className={`p-2 rounded-lg transition flex items-center justify-center ${status?.connected ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                        title={status?.connected ? "פתח תיקיית שרת" : "הוראות הפעלה (שרת כבוי)"}
                    >
                        {status?.connected ? <FolderOpen size={14} /> : <Zap size={14} />}
                    </button>

                    {status?.qr && !status.connected && (
                        <button onClick={() => setIsQrModalOpen(true)} className="p-2 bg-yellow-100 text-yellow-700 rounded-lg animate-pulse">
                            <RefreshCw size={14} />
                        </button>
                    )}
                </div>
            </div>

            {isQrModalOpen && status?.qr && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center backdrop-blur-sm p-2 sm:p-4">
                    <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative">
                        <button onClick={() => setIsQrModalOpen(false)} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X size={20} /></button>
                        <div className="p-8 flex flex-col items-center">
                            <h2 className="text-2xl font-black text-slate-900 mb-2">סריקת חיבור לוואטסאפ</h2>
                            <p className="text-gray-500 mb-6 text-center text-sm">פתח את הוואטסאפ בטלפון &gt; הגדרות &gt; מכשירים מקושרים &gt; קישור מכשיר</p>
                            <div className="p-4 bg-white border-2 border-slate-100 rounded-2xl shadow-inner">
                                <img src={status.qr} alt="Scan QR" className="w-64 h-64 object-contain mix-blend-multiply" />
                            </div>
                            <p className="mt-6 text-xs text-gray-400 font-mono">Server v220 • Secure Tunnel</p>
                        </div>
                    </div>
                </div>
            )}

            {showFolderInstructions && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold flex items-center gap-2"><Zap className="text-yellow-500" /> הפעלת השרת</h3>
                            <button onClick={() => setShowFolderInstructions(false)}><X className="text-gray-400" /></button>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <p className="font-bold text-blue-800 mb-1">השרת כבוי כרגע.</p>
                                <p className="text-sm text-blue-600">הדפדפן לא יכול להפעיל קבצים במחשב שלך באופן ישיר כאשר השרת כבוי.</p>
                            </div>

                            <ol className="list-decimal list-inside space-y-2 text-gray-700 text-sm">
                                <li>גש למחשב הראשי.</li>
                                <li>פתח את התיקייה: <span dir="ltr" className="font-mono bg-gray-100 px-2 rounded select-all cursor-pointer hover:bg-gray-200" onClick={(e) => {
                                    const path = serverSpot || 'f:\\AVODOT\\TAXI-WORK\\whatsapp-taxi-bridge';
                                    navigator.clipboard.writeText(path);
                                    (e.target as HTMLElement).innerText = 'הועתק!';
                                    setTimeout(() => (e.target as HTMLElement).innerText = path, 1500);
                                }}>{serverSpot || 'f:\\AVODOT\\TAXI-WORK\\whatsapp-taxi-bridge'}</span> (לחץ להעתקה)</li>
                                <li>הפעל את <b>restart.bat</b></li>
                            </ol>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button onClick={() => setShowFolderInstructions(false)} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold">הבנתי, סוגר</button>
                        </div>
                    </div>
                </div>
            )}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </>
    );
};
