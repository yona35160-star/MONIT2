import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, User, Phone, Car, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import { getPendingDrivers, approveDriver, rejectDriver } from '../api/adminApi';

interface PendingDriver {
    driver_id: string;
    driver_name: string;
    phone: string;
    vehicle_model?: string;
    vehicle_plate?: string;
    license_number?: string;
    created_at?: string;
}

interface PendingDriversPanelProps {
    /** Auth token for admin actions */
    authToken: string;
}

/**
 * MISSING-006 FIX: Admin panel section for approving/rejecting pending driver registrations.
 * Displayed inside the Admin Dashboard drivers section.
 */
export const PendingDriversPanel: React.FC<PendingDriversPanelProps> = ({ authToken }) => {
    const [drivers, setDrivers] = useState<PendingDriver[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

    const fetchPending = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getPendingDrivers({});
            if (res?.ok && res.data) {
                setDrivers(res.data.items || res.data || []);
                setLastRefresh(new Date());
            } else {
                setError(res?.error || 'שגיאה בטעינת נהגים ממתינים');
            }
        } catch (e: any) {
            console.error(e);
            setError('שגיאת תקשורת');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPending();
    }, [fetchPending]);

    const handleApprove = async (driverId: string) => {
        setActionLoading(driverId + '_approve');
        try {
            const res = await approveDriver({ driver_id: driverId });
            if (res?.ok) {
                setDrivers(prev => prev.filter(d => d.driver_id !== driverId));
            } else {
                setError(res?.error || 'שגיאה באישור נהג');
            }
        } catch (e: any) {
            setError('שגיאת תקשורת');
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (driverId: string) => {
        if (!window.confirm('האם לדחות ומחוק בקשה זו לצמיתות?')) return;
        setActionLoading(driverId + '_reject');
        try {
            const res = await rejectDriver({ driver_id: driverId, reason: 'Rejected by admin' });
            if (res?.ok) {
                setDrivers(prev => prev.filter(d => d.driver_id !== driverId));
            } else {
                setError(res?.error || 'שגיאה בדחיית נהג');
            }
        } catch (e: any) {
            setError('שגיאת תקשורת');
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) {
        return (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-center gap-3">
                <RefreshCw className="animate-spin text-amber-500" size={20} />
                <span className="text-amber-700 font-medium">טוען נהגים ממתינים לאישור...</span>
            </div>
        );
    }

    if (drivers.length === 0) {
        return (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 flex items-center gap-3">
                <CheckCircle className="text-emerald-500" size={20} />
                <span className="text-emerald-700 font-medium">אין נהגים ממתינים לאישור</span>
                <button onClick={fetchPending} className="mr-auto text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-1 transition">
                    <RefreshCw size={12} /> רענן
                </button>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden" dir="rtl">
            {/* Header */}
            <div className="bg-amber-500 text-white px-5 py-4 flex items-center gap-3">
                <Clock size={20} />
                <h3 className="font-black text-lg">נהגים ממתינים לאישור</h3>
                <span className="mr-auto bg-white/20 text-white text-sm font-black px-2.5 py-0.5 rounded-full">
                    {drivers.length}
                </span>
                <button
                    onClick={fetchPending}
                    title="רענן רשימה"
                    className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition"
                >
                    <RefreshCw size={15} />
                </button>
            </div>

            {error && (
                <div className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-red-600 text-sm">
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            {/* Driver List */}
            <div className="divide-y divide-amber-200/60">
                {drivers.map(driver => (
                    <div key={driver.driver_id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-4 bg-white hover:bg-amber-50/50 transition">
                        {/* Avatar */}
                        <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                            <User size={22} className="text-amber-600" />
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                            <p className="font-black text-slate-800 text-base truncate">{driver.driver_name || 'שם לא ידוע'}</p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                <span className="text-sm text-slate-500 flex items-center gap-1">
                                    <Phone size={12} /> {driver.phone || '—'}
                                </span>
                                {driver.vehicle_model && (
                                    <span className="text-sm text-slate-500 flex items-center gap-1">
                                        <Car size={12} /> {driver.vehicle_model}
                                        {driver.vehicle_plate ? ` (${driver.vehicle_plate})` : ''}
                                    </span>
                                )}
                                {driver.created_at && (
                                    <span className="text-xs text-slate-400">
                                        נרשם: {new Date(driver.created_at).toLocaleDateString('he-IL')}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 flex-shrink-0">
                            <button
                                onClick={() => handleApprove(driver.driver_id)}
                                disabled={actionLoading !== null}
                                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-black rounded-xl transition disabled:opacity-50"
                            >
                                {actionLoading === driver.driver_id + '_approve'
                                    ? <RefreshCw size={14} className="animate-spin" />
                                    : <CheckCircle size={14} />}
                                אשר
                            </button>
                            <button
                                onClick={() => handleReject(driver.driver_id)}
                                disabled={actionLoading !== null}
                                className="flex items-center gap-1.5 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-black rounded-xl transition disabled:opacity-50"
                            >
                                {actionLoading === driver.driver_id + '_reject'
                                    ? <RefreshCw size={14} className="animate-spin" />
                                    : <XCircle size={14} />}
                                דחה
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {lastRefresh && (
                <p className="text-center text-xs text-amber-600/60 py-2">
                    עודכן: {lastRefresh.toLocaleTimeString('he-IL')}
                </p>
            )}
        </div>
    );
};
