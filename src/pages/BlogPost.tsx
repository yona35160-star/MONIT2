import React, { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { SeoMeta } from '../components/SeoMeta';
import { blogArticles } from '../data/blogArticles';
import { ArrowLeft, ArrowRight, User, Calendar, Clock, Share2, CornerUpRight } from 'lucide-react';

export const BlogPost: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const article = blogArticles.find(a => a.slug === slug);

  // Scroll to top on load per UX request
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (!article) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">המאמר לא נמצא</h2>
        <button onClick={() => navigate('/blog')} className="text-yellow-600 font-bold hover:underline">
          חזרה למגזין המוניות
        </button>
      </div>
    );
  }

  // Schema.org logic deeply tuned for Google Article
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.title,
    "description": article.excerpt,
    "image": article.imageUrl,
    "author": {
      "@type": "Person",
      "name": article.author
    },
    "publisher": {
      "@type": "Organization",
      "name": "TAXIPRO",
      "logo": {
        "@type": "ImageObject",
        "url": "https://taxi-pro-il.netlify.app/icons/icon-512.png"
      }
    },
    "datePublished": article.date
  };

  return (
    <div className="min-h-screen bg-slate-50 rtl text-slate-900 pb-20">
      <SeoMeta
        title={article.title}
        description={article.excerpt}
        imageUrl={article.imageUrl}
        type="article"
        schemaData={schema}
      />

      {/* Hero Header */}
      <div className="w-full relative bg-slate-900 border-b-4 border-yellow-400">
        <div className="absolute inset-0 overflow-hidden">
          <img 
            src={article.imageUrl} 
            alt={article.title}
            className="w-full h-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent"></div>
        </div>
        
        <div className="relative z-10 max-w-4xl mx-auto px-4 pt-10 pb-16">
          <Link 
            to="/blog"
            className="inline-flex items-center gap-2 text-slate-300 hover:text-white bg-slate-800/50 px-4 py-2 rounded-full backdrop-blur-md transition-all mb-8 border border-slate-700/50"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">חזרה למגזין</span>
          </Link>
          
          <div className="inline-block bg-yellow-400 text-slate-900 px-3 py-1 rounded-md font-bold text-xs mb-6 shadow-sm">
            {article.category}
          </div>
          
          <h1 className="text-3xl md:text-5xl font-black text-white leading-tight mb-6">
            {article.title}
          </h1>
          
          <div className="flex flex-wrap items-center gap-6 text-sm text-slate-300 font-medium bg-slate-800/40 p-4 rounded-2xl backdrop-blur border border-slate-700/30 w-fit">
            <span className="flex items-center gap-2">
              <User className="w-4 h-4 text-yellow-400" />
              {article.author}
            </span>
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-yellow-400" />
              {new Date(article.date).toLocaleDateString('he-IL')}
            </span>
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-400" />
              {article.readingTimeMin} דק' קריאה
            </span>
          </div>
        </div>
      </div>

      {/* Article Content Area */}
      <div className="max-w-4xl mx-auto px-4 relative z-20">
        <div className="bg-white rounded-[2rem] p-6 md:p-12 shadow-xl border border-slate-100 -mt-8">
          
          <p className="text-xl md:text-2xl text-slate-600 font-light leading-relaxed mb-10 pb-8 border-b border-slate-100 italic">
            {article.excerpt}
          </p>

          <div 
            className="prose prose-slate prose-lg md:prose-xl max-w-none prose-headings:font-bold prose-headings:text-slate-900 prose-p:leading-relaxed prose-p:text-slate-700 prose-a:text-yellow-600 prose-strong:text-slate-900 prose-li:text-slate-700 prose-ul:space-y-2 prose-h2:mt-12 prose-h2:mb-6 prose-h2:pb-2 prose-h2:border-b prose-h2:border-slate-100"
            dangerouslySetInnerHTML={{ __html: article.content }} 
          />
          
          <div className="mt-16 pt-8 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200">
                <span className="text-xl">🚕</span>
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">נכתב על ידי</p>
                <p className="font-bold text-slate-900">{article.author}</p>
              </div>
            </div>

            <button 
              className="w-full md:w-auto flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-xl font-bold transition-colors"
              onClick={() => {
                if(navigator.share) {
                  navigator.share({
                    title: article.title,
                    url: window.location.href
                  });
                }
              }}
            >
              <Share2 className="w-5 h-5" />
              <span>שתף מאמר</span>
            </button>
          </div>
        </div>

        {/* Read more banner */}
        <div className="mt-8 bg-yellow-400 rounded-[2rem] p-8 flex flex-col md:flex-row items-center justify-between text-slate-900 pb-10 shadow-lg relative overflow-hidden">
          <div className="relative z-10 mb-6 md:mb-0">
            <h3 className="text-2xl font-black mb-2">צריכים נסיעה? אל תתבססו על שמועות.</h3>
            <p className="font-medium opacity-90">האפליקציה תמצא עבורכם נהג קרוב ותציג מחיר שקוף לפני.</p>
          </div>
          <button 
            onClick={() => navigate('/')}
            className="w-full md:w-auto relative z-10 flex items-center justify-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-xl font-bold shadow-xl hover:bg-black transition-colors"
          >
            <span>הזמן עכשיו</span>
            <CornerUpRight className="w-5 h-5" />
          </button>
        </div>
        
      </div>
    </div>
  );
};
