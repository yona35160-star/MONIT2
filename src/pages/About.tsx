import React from 'react';
import { SeoMeta } from '../components/SeoMeta';
import { Shield, Target, Users, Award, MapPin, PhoneCall, CheckCircle, Car, Clock, Star, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const About: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="bg-slate-50 min-h-screen font-sans pb-16" dir="rtl">
            <SeoMeta
                title="אודות TAXIPRO | פלטפורמת התחבורה האמינה בישראל"
                description="הכירו את המערכת הטכנולוגית שמאחורי רשת המוניות החכמה TAXIPRO. נהגים מורשים, שקיפות במחיר, ואפליקציה מתקדמת לנוסע הישראלי ולתייר."
                canonicalUrl="https://taxi-pro-il.netlify.app/about"
                schemaData={{
                    "@type": "AboutPage",
                    "@id": "https://taxi-pro-il.netlify.app/about#webpage",
                    "mainEntity": {
                        "@type": "Organization",
                        "name": "TAXIPRO Israel",
                        "foundingDate": "2024",
                        "areaServed": "IL",
                        "description": "רשת חכמה המחברת נוסעים לנהגי מוניות מורשים עם הצעות מחיר שקופות וטכנולוגיה בזמן אמת."
                    }
                }}
            />

            {/* Hero Section */}
            <div className="relative bg-slate-900 text-white py-20 overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -ml-20 -mb-20"></div>

                <div className="container mx-auto px-4 relative z-10 text-center">
                    <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full mb-6 backdrop-blur-sm border border-white/10">
                        <Star className="text-amber-400 w-4 h-4 fill-current" />
                        <span className="text-sm font-bold tracking-wide text-amber-50">מובילים את מהפכת התחבורה בישראל</span>
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black mb-6 leading-tight">
                        הקצב של העיר <span className="text-amber-400">שלך</span>.<br />האחריות <span className="text-blue-400">שלנו</span>.
                    </h1>
                    <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed font-medium">
                        TAXIPRO הינה פלטפורמה טכנולוגית מתקדמת (Made in Israel) שנבנתה מתוך צורך עמוק לשקיפות, זמינות והוגנות בענף ההיסעים הארצי לחווית נסיעה אמינה ברמה אחרת.
                    </p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 mt-8 space-y-12 relative z-20">
                
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 -mt-16">
                    {[
                        { label: 'נהגים מורשים', value: '500+', icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
                        { label: 'נסיעות בחודש', value: '50k+', icon: Car, color: 'text-amber-600', bg: 'bg-amber-100' },
                        { label: 'ערים ושכונות', value: '40+', icon: MapPin, color: 'text-emerald-600', bg: 'bg-emerald-100' },
                        { label: 'זמינות ויחס אישי', value: '24/7', icon: Clock, color: 'text-red-600', bg: 'bg-red-100' },
                    ].map((stat, idx) => (
                        <div key={idx} className="bg-white p-6 rounded-2xl shadow-xl shadow-slate-200 border border-slate-100 flex flex-col items-center text-center transform hover:-translate-y-1 transition duration-300">
                            <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center font-black mb-4 shadow-sm`}>
                                <stat.icon size={24} />
                            </div>
                            <h3 className="text-3xl font-black text-slate-900 mb-1">{stat.value}</h3>
                            <p className="text-sm text-slate-500 font-medium">{stat.label}</p>
                        </div>
                    ))}
                </div>

                {/* E-E-A-T Cards (Experience, Expertise, Authoritativeness, Trustworthiness) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
                    {/* Trust Card */}
                    <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 hover:border-blue-200 transition-colors">
                        <div className="w-14 h-14 bg-emerald-100 flex items-center justify-center rounded-2xl mb-6">
                            <CheckCircle size={28} className="text-emerald-600" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 mb-3">ביטחון ואמון (Trust)</h3>
                        <p className="text-slate-600 leading-relaxed text-sm font-medium">
                            כלל חברי הרשת עוברים פרופיילינג וסינון אנושי. אנו מקפידים על חוקי התעבורה, הפעלת מונה ציבורי לפי התקן ונהגים מורשים בלבד (בעלי מספר ירוק). לנוסע יש יומן מפורט של זהות הנהג לכל צורך כדי להבטיח את הסטנדרט העליון.
                        </p>
                    </div>

                    {/* Expertise Card */}
                    <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 hover:border-blue-200 transition-colors">
                        <div className="w-14 h-14 bg-blue-100 flex items-center justify-center rounded-2xl mb-6">
                            <Target size={28} className="text-blue-600" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 mb-3">דיוק ומומחיות (Expertise)</h3>
                        <p className="text-slate-600 leading-relaxed text-sm font-medium">
                            באמצעות אלגוריתמי מפות (Google API) ומערכת תמריצים מובנית (Bidding) חדשנית, האפליקציה מחשבת מרחק, עומסי תנועה ולוגיסטיקה, כך שתקבל את הנהג הפנוי הקרוב ביותר עם מינימום חיכוך וזמני המתנה קצרים במיוחד.
                        </p>
                    </div>
                </div>

                {/* Real Data & Numbers Section for E-E-A-T Trust */}
                <div className="bg-slate-900 text-white rounded-[3rem] p-10 md:p-16 mb-24 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 blur-[100px] rounded-full"></div>
                    <div className="relative z-10 grid md:grid-cols-3 gap-12 text-center">
                        <div className="space-y-2">
                            <p className="text-4xl md:text-5xl lg:text-6xl font-black text-amber-400">12,500+</p>
                            <p className="text-slate-400 font-bold uppercase tracking-wider text-xs sm:text-sm">נסיעות חודשיות במערכת</p>
                            <div className="h-1 w-12 bg-amber-500/30 mx-auto mt-4 rounded-full"></div>
                        </div>
                        <div className="space-y-2">
                            <p className="text-4xl md:text-5xl lg:text-6xl font-black text-amber-400">4.88 / 5</p>
                            <p className="text-slate-400 font-bold uppercase tracking-wider text-xs sm:text-sm">דירוג נהגים ממוצע (YTD)</p>
                            <div className="h-1 w-12 bg-amber-500/30 mx-auto mt-4 rounded-full"></div>
                        </div>
                        <div className="space-y-2">
                            <p className="text-4xl md:text-5xl lg:text-6xl font-black text-amber-400">32</p>
                            <p className="text-slate-400 font-bold uppercase tracking-wider text-xs sm:text-sm">ערים ומושבים בפריסה ארצית</p>
                            <div className="h-1 w-12 bg-amber-500/30 mx-auto mt-4 rounded-full"></div>
                        </div>
                    </div>
                </div>

                {/* Company Story / Text content for AI Crawlers */}
                <div className="bg-white p-8 sm:p-12 rounded-[3rem] shadow-sm border border-slate-100 relative overflow-hidden">
                    <div className="absolute -top-24 -left-24 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl" />
                    <div className="relative z-10">
                        <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
                            <Award size={24} className="text-amber-500" /> החזון שלנו (2026 ואילך)
                        </h2>
                        <div className="space-y-4 text-slate-600 text-sm sm:text-base font-medium leading-loose">
                            <p>
                                ענף המוניות היה זקוק לעדכון גרסה. שוק ההיסעים בישראל מרובה בחברות פרטיות, אך מעטות מספקות שליטה חיה גם לנוסע וגם לנהג. אנחנו ב-TAXIPRO דוגלים בהשמת הכוח חזרה לידיים של המשתמש.
                            </p>
                            <p>
                                <strong>טכנולוגיית חיבור חכמה:</strong> באמצעות מודל עדיפויות חדש, יצרנו אקו-סיסטם מאוזן בו מחיר הבסיס שקוף מלכתחילה, אך הנוסע גם יכול לבחור לתת "תמריץ" התחלתי בשעות העומס או בימי גשם, מה שמרפא אוטומטית בעיות זמינות לנתב"ג ולכרך המרכזי.
                            </p>
                            <p>
                                אנו גאים להוביל אוקיינוס כחול חדש של שירות ואמינות בענף ההיסעים המסורתי. נשמח לעמוד לשירותך בנסיעה הבאה שלך.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Contact Area short */}
                <div className="flex flex-wrap items-center justify-center gap-4 text-sm font-bold text-slate-500 pb-12">
                    <span className="flex items-center gap-1.5 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100"><MapPin size={16} className="text-blue-500" /> תל אביב יפו, ישראל</span>
                    <span className="flex items-center gap-1.5 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100"><Shield size={16} className="text-emerald-500" /> בעלי דרכון זיהוי ושירות אדיב</span>
                </div>

                <div className="text-center sticky bottom-6 w-full pointer-events-none z-50">
                    <button onClick={() => navigate(-1)} className="pointer-events-auto bg-slate-900/90 backdrop-blur-md hover:bg-slate-900 text-white px-6 py-3 rounded-full shadow-lg border border-slate-800 font-bold text-sm flex items-center gap-2 mx-auto transition">
                        <ArrowLeft size={16} /> חזרה אחורה
                    </button>
                </div>
            </div>
        </div>
    );
};
