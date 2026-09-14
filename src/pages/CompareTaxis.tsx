import React from 'react';
import { SeoMeta } from '../components/SeoMeta';
import { Check, Minus, X, ArrowRight, ShieldCheck, Zap, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const CompareTaxis: React.FC = () => {
  const navigate = useNavigate();

  const comparisonData = [
    {
      feature: "מהירות איסוף (ממוצע)",
      taxipro: "4.5 דקות",
      competitorA: "7-10 דקות (Gett)",
      competitorB: "7-12 דקות (Yango)",
      traditional: "15-25 דקות",
    },
    {
      feature: "שקיפות מחיר (Fix Price)",
      taxipro: "כן מוחלט, לפני הזמנה",
      competitorA: "לרוב מונה בלבד",
      competitorB: "כן, אלגוריתם תנודתי",
      traditional: "לא, מונה",
    },
    {
      feature: "תמריץ קידום קריאה (Bidding)",
      taxipro: "קיים (סליידר דינמי)",
      competitorA: "לא",
      competitorB: "לא",
      traditional: "לא",
    },
    {
      feature: "תשלום למזוודות",
      taxipro: "ללא תוספת מפתיעה",
      competitorA: "תוספת על פי חוק",
      competitorB: "תוספת על פי חוק",
      traditional: "תוספת מזומן לפריט",
    },
    {
      feature: "ממשק לנהג",
      taxipro: "Liquid Swipe נגד טעויות",
      competitorA: "כפתור סטנדרטי",
      competitorB: "כפתור סטנדרטי",
      traditional: "מכשיר קשר דיבורי",
    },
    {
      feature: "אבטחה ופרטי הרכב",
      taxipro: "אימות מיקום SMS בלייב",
      competitorA: "קיים",
      competitorB: "חלקי",
      traditional: "לא מנותר כלל",
    }
  ];

  // Schema.org for a Comparison Page / Article
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "השוואת תחנת מוניות בישראל 2026: TAXIPRO מול השוק",
    "description": "השוואה אובייקטיבית בין חברות התחבורה בישראל ב-2026.",
    "author": {
      "@type": "Organization",
      "name": "TAXIPRO Insights"
    },
    "datePublished": "2026-03-30",
    "publisher": {
      "@type": "Organization",
      "name": "TAXIPRO"
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 rtl text-slate-900 pb-20">
      <SeoMeta
        title="השוואת תחנת מוניות בישראל 2026"
        description="כיצד TAXIPRO מתמודדת מול אפליקציות מוניות מתחרות בשוק הישראלי? השוואה מלאה של זמני הגעה, עמלות, וטכנולוגית הזמנה בשנת 2026."
        schemaData={schema}
      />

      {/* Hero Section */}
      <div className="bg-slate-900 text-white pt-20 pb-16 px-4 shrink-0">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h1 className="text-4xl md:text-5xl font-black text-yellow-500">
            השוואת תחנת מוניות בישראל 2026
          </h1>
          <p className="text-lg md:text-xl text-slate-300 leading-relaxed font-light">
            השוק הישראלי גדוש באפליקציות תחבורה (Gett, Yango וכו') ובתחנות מוניות מסורתיות.
            לקחנו את המדדים החשובים ביותר – מהירות, מחיר וטכנולוגיה – והכנסנו למבחן אובייקטיבי.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 mt-8 md:-mt-10 relative z-10">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
          
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 border-b-2 border-slate-200">
                  <th className="p-5 text-slate-600 font-bold w-1/4">קריטריון</th>
                  <th className="p-5 text-center bg-yellow-50 text-slate-900 border-x-4 border-yellow-400 font-black w-1/4">
                    <span className="bg-yellow-400 text-slate-900 px-3 py-1 rounded-full text-xs font-bold mb-2 inline-block">המערכת שלנו</span>
                    <br />TAXIPRO
                  </th>
                  <th className="p-5 text-center text-slate-500 font-semibold w-1/4">אפליקציות מתחרות</th>
                  <th className="p-5 text-center text-slate-500 font-semibold w-1/4">תחנה טלפונית מסורתית</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comparisonData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-5 font-semibold text-slate-700">{row.feature}</td>
                    
                    {/* TAXIPRO Col */}
                    <td className="p-5 text-center bg-yellow-50/50 border-x-4 border-yellow-400 font-bold text-slate-900">
                      {row.taxipro === "כן מוחלט, לפני הזמנה" || row.taxipro.includes("קיים") || row.taxipro.includes("ללא תוספת") || row.taxipro.includes("Liquid") ? (
                        <div className="flex items-center justify-center gap-2">
                          <Check className="w-5 h-5 text-green-500" />
                          <span>{row.taxipro}</span>
                        </div>
                      ) : (
                        <span className="text-yellow-700">{row.taxipro}</span>
                      )}
                    </td>

                    {/* Competitors Col */}
                    <td className="p-5 text-center text-slate-600">
                      {row.competitorA}
                    </td>

                    {/* Traditional Col */}
                    <td className="p-5 text-center text-slate-500">
                      {row.traditional === "לא" || row.traditional.includes("לא מנותר") ? (
                        <div className="flex items-center justify-center gap-2 text-red-400">
                          <X className="w-4 h-4" />
                          <span>{row.traditional}</span>
                        </div>
                      ) : (
                        row.traditional
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Breakdown Analysis */}
        <div className="grid md:grid-cols-3 gap-8 mt-16">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <Zap className="w-10 h-10 text-yellow-500 mb-4" />
            <h3 className="text-xl font-bold mb-3">מהירות היא שם המשחק</h3>
            <p className="text-slate-600 leading-relaxed">
              האלגוריתם של TAXIPRO פונה באופן בלעדי לנהגים בקרדיוס של עד 3 ק"מ ממוקד ההזמנה. 
              ללא Dispatch (ניתוב) אנושי מעכב, הקריאה מזנקת אל הנהג בתוך סליידר קבלה, מחלקת את זמן ההגעה הפנומנלי של 4 דקות.
            </p>
          </div>
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <DollarSign className="w-10 h-10 text-yellow-500 mb-4" />
            <h3 className="text-xl font-bold mb-3">שקיפות מחירים מול מונה</h3>
            <p className="text-slate-600 leading-relaxed">
              בניגוד לתחנות מסורתיות בהן המחיר נתון לחסדי הפקק, גישת עמק הסיליקון מחשבת זמן-מרחק לפני שהנהג הגיע.
              הנוסע סוגר חוזה מחיר אחיד ויכול אפילו להציע תמריץ כספי באצבעו כדי לעודד נסיעות קצרות.
            </p>
          </div>
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <ShieldCheck className="w-10 h-10 text-yellow-500 mb-4" />
            <h3 className="text-xl font-bold mb-3">מנגנוני אבטחה של 2026</h3>
            <p className="text-slate-600 leading-relaxed">
              בידוד ותיעוד. הכל מתועד בקופסאות השחורות של מסד הנתונים בענן. זהות הנהג מקושרת לרישיון ולמוניטין - ככל שהנהג מקבל ביקורות שליליות, המערכת תסנן אותו החוצה.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 bg-slate-900 rounded-3xl p-10 flex flex-col md:flex-row items-center justify-between text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/10 blur-3xl rounded-full"></div>
          <div className="relative z-10 md:w-2/3">
            <h2 className="text-3xl font-black mb-4">מוכנים לחוות את הדור הבא?</h2>
            <p className="text-slate-300 text-lg">מונית בדרך אליכם תוך מספר דקות - במחיר שאתם קובעים.</p>
          </div>
          <button 
            onClick={() => navigate('/')}
            className="mt-6 md:mt-0 relative z-10 flex items-center gap-3 bg-yellow-500 hover:bg-yellow-400 text-slate-900 px-8 py-4 rounded-2xl font-bold text-lg transition-transform hover:scale-105 active:scale-95"
          >
            הזמן מונית עכשיו
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
