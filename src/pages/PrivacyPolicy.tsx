
import React from 'react';
import { Shield, CheckCircle, AlertTriangle, ArrowRight, X, FileText, Ban, Scale, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const PrivacyPolicy: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans" dir="rtl">
            <div className="max-w-4xl mx-auto bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-gray-100">

                {/* Header */}
                <div className="bg-slate-900 p-12 text-white text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-yellow-400/10 rounded-full blur-3xl -ml-16 -mb-16"></div>

                    <div className="relative z-10">
                        <div className="w-20 h-20 bg-yellow-400 rounded-2xl flex items-center justify-center mx-auto mb-6 text-slate-900 shadow-lg transform rotate-3">
                            <Scale size={40} />
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black mb-3">תנאי שימוש ומדיניות פרטיות</h1>
                        <p className="text-slate-400 text-sm md:text-base max-w-lg mx-auto">
                            מסמך זה מהווה הסכם משפטי מחייב בין הנהג/המשתמש לבין חברת Taxi Express. אנא קרא בעיון.
                        </p>
                    </div>
                </div>

                <div className="p-8 md:p-12 space-y-10 text-gray-700 leading-relaxed text-right">

                    {/* Section 1: Introduction */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                            <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-black">1</span>
                            מבוא והסכמה לתנאים
                        </h2>
                        <div className="pr-11">
                            <p className="mb-3">
                                מערכת Taxi Express משמשת כפלטפורמה טכנולוגית לקישור בין נהגי מוניות מורשים לבין נוסעים. השימוש באפליקציה, באתר או בבוט הטלגרם מהווה הסכמה מלאה, בלתי מסויגת ובלתי הפיכה לכל התנאים המפורטים במסמך זה.
                            </p>
                            <p className="text-sm bg-blue-50 p-4 rounded-xl border border-blue-100 text-blue-800">
                                <strong>שים לב:</strong> אם אינך מסכים לאחד או יותר מהתנאים, עליך לחדול מיד משימוש במערכת.
                            </p>
                        </div>
                    </section>

                    {/* Section 2: Commission & Payments */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                            <span className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center text-sm font-black">2</span>
                            מדיניות תשלומים ועמלות
                        </h2>
                        <div className="pr-11 space-y-4">
                            <div className="bg-yellow-50 p-6 rounded-2xl border border-yellow-100 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-2 h-full bg-yellow-400"></div>
                                <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                                    <AlertTriangle size={18} className="text-yellow-600" />
                                    חובת תשלום עמלה
                                </h3>
                                <p className="mb-3 font-medium text-slate-800">
                                    נהג המקבל הזמנה דרך המערכת מתחייב לשלם "דמי תיווך" (להלן: "עמלה") עבור כל נסיעה שבוצעה.
                                </p>
                                <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
                                    <li>גובה העמלה נקבע מראש ומוצג לנהג לפני או עם קבלת פרטי הנסיעה.</li>
                                    <li>חובה להעביר את תשלום העמלה בתוך זמן סביר (עד 24 שעות) מסיום הנסיעה.</li>
                                    <li>המערכת תומכת בתשלום באמצעות: Bit, Paybox, PayPal וכרטיסי אשראי.</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* Section 3: Refunds & Cancellations */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                            <span className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-sm font-black">3</span>
                            מדיניות ביטולים והחזרים (Refund Policy)
                        </h2>
                        <div className="pr-11 space-y-4">
                            <p>מדיניות ההחזרים של Taxi Express היא קפדנית וברורה למניעת ניצול לרעה:</p>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="border border-slate-200 p-4 rounded-xl">
                                    <div className="flex items-center gap-2 mb-2 text-red-600 font-bold text-sm">
                                        <Ban size={16} /> אין החזר על נסיעה שבוצעה
                                    </div>
                                    <p className="text-xs text-slate-500">עמלה ששולמה עבור נסיעה שהושלמה בהצלחה (הנוסע הגיע ליעדו ושילם לנהג) אינה ניתנת להחזר בשום מקרה.</p>
                                </div>

                                <div className="border border-slate-200 p-4 rounded-xl">
                                    <div className="flex items-center gap-2 mb-2 text-green-600 font-bold text-sm">
                                        <CheckCircle size={16} /> ביטול מוצדק
                                    </div>
                                    <p className="text-xs text-slate-500">במקרה של "ביטול פרש" (נוסע לא הגיע / ביטל ברגע האחרון), הנהג זכאי לזיכוי העמלה בחשבונו לנסיעה הבאה, בכפוף להצגת הוכחות (צילום מסך שיחה/מיקום).</p>
                                </div>
                            </div>

                            <p className="text-sm text-slate-500 italic mt-2">
                                * כל בקשה להחזר כספי תיבחן לגופה תוך 7 ימי עסקים. החלטת הנהלת התחנה הינה סופית.
                            </p>
                        </div>
                    </section>

                    {/* Section 4: Privacy */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                            <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-black">4</span>
                            פרטיות ואבטחת מידע
                        </h2>
                        <div className="pr-11">
                            <p className="mb-3">
                                אנו מכבדים את פרטיותך ופועלים בהתאם לחוק הגנת הפרטיות. המידע הנאסף (שם, טלפון, מיקום GPS, היסטוריית נסיעות) משמש אך ורק לצורך תפעול השירות, שיפור השירות והתחשבנות כספית.
                            </p>
                            <p className="text-sm text-slate-600">
                                המערכת אינה מעבירה את פרטיך לצד שלישי ללא הסכמתך, למעט במקרים של דרישה חוקית (צו בית משפט / משטרה).
                            </p>
                        </div>
                    </section>

                    {/* Section 5: Driver Responsibilities */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                            <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-black">5</span>
                            אחריות הנהג
                        </h2>
                        <div className="pr-11">
                            <ul className="space-y-3 text-sm">
                                <li className="flex items-start gap-2">
                                    <CheckCircle size={16} className="text-green-500 mt-0.5 shrink-0" />
                                    <span>הנהג מתחייב להחזיק בכל הרישיונות, הביטוחים וההיתרים הנדרשים כחוק להפעלת מונית.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle size={16} className="text-green-500 mt-0.5 shrink-0" />
                                    <span>הנהג אחראי בלעדית לכל נזק, ישיר או עקיף, שייגרם לנוסע או לרכושו במהלך הנסיעה. לחברה אין יחסי עובד-מעביד עם הנהגים.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle size={16} className="text-green-500 mt-0.5 shrink-0" />
                                    <span>התנהגות לא הולמת, הטרדה או גביית יתר יובילו להרחקה לצמיתות.</span>
                                </li>
                            </ul>
                        </div>
                    </section>

                    <div className="h-px bg-slate-200 mt-8 mb-8"></div>

                    <div className="bg-slate-50 p-6 rounded-2xl text-center">
                        <p className="font-bold text-slate-800 mb-4">
                            תאריך עדכון אחרון: 26/01/2026
                        </p>
                        <p className="text-sm text-slate-500 mb-6">
                            צוות Taxi Express עומד לרשותך בכל שאלה בבוט התמיכה בטלגרם.
                        </p>
                        <div className="flex justify-center flex-wrap gap-4">
                            <button
                                onClick={() => navigate(-1)}
                                className="px-8 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 transition shadow-sm"
                            >
                                <ArrowLeft size={18} /> חזרה אחורה
                            </button>
                            <button
                                onClick={() => navigate('/register-driver')}
                                className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition shadow-lg"
                            >
                                <CheckCircle size={18} /> אני מאשר ורוצה להירשם
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
