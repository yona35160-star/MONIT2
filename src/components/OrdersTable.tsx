import { useState } from 'react';
import { Pencil, CheckCircle, Clock, Check, MapPin, User, Phone, Car, DollarSign } from 'lucide-react';
import { Order } from '../types';
import { Toast } from './Toast';
import { markPaymentCompleted } from '../api/adminApi';
import { TableSkeleton } from './Skeleton';
import { ConfirmationModal } from './ConfirmationModal';
import { SwipeCard } from './SwipeCard';
import { getStatusConfig } from '../utils/statusConfig';

interface OrdersTableProps {
    orders: Order[];
    isLoading: boolean;
    onEdit: (orderId: string) => void;
    onRefresh: () => void;
    stationPaymentPhone?: string;
    messageStatuses?: Record<string, Record<string, any>>;
}

export const OrdersTable: React.FC<OrdersTableProps> = ({ orders, isLoading, onEdit, onRefresh, stationPaymentPhone, messageStatuses = {} }) => {
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [optimisticCompletedIds, setOptimisticCompletedIds] = useState<Set<string>>(new Set());
    const [confirmModalOrder, setConfirmModalOrder] = useState<Order | null>(null);

    const isPaymentEnabled = !!stationPaymentPhone;

    const handleConfirmPayment = async () => {
        if (!confirmModalOrder) return;
        const orderId = confirmModalOrder.orderId;

        setOptimisticCompletedIds(prev => new Set(prev).add(orderId));
        setConfirmModalOrder(null);

        try {
            const res = await markPaymentCompleted({ orderId, phone: stationPaymentPhone || '' });
            if (res.ok) {
                setToast({ message: 'התשלום אושר בהצלחה!', type: 'success' });
                if (onRefresh) onRefresh();
            } else {
                setOptimisticCompletedIds(prev => {
                    const next = new Set(prev);
                    next.delete(orderId);
                    return next;
                });
                setToast({ message: 'שגיאה באישור התשלום: ' + res.error, type: 'error' });
                if (onRefresh) onRefresh();
            }
        } catch (err) {
            setOptimisticCompletedIds(prev => {
                const next = new Set(prev);
                next.delete(orderId);
                return next;
            });
            setToast({ message: 'שגיאה: ' + (err as Error).message, type: 'error' });
            if (onRefresh) onRefresh();
        }
    };

    const isPaymentCompleted = (order: Order) => {
        if (optimisticCompletedIds.has(order.orderId)) return true;
        const val = String(order.paymentCompleted || '').toLowerCase();
        return val === 'true' || val === '1' || val === 'yes';
    };

    const getMessageStatus = (orderId: string, method: 'whatsapp' | 'telegram') => {
        const orderMsgs = messageStatuses[orderId];
        if (!orderMsgs) return null;

        const msgs = Object.values(orderMsgs).filter(m => m.method === method);
        if (msgs.length === 0) return null;

        // Sort by timestamp if available, find latest
        const latest = msgs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];
        return latest.status;
    };

    const renderMessageIcon = (orderId: string, method: 'whatsapp' | 'telegram') => {
        const status = getMessageStatus(orderId, method);
        if (!status) return null;

        const isWA = method === 'whatsapp';
        const colorClass =
            status === 'sent' ? 'text-blue-500' :
                status === 'delivered' ? 'text-emerald-500' :
                    status === 'read' ? 'text-cyan-500' :
                        (status.includes('fail') || status === 'exception' || status.startsWith('http_')) ? 'text-rose-500' :
                            'text-slate-400';

        return (
            <div className={`flex items-center gap-0.5 ${colorClass}`} title={`${method}: ${status}`}>
                {isWA ? (
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.019-.962-.262-.095-.453-.141-.642.141-.189.282-.733.918-.899 1.107-.166.19-.333.21-.63.061-1.218-.61-2.071-.989-2.887-2.396-.289-.5-.102-.771.048-.92.136-.134.303-.353.454-.53.151-.177.202-.303.303-.505.101-.202.051-.371-.025-.521-.076-.15-.642-1.546-.879-2.112-.232-.56-.47-.482-.642-.491-.166-.007-.356-.008-.545-.008-.19 0-.5.071-.762.353-.262.282-1 0.978-1 2.384 0 1.406 1.025 2.768 1.168 2.955.143.187 2.018 3.082 4.889 4.319.684.295 1.219.471 1.636.604.686.218 1.31.187 1.804.114.55-.082 1.758-.718 2.006-1.412.248-.694.248-1.289.173-1.412-.074-.123-.274-.195-.573-.344zM12.004 20.128l-.003.001s-1.052 0-1.052 0c-1.323 0-2.613-.352-3.741-1.016l-2.684.704.717-2.618c-.732-1.27-1.118-2.72-1.118-4.195 0-4.407 3.585-7.993 7.993-7.993 2.135 0 4.142.831 5.65 2.339 1.508 1.508 2.339 3.515 2.339 5.65 0 4.408-3.586 7.994-7.994 7.994zm8.851-14.152C18.995 4.116 16.53 3 13.918 3c-5.115 0-9.278 4.162-9.278 9.278 0 1.635.427 3.23 1.238 4.637L3 22l5.36-.14c1.338.73 2.846 1.114 4.375 1.115h.004c5.115 0 9.278-4.162 9.278-9.278 0-2.48-.963-4.807-2.712-6.556v-.004z" /></svg>
                ) : (
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.69-.52.35-.99.53-1.41.52-.46-.01-1.32-.26-1.97-.48-.8-.26-1.43-.4-1.38-.85.03-.24.36-.48.98-.71 3.84-1.67 6.4-2.77 7.68-3.3 3.65-1.5 4.41-1.76 4.9-1.77.11 0 .35.03.5.15.13.12.17.27.18.39.01.1.01.21 0 .31z" /></svg>
                )}
                {status === 'delivered' && <span className="text-[8px] font-bold">✓✓</span>}
                {status === 'sent' && <span className="text-[8px] font-bold">✓</span>}
                {status === 'read' && <span className="text-[8px] font-bold">👀</span>}
                {(status.includes('fail') || status === 'exception') && <span className="text-[8px] font-bold">!</span>}
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="card p-4">
                <TableSkeleton rows={5} cols={8} />
            </div>
        );
    }

    return (
        <>
            <div className="hidden lg:block overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right border-collapse">
                        <thead>
                            <tr className="bg-[#1E293B] border-b border-white/5">
                                <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">מזהה</th>
                                <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">לקוח</th>
                                <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">איסוף</th>
                                <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">יעד</th>
                                <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">מחיר</th>
                                <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">נהג</th>
                                <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">סטטוס</th>
                                <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">ניהול</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {orders.map((order) => {
                                const completed = isPaymentCompleted(order);
                                const rawPayment = String(order.paymentCompleted || '').toLowerCase();
                                const waiting = (rawPayment === 'waiting_approval' || order.status === 'waiting_approval') && !completed;
                                const statusConfig = getStatusConfig(order.status);

                                return (
                                    <tr key={order.orderId} className={`transition-colors hover:bg-white/[0.02] ${completed ? 'bg-indigo-500/5' : ''}`}>
                                        <td className="px-6 py-6 font-mono text-xs">
                                            <div className="flex flex-col gap-2">
                                                <span className="text-slate-400 font-black" dir="ltr">#{order.orderId}</span>
                                                <div className="flex gap-2">
                                                    {renderMessageIcon(order.orderId, 'whatsapp')}
                                                    {renderMessageIcon(order.orderId, 'telegram')}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 font-black text-white text-base">{order.customerName}</td>
                                        <td className="px-6 py-6">
                                            <div className="line-clamp-1 max-w-[200px] text-slate-300 font-medium" title={order.pickupAddress}>{order.pickupAddress}</div>
                                            {order.pickupExactAddress && <div className="text-[10px] text-slate-500 font-black mt-1 uppercase tracking-wider line-clamp-1">{order.pickupExactAddress}</div>}
                                        </td>
                                        <td className="px-6 py-6">
                                            <div className="line-clamp-1 max-w-[200px] text-slate-300 font-medium" title={order.destinationAddress}>{order.destinationAddress}</div>
                                            {order.destinationExactAddress && <div className="text-[10px] text-slate-500 font-black mt-1 uppercase tracking-wider line-clamp-1">{order.destinationExactAddress}</div>}
                                        </td>
                                        <td className="px-6 py-6 font-black text-white">
                                            <div className="flex flex-col items-end gap-2">
                                                <span className="text-lg">₪{order.price}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${completed ? 'bg-emerald-500/20 text-emerald-400' : waiting ? 'bg-amber-500/20 text-amber-400 animate-pulse' : 'bg-slate-800 text-slate-500'}`}>
                                                    {completed ? 'שולם' : waiting ? 'ממתין לאישור' : 'לא שולם'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 text-slate-400 font-black">{order.driverName || '-'}</td>
                                        <td className="px-6 py-6">
                                            <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] border border-white/5 ${statusConfig.bg} ${statusConfig.text}`}>
                                                {statusConfig.pulse && <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot || 'bg-current'} animate-pulse`} />}
                                                {statusConfig.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-6">
                                            <div className="flex gap-3 justify-end items-center">
                                                <button onClick={() => onEdit(order.orderId)} className="w-10 h-10 flex items-center justify-center bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white rounded-xl transition-all" title="עריכה">
                                                    <Pencil size={18} />
                                                </button>
                                                {!completed && isPaymentEnabled && (
                                                    <button
                                                        onClick={() => setConfirmModalOrder(order)}
                                                        className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all shadow-xl ${waiting ? 'bg-amber-500 text-slate-900 animate-pulse' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white'}`}
                                                        title={waiting ? 'אשר בקשה דחופה' : 'אישור תשלום'}
                                                    >
                                                        <CheckCircle size={18} />
                                                    </button>
                                                )}
                                                {completed && <div className="w-10 h-10 flex items-center justify-center text-indigo-400 bg-indigo-500/10 rounded-xl"><Check size={20} /></div>}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="lg:hidden space-y-5 px-4 pb-12">
                {orders.map((order) => {
                    const completed = isPaymentCompleted(order);
                    const rawPayment = String(order.paymentCompleted || '').toLowerCase();
                    const waiting = (rawPayment === 'waiting_approval' || order.status === 'waiting_approval') && !completed;
                    const statusConfig = getStatusConfig(order.status);

                    return (
                        <SwipeCard
                            key={order.orderId}
                            onSwipeRight={() => onEdit(order.orderId)}
                            rightActionText="ניהול נסיעה"
                            className={`mb-4 relative overflow-hidden ${completed ? 'border-indigo-500/20' : ''}`}
                        >
                            <div className={`p-8 bg-[#1E293B] rounded-[2.5rem] border border-white/5 ${completed ? 'bg-indigo-500/5' : ''}`}>
                                {/* Card Header */}
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono text-xs text-slate-500 font-black" dir="ltr">#{order.orderId}</span>
                                            <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/5 ${statusConfig.bg} ${statusConfig.text}`}>
                                                {statusConfig.pulse && <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot || 'bg-current'} animate-pulse`} />}
                                                {statusConfig.label}
                                            </span>
                                        </div>
                                        <div className="flex gap-3">
                                            {renderMessageIcon(order.orderId, 'whatsapp')}
                                            {renderMessageIcon(order.orderId, 'telegram')}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-black text-white">₪{order.price}</p>
                                        <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${completed ? 'text-emerald-400' : waiting ? 'text-amber-400' : 'text-slate-600'}`}>
                                            {completed ? 'שולם' : waiting ? 'ממתין לאישור' : 'לא שולם'}
                                        </p>
                                    </div>
                                </div>

                                {/* Customer & Route */}
                                <div className="space-y-6 mb-10">
                                    <div className="flex items-center gap-5">
                                        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-slate-300">
                                            <User size={22} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">פרטי לקוח</p>
                                            <h4 className="text-lg font-black text-white">{order.customerName}</h4>
                                        </div>
                                    </div>

                                    <div className="relative pr-6">
                                        <div className="absolute right-0 top-2 bottom-2 w-0.5 bg-white/5 rounded-full"></div>
                                        <div className="space-y-8">
                                            <div className="relative">
                                                <div className="absolute -right-[27px] top-1 w-3 h-3 bg-emerald-500 rounded-full border-4 border-[#1E293B] z-10"></div>
                                                <div>
                                                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">נקודת איסוף</p>
                                                    <p className="text-sm font-bold text-slate-200 line-clamp-1">{order.pickupAddress}</p>
                                                </div>
                                            </div>
                                            <div className="relative">
                                                <div className="absolute -right-[27px] top-1 w-3 h-3 bg-rose-500 rounded-full border-4 border-[#1E293B] z-10"></div>
                                                <div>
                                                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">יעד נסיעה</p>
                                                    <p className="text-sm font-bold text-slate-200 line-clamp-1">{order.destinationAddress}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Action HUD */}
                                <div className="flex gap-4 pt-6 border-t border-white/5">
                                    <button onClick={() => onEdit(order.orderId)} className="flex-1 bg-white/5 hover:bg-white/10 text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all border border-white/5">
                                        <Pencil size={18} /> ניהול
                                    </button>
                                    {!completed && isPaymentEnabled && (
                                        <button
                                            onClick={() => setConfirmModalOrder(order)}
                                            className={`flex-1 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all shadow-2xl ${waiting
                                                ? 'bg-amber-500 text-slate-900 shadow-amber-500/20'
                                                : 'bg-indigo-600 text-white shadow-indigo-600/20'
                                                }`}
                                        >
                                            <CheckCircle size={18} /> {waiting ? 'אשר תשלום' : 'אישור'}
                                        </button>
                                    )}
                                    {completed && (
                                        <div className="flex-1 flex items-center justify-center gap-3 py-4 text-emerald-400 bg-emerald-500/10 rounded-2xl font-black text-sm border border-emerald-500/20">
                                            <CheckCircle size={18} /> שולם נטו
                                        </div>
                                    )}
                                </div>
                            </div>
                        </SwipeCard>
                    );
                })}
            </div>

            <ConfirmationModal
                isOpen={!!confirmModalOrder}
                onClose={() => setConfirmModalOrder(null)}
                onConfirm={handleConfirmPayment}
                title="אישור תשלום עמלה"
                message={`האם אתה בטוח שברצונך לאשר תשלום עמלה ${confirmModalOrder?.price ? `על סך ${confirmModalOrder?.price} ₪` : ''} עבור הזמנה ${confirmModalOrder?.orderId}?`}
                type="success"
                confirmText="אשר תשלום"
            />

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </>
    );
};
