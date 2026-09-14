import React, { useState, useEffect } from 'react';
import { Activity, XCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { listenToSystemHealth } from '../services/firebase';

export const SystemStatusIndicator: React.FC = () => {
    const [status, setStatus] = useState<'ONLINE' | 'OFFLINE' | 'LOADING'>('LOADING');
    const [lastHeartbeat, setLastHeartbeat] = useState<string>('');

    useEffect(() => {
        // Real-time listener instead of polling
        const unsubscribe = listenToSystemHealth((data) => {
            if (data && data.online) {
                setStatus('ONLINE');
                setLastHeartbeat(data.last_heartbeat || new Date().toLocaleTimeString());
            } else {
                setStatus('OFFLINE');
            }
        });

        return () => unsubscribe();
    }, []);

    return (
        <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-full border border-slate-200 shadow-sm text-xs font-bold" title={`Last heartbeat: ${lastHeartbeat}`}>
            {status === 'LOADING' && <RefreshCw size={12} className="animate-spin text-slate-400" />}
            {status === 'ONLINE' && <CheckCircle size={12} className="text-green-500 animate-pulse" />}
            {status === 'OFFLINE' && <XCircle size={12} className="text-red-500" />}

            <span className={status === 'ONLINE' ? 'text-slate-700' : 'text-slate-400'}>
                {status === 'ONLINE' ? 'מערכת מחוברת' : status === 'OFFLINE' ? 'מערכת מנותקת' : 'מתחבר...'}
            </span>
        </div>
    );
};
