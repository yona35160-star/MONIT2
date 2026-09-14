
import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Star, Send, Loader2, CheckCircle, AlertCircle, Home, MessageSquare } from 'lucide-react';
import { submitRating } from '../api/passengerApi';

export const RateRide: React.FC = () => {
    const [searchParams] = useSearchParams();
    const orderId = searchParams.get('orderId');

    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [comment, setComment] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (rating === 0) {
            setErrorMsg('נא לבחור דירוג (לפחות כוכב אחד).');
            setStatus('error');
            return;
        }
        setStatus('loading');
        setErrorMsg('');

        const res = await submitRating({
            orderId: orderId!,
            rating,
            comment
        });

        if (res.ok) {
            setStatus('success');
        } else {
            setStatus('error');
            setErrorMsg(res.error || 'שגיאה בשליחת הדירוג.');
        }
    };

    if (!orderId) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center text-center p-6 font-sans" dir="rtl">
                <div className="bg-white p-10 rounded-3xl shadow-lg border border-slate-100 max-w-sm w-full">
                    <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                        <AlertCircle className="text-red-500" size={28} />
                    </div>
                    <h2 className="text-xl font-black text-slate-800 mb-2">קישור שגוי</h2>
                    <p className="text-slate-400 text-sm mb-8 font-medium">מזהה ההזמנה חסר. לא ניתן לדרג נסיעה ללא קישור תקין.</p>
                    <Link to="/" className="btn-premium w-full block text-center py-4 rounded-2xl text-lg">
                        חזור לדף הבית
                    </Link>
                </div>
            </div>
        );
    }

    if (status === 'success') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans" dir="rtl">
                <div className="max-w-sm w-full text-center">
                    <div className="w-32 h-32 bg-gradient-to-br from-amber-300 to-amber-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-amber-200 ring-8 ring-amber-50">
                        <CheckCircle className="text-white drop-shadow-lg" size={52} strokeWidth={2.5} />
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">תודה!</h2>
                    <p className="text-slate-500 font-medium mb-10">המשוב שלך עוזר לנו להשתפר ולהציע שירות טוב יותר.</p>
                    <Link
                        to="/"
                        className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white font-black py-4 px-10 rounded-2xl shadow-xl hover:bg-slate-800 transition-all active:scale-95"
                    >
                        <Home size={20} />
                        חזור לדף הבית
                    </Link>
                </div>
            </div>
        );
    }

    const ratingLabels = ['', 'גרוע', 'לא טוב', 'בסדר', 'טוב', 'מצוין!'];
    const displayRating = hoverRating || rating;

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans" dir="rtl">
            <div className="max-w-md w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-gradient-to-br from-amber-300 to-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-xl shadow-amber-200 rotate-3">
                        <Star size={36} className="text-white drop-shadow" fill="white" strokeWidth={0} />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-1">דרג את הנסיעה</h1>
                    <p className="text-slate-400 font-medium text-sm">הזמנה <span className="font-mono font-black text-slate-600">#{orderId}</span></p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Star Rating Card */}
                    <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 text-center">
                        <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">איך הייתה הנסיעה?</p>
                        <div
                            className="flex justify-center gap-3 mb-5"
                            onMouseLeave={() => setHoverRating(0)}
                        >
                            {[1, 2, 3, 4, 5].map(star => (
                                <button
                                    key={star}
                                    type="button"
                                    onMouseEnter={() => setHoverRating(star)}
                                    onClick={() => setRating(star)}
                                    className="transition-all duration-150 hover:scale-125 active:scale-95"
                                >
                                    <Star
                                        size={44}
                                        className={`transition-colors duration-150 ${displayRating >= star
                                                ? 'text-amber-400 drop-shadow-[0_4px_8px_rgba(251,191,36,0.4)]'
                                                : 'text-slate-200'
                                            }`}
                                        fill={displayRating >= star ? 'currentColor' : 'none'}
                                        strokeWidth={displayRating >= star ? 0 : 2}
                                    />
                                </button>
                            ))}
                        </div>
                        {displayRating > 0 && (
                            <p className="text-amber-500 font-black text-lg animate-in fade-in duration-200">
                                {ratingLabels[displayRating]}
                            </p>
                        )}
                    </div>

                    {/* Comment Card */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                        <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                            <MessageSquare size={12} />
                            הערות נוספות (אופציונלי)
                        </label>
                        <textarea
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            placeholder="ספר לנו עוד על החוויה שלך..."
                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl h-28 focus:ring-4 focus:ring-amber-400/20 outline-none transition font-medium text-sm text-slate-700 resize-none placeholder:text-slate-300"
                        />
                    </div>

                    {status === 'error' && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm flex items-center gap-3 border border-red-100 font-bold">
                            <AlertCircle size={18} className="shrink-0" />
                            {errorMsg}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={status === 'loading' || rating === 0}
                        className={`w-full py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all duration-300 ${rating > 0
                                ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-slate-900 shadow-xl shadow-amber-200 hover:shadow-amber-300 hover:-translate-y-0.5 active:scale-95'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            } disabled:opacity-60`}
                    >
                        {status === 'loading'
                            ? <><Loader2 className="animate-spin" size={22} /> שולח...</>
                            : <><Send size={20} /> שלח דירוג</>
                        }
                    </button>

                    <Link to="/" className="block text-center py-3 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors">
                        דלג בינתיים
                    </Link>
                </form>
            </div>
        </div>
    );
};
