import React, { useState } from 'react';
import { sendToBackend } from '../api/adminApi';
import { Toast } from '../components/Toast';
import {
    Send, Image, MessageSquare, CheckCircle, XCircle, Loader2,
    Eye, Globe, Facebook, Youtube, AlertTriangle
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

type Platform = 'telegram' | 'facebook' | 'blogger' | 'gbusiness';

interface PlatformResult {
    ok: boolean;
    error?: string;
    postId?: string;
    messageId?: number;
    postName?: string;
    url?: string;
}

interface PublishResults {
    telegram?: PlatformResult;
    facebook?: PlatformResult;
    blogger?: PlatformResult;
    gbusiness?: PlatformResult;
}

// ── Platform config ────────────────────────────────────────────────────────

const PLATFORMS: { id: Platform; label: string; icon: React.ReactNode; color: string; maxChars: number }[] = [
    {
        id: 'telegram',
        label: 'Telegram',
        icon: <Send size={18} />,
        color: 'from-sky-500 to-sky-600',
        maxChars: 4096
    },
    {
        id: 'facebook',
        label: 'Facebook',
        icon: <Facebook size={18} />,
        color: 'from-blue-600 to-blue-700',
        maxChars: 63206
    },
    {
        id: 'blogger',
        label: 'Blogger',
        icon: <Globe size={18} />,
        color: 'from-orange-500 to-orange-600',
        maxChars: 0 // no limit
    },
    {
        id: 'gbusiness',
        label: 'Google Business',
        icon: <Youtube size={18} />,
        color: 'from-green-500 to-green-600',
        maxChars: 1500
    }
];

// ── Component ──────────────────────────────────────────────────────────────

export const AdminPublisher: React.FC = () => {
    const [text, setText] = useState('');
    const [caption, setCaption] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [targets, setTargets] = useState<Platform[]>(['telegram']);
    const [publishing, setPublishing] = useState(false);
    const [results, setResults] = useState<PublishResults | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    // ── Helpers ──────────────────────────────────────────────────────────────

    const toggleTarget = (p: Platform) => {
        setTargets(prev =>
            prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
        );
        setResults(null);
    };

    const activeCharsLimit = (): number => {
        const limits = targets
            .map(t => PLATFORMS.find(p => p.id === t)?.maxChars ?? 0)
            .filter(n => n > 0);
        return limits.length ? Math.min(...limits) : 0;
    };

    const limit = activeCharsLimit();

    const handlePublish = async () => {
        if (!text.trim()) {
            setToast({ message: 'נא להזין טקסט לפוסט', type: 'error' });
            return;
        }
        if (!targets.length) {
            setToast({ message: 'נא לבחור לפחות פלטפורמה אחת', type: 'error' });
            return;
        }

        setPublishing(true);
        setResults(null);

        const res = await sendToBackend<PublishResults>('publishPost', {
            text: text.trim(),
            imageUrl: imageUrl.trim() || undefined,
            caption: caption.trim() || undefined,
            targets
        });

        setPublishing(false);

        if (res.ok && res.data) {
            setResults(res.data);
            const allOk = Object.values(res.data).every(r => r.ok);
            setToast({
                message: allOk ? '✅ הפרסום הצליח בכל הפלטפורמות!' : '⚠️ חלק מהפרסומים נכשלו — בדוק את התוצאות',
                type: allOk ? 'success' : 'error'
            });
        } else {
            setToast({ message: 'שגיאה: ' + (res.error || 'לא ידועה'), type: 'error' });
        }
    };

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-[#0F172A] text-slate-100 p-4 md:p-8 font-sans" dir="rtl">
            <div className="max-w-3xl mx-auto space-y-6">

                {/* Header */}
                <header className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-purple-500/30">
                        📣
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white">מרכז פרסום שיווקי</h1>
                        <p className="text-slate-400 text-sm">כתוב פעם אחת — שגר לכל הפלטפורמות</p>
                    </div>
                </header>

                {/* Platform selector */}
                <section className="bg-[#1E293B] rounded-2xl p-5 border border-[#334155]">
                    <h2 className="text-sm font-bold text-slate-400 uppercase mb-4 tracking-wider">בחר פלטפורמות</h2>
                    <div className="flex flex-wrap gap-3">
                        {PLATFORMS.map(p => {
                            const selected = targets.includes(p.id);
                            return (
                                <button
                                    key={p.id}
                                    onClick={() => toggleTarget(p.id)}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border transition-all ${selected
                                            ? `bg-gradient-to-r ${p.color} border-transparent text-white shadow-md`
                                            : 'border-[#334155] text-slate-400 hover:border-slate-500 hover:text-slate-300 bg-transparent'
                                        }`}
                                >
                                    {p.icon}
                                    {p.label}
                                    {selected && (
                                        <span className="bg-white/20 w-5 h-5 rounded-full flex items-center justify-center text-xs">✓</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* Caption (Blogger title) */}
                <section className="bg-[#1E293B] rounded-2xl p-5 border border-[#334155] space-y-4">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">כותרת (Blogger)</h2>
                    <input
                        type="text"
                        placeholder='למשל: "מבצע קיץ — מוניות בן גוריון"'
                        value={caption}
                        onChange={e => setCaption(e.target.value)}
                        className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                    />
                </section>

                {/* Main post body */}
                <section className="bg-[#1E293B] rounded-2xl p-5 border border-[#334155] space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <MessageSquare size={16} /> טקסט הפוסט
                        </h2>
                        {limit > 0 && (
                            <span className={`text-xs font-mono ${text.length > limit ? 'text-red-400' : 'text-slate-500'}`}>
                                {text.length} / {limit} תווים
                            </span>
                        )}
                    </div>
                    <textarea
                        rows={8}
                        placeholder="כתוב את הפוסט כאן...&#10;&#10;טיפ: תמיכה ב-Markdown עבור Telegram (כוכביות להדגשה, קו תחתון להטיה)"
                        value={text}
                        onChange={e => { setText(e.target.value); setResults(null); }}
                        className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors resize-none leading-relaxed"
                    />
                    {limit > 0 && text.length > limit && (
                        <div className="flex items-center gap-2 text-red-400 text-sm">
                            <AlertTriangle size={16} />
                            <span>הטקסט ארוך מהמותר בפלטפורמה אחת מהנבחרות</span>
                        </div>
                    )}
                </section>

                {/* Image URL */}
                <section className="bg-[#1E293B] rounded-2xl p-5 border border-[#334155] space-y-3">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <Image size={16} /> קישור לתמונה (אופציונלי)
                    </h2>
                    <input
                        type="url"
                        placeholder="https://example.com/image.jpg"
                        value={imageUrl}
                        onChange={e => setImageUrl(e.target.value)}
                        className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors font-mono text-sm"
                        dir="ltr"
                    />
                    {imageUrl && (
                        <img
                            src={imageUrl}
                            alt="תצוגה מקדימה"
                            className="w-full max-h-48 object-cover rounded-xl border border-[#334155]"
                            onError={e => (e.currentTarget.style.display = 'none')}
                        />
                    )}
                </section>

                {/* Preview toggle */}
                {text && (
                    <section className="bg-[#1E293B] rounded-2xl border border-[#334155] overflow-hidden">
                        <button
                            onClick={() => setShowPreview(!showPreview)}
                            className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
                        >
                            <span className="flex items-center gap-2 font-bold text-slate-300 text-sm">
                                <Eye size={16} /> תצוגה מקדימה
                            </span>
                            <span className="text-slate-500 text-xs">{showPreview ? '▲ סגור' : '▼ פתח'}</span>
                        </button>
                        {showPreview && (
                            <div className="px-5 pb-5 grid gap-4 md:grid-cols-2">
                                {targets.map(t => {
                                    const platform = PLATFORMS.find(p => p.id === t)!;
                                    return (
                                        <div key={t} className="bg-[#0F172A] rounded-xl p-4 border border-[#334155]">
                                            <div className={`flex items-center gap-2 text-xs font-bold mb-3 bg-gradient-to-r ${platform.color} bg-clip-text text-transparent`}>
                                                {platform.icon} {platform.label}
                                            </div>
                                            {imageUrl && (
                                                <img
                                                    src={imageUrl}
                                                    alt=""
                                                    className="w-full h-24 object-cover rounded-lg mb-3"
                                                    onError={e => (e.currentTarget.style.display = 'none')}
                                                />
                                            )}
                                            {caption && t === 'blogger' && (
                                                <p className="font-bold text-white text-sm mb-1">{caption}</p>
                                            )}
                                            <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed line-clamp-6">{text}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                )}

                {/* Publish button */}
                <button
                    onClick={handlePublish}
                    disabled={publishing || !text.trim() || !targets.length}
                    className="w-full py-4 rounded-2xl font-black text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                    {publishing ? (
                        <>
                            <Loader2 className="animate-spin" size={22} />
                            מפרסם...
                        </>
                    ) : (
                        <>
                            <Send size={22} />
                            שגר פרסום ל-{targets.length} פלטפורמ{targets.length === 1 ? 'ה' : 'ות'}
                        </>
                    )}
                </button>

                {/* Results */}
                {results && (
                    <section className="bg-[#1E293B] rounded-2xl p-5 border border-[#334155] space-y-3">
                        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">תוצאות פרסום</h2>
                        <div className="space-y-2">
                            {Object.entries(results).map(([key, result]) => {
                                const platform = PLATFORMS.find(p => p.id === key);
                                return (
                                    <div
                                        key={key}
                                        className={`flex items-center gap-3 p-3 rounded-xl border ${result.ok ? 'border-green-500/30 bg-green-500/10' : 'border-red-500/30 bg-red-500/10'
                                            }`}
                                    >
                                        {result.ok ? (
                                            <CheckCircle className="text-green-400 shrink-0" size={20} />
                                        ) : (
                                            <XCircle className="text-red-400 shrink-0" size={20} />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-bold text-sm ${result.ok ? 'text-green-300' : 'text-red-300'}`}>
                                                {platform?.label || key}
                                            </p>
                                            {result.ok ? (
                                                <p className="text-xs text-slate-400">
                                                    {result.url ? (
                                                        <a href={result.url} target="_blank" rel="noreferrer" className="underline hover:text-slate-200">
                                                            צפה בפוסט ←
                                                        </a>
                                                    ) : (
                                                        'פורסם בהצלחה'
                                                    )}
                                                </p>
                                            ) : (
                                                <p className="text-xs text-red-400 truncate">{result.error}</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}
            </div>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};
