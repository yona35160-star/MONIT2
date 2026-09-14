import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SeoMetaProps {
  title: string;
  description: string;
  canonicalUrl?: string;
  type?: 'website' | 'article' | 'profile';
  imageUrl?: string;
  schemaData?: Record<string, any>;
  keywords?: string;
}

export const SeoMeta: React.FC<SeoMetaProps> = ({
  title,
  description,
  canonicalUrl = typeof window !== 'undefined' ? window.location.href : '',
  type = 'website',
  imageUrl,
  schemaData,
  keywords = "הזמנת מונית, מוניות בישראל, TAXIPRO, מונית לשדה התעופה, מוניות לנתבג, מונית מהירה"
}) => {
  const finalTitle = title.includes('TAXIPRO') ? title : `${title} | TAXIPRO`;
  const defaultImage = "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1200&q=80";
  const ogImg = imageUrl || defaultImage;

  const siteUrl = import.meta.env.VITE_SITE_URL || "https://taxi-pro-il.netlify.app";
  
  // Base structured data (WebSite & WebPage) injected on every page
  const defaultSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        "url": siteUrl,
        "name": "TAXIPRO - הזמנת מוניות",
        "description": "פלטפורמת התחבורה החכמה של ישראל. הזמנת מונית מהירה ובטוחה למגוון יעדים כולל נתב״ג.",
        "inLanguage": "he-IL"
      },
      {
        "@type": "WebPage",
        "@id": `${canonicalUrl}#webpage`,
        "url": canonicalUrl,
        "name": finalTitle,
        "description": description,
        "isPartOf": { "@id": `${siteUrl}/#website` },
        "inLanguage": "he-IL"
      },
      // Insert specific schema passed via props if exists
      ...(schemaData ? [schemaData] : [])
    ]
  };

  return (
    <Helmet>
      {/* Core SEO Meta Tags */}
      <title>{finalTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      {/* Direct AI / Bot instructions for Snippet Previews */}
      <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />

      {/* Open Graph / Facebook / WhatsApp */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={finalTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImg} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="TAXIPRO ישראל" />
      <meta property="og:locale" content="he_IL" />

      {/* Twitter Cards */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonicalUrl} />
      <meta name="twitter:title" content={finalTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImg} />
      <meta name="twitter:creator" content="@TAXIPRO_IL" />

      {/* JSON-LD Schema.org Data */}
      <script type="application/ld+json">
        {JSON.stringify(defaultSchema)}
      </script>
    </Helmet>
  );
};
