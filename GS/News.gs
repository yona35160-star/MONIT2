/**
 * News Service
 * Fetches and caches news from Google News RSS feed
 * 
 * Dependencies: None (standalone service)
 */

var NewsService = {
  getTaxiNews: function() {
    try {
      // Check cache first (cache for 1 hour to avoid hitting limits)
      var cache = CacheService.getScriptCache();
      var cachedNews = cache.get('taxi_news_v1');
      
      if (cachedNews) {
        return JSON.parse(cachedNews);
      }
      
      // Google News RSS feed for specific Israeli taxi/transport topics
      var rssUrl = 'https://news.google.com/rss/search?q=%D7%9E%D7%95%D7%A0%D7%99%D7%95%D7%AA+%D7%91%D7%99%D7%A9%D7%A8%D7%90%D7%9C+OR+%D7%9E%D7%97%D7%99%D7%A8%D7%99+%D7%94%D7%93%D7%9C%D7%A7+OR+%D7%9E%D7%97%D7%90%D7%AA+%D7%94%D7%9E%D7%95%D7%A0%D7%99%D7%95%D7%AA&hl=he&gl=IL&ceid=IL:he';
      
      var response = UrlFetchApp.fetch(rssUrl);
      var xml = response.getContentText();
      var document = XmlService.parse(xml);
      var root = document.getRootElement();
      var channel = root.getChild('channel');
      var items = channel.getChildren('item');
      
      var newsItems = [];
      // Get top 6 relevant items
      for (var i = 0; i < Math.min(items.length, 6); i++) {
        var item = items[i];
        var title = item.getChildText('title');
        
        // Remove the source name from title if it exists
        var cleanTitle = title.split(' - ')[0]; 
        var link = item.getChildText('link');
        var pubDate = item.getChildText('pubDate');
        var source = item.getChildText('source') || 'חדשות הרכב';
        
        // Extract basic image from description or use fallback
        var image = NewsService._getImageForArticle(cleanTitle);

        newsItems.push({
          id: i,
          title: cleanTitle,
          link: link,
          date: NewsService._formatDate(pubDate),
          source: source,
          image: image
        });
      }
      
      // Cache the result
      cache.put('taxi_news_v1', JSON.stringify(newsItems), 3600); // 1 hour
      
      return newsItems;
    } catch (e) {
      Logger.log('Error fetching news: ' + e.toString());
      return NewsService._getFallbackNews();
    }
  },
  
  _formatDate: function(dateStr) {
    try {
      var date = new Date(dateStr);
      return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) { return dateStr; }
  },
  
  _getImageForArticle: function(title) {
    var t = title.toLowerCase();
    if (t.includes('דלק') || t.includes('fuel')) return 'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&q=80&w=1000';
    if (t.includes('חשמל') || t.includes('electric')) return 'https://images.unsplash.com/photo-1620803930874-9f4e2f84b360?auto=format&fit=crop&q=80&w=1000';
    if (t.includes('פקק') || t.includes('traffic')) return 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=1000';
    if (t.includes('טכנולוג') || t.includes('app')) return 'https://images.unsplash.com/photo-1554672723-b208dc851349?auto=format&fit=crop&q=80&w=1000';
    return 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&q=80&w=1000';
  },
  
  _getFallbackNews: function() {
    var now = new Date();
    var d1 = new Date(now); d1.setDate(now.getDate() - 1);
    var d2 = new Date(now); d2.setDate(now.getDate() - 3);
    var d3 = new Date(now); d3.setDate(now.getDate() - 7);
    return [
      { id: 1, title: "מחירי הדלק צפויים לרדת בתחילת החודש הבא", link: "https://www.ynet.co.il/wheels", date: Utilities.formatDate(d1, 'Asia/Jerusalem', 'dd/MM/yyyy'), source: "ynet", image: "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&q=80&w=1000" },
      { id: 2, title: "מחאת נהגי המוניות: דורשים סבסוד לרכב חשמלי", link: "https://www.calcalist.co.il", date: Utilities.formatDate(d2, 'Asia/Jerusalem', 'dd/MM/yyyy'), source: "כלכליסט", image: "https://images.unsplash.com/photo-1620803930874-9f4e2f84b360?auto=format&fit=crop&q=80&w=1000" },
      { id: 3, title: "מהפכה בכבישים: נתיבים חדשים לתחבורה ציבורית בגוש דן", link: "https://cars.walla.co.il", date: Utilities.formatDate(d3, 'Asia/Jerusalem', 'dd/MM/yyyy'), source: "וואלה! רכב", image: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=1000" }
    ];
  }
};

// Helper to clear news cache from Apps Script editor
function clearNewsCache() {
  try {
    CacheService.getScriptCache().remove('taxi_news_v1');
    Logger.log('News cache cleared successfully');
    return 'Cache cleared';
  } catch (e) {
    Logger.log('Error clearing cache: ' + e.toString());
    return 'Error: ' + e.toString();
  }
}
