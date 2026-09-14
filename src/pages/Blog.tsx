import React from 'react';
import { SeoMeta } from '../components/SeoMeta';
import { blogArticles } from '../data/blogArticles';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Calendar, User, ChevronLeft } from 'lucide-react';

export const Blog: React.FC = () => {
  const navigate = useNavigate();

  // Basic structured data for blog layout
  const schema = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": "TAXIPRO Insights - מדריכי מוניות ותשתיות",
    "url": window.location.href, // Can be improved with env vars
    "description": "20 מאמרים מקצועיים שילמדו אתכם איך להזמין מונית בשנת 2026.",
    "blogPost": blogArticles.map(article => ({
      "@type": "BlogPosting",
      "headline": article.title,
      "datePublished": article.date,
      "url": `${window.location.origin}/blog/${article.slug}`
    }))
  };

  return (
    <div className="min-h-screen bg-slate-50 rtl text-slate-900 pb-20">
      <SeoMeta
        title="מגזין המוניות של ישראל | TAXIPRO"
        description="20 המאמרים המובילים לקבלת מוניות בשנת 2026. טיפים לתעריפים, הימנעות מעוקץ, הזמנות בזמן אמת לשדה התעופה ועוד."
        schemaData={schema}
      />

      {/* Hero Section */}
      <div className="bg-slate-900 text-white pt-10 pb-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-yellow-500/10 blur-3xl opacity-30 rounded-full w-full h-full mix-blend-screen scale-150 transform -translate-y-1/2"></div>
        <div className="max-w-5xl mx-auto relative z-10">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>חזרה לעמוד הראשי</span>
          </button>
          
          <h1 className="text-4xl md:text-5xl font-black mb-6">מגזין המוניות של ישראל 🚕</h1>
          <p className="text-slate-300 text-lg md:text-xl max-w-2xl font-light leading-relaxed">
            מאמרים עמוקים, צרכנות, סקירות טכנולוגיות על התוספות, היתרונות והמחסומים בדרך ליצירת התניידות עירונית חלקה (Mobility).
          </p>
        </div>
      </div>

      {/* Grid of Articles */}
      <div className="max-w-5xl mx-auto px-4 -mt-10 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {blogArticles.map(article => (
            <Link 
              to={`/blog/${article.slug}`} 
              key={article.id}
              className="group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 flex flex-col"
            >
              <div className="relative h-48 overflow-hidden bg-slate-200">
                <img 
                  src={article.imageUrl} 
                  alt={article.title} 
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute top-4 right-4 bg-yellow-400 text-slate-900 text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                  {article.category}
                </div>
              </div>
              
              <div className="p-6 flex-1 flex flex-col">
                <h2 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-yellow-600 transition-colors line-clamp-2 leading-tight">
                  {article.title}
                </h2>
                <p className="text-slate-600 mb-6 line-clamp-3 leading-relaxed flex-1">
                  {article.excerpt}
                </p>
                
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100/50">
                  <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                    <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(article.date).toLocaleDateString('he-IL')}
                    </span>
                    <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg">
                      <Clock className="w-3.5 h-3.5" />
                      {article.readingTimeMin} דק'
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-yellow-100 group-hover:text-yellow-600 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};
