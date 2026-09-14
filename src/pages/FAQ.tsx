import React, { useState } from 'react';
import { SeoMeta } from '../components/SeoMeta';
import { faqData } from '../data/faqData';
import { ChevronDown, MessageSquare, PhoneCall } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const navigate = useNavigate();

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  // Structured Data specifically for Google's FAQ rich snippets
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqData.map(item => ({
      "@type": "Question",
      "name": item.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.answer
      }
    }))
  };

  return (
    <div className="min-h-screen bg-slate-50 rtl text-slate-900 pb-20">
      <SeoMeta
        title="שאלות ותשובות נפוצות | TAXIPRO מרכז תמיכה"
        description="יש לכם שאלה בנוגע להזמנת מונית, מחירים, או שירות הלקוחות? קראו את תשובות המומחים שלנו ותקבלו את כל התמיכה הנדרשת."
        schemaData={schema}
      />

      {/* Header */}
      <div className="bg-slate-900 text-white pt-24 pb-16 px-4 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-yellow-500/20 blur-[100px] rounded-full"></div>
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <div className="w-16 h-16 bg-slate-800/80 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-sm border border-slate-700">
            <MessageSquare className="w-8 h-8 text-yellow-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-6">איך נוכל לעזור? 🤔</h1>
          <p className="text-slate-300 text-lg md:text-xl font-light">
            ריכזנו עבורכם את כל השאלות הנפוצות ביותר שעולות משיתופי הפעולה והנוסעים המתמידים שלנו.
          </p>
        </div>
      </div>

      {/* FAQ Accordion */}
      <div className="max-w-3xl mx-auto px-4 -mt-10 relative z-20">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 md:p-10 mb-10">
          <div className="space-y-4">
            {faqData.map((item, index) => {
              const isOpen = openIndex === index;
              return (
                <div 
                  key={index} 
                  className={`border border-slate-200 rounded-2xl overflow-hidden transition-all duration-300 ${isOpen ? 'bg-yellow-50/30 shadow-md ring-2 ring-yellow-400/50' : 'hover:border-slate-300'}`}
                >
                  <button
                    onClick={() => toggleFAQ(index)}
                    className="w-full text-right p-5 flex items-center justify-between focus:outline-none"
                    aria-expanded={isOpen}
                  >
                    <span className="font-bold text-lg pr-2 text-slate-800">
                      {item.question}
                    </span>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${isOpen ? 'bg-yellow-400 text-slate-900 rotate-180' : 'bg-slate-100 text-slate-500'}`}>
                      <ChevronDown className="w-5 h-5" />
                    </div>
                  </button>
                  
                  <div 
                    className={`transition-all duration-500 ease-in-out ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}
                  >
                    <div className="p-5 pt-0 text-slate-600 leading-relaxed font-medium">
                      {item.answer}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Support Section */}
        <div className="bg-slate-900 rounded-[2rem] p-10 flex flex-col items-center text-center text-white relative overflow-hidden shadow-2xl">
          <div className="absolute left-0 bottom-0 w-64 h-64 bg-yellow-500/10 blur-3xl rounded-full"></div>
          <PhoneCall className="w-12 h-12 text-yellow-500 mb-6" />
          <h2 className="text-2xl font-black mb-3">עדיין צריכים עזרה טלפונית?</h2>
          <p className="text-slate-400 mb-8 max-w-md mx-auto">
            מוקד שירות הלקוחות שלנו זמין באפליקציה למענה אנושי מהיר בכל שעות העבודה השוטפת, וכן צ'אט אוטומטי.
          </p>
          <button 
            onClick={() => navigate('/')}
            className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 px-8 py-4 rounded-xl font-bold transition-all hover:scale-105 active:scale-95 shadow-lg shadow-yellow-500/30"
          >
            פתיחת האפליקציה
          </button>
        </div>
      </div>
    </div>
  );
};
